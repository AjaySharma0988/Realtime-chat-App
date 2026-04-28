import User from "../models/user.model.js";
import Message from "../models/message.model.js";
import cloudinary from "../lib/cloudinary.js";
import { getReceiverSocketId, io } from "../lib/socket.js";
import { filterUserPrivacy } from "../lib/privacy.js";

export const getUsersForSidebar = async (req, res) => {
  try {
    const loggedInUserId = req.user._id;

    const usersWithStats = await User.aggregate([
      { $match: { _id: { $ne: loggedInUserId } } },
      {
        $lookup: {
          from: "messages",
          let: { oId: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $or: [
                    { $and: [{ $eq: ["$senderId", loggedInUserId] }, { $eq: ["$receiverId", "$$oId"] }] },
                    { $and: [{ $eq: ["$senderId", "$$oId"] }, { $eq: ["$receiverId", loggedInUserId] }] }
                  ]
                }
              }
            },
            { $sort: { createdAt: -1 } }
          ],
          as: "messages"
        }
      },
      {
        $addFields: {
          lastMessage: { $arrayElemAt: ["$messages", 0] },
          unreadCount: {
            $size: {
              $filter: {
                input: "$messages",
                as: "m",
                cond: { $and: [{ $eq: ["$$m.receiverId", loggedInUserId] }, { $ne: ["$$m.status", "seen"] }] }
              }
            }
          }
        }
      },
      {
        $project: {
          password: 0,
          messages: 0 // omit huge message arrays
        }
      },
      // Sort by last message so recent chats are at the top, then alphabetically
      { $sort: { "lastMessage.createdAt": -1, fullName: 1 } }
    ]);

    // Apply privacy filters
    const filteredUsers = usersWithStats.map(u => filterUserPrivacy(loggedInUserId, u));

    res.status(200).json(filteredUsers);
  } catch (error) {
    console.error("Error in getUsersForSidebar:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

// ── GET: Fetch messages with cursor-based pagination ─────────
export const getMessages = async (req, res) => {
  try {
    const { id: userToChatId } = req.params;
    const { limit = 10, before } = req.query;
    const myId = req.user._id;

    const query = {
      $or: [
        { senderId: myId, receiverId: userToChatId },
        { senderId: userToChatId, receiverId: myId },
      ],
      deletedFor: { $ne: myId }
    };

    // Cursor-based pagination: fetch messages older than the 'before' ID
    if (before) {
      query._id = { $lt: before };
    }

    const messages = await Message.find(query)
      .sort({ _id: -1 }) // Get latest first using ID
      .limit(parseInt(limit));

    // Reverse to return in chronological order (oldest -> newest)
    res.status(200).json(messages.reverse());
  } catch (error) {
    console.log("Error in getMessages:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

// ── POST: Send a text/image/audio/call-log message ────────────────────────
export const sendMessage = async (req, res) => {
  try {
    const {
      text, image, audio,
      replyTo,              // embedded object { messageId, text, senderName, image }
      statusRef,            // { statusId, mediaUrl, mediaType, caption }
      type = "text",        // "text" | "call" | "status-reply"
      callType,             // "audio" | "video"
      callStatus,           // "completed" | "missed" | "rejected"
      callDuration = 0,
    } = req.body;
    const { id: receiverId } = req.params;
    const senderId = req.user._id;

    console.log("[Message] Sending:", { type, hasStatus: !!statusRef, text: text?.slice(0, 20) });

    let imageUrl;
    if (image) {
      // Validate base64 image: only safe MIME types, max ~8 MB base64
      if (!/^data:image\/(png|jpeg|jpg|webp|gif);base64,/.test(image)) {
        return res.status(400).json({ error: "Invalid image format" });
      }
      if (image.length > 11 * 1024 * 1024) { // ~8 MB in base64 ≈ 11M chars
        return res.status(413).json({ error: "Image too large (max 8 MB)" });
      }
      const uploadResponse = await cloudinary.uploader.upload(image);
      imageUrl = uploadResponse.secure_url;
    }

    let audioUrl;
    if (audio) {
      // Validate base64 audio: only safe MIME types, max ~5 MB base64
      if (!/^data:audio\/(webm|ogg|mpeg|mp4|wav);base64,/.test(audio)) {
        return res.status(400).json({ error: "Invalid audio format" });
      }
      if (audio.length > 7 * 1024 * 1024) { // ~5 MB in base64 ≈ 7M chars
        return res.status(413).json({ error: "Audio too large (max 5 MB)" });
      }
      const uploadResponse = await cloudinary.uploader.upload(audio, {
        resource_type: "video",
        folder: "chat-audio",
      });
      audioUrl = uploadResponse.secure_url;
    }

    const newMessage = new Message({
      senderId,
      receiverId,
      text,
      image: imageUrl,
      audio: audioUrl,
      replyTo: replyTo || null,      // snapshot already built on frontend
      statusRef: statusRef || null,
      type,
      callType: callType || null,
      callStatus: callStatus || null,
      callDuration: callDuration || 0,
    });

    await newMessage.save();

    const receiverSocketId = getReceiverSocketId(receiverId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("newMessage", newMessage);
    }

    res.status(201).json(newMessage);
  } catch (error) {
    console.log("Error in sendMessage:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

// ── DELETE: Remove entire conversation FOR CURRENT USER ────────────────────
export const deleteMessages = async (req, res) => {
  try {
    const { id: otherUserId } = req.params;
    const myId = req.user._id;

    const result = await Message.updateMany({
      $or: [
        { senderId: myId, receiverId: otherUserId },
        { senderId: otherUserId, receiverId: myId },
      ],
    }, { $addToSet: { deletedFor: myId } });

    res.status(200).json({ message: "Chat deleted exclusively for you", count: result.modifiedCount });
  } catch (error) {
    console.log("Error in deleteMessages:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

// ── DELETE /bulk: Remove selected messages ────────────────────────────────
export const bulkDeleteMessages = async (req, res) => {
  try {
    const { messageIds, receiverId, deleteForEveryone } = req.body;
    const myId = req.user._id;

    if (!Array.isArray(messageIds) || messageIds.length === 0) {
      return res.status(400).json({ error: "No message IDs provided" });
    }
    if (messageIds.length > 200) {
      return res.status(400).json({ error: "Too many message IDs (max 200)" });
    }

    if (deleteForEveryone) {
      await Message.updateMany(
        { _id: { $in: messageIds }, senderId: myId },
        { $set: { isDeletedForEveryone: true, text: "This message was deleted", image: null, audio: null, replyTo: null } }
      );

      if (receiverId) {
        const receiverSocketId = getReceiverSocketId(receiverId);
        if (receiverSocketId) {
          io.to(receiverSocketId).emit("messagesDeletedForEveryone", { messageIds });
        }
      }
    } else {
      await Message.updateMany(
        { _id: { $in: messageIds }, $or: [{ senderId: myId }, { receiverId: myId }] },
        { $addToSet: { deletedFor: myId } }
      );
    }

    res.status(200).json({ success: true, count: messageIds.length });
  } catch (error) {
    console.log("Error in bulkDeleteMessages:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

// ── PUT /:id: Edit a message text ─────────────────────────────────────────
export const editMessage = async (req, res) => {
  try {
    const { id: messageId } = req.params;
    const { text } = req.body;
    const myId = req.user._id;

    if (!text || !text.trim()) {
      return res.status(400).json({ error: "Text cannot be empty" });
    }
    if (text.length > 5000) {
      return res.status(400).json({ error: "Message too long (max 5000 characters)" });
    }

    const message = await Message.findById(messageId);
    if (!message) return res.status(404).json({ error: "Message not found" });
    if (message.senderId.toString() !== myId.toString()) {
      return res.status(403).json({ error: "You can only edit your own messages" });
    }

    message.text = text.trim();
    message.isEdited = true;
    await message.save();

    // Real-time: update message in receiver's UI instantly
    const receiverSocketId = getReceiverSocketId(message.receiverId.toString());
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("messageEdited", message);
    }

    res.status(200).json(message);
  } catch (error) {
    console.log("Error in editMessage:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

// ── POST /:id/react: Toggle emoji reaction ────────────────────────────────
export const reactToMessage = async (req, res) => {
  try {
    const { id: messageId } = req.params;
    const { emoji } = req.body;
    const myId = req.user._id.toString();

    if (!emoji || typeof emoji !== "string" || emoji.length === 0 || emoji.length > 10) {
      return res.status(400).json({ error: "Invalid emoji" });
    }

    const message = await Message.findById(messageId);
    if (!message) return res.status(404).json({ error: "Message not found" });

    const existingIdx = message.reactions.findIndex(
      (r) => r.userId.toString() === myId
    );

    if (existingIdx !== -1) {
      if (message.reactions[existingIdx].emoji === emoji) {
        // Same emoji → remove (toggle off)
        message.reactions.splice(existingIdx, 1);
      } else {
        // Different emoji → replace
        message.reactions[existingIdx].emoji = emoji;
      }
    } else {
      // New reaction
      message.reactions.push({ userId: myId, emoji });
    }

    await message.save();

    // Notify BOTH parties in real-time
    const peerId = message.senderId.toString() === myId
      ? message.receiverId.toString()
      : message.senderId.toString();

    const peerSocketId = getReceiverSocketId(peerId);
    const mySocketId = getReceiverSocketId(myId);

    const payload = { messageId, reactions: message.reactions };
    if (peerSocketId) io.to(peerSocketId).emit("messageReacted", payload);
    if (mySocketId) io.to(mySocketId).emit("messageReacted", payload);

    res.status(200).json({ reactions: message.reactions });
  } catch (error) {
    console.log("Error in reactToMessage:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const markMessagesAsRead = async (req, res) => {
  try {
    const { id: senderId } = req.params;
    const receiverId = req.user._id;

    // Update all messages where I am the receiver, the specified person is sender, and status != seen
    await Message.updateMany(
      { senderId, receiverId, status: { $ne: "seen" } },
      { $set: { status: "seen" } }
    );

    // Notify the sender that their messages were read
    const senderSocketId = getReceiverSocketId(senderId);
    if (senderSocketId) {
      io.to(senderSocketId).emit("messagesSeen", { receiverId });
    }

    res.status(200).json({ success: true });
  } catch (error) {
    console.error("Error in markMessagesAsRead:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const uploadVideo = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No video file uploaded" });
    }

    console.log("[Cloudinary] Streaming video upload...");

    const uploadStream = cloudinary.uploader.upload_stream(
      {
        resource_type: "video",
        folder: "watch-party-videos",
      },
      (error, result) => {
        if (error) {
          console.error("[Cloudinary] Stream error:", error);
          return res.status(500).json({ error: "Failed to upload to Cloudinary" });
        }
        console.log("[Cloudinary] Upload success:", result.secure_url);
        res.status(200).json({ secure_url: result.secure_url });
      }
    );

    // Write buffer to stream
    uploadStream.end(req.file.buffer);
  } catch (error) {
    console.error("Error in uploadVideo:", error.message);
    res.status(500).json({ error: "Failed to upload video" });
  }
};

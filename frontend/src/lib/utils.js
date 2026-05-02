export function formatMessageTime(date) {
  return new Date(date).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

/**
 * Returns a timestamped profile picture URL for cache busting,
 * or a default avatar if the URL is missing.
 */
export function getProfilePicUrl(user) {
  if (!user || !user.profilePic) return "/avatar.png";
  
  // Use updatedAt if available, otherwise just use current time 
  // to ensure we always try to get the freshest data after a reload/sync.
  const ts = user.updatedAt ? new Date(user.updatedAt).getTime() : Date.now();
  
  // Avoid double question marks if the URL already has params
  const separator = user.profilePic.includes("?") ? "&" : "?";
  return `${user.profilePic}${separator}t=${ts}`;
}

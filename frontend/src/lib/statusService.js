import { axiosInstance } from "./axios.js";

// ── Fetch all active (non-expired) statuses ──────────────────────────────
export const fetchStatuses = async () => {
  try {
    const res = await axiosInstance.get("/status");
    return res.data;
  } catch (error) {
    console.error("[StatusService] fetchStatuses:", error.message);
    return [];
  }
};

// ── Upload a new status (image or video, as base64) ───────────────────────
export const uploadStatus = async ({ media, mediaType, caption, music, expiryDuration, audience }) => {
  const res = await axiosInstance.post("/status", { 
    media, 
    mediaType, 
    caption, 
    music, 
    expiryDuration, 
    audience 
  });
  return res.data;
};

// ── Mark a status as viewed (fire-and-forget is fine) ────────────────────
export const markStatusViewed = async (statusId) => {
  try {
    await axiosInstance.post(`/status/${statusId}/view`);
  } catch (error) {
    console.error("[StatusService] markStatusViewed:", error.message);
  }
};

// ── Delete own status ─────────────────────────────────────────────────────
export const deleteStatusById = async (statusId) => {
  const res = await axiosInstance.delete(`/status/${statusId}`);
  return res.data;
};

// ── Get populated viewers list (owner only) ───────────────────────────────
export const getStatusViewers = async (statusId) => {
  const res = await axiosInstance.get(`/status/${statusId}/viewers`);
  return res.data;
};

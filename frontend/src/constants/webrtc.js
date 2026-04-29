/**
 * ICE / STUN / TURN configuration — centralized for all RTCPeerConnections.
 *
 * TURN is REQUIRED for calls across different networks (WiFi ↔ Mobile data).
 * Without TURN, WebRTC only works on the same local network (STUN only).
 *
 * Dynamic credentials are fetched from the backend before every call.
 * This prevents the #1 cause of 60-second call drops: TURN credential expiry.
 *
 * 🔴 FOR PRODUCTION: Configure TURN_SECRET in backend .env and point the
 *    TURN URLs to your own coturn server or a paid provider.
 */

// ── Static STUN servers (always needed, no auth required) ──────────────────
const STUN_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:stun.cloudflare.com:3478" },
];

// ── Static fallback TURN (used only if backend fetch fails) ────────────────
// Kept as last-resort; free providers cap sessions at ~60 s.
const STATIC_TURN_FALLBACK = [
  {
    urls: [
      "turn:openrelay.metered.ca:80",
      "turn:openrelay.metered.ca:80?transport=tcp",
      "turns:openrelay.metered.ca:443?transport=tcp",
    ],
    username: "openrelayproject",
    credential: "openrelayproject",
  },
  {
    urls: [
      "turn:a.relay.metered.ca:80",
      "turn:a.relay.metered.ca:80?transport=tcp",
      "turns:a.relay.metered.ca:443?transport=tcp",
    ],
    username: "e8dd65f5654e3c3a3a2b7f83",
    credential: "uU2OoFQBwcuW0xV7",
  },
];

/**
 * Fetch fresh TURN credentials from the backend before starting a call.
 *
 * The backend generates HMAC-SHA1 signed credentials with a 1-hour TTL,
 * which is the standard coturn "time-limited credentials" mechanism.
 *
 * Returns a full RTCConfiguration object ready for new RTCPeerConnection().
 */
export const fetchIceServers = async () => {
  try {
    const { axiosInstance } = await import("../lib/axios");
    const { data } = await axiosInstance.get("/calls/turn-credentials");

    // data = { username: <unix-ts+3600>, password: <hmac-b64>, ttl: 3600 }
    const dynamicTurn = {
      urls: [
        "turn:openrelay.metered.ca:80",
        "turn:openrelay.metered.ca:80?transport=tcp",
        "turns:openrelay.metered.ca:443?transport=tcp",
      ],
      username: String(data.username),
      credential: data.password,
    };

    console.log("[WebRTC] Dynamic TURN credentials fetched — TTL:", data.ttl, "s");

    return {
      iceServers: [...STUN_SERVERS, dynamicTurn],
      iceTransportPolicy: "all",
      bundlePolicy: "max-bundle",
      rtcpMuxPolicy: "require",
      iceCandidatePoolSize: 0,
    };
  } catch (err) {
    console.warn("[WebRTC] Failed to fetch TURN credentials, using static fallback:", err.message);
    return ICE_SERVERS; // static fallback
  }
};

/**
 * Static ICE config — used as fallback if fetchIceServers() fails,
 * and for any code that hasn't migrated to the dynamic credentials yet.
 */
export const ICE_SERVERS = {
  iceServers: [...STUN_SERVERS, ...STATIC_TURN_FALLBACK],
  iceTransportPolicy: "all",
  bundlePolicy: "max-bundle",
  rtcpMuxPolicy: "require",
  iceCandidatePoolSize: 0,
};

/**
 * TURN-only config — use this temporarily to verify your TURN server works.
 * If calls connect with this config but fail with ICE_SERVERS, TURN is broken.
 *
 * Usage:  const pc = new RTCPeerConnection(ICE_SERVERS_RELAY_ONLY);
 */
export const ICE_SERVERS_RELAY_ONLY = {
  ...ICE_SERVERS,
  iceTransportPolicy: "relay",
};

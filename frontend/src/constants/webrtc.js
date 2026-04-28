/**
 * ICE / STUN / TURN configuration — centralized for all RTCPeerConnections.
 *
 * TURN is REQUIRED for calls across different networks (WiFi ↔ Mobile data).
 * Without TURN, WebRTC only works on the same local network (STUN only).
 *
 * Multiple providers are listed for redundancy. The browser will try them
 * in parallel and use whichever responds fastest.
 *
 * 🔴 FOR PRODUCTION: Replace with your own TURN server credentials.
 *    Free providers (openrelay, metered.ca) are heavily throttled and unreliable.
 *    Recommended: Twilio TURN, Metered.ca paid, or self-hosted coturn.
 */
export const ICE_SERVERS = {
  iceServers: [
    // ── Google STUN (fast, works on same-network calls) ──────────────────────
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },

    // ── Cloudflare STUN ──────────────────────────────────────────────────────
    { urls: "stun:stun.cloudflare.com:3478" },

    // ── OpenRelay TURN — Provider 1 (UDP + TCP + TLS) ────────────────────────
    // Required for symmetric NAT (mobile networks, corporate firewalls)
    {
      urls: [
        "turn:openrelay.metered.ca:80",
        "turn:openrelay.metered.ca:80?transport=tcp",
        "turns:openrelay.metered.ca:443?transport=tcp",
      ],
      username: "openrelayproject",
      credential: "openrelayproject",
    },

    // ── Metered.ca TURN — Provider 2 (alternative UDP path) ─────────────────
    // Separate credentials increase the chance one works on mobile
    {
      urls: [
        "turn:a.relay.metered.ca:80",
        "turn:a.relay.metered.ca:80?transport=tcp",
        "turns:a.relay.metered.ca:443?transport=tcp",
      ],
      username: "e8dd65f5654e3c3a3a2b7f83",
      credential: "uU2OoFQBwcuW0xV7",
    },
  ],

  // ── Connection policy ────────────────────────────────────────────────────
  // "all" = try direct P2P first (STUN), fall back to TURN relay.
  // Set to "relay" temporarily to verify TURN is working when debugging.
  iceTransportPolicy: "all",

  // ── Bundle all media into one transport (reduces port usage) ────────────
  bundlePolicy: "max-bundle",
  rtcpMuxPolicy: "require",

  // ── Do NOT pre-gather candidates (iceCandidatePoolSize: 0) ───────────────
  // Pre-gathering before the offer is created causes candidate mismatches
  // on mobile networks where the IP changes during setup.
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

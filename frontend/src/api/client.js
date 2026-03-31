/**
 * api/client.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Thin HTTP + WebSocket client for the NETAnalyzer FastAPI backend.
 *
 * DEV  mode  (npm run dev)  → API runs on localhost:8000, frontend on :5173.
 * PROD mode  (npm run build + served by FastAPI's StaticFiles)
 *            → frontend and API share the same origin; use relative URLs.
 *
 * Set VITE_API_URL in a .env file to override both modes, e.g.:
 *   VITE_API_URL=http://192.168.1.10:8000
 * ─────────────────────────────────────────────────────────────────────────────
 */

// In PROD the frontend is served by FastAPI at the same origin, so we can use
// empty-string base URLs (relative paths).  In DEV Vite's dev-server runs on a
// different port, so we need the explicit localhost address.
const _default = import.meta.env.DEV ? 'http://localhost:8000' : '';

/** Base URL for REST calls.  Override with VITE_API_URL env var. */
const API = "http://localhost:8000";

/** Base URL for WebSocket connections (mirrors API, swaps protocol). */
const WS  = API.replace('http', 'ws');

// ─── Sessions ─────────────────────────────────────────────────────────────────

/** Fetch all sessions ordered by creation time. */
async function fetchSessions() {
    const res= await fetch(`${API}/sessions/`);
    if (!res.ok) throw new Error(`fetchSessions: ${res.status}`);
    return res.json();
}

/** Create a new session.  Returns `{ session_id, name }`. */
async function createSession(name) {
    const res = await fetch(`${API}/sessions/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
    })
    if (!res.ok) throw new Error(`createSession: ${res.status}`);
    return res.json();
}

/** Permanently delete a session and all its associated data. */
async function deleteSession(sessionId) {
    const res = await fetch(`${API}/sessions/${sessionId}`, { method: 'DELETE' });
    if (!res.ok) throw new Error(`deleteSession: ${res.status}`);
}

// ─── Capture ──────────────────────────────────────────────────────────────────

/** Start packet capture for the given session. */
async function startCapture(sessionId) {
    const res = await fetch(`${API}/capture/`, { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ session_id: sessionId }),
    });
    if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.detail ?? `startCapture: ${res.status}`);
    }
    return res.json();
}

/** Stop the currently-running packet capture. */
async function stopCapture() {
    const res = await fetch(`${API}/capture/`, { method: 'DELETE'});
    if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.detail ?? `stopCapture: ${res.status}`);
    }
    return res.json()
}

/** Poll whether a capture is currently active.  Returns `{ active_session }`. */
async function fetchCaptureStatus() {
    const res = await fetch(`${API}/capture/`);
    if (!res.ok) throw new Error(`fetchCaptureStatus: ${res.status}`);
    return res.json();
}

// ─── Stats / Packets ──────────────────────────────────────────────────────────

/**
 * Fetch aggregated dashboard stats for a session.
 * @param {number} sessionId
 * @param {number} [limit=18]  How many recent packets to include in the feed.
 */
async function fetchStats(sessionId, limit = 18) {
    const res = await fetch(`${API}/sessions/${sessionId}/stats?limit=${limit}`);
    if (!res.ok) throw new Error(`fetchStats: ${res.status}`);
    return res.json();
}

/**
 * Fetch every packet for a session (used by the PacketSearch modal).
 * Returns packets in ascending timestamp order.
 */
async function fetchAllPackets(sessionId) {
    const res = await fetch(`${API}/sessions/${sessionId}/packets?order=asc`);
    if (!res.ok) throw new Error(`fetchAllPackets: ${res.status}`);
    return res.json();
}

/**
 * Trigger a browser download of session packets.
 * @param {number} sessionId
 * @param {'csv'|'excel'} format
 */
async function exportSession(sessionId, format) {
    // Opens in a new tab; the response's Content-Disposition triggers the download.
    window.open(`${API}/sessions/${sessionId}/packets/export?format=${format}`, '_blank');
}

// ─── Network topology ─────────────────────────────────────────────────────────

/**
 * Fetch the network device map.
 *
 * - Without `sessionId` → returns the live in-memory device state (updated
 *   while capture is running).
 * - With    `sessionId` → returns the persisted DB snapshot saved when capture
 *   was stopped for that session.
 *
 * Shape: `{ subnet, source: 'live'|'snapshot'|'empty', nodes: [...] }`
 */
async function fetchTopology(sessionId = null) {
    const url = sessionId 
    ? `${API}/sessions/${sessionId}/devices` 
    : `${API}/network/devices`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`fetchTopology: ${res.status}`);
    return res.json();
}

/**
 * Trigger an active ARP scan of the local subnet (~2 s blocking on the
 * backend).  Returns `{ subnet, nodes_found, nodes }`.
 */
async function triggerScan() {
    const res = await fetch(`${API}/network/scan`, { method: 'POST' });
    if (!res.ok) throw new Error(`triggerScan: ${res.status}`);
    return res.json();
}

// ─── Alerts ───────────────────────────────────────────────────────────────────

/** Fetch all anomaly-detection alerts for a session, newest first. */
async function fetchAlerts(sessionId = null) {
    const res = await fetch(`${API}/sessions/${sessionId}/alerts`);
    if (!res.ok) throw new Error(`fetchAlerts: ${res.status}`);
    return res.json();
}

// ─── WebSocket live feed ──────────────────────────────────────────────────────

/**
 * Open a WebSocket that streams `{ stats, topology, alerts }` once per second.
 *
 * @param {number}   sessionId  Session to subscribe to.
 * @param {Function} onData     Called with each parsed message.
 * @returns {Function}          Call to close the socket and stop the stream.
 */
function subscribeToStats(sessionId, onData) {
    const ws = new WebSocket(`${WS}/sessions/${sessionId}/live`);

    ws.onopen = () => console.log('[WS] connected');
    ws.onmessage = (e) => onData(JSON.parse(e.data));
    ws.onerror = (err) => { console.error('[WS] error', err); ws.close(); };
    ws.onclose = () => console.log('[WS] closed');

    // Return a cleanup function so callers can close gracefully.
    return () => ws.close();
}

// ─── AI analysis ──────────────────────────────────────────────────────────────

/**
 * Check whether the backend has a Gemini API key configured in its
 * environment (so the frontend knows whether to prompt the user for one).
 * Returns `{ configured: boolean }`.
 */
async function fetchAiStatus() {
  const res = await fetch(`${API}/ai/status`);
  if (!res.ok) throw new Error(`fetchAiStatus: ${res.status}`);
  return res.json(); 
}

/**
 * Ask Gemini to summarise an entire capture session.
 *
 * Builds a concise prompt from the live stats/alerts objects so the backend
 * doesn't need to re-query the DB.
 *
 * @param {object}      stats    Dashboard stats object.
 * @param {object[]}    alerts   Alert list for the session.
 * @param {string|null} apiKey   User-provided key; null = use backend env key.
 */
async function analyzeSession(stats, alerts, apiKey = null) {
  const proto = (stats?.protocol_breakdown ?? [])
    .map(p => `${p.protocol}: ${p.total}`)
    .join(', ');

  const topIps = (stats?.top_10_ips ?? [])
    .slice(0, 5)
    .map(ip => `${ip.ip} (${ip.total} pkts)`)
    .join(', ');

  const ppm = stats?.packets_per_minute ?? [];
  const peak = ppm.length ? Math.max(...ppm.map(p => p.total)) : 0;

  const alertsSummary = alerts.length === 0
    ? 'No anomalies detected.'
    : alerts.slice(0, 5)
        .map(a => `[${a.severity.toUpperCase()}] ${a.rule_triggered}: ${a.description}`)
        .join('\n');

  const res = await fetch(`${API}/ai/analyze/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key:              apiKey,   // null = backend uses env key
      total_packets:        stats?.total_packets ?? 0,
      avg_packet_size:      stats?.average_packet_size ?? null,
      active_hosts:         stats?.active_hosts ?? 0,
      peak_packets_per_min: peak,
      protocol_breakdown:   proto,
      top_ips:              topIps,
      alert_count:          alerts.length,
      alerts_summary:       alertsSummary,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.detail ?? `Server error ${res.status}`);
  }
  return (await res.json()).result;
}

/**
 * Ask Gemini to explain a single anomaly alert.
 *
 * @param {object}      alert   Alert object from the alerts list.
 * @param {string|null} apiKey  User-provided key; null = use backend env key.
 */
async function analyzeAlert(alert, apiKey = null) {
  const res = await fetch(`${API}/ai/analyze/alert`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key:     apiKey,           
      rule:        alert.rule_triggered,
      severity:    alert.severity,
      src_ip:      alert.src_ip,
      dst_ip:      alert.dst_ip,
      description: alert.description,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.detail ?? `Server error ${res.status}`);
  }
  return (await res.json()).result;
}

export { 
    fetchSessions, 
    createSession, 
    deleteSession,
    startCapture, 
    stopCapture, 
    fetchCaptureStatus, 
    fetchStats, 
    fetchAllPackets, 
    exportSession, 
    fetchTopology,
    triggerScan,
    subscribeToStats,
    fetchAlerts,
    fetchAiStatus,
    analyzeSession,
    analyzeAlert,
 };
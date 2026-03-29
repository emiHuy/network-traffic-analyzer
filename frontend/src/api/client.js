const API = "http://localhost:8000";
const WS  = API.replace('http', 'ws');

async function fetchSessions() {
    const res= await fetch(`${API}/sessions/`);
    return res.json();
}

async function createSession(name) {
    const res = await fetch(`${API}/sessions/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
    })
    return res.json(); // { session_id, name }
}

async function deleteSession(sessionId) {
    const res = await fetch(`${API}/sessions/${sessionId}`, { method: 'DELETE' });
    if (!res.ok) throw new Error(`${res.status}`);
}

async function startCapture(sessionId) {
    const res = await fetch(`${API}/capture/`, { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ session_id: sessionId }),
    });
    return res.json();
}

async function stopCapture() {
    const res = await fetch(`${API}/capture/`, { method: 'DELETE'});
    return res.json()
}

async function fetchCaptureStatus() {
    const res = await fetch(`${API}/capture/`);
    return res.json();
}

async function fetchStats(sessionId, limit = 18) {
    const res = await fetch(`${API}/sessions/${sessionId}/stats?limit=${limit}`);
    return res.json();
}

async function fetchAllPackets(sessionId) {
    const res = await fetch(`${API}/sessions/${sessionId}/packets?order=asc`);
    return res.json();
}

async function exportSession(sessionId, format) {
    window.open(`${API}/sessions/${sessionId}/packets/export?format=${format}`, '_blank');
}

async function fetchTopology(sessionId = null) {
    // Without sessionId: returns current in-memory state (live or post-capture)
    // With sessionId:    returns persisted DB snapshot for that session
    // Returns { subnet, source: 'live'|'snapshot', nodes: [...] }
    const url = sessionId ? `${API}/sessions/${sessionId}/devices` : `${API}/network/devices`;
    const res = await fetch(url);
    return res.json();
}

async function triggerScan() {
    // Triggers active ARP scan on the backend (~2s blocking)
    // Returns { subnet, nodes_found, nodes }
    const res = await fetch(`${API}/network/scan`, { method: 'POST' });
    return res.json();
}

async function fetchAlerts(sessionId = null) {
    const res = await fetch(`${API}/sessions/${sessionId}/alerts`);
    return res.json();
}

// Web Socket connection
function subscribeToStats(sessionId, onData) {
    const ws = new WebSocket(`${WS}/sessions/${sessionId}/live`);

    ws.onopen = () => console.log("WS connected");

    ws.onmessage = (e) => {
        const parsed = JSON.parse(e.data);
        console.log("WS message:", parsed);
        onData(parsed);
    };

    ws.onerror = (err) => {
        console.error("WS error", err);
        ws.close();
    };

    ws.onclose = () => console.log("WS closed");

    return () => ws.close();
}

async function fetchAiStatus() {
  const res = await fetch(`${API}/ai/status`);
  if (!res.ok) throw new Error(`Server error ${res.status}`);
  return res.json(); // { configured: bool }
}

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

async function analyzeAlert(alert, apiKey = null) {
  const res = await fetch(`${API}/ai/analyze/alert`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key:     apiKey,           // null = backend uses env key
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
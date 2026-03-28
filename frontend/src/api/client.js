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
    return res.json();
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
    if (!sessionId) return;
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
 };
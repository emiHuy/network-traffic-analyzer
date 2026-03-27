import { useState, useRef, useEffect } from 'react';

import { 
  startCapture, 
  stopCapture,
  subscribeToStats, 
  fetchSessions, 
  createSession, 
  deleteSession, 
  fetchStats, 
  fetchAllPackets,
  exportSession,
  fetchTopology,
  triggerScan,
  fetchAlerts
} from './api/client.js';

import TopBar       from './components/TopBar.jsx';
import SessionBar   from './components/SessionBar.jsx';
import NavBar       from './components/NavBar.jsx';
import Dashboard    from './components/Dashboard.jsx';
import NetworkGraph from './components/NetworkGraph.jsx';

import styles from './styles/App.module.css'
import AlertsPanel from './components/AlertsPanel.jsx';

function App() {

  // ── Navigation ────────────────────────────────────────────────────────────
  const [activeView, setActiveView] = useState('dashboard');

  // ── Sessions ──────────────────────────────────────────────────────────────
  const [sessions, setSessions] = useState([]);      
  const [sessionId, setSessionId] = useState(null);  
  const [stats, setStats] = useState(null);         
  const [error, setError] = useState(null);

  // ── Capture ───────────────────────────────────────────────────────────────
  const [capturing, setCapturing] = useState(false);
  const wsCleanup = useRef(null);        

  // ── Topology ──────────────────────────────────────────────────────────────
  const [topology, setTopology] = useState({ nodes: [] });
  const [scanning, setScanning] = useState(false);
  const lastScanTime = useRef(null);
  const [lastScanDisplay, setLastScanDisplay] = useState(null); // state copy so label re-renders

  // ── Alerts ────────────────────────────────────────────────────────────────
  const [alerts, setAlerts] = useState([]);

  const sessionHasData = sessions.find(s => s.id === sessionId)?.packet_count > 0;

  // ── Initial load ──────────────────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      setSessions(await fetchSessions());
    }
    load();
  }, []);

  // WebSocket cleanup on unmount
  useEffect(() => {
    return () => {
      if (wsCleanup.current) {
        wsCleanup.current();
        wsCleanup.current = null;
      }
    };
  }, []);

  // ── Scan ──────────────────────────────────────────────────────────────────
  async function onScan() {
      setScanning(true);
      try {
          const result = await triggerScan();
          setTopology({ nodes: result.nodes });
          lastScanTime.current = Date.now();
          setLastScanDisplay(Date.now()); // state update triggers re-render so label updates
      } finally {
          setScanning(false);
      }
  }

  // ── Capture ───────────────────────────────────────────────────────────────
  async function onStart() {
    const twoHours = 2 * 60 * 60 * 1000;
    const scanAge  = lastScanTime.current
        ? Date.now() - lastScanTime.current
        : null;

    if (!lastScanTime.current) {
        // no scan data — silent auto-scan first
        await onScan();
    } else if (scanAge > twoHours) {
        // stale data — ask user
        const rescan = window.confirm(
            'Scan data is over 2 hours old. Rescan before capturing?'
        );
        if (rescan) await onScan();
    }

    await startCapture(sessionId);

    wsCleanup.current = subscribeToStats(sessionId, (data) => {
      console.log(data);
      setStats(data.stats);

      // overlay live packet activity onto topology nodes
      if (data.topology?.length) {
        setTopology(prev => ({ ...prev, nodes: data.topology }));
      }

      if (data.alerts?.length) {
        setAlerts(data.alerts);
      }
    });
    
    setCapturing(true);
  }

  async function onStop() {
    await stopCapture();
    if (wsCleanup.current) {
      wsCleanup.current();
      wsCleanup.current = null;
    }
    setCapturing(false);
    setSessions(await fetchSessions());

    // pull final session totals into topology
    setTopology(await fetchTopology(sessionId));
    setAlerts(await fetchAlerts(sessionId));
  }

  // ── Session management ────────────────────────────────────────────────────
  async function onCreate(name) {
    if (sessions.some(s => s.name === name)) {
      setError('A session with that name already exists.');
      setTimeout(() => setError(null), 3000);
      return;
    }
    const { session_id } = await createSession(name);
    setSessions(await fetchSessions());
    setSessionId(session_id);
    setStats(await fetchStats(session_id));
    setTopology({ nodes: [] })
    setAlerts([]);
    lastScanTime.current = null;
  }

  async function onDelete(id) {
    if (id == sessionId && capturing) {
      setError('Cannot delete a session while capturing.');
      setTimeout(() => setError(null), 3000);
      return;
    }
    if (id == sessionId) {
      setSessionId(null);
      setStats(null);
    }
    await deleteSession(id);
    setTopology({ nodes: [] }); 
    setAlerts([]);
    setSessions(await fetchSessions());
  }

  async function onSelect(id) {
    if (id == sessionId) return;
    setSessionId(id);
    setStats(await fetchStats(id));
    setTopology(await fetchTopology(id));
    setAlerts(await fetchAlerts(id));
    lastScanTime.current = null;
  }

  async function onExport(id, format) {
    return exportSession(id, format)
  }
  
  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className={styles.app}>
      {error && <div className={styles.error}>{error}</div>}
      {scanning && (
        <div className={styles.scanningOverlay}>
          <div className={styles.scanningBox}>
            Scanning network… please wait
          </div>
        </div>
      )}
      <TopBar
        sessionId={sessionId}
        isCapturing={capturing}
        sessionHasData={sessionHasData}
        onStart={onStart}
        onStop={onStop}
      />
      <SessionBar
        sessions={sessions}
        activeSessionId={sessionId}
        onSelect={onSelect}
        onCreate={onCreate}
        onDelete={onDelete}
        onExport={onExport}
        isCapturing={capturing}
      />
      <NavBar
        activeView={activeView}
        onViewChange={setActiveView}
        isCapturing={capturing}
      />
      <Dashboard 
        isVisible={activeView === 'dashboard'}
        stats={stats}
        sessionId={sessionId}
        fetchAllPackets={fetchAllPackets}
      />
      <NetworkGraph
        key={sessionId}
        isVisible={activeView === 'network'}
        nodes={topology.nodes}
        sessionStats={stats?.top_10_ips}
        isCapturing={capturing}
        onScan={onScan}
        scanning={scanning}
        lastScanTime={lastScanDisplay}
        sessionHasData={sessionHasData}
        />
      <AlertsPanel
        isVisible={activeView === 'alerts'}
        alerts={alerts}
        sessionId={sessionId}
      />
    </div>
  )
}

export default App

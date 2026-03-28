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

import TopBar       from './components/layout/TopBar.jsx';
import SessionBar   from './components/layout/SessionBar.jsx';
import NavBar       from './components/layout/NavBar.jsx';
import Dashboard    from './components/dashboard/Dashboard.jsx';
import NetworkGraph from './components/network/NetworkGraph.jsx';
import AlertsPanel  from './components/alerts/AlertsPanel.jsx';
import AiAnalysis   from './components/analysis/AiAnalysis.jsx';
import { useToast } from './components/ui/ToastContext.jsx';

import styles from './App.module.css'

function App() {
  const toast = useToast();
  
  // ── Navigation ────────────────────────────────────────────────────────────
  const [activeView, setActiveView] = useState('dashboard');

  // ── Sessions ──────────────────────────────────────────────────────────────
  const [sessions, setSessions] = useState([]);      
  const [sessionId, setSessionId] = useState(null);  
  const [stats, setStats] = useState(null);         

  // ── Capture ───────────────────────────────────────────────────────────────
  const [capturing, setCapturing] = useState(false);
  const wsCleanup = useRef(null);        
  const [stopping, setStopping] = useState(false);

  // ── Topology ──────────────────────────────────────────────────────────────
  const [topology, setTopology] = useState({ nodes: [] });
  const [scanning, setScanning] = useState(false);
  const lastScanTime = useRef(null);
  const [lastScanDisplay, setLastScanDisplay] = useState(null); // state copy so label re-renders

  // ── Alerts ────────────────────────────────────────────────────────────────
  const [alerts, setAlerts] = useState([]);
  const seenAlertIds = useRef(new Set());

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
      } catch (e) {
        toast.error('Scan failed', e?.message ?? 'Could not complete network scan.');
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
        toast.warning('Stale scan data', 'Network map is over 2 hours hold. Consider rescanning.');
        const rescan = confirm('Rescan?');
        if (rescan) await onScan();
    }

    try { 
      await startCapture(sessionId);
    } catch (e) {
      toast.error('Capture failed to start', e?.message ?? 'Could not bind to interface.');
      return;
    }

    seenAlertIds.current = new Set();

    wsCleanup.current = subscribeToStats(sessionId, (data) => {
      console.log(data);
      setStats(data.stats);

      // overlay live packet activity onto topology nodes
      if (data.topology?.length) {
        setTopology(prev => ({ ...prev, nodes: data.topology }));
      }

      if (data.alerts?.length) {
        setAlerts(data.alerts);

        data.alerts.forEach(alert => {
          if (!seenAlertIds.current.has(alert.id)) {
            seenAlertIds.current.add(alert.id);
            toast.alert(
              `Anomaly: ${alert.rule_triggered.replace(/_/g, ' ')}`,
              alert.description
            );
          }
        });
      }
    });
    
    setCapturing(true);
    toast.info('Capture started', `Listening on network · session active.`);
  }

  async function onStop() {
    setStopping(true);

    try {
      await stopCapture();
    } catch (e) {
      toast.error('Failed to stop capture', e?.message ?? 'Unknown error.');
      setStopping(false);
      return;
    }
    
    if (wsCleanup.current) {
      wsCleanup.current();
      wsCleanup.current = null;
    }
    setCapturing(false);
    setStopping(false);

    setSessions(await fetchSessions());
    setTopology(await fetchTopology(sessionId));
    setAlerts(await fetchAlerts(sessionId));
    toast.info('Capture stopped', 'Session data saved.');
  }

  // ── Session management ────────────────────────────────────────────────────
  async function onCreate(name) {
    if (sessions.some(s => s.name === name)) {
      toast.error('Duplicate session name', `A session named "${name}" already exists.`);
      return;
    }
    try {
      const { session_id } = await createSession(name);
      setSessions(await fetchSessions());
      setSessionId(session_id);
      setStats(await fetchStats(session_id));
      setTopology({ nodes: [] })
      setAlerts([]);
      lastScanTime.current = null;
      toast.success('Session created', `Session "${name}" added to database.`);
    } catch (e) {
      toast.error('Failed to create session', e?.message ?? 'Unknown error.');
    }
  }

  async function onDelete(id) {
    if (id == sessionId && capturing) {
      toast.error('Cannot delete during active session', 'Stop the capture before deleting.');
      return;
    }
    try {
      await deleteSession(id);
      if (id == sessionId) {
        setSessionId(null);
        setStats(null);
        setTopology({ nodes: [] }); 
        setAlerts([]);
      }
      setSessions(await fetchSessions());
      toast.success('Session deleted', `Session removed from database.`);
    } catch (e) {
      toast.error('Failed to delete session', e?.message ?? 'Unknown error.');
    }
  }

  async function onSelect(id) {
    if (id == sessionId) return;
    try {
      setSessionId(id);
      setStats(await fetchStats(id));
      setTopology(await fetchTopology(id));
      setAlerts(await fetchAlerts(id));
      lastScanTime.current = null;
    } catch (e) {
      toast.error('Failed to load session', e?.message ?? 'Unknown error.');
    }
  }

  async function onExport(id, format) {
    try {
      const exp = await exportSession(id, format);
      toast.success('Export started', `Downloading session as .${format}.`);
      return exp;
    } catch (e) {
      toast.error('Export failed', e?.messsage ?? 'Unknown error.');
    }
  }
  
  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className={styles.app}>
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
        isStopping={stopping}
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
        sessionId={sessionId}
        numAlerts={alerts.length}
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
      <AiAnalysis 
        isVisible={activeView === 'analysis'}
        stats={stats}
        alerts={alerts}
        sessionId={sessionId}
      />
    </div>
  )
}

export default App

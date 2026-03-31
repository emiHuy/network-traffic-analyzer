/**
 * @file App.jsx
 * @description
 * Root application component. Manages global state and orchestrates the four
 * primary views: Dashboard, Network, Alerts, and AI Analysis.
 *
 * Responsibilities:
 *   - Maintains global application state
 *   - Handles session selection and live capture control
 *   - Aggregates statistics for the dashboard
 *   - Manages network topology scanning
 *   - Tracks alerts and triggers toast notifications
 *   - Cleans up WebSocket connections on unmount
 *
 * State Architecture:
 * ─────────────────────────
 *  sessions      – Array of all sessions fetched from the database
 *  sessionId     – Currently-selected session ID (null if none)
 *  stats         – Aggregated dashboard metrics for the active session
 *  capturing     – Boolean: whether a live capture is currently running
 *  stopping      – Boolean flag while a stop request is in-flight
 *  topology      – Network topology object: { nodes: [...] }
 *  scanning      – Boolean: whether an ARP scan is in-flight (controls overlay)
 *  alerts        – List of anomaly alerts for the active session
 *  seenAlertIds  – Ref-set for de-duplicating toast notifications
 *  wsCleanup     – Ref storing WebSocket teardown function
 *
 * Notes:
 *   - Toast notifications are triggered for new alerts that are not in seenAlertIds
 *   - ARP scans and live capture are mutually coordinated with overlay indicators
 *   - All state updates are centralized here for predictable view behavior
 */

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

import styles from './App.module.css';

// ── Stale-scan threshold: warn the user if their topology is older than this ──
const STALE_SCAN_MS = 2 * 60 * 60 * 1000; // 2 hours

// ─────────────────────────────────────────────────────────────────────────────

export default function App() {
  const toast = useToast();
  
  // ── Navigation ────────────────────────────────────────────────────────────
  const [activeView, setActiveView] = useState('dashboard');

  // ── Session state ─────────────────────────────────────────────────────────
  const [sessions, setSessions] = useState([]);      
  const [sessionId, setSessionId] = useState(null);  
  const [stats, setStats] = useState(null);         

  // ── Capture state ─────────────────────────────────────────────────────────
  const [capturing, setCapturing] = useState(false);
  const wsCleanup = useRef(null);        
  const [stopping, setStopping] = useState(false);

  // ── Network topology ──────────────────────────────────────────────────────
  const [topology, setTopology] = useState({ nodes: [] });
  const [scanning, setScanning] = useState(false);
  const lastScanTime = useRef(null);
  // Mirror in state so the NetworkGraph label re-renders when the time changes.
  const [lastScanDisplay, setLastScanDisplay] = useState(null); // state copy so label re-renders

  // ── Alerts ────────────────────────────────────────────────────────────────
  const [alerts, setAlerts] = useState([]);
  const seenAlertIds = useRef(new Set());

  // True if the active session already has captured packets (prevents re-capture).
  const sessionHasData = sessions.find(s => s.id === sessionId)?.packet_count > 0;

  // ── Bootstrap ─────────────────────────────────────────────────────────────
  useEffect(() => {
    fetchSessions()
      .then(setSessions)
      .catch((e) => toast.error('Failed to load sessions', e.message));
  }, []);

  // Tear down the WebSocket when the component unmounts.
  useEffect(() => {
    return () => wsCleanup.current?.()
  }, []);

  // ── Network scan ──────────────────────────────────────────────────────────

  async function onScan() {
    setScanning(true);
    try {
      const result = await triggerScan();
      setTopology({ nodes: result.nodes });
      lastScanTime.current = Date.now();
      setLastScanDisplay(Date.now()); /// triggers re-render of the "last scan" label
    } catch (e) {
      toast.error('Scan failed', e?.message ?? 'Could not complete network scan.');
    } finally {
      setScanning(false);
    }
  }

  // ── Capture start ─────────────────────────────────────────────────────────

  async function onStart() {
    const scanAge  = lastScanTime.current
        ? Date.now() - lastScanTime.current
        : null;

    if (!lastScanTime.current) {
        // First capture in this session — silently run a background scan
        // so the network map is ready when the user switches to it.
        await onScan();
    } else if (scanAge > STALE_SCAN_MS) {
        toast.warning('Stale scan data', 'Network map is over 2 hours hold. Consider rescanning.');
        if (window.confirm('Rescan the network before starting capture?')) {
          await onScan();
        }
    }

    try { 
      await startCapture(sessionId);
    } catch (e) {
      toast.error('Capture failed to start', e?.message ?? 'Could not bind to interface.');
      return;
    }

    // Reset alert de-duplication for this new capture run.
    seenAlertIds.current = new Set();

    // Open the live WebSocket feed.
    wsCleanup.current = subscribeToStats(sessionId, (data) => {
      setStats(data.stats);

      // Overlay live traffic data onto the topology nodes.
      if (data.topology?.length) {
        setTopology(prev => ({ ...prev, nodes: data.topology }));
      }

      // Process incoming alerts, showing a toast for each new one.
      if (data.alerts?.length) {
        setAlerts(data.alerts);
        for (const alert of data.alerts) {
          if (!seenAlertIds.current.has(alert.id)) {
            seenAlertIds.current.add(alert.id);
            toast.alert(
                `Anomaly: ${alert.rule_triggered.replace(/_/g, ' ')}`,
                alert.description,
            );
          }
        }
      }
    });
    
    setCapturing(true);
    toast.info('Capture started', `Listening on network · session active.`);
  }

  // ── Capture stop ──────────────────────────────────────────────────────────

  async function onStop() {
    setStopping(true);

    try {
      await stopCapture();
    } catch (e) {
      toast.error('Failed to stop capture', e?.message ?? 'Unknown error.');
      setStopping(false);
      return;
    }
    
    // Close the WebSocket.
    wsCleanup.current();
    wsCleanup.current = null;
    
    setCapturing(false);
    setStopping(false);

    // Refresh data from the DB now that the session snapshot is complete.
    const [updatedSessions, snap, sessionAlerts] = await Promise.all([
      fetchSessions(),
      fetchTopology(sessionId),
      fetchAlerts(sessionId),
    ])
    setSessions(updatedSessions);
    setTopology(snap);
    setAlerts(sessionAlerts);

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
      const updated = await fetchSessions();
      setSessions(updated);
      setSessionId(session_id);
      setStats(await fetchStats(session_id));
      setTopology({ nodes: [] })
      setAlerts([]);
      lastScanTime.current = null;
      toast.success('Session created', `Session "${name}" added.`);
    } catch (e) {
      toast.error('Failed to create session', e?.message ?? 'Unknown error.');
    }
  }

  async function onDelete(id) {
    if (id == sessionId && capturing) {
      toast.error('Cannot delete during active session', 'Stop the capture first.');
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
      toast.success('Session deleted', `Removed from database.`);
    } catch (e) {
      toast.error('Failed to delete session', e?.message ?? 'Unknown error.');
    }
  }

  async function onSelect(id) {
    if (id == sessionId) return;
    try {
      const [newStats, topo, sessionAlerts] = await Promise.all([
        fetchStats(id),
        fetchTopology(id),
        fetchAlerts(id),
      ]);
      setSessionId(id);
      setStats(newStats);
      setTopology(topo);
      setAlerts(sessionAlerts);
      lastScanTime.current = null;
    } catch (e) {
      toast.error('Failed to load session', e?.message ?? 'Unknown error.');
    }
  }

  async function onExport(id, format) {
    try {
      exportSession(id, format);
      toast.success('Export started', `Downloading as .${format}.`);
    } catch (e) {
      toast.error('Export failed', e?.messsage ?? 'Unknown error.');
    }
  }
  
  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className={styles.app}>
      {/* Full-screen overlay shown while the ARP scan is running */}
      {scanning && (
        <div className={styles.scanningOverlay}>
          <div className={styles.scanningBox}>
            Scanning network… please wait
          </div>
        </div>
      )}

      <TopBar
        sessionId={sessionId}
        sessionHasData={sessionHasData}
        onStart={onStart}
        onStop={onStop}
        isCapturing={capturing}
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
        sessionId={sessionId}
        numAlerts={alerts.length}
        isCapturing={capturing}
      />

      <Dashboard 
        isVisible={activeView === 'dashboard'}
        sessionId={sessionId}
        stats={stats}
        fetchAllPackets={fetchAllPackets}
      />

      <NetworkGraph
        key={sessionId}
        isVisible={activeView === 'network'}
        sessionHasData={sessionHasData}
        sessionStats={stats?.top_10_ips}
        nodes={topology.nodes}
        onScan={onScan}
        scanning={scanning}
        lastScanTime={lastScanDisplay}
        isCapturing={capturing}
      />

      <AlertsPanel
        isVisible={activeView === 'alerts'}
        sessionId={sessionId}
        alerts={alerts}
      />

      <AiAnalysis 
        isVisible={activeView === 'analysis'}
        sessionId={sessionId}
        stats={stats}
        alerts={alerts}
        isCapturing={capturing}
      />

    </div>
  )
}
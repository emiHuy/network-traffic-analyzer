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
  exportSession 
} from './api/client.js';

import TopBar     from './components/TopBar.jsx';
import SessionBar from './components/SessionBar.jsx';
import Dashboard  from './components/Dashboard.jsx';

import styles from './styles/App.module.css'

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

  // ── Capture ───────────────────────────────────────────────────────────────
  async function onStart() {
    await startCapture(sessionId);
    wsCleanup.current = subscribeToStats(sessionId, setStats);
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
  }

  // ── Session management ────────────────────────────────────────────────────
  async function onCreate(name) {
    const { session_id } = await createSession(name);
    setSessions(await fetchSessions());
    setSessionId(session_id);
    setStats(await fetchStats(session_id));
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
    setSessions(await fetchSessions());
  }

  async function onSelect(id) {
    if (id == sessionId) return;
    setSessionId(id);
    setStats(await fetchStats(id));
  }

  async function onExport(id, format) {
    return exportSession(id, format)
  }
  
  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className={styles.app}>
      {error && <div className={styles.error}>{error}</div>}
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
        oonSelect={onSelect}
        onCreate={onCreate}
        onDelete={onDelete}
        onExport={onExport}
      />
      <Dashboard 
        isVisible={activeView === 'dashboard'}
        stats={stats}
        sessionId={sessionId}
        fetchAllPackets={fetchAllPackets}
      />
    </div>
  )
}

export default App

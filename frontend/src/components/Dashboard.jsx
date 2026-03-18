import { useState, useRef, useEffect } from 'react';

import { 
  startCapture, stopCapture, subscribeToStats, 
  fetchSessions, createSession, deleteSession,
  fetchStats, fetchAllPackets, exportSession
} from '../api/client.js';

import TopBar from './TopBar.jsx';
import SessionBar from './SessionBar.jsx';
import MetricCards from './MetricsCards.jsx';
import TopIPs from './TopIps.jsx';
import ProtocolBreakdown from './ProtocolBreakdown.jsx';
import PacketFeed from './PacketFeed.jsx';
import PacketSearch from './PacketSearch.jsx';

import styles from '../styles/Dashboard.module.css'


export default function Dashboard() {
  const [sessions, setSessions] = useState([]);      // all available sessions
  const [sessionId, setSessionId] = useState(null);  // currently selected session
  const [stats, setStats] = useState(null);          // stats for selected session
  const [capturing, setCapturing] = useState(false); // whether live capture is active
  const [error, setError] = useState(null);          // error
  const [searching, setSearching] = useState(false); // search
  
  // Holds cleanup function for active WebSocket subscription
  const wsCleanup = useRef(null);

  // Initial load: fetch all sessions when component mounts
  useEffect(() => {
    async function load() {
      setSessions(await fetchSessions());
    }
    load();
  }, []);

  // Cleanup on unmount: ensure WebSocket is closed if user navigates away mid-capture
  useEffect(() => {
    return () => {
      if (wsCleanup.current) {
        wsCleanup.current();
        wsCleanup.current = null;
      }
    };
  }, []);

  // --- Capture controls ---
  async function onStart() {
    // Start backend capture for current session
    await startCapture(sessionId);
    // Subscribe to live stats stream (WebSocket)
    wsCleanup.current = subscribeToStats(sessionId, setStats);
    setCapturing(true);
  }

  async function onStop() {
    // Stop backend capture
    await stopCapture();
    // Cleanup WebSocket subscription
    if (wsCleanup.current) {
      wsCleanup.current();
      wsCleanup.current = null;
    }
    setCapturing(false);
    setSessions(await fetchSessions());
  }

  // --- Session management ---
  async function onCreate(name) {
    // Create new session, then refresh session list
    const { session_id } = await createSession(name);
    setSessions(await fetchSessions());
    // Auto-select newly created session
    setSessionId(session_id);
    // Fetch initial stats snapshot
    setStats(await fetchStats(session_id));
  }

  async function onDelete(id) {
    // Prevent deletion of active session during capture
    if (id == sessionId && capturing) {
      setError('Cannot delete a session while capturing.');
      setTimeout(() => setError(null), 3000);
      return;
    }
    // If deleting currently selected session, reset selection + stats
    if (id == sessionId) {
      setSessionId(null);
      setStats(null);
    }
    await deleteSession(id);
    // Refresh session list
    setSessions(await fetchSessions());
  }

  async function onSelect(id) {
    // No-op if selecting same session
    if (id == sessionId) return;
    setSessionId(id);
    // Fetch stats snapshot for selected session.
    setStats(await fetchStats(id));
  }

  async function onExport(id, format) {
    return exportSession(id, format)
  }

  return (
    <div>
      {error && <div className={styles.error}>{error}</div>}
      <TopBar sessionId={sessionId} isCapturing={capturing} onStart={onStart} onStop={onStop}/>
      <SessionBar sessions={sessions} activeSessionId={sessionId} onSelect={onSelect} onCreate={onCreate} onDelete={onDelete} onExport={onExport}/>
      <MetricCards totalPackets={stats?.total_packets} avgPacketSize={stats?.average_packet_size} packetsPerMin={stats?.packets_per_minute?.at(-1)?.total} activeHosts={stats?.active_hosts}/>
      <div className={styles.grid2}>
        <TopIPs data={stats?.top_10_ips}/>
        <ProtocolBreakdown data={stats?.protocol_breakdown}/>
      </div>
      <PacketFeed data={stats?.recent_packets} sessionId={sessionId} onSearch={setSearching}/>
      {searching && sessionId && (
        <PacketSearch
          sessionId={sessionId}
          onClose={() => setSearching(false)}
          fetchAllPackets={fetchAllPackets}
        />
      )}
    </div>
  )
}
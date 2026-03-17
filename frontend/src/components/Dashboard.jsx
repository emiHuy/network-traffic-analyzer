import { useState, useRef, useEffect } from 'react';

import { 
  startCapture, stopCapture, subscribeToStats, 
  fetchSessions, createSession, deleteSession,
  fetchStats,
} from '../api/client.js';

import TopBar from './TopBar.jsx';
import SessionBar from './SessionBar.jsx';
import MetricCards from './MetricsCards.jsx';
import TopIPs from './TopIps.jsx';
import ProtocolBreakdown from './ProtocolBreakdown.jsx';
import PacketFeed from './PacketFeed.jsx';

import styles from '../styles/Dashboard.module.css'


export default function Dashboard() {
  const [sessions, setSessions] = useState([]);
  const [sessionId, setSessionId] = useState(null);
  const [stats, setStats] = useState(null);
  const [capturing, setCapturing] = useState(false);
  
  const wsCleanup = useRef(null);

  useEffect(() => {
    async function load() {
      setSessions(await fetchSessions());
    }
    load();
  }, []);

  async function onStart() {
    await startCapture(sessionId);
    wsCleanup.current = subscribeToStats(sessionId, setStats);
    setCapturing(true);
  }

  async function onStop() {
    await stopCapture();
    wsCleanup.current();
    wsCleanup.current = null;
    setCapturing(false);
  }

  async function onCreate(name) {
    const { session_id } = await createSession(name);
    setSessions(await fetchSessions());
    setSessionId(session_id);
    setStats(await fetchStats(session_id));
  }

  async function onDelete(id) {
    if (id == sessionId && capturing) {
      alert('Cannot delete while capturing.');
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

  return (
    <div>
      <TopBar sessionId={sessionId} isCapturing={capturing} onStart={onStart} onStop={onStop}/>
      <SessionBar sessions={sessions} activeSessionId={sessionId} onSelect={onSelect} onCreate={onCreate} onDelete={onDelete}/>
      <MetricCards totalPackets={stats?.total_packets} avgPacketSize={stats?.average_packet_size} packetsPerMin={stats?.packets_per_minute?.at(-1)?.total} activeHosts={stats?.active_hosts}/>
      <div className={styles.grid2}>
        <TopIPs data={stats?.top_10_ips}/>
        <ProtocolBreakdown data={stats?.protocol_breakdown}/>
      </div>
      <PacketFeed data={stats?.recent_packets}/>
    </div>
  )
}
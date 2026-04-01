/**
 * @file Dashboard.jsx
 * @description Main dashboard view for NETAnalyzer.
 *
 * Composes the four primary data panels into a single scrollable view:
 *   1. MetricCards       — headline stats (total packets, avg size, pkts/min, hosts)
 *   2. TopIPs            — horizontal bar chart of the top 10 IPs by traffic
 *   3. ProtocolBreakdown — donut chart + legend of protocol distribution
 *   4. PacketFeed        — live scrollable packet table with collapse + search
 *
 * The PacketSearch modal is mounted on demand when the user opens the search
 * overlay from within PacketFeed, and unmounted on close to avoid holding a
 * large packet list in memory unnecessarily.
 *
 * Props:
 *   @prop {boolean}  isVisible       - Controls display via inline style (tab switching).
 *   @prop {object}   stats           - Session stats object from the WebSocket / REST API.
 *   @prop {number}   sessionId       - Active session ID; required before search can open.
 *   @prop {function} fetchAllPackets - Async fn(sessionId) used by PacketSearch to load all packets.
 */

import { useState } from 'react';

import MetricCards       from './MetricsCards.jsx';
import TopIPs            from './TopIps.jsx';
import ProtocolBreakdown from './ProtocolBreakdown.jsx';
import PacketFeed        from './PacketFeed.jsx';
import PacketSearch      from './PacketSearch.jsx';

import styles from './Dashboard.module.css';

export default function Dashboard({ isVisible, stats, sessionId, fetchAllPackets }) {
  // True while the packet search modal is open
  const [searching, setSearching] = useState(false); 

  return (
    <div style={{ display: isVisible ? '' : 'none' }}>
      {/* top row: total packets, avg size, pkts/min, active hosts */}
      <MetricCards 
        totalPackets={stats?.total_packets} 
        avgPacketSize={stats?.average_packet_size} 
        packetsPerMin={stats?.packets_per_minute?.at(-1)?.total} 
        activeHosts={stats?.active_hosts}
      />

      {/* two-column row: top IPs by traffic + protocol donut chart */}
      <div className={styles.grid2}>
        <TopIPs data={stats?.top_10_ips}/>
        <ProtocolBreakdown data={stats?.protocol_breakdown}/>
      </div>

      {/* scrollable live packet table; search button sets searching = true */}
      <PacketFeed 
        data={stats?.recent_packets} 
        onSearch={setSearching}
      />

      {/* search modal — only rendered when triggered and a session is active */}
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
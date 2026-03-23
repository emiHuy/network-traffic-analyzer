import { useState } from 'react';

import MetricCards       from './MetricsCards.jsx';
import TopIPs            from './TopIps.jsx';
import ProtocolBreakdown from './ProtocolBreakdown.jsx';
import PacketFeed        from './PacketFeed.jsx';
import PacketSearch      from './PacketSearch.jsx';

import styles from '../styles/Dashboard.module.css'

export default function Dashboard({ isVisible, stats, sessionId, fetchAllPackets }) {
  const [searching, setSearching] = useState(false); 

  return (
    <div style={{ display: isVisible ? '' : 'none' }}>
      <MetricCards 
        totalPackets={stats?.total_packets} 
        avgPacketSize={stats?.average_packet_size} 
        packetsPerMin={stats?.packets_per_minute?.at(-1)?.total} 
        activeHosts={stats?.active_hosts}
      />

      <div className={styles.grid2}>
        <TopIPs data={stats?.top_10_ips}/>
        <ProtocolBreakdown data={stats?.protocol_breakdown}/>
      </div>

      <PacketFeed 
        data={stats?.recent_packets} 
        sessionId={sessionId} 
        onSearch={setSearching}
      />

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
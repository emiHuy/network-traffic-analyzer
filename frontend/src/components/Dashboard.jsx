import TopBar from './TopBar.jsx';
import SessionBar from './SessionBar.jsx';
import MetricCards from './MetricsCards.jsx';
import TopIPs from './TopIps.jsx';
import ProtocolBreakdown from './ProtocolBreakdown.jsx';
import PacketFeed from './PacketFeed.jsx';
import styles from '../styles/Dashboard.module.css'


export default function Dashboard() {
  return (
    <div>
      <TopBar />
      <SessionBar />
      <MetricCards />
      <div className={styles.grid2}>
        <TopIPs />
        <ProtocolBreakdown />
      </div>
      <PacketFeed />
    </div>
  )
}
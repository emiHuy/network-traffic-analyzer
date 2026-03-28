import styles from './MetricCards.module.css';

// single stat card — accent maps to a CSS class for the value color
function MetricCard({ label, value, sub, accent }) {
  return (
    <div className={styles.card}>
      <div className={styles.label}>{label}</div>
      <div className={`${styles.value} ${styles[accent]}`}>{value}</div>
      <div className={styles.sub}>{sub}</div>
    </div>
  );
}

export default function MetricCards({ totalPackets, avgPacketSize, packetsPerMin, activeHosts }) {
  return (
    <div className={styles.grid}>
      <MetricCard
        label="total packets"
        value={totalPackets?.toLocaleString() ?? "—"}
        sub="this session"
        accent="accentBlue"
      />
      <MetricCard
        label="avg packet size"
        value={avgPacketSize ? `${Math.round(avgPacketSize)} B` : "—"}
        sub="bytes"
        accent="accentGreen"
      />
      <MetricCard
        label="pkts / min"
        value={packetsPerMin ?? "—"}
        sub="last interval"
        accent="accentAmber"
      />
      <MetricCard
        label="active hosts"
        value={activeHosts ?? "—"}
        sub="unique IPs"
        accent="accentPurple"
      />
    </div>
  );
}
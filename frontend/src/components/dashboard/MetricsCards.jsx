/**
 * @file MetricsCards.jsx
 * @description Headline stat cards displayed at the top of the dashboard.
 *
 * Renders a four-column grid of summary metrics for the active capture session:
 *   - Total Packets    — cumulative packet count, formatted with locale separators
 *   - Avg Packet Size  — mean size in bytes, rounded to the nearest integer
 *   - Pkts / Min       — packet rate from the most recent one-minute interval
 *   - Active Hosts     — count of unique local IPs seen in the session
 *
 * Each card delegates its color accent to a CSS module class (accentBlue,
 * accentGreen, accentAmber, accentPurple) so the palette is controlled
 * entirely from MetricCards.module.css.
 *
 * Props:
 *   @prop {number} totalPackets   - Total packets captured this session.
 *   @prop {number} avgPacketSize  - Average packet size in bytes.
 *   @prop {number} packetsPerMin  - Packet count for the latest one-minute bucket.
 *   @prop {number} activeHosts    - Number of unique IPs seen this session.
 */

import styles from './MetricsCards.module.css';

/**
 * A single metric card with a label, large value, and muted sub-label.
 *
 * @param {{ label: string, value: string, sub: string, accent: string }} props
 * @param {string} props.accent - CSS module class name applied to the value (e.g. "accentBlue").
 */
function MetricCard({ label, value, sub, accent }) {
  return (
    <div className={styles.card}>
      <div className={styles.label}>{label}</div>
      <div className={`${styles.value} ${styles[accent]}`}>{value}</div>
      <div className={styles.sub}>{sub}</div>
    </div>
  );
}

/**
 * Renders the four headline metric cards in a responsive grid.
 * Falls back to "—" for any stat that is null or undefined.
 */
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
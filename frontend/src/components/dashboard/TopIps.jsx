/**
 * @file TopIPs.jsx
 * @description Horizontal bar list showing the top IP addresses by traffic volume.
 *
 * Displays the top 10 IPs ranked by total packet count (or bytes),
 * with proportional bar widths for quick visual comparison.
 *
 * Props:
 *   @prop {object[]} data - Array of IP traffic objects from the stats API,
 *                           each entry shaped as { ip: string, total: number }.
 */

import styles from './TopIps.module.css';

// bar colors cycle through accent palette by rank
const BAR_COLORS = ["#4fc3f7", "#4fc3f7", "#a78bfa", "#a78bfa", "#22c55e", "#22c55e", "#f59e0b", "#f59e0b", "#f59e0b", "#f59e0b"];

export default function TopIPs({ data = [] }) {
  // max value used to calculate bar widths as percentage
  const max = data[0]?.total ?? 1;

  return (
    <div className={styles.panel}>
      <div className={styles.title}>top 10 IPs by traffic</div>

      {/* empty state when no data is available */}
      {data.length === 0 && (
        <div className={styles.empty}>no data yet</div>
      )}

      {data.map((row, i) => (
        <div key={row.ip} className={styles.row}>
          <span className={styles.ip}>{row.ip}</span>

          {/* bar width is proportional to top IP's count */}
          <div className={styles.barWrap}>
            <div
              style={{
                height: "4px",
                borderRadius: "2px",
                background: BAR_COLORS[i] ?? "#546e8a",
                width: `${Math.round((row.total / max) * 100)}%`,
                transition: "width 0.4s ease",
              }}
            />
          </div>

          {/* traffic count (top IP highlighted) */}
          <span className={`${styles.count} ${i === 0 ? styles.countFirst : ''}`}>
            {row.total}
          </span>
        </div>
      ))}
      
    </div>
  );
}
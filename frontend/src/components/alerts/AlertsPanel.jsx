/**
 * @file AlertsPanel.jsx
 * @description Displays anomaly alerts for the active session.
 *
 * Each alert is rendered as a card with its rule, description,
 * source/destination IPs, timestamp, and severity.
 *
 * Props:
 *   @prop {object[]} alerts    - Alert objects for the active session.
 *   @prop {boolean}  isVisible - Controls display (tab switching).
 *   @prop {number}   sessionId - Used to differentiate empty-state messages.
 */

import styles from './AlertsPanel.module.css';

// formats ISO timestamp to HH:MM:SS.mmm; returns '—' for missing values
function formatTimestamp(ts) {
  if (!ts) return '—';
  try {
    const d = new Date(ts);
    return d.toLocaleTimeString('en-CA', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      fractionalSecondDigits: 3,
      hour12: false,
    });
  } catch {
    return ts; 
  }
}

// single alert card — left border colour and severity badge vary by severity level
function AlertCard({ alert }) {
  const isHigh = alert.severity === 'high'; // Determine severity styling
  return (
    <div className={`${styles.card} ${isHigh ? styles.cardHigh : styles.cardMedium}`}>
      <div className={styles.cardBody}>

        {/* rule name */}
        <span className={styles.rule}>{alert.rule_triggered}</span>

        {/* alert description */}
        <p className={styles.desc}>{alert.description}</p>

        {/* metadata: source → destination and timestamp */}
        <div className={styles.meta}>
          {alert.src_ip} → {alert.dst_ip} · {formatTimestamp(alert.timestamp)}
        </div>
      </div>

      {/* severity badge */}
      <span className={isHigh ? styles.sevHigh : styles.sevMedium}>
        {alert.severity}
      </span>
    </div>
  );
}

// empty-state message differs based on whether a session is selected
export default function AlertsPanel({ alerts = [], isVisible, sessionId }) {
  return (
    // Panel container, hidden if not visible
    <div className={styles.panel} style={{ display: isVisible ? '' : 'none' }}>
      <div className={styles.titleRow}>
        <span className={styles.title}>alerts</span>
        {alerts.length > 0 && (
          <span className={styles.countBadge}>{alerts.length} alert{alerts.length !== 1 ? 's' : ''}</span>
        )}
      </div>
      
      {/* Empty state */}
      {alerts.length === 0 ? (
        <div className={styles.empty}>{ sessionId ? 'no alerts detected' : 'no data yet'}</div>
      ) : (
        // Map over alerts and render AlertCard for each
        alerts.map((alert) => (
          <AlertCard key={alert.id} alert={alert} />
        ))
      )}
    </div>
  );
}

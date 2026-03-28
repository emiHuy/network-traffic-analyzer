import styles from './AlertsPanel.module.css';

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

function AlertCard({ alert }) {
  const isHigh = alert.severity === 'high';
  return (
    <div className={`${styles.card} ${isHigh ? styles.cardHigh : styles.cardMedium}`}>
      <div className={styles.cardBody}>
        <span className={styles.rule}>{alert.rule_triggered}</span>
        <p className={styles.desc}>{alert.description}</p>
        <div className={styles.meta}>
          {alert.src_ip} → {alert.dst_ip} · {formatTimestamp(alert.timestamp)}
        </div>
      </div>
      <span className={isHigh ? styles.sevHigh : styles.sevMedium}>
        {alert.severity}
      </span>
    </div>
  );
}

export default function AlertsPanel({ alerts = [], isVisible, sessionId }) {
  return (
    <div className={styles.panel} style={{ display: isVisible ? '' : 'none' }}>
      <div className={styles.titleRow}>
        <span className={styles.title}>alerts</span>
        {alerts.length > 0 && (
          <span className={styles.countBadge}>{alerts.length} alert{alerts.length !== 1 ? 's' : ''}</span>
        )}
      </div>
      

      {alerts.length === 0 ? (
        <div className={styles.empty}>{ sessionId ? 'no alerts detected' : 'no data yet'}</div>
      ) : (
        alerts.map((alert) => (
          <AlertCard key={alert.id} alert={alert} />
        ))
      )}
    </div>
  );
}

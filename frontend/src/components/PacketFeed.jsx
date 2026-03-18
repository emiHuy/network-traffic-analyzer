import { useState } from 'react';
import { PROTO_NAMES, PROTO_COLOURS } from '../constants/protocols';
import styles from '../styles/PacketFeed.module.css';

const COLLAPSED_LIMIT = 6;

// resolves protocol number or string to a colored badge
function ProtoBadge({ protocol }) {
  const name = typeof protocol === 'number' ? (PROTO_NAMES[protocol] ?? 'UNK') : (protocol ?? 'UNK');
  const colour = PROTO_COLOURS[name];
  return (
    <span 
      className={`${styles.badge}`} 
      style={{
        color: colour,
        background: `${colour}1a`, // 1a = 10% opacity
      }}
    >
      {name}
    </span>
  );
}

// formats ISO timestamp to HH:MM:SS.mmm
function formatTimestamp(ts) {
  if (!ts) return '—';
  try {
    const d = new Date(ts);
    const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const time = d.toLocaleTimeString('en-CA', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      fractionalSecondDigits: 3,
      hour12: false,
    });
    return `${date} ${time}`;
  } catch {
    return ts;
  }
}

export default function PacketFeed({ data = [], limit = 18, sessionId, onSearch}) {
  const [collapsed, setCollapsed] = useState(false);
  // cap rows shown to limit
  const rows = (collapsed ? data.slice(0, COLLAPSED_LIMIT) : data.slice(0, limit));

  return (
    <div className={styles.panel}>
      {/* title + total count */}
      <div className={styles.titleRow}>
        <div className={styles.title}>live packet feed</div>
        <div className={styles.titleRight}>
          <span className={styles.packetCount}>most recent {data.length} packets</span>
          <button className={styles.collapseBtn} onClick={onSearch}>⌕ search</button>
          <button className={styles.collapseBtn} onClick={() => setCollapsed(c => !c)}>
            <span className={`${styles.arrow} ${collapsed ? styles.arrowCollapsed : ''}`}>▲</span>
          </button>
        </div>
      </div>

      {/* column headers */}
      <div className={styles.header}>
        <span>src ip</span>
        <span>dst ip</span>
        <span>protocol</span>
        <span>size</span>
        <span>timestamp</span>
      </div>

      {rows.length === 0 && (
        <div className={styles.empty}>no packets captured yet</div>
      )}

      {/* packet rows */}
      {rows.map((pkt, i) => (
        <div
          key={i}
          className={`${styles.row} ${i === rows.length - 1 ? styles.rowLast : ''}`}
        >
          <span className={styles.cell}>{pkt.src_ip}</span>
          <span className={styles.cell}>{pkt.dst_ip}</span>
          <span><ProtoBadge protocol={pkt.protocol} /></span>
          <span>{pkt.size} B</span>
          <span className={styles.timestamp}>{formatTimestamp(pkt.timestamp)}</span>
        </div>
      ))}

      {collapsed && data.length > COLLAPSED_LIMIT && (
        <div className={styles.more} onClick={() => setCollapsed(false)}>
          show more
        </div>
      )}
    </div>
  );
}
import styles from '../styles/PacketFeed.module.css';

// maps protocol name to its badge CSS class
const BADGE_CLASSES = {
  TCP: styles.badgeTcp,
  UDP: styles.badgeUdp,
  IGMP: styles.badgeIgmp,
  ICMP: styles.badgeIcmp,
};

// maps protocol number to name
const PROTO_NAMES = { 1: "ICMP", 2: "IGMP", 6: "TCP", 17: "UDP", 41: "IPv6", 89: "OSPF" };

// resolves protocol number or string to a colored badge
function ProtoBadge({ protocol }) {
  const name = typeof protocol === "number" ? (PROTO_NAMES[protocol] ?? "UNK") : protocol;
  return (
    <span className={`${styles.badge} ${BADGE_CLASSES[name] ?? styles.badgeUnknown}`}>
      {name}
    </span>
  );
}

// formats ISO timestamp to HH:MM:SS.mmm
function formatTimestamp(ts) {
  if (!ts) return "—";
  try {
    return new Date(ts).toLocaleTimeString("en-CA", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      fractionalSecondDigits: 3,
    });
  } catch {
    return ts;
  }
}

export default function PacketFeed({ data = [], limit = 50 }) {
  // cap rows shown to limit
  const rows = data.slice(0, limit);

  return (
    <div className={styles.panel}>
      {/* title + total count */}
      <div className={styles.titleRow}>
        <div className={styles.title}>live packet feed</div>
        <span className={styles.packetCount}>{data.length} packets</span>
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
    </div>
  );
}
/**
 * @file PacketFeed.jsx
 * @description Live packet feed panel displayed at the bottom of the dashboard.
 *
 * Renders the most recent captured packets in a scrollable table with five
 * columns: source IP, destination IP, protocol badge, size, and timestamp.
 *
 * Features:
 *   - Collapse toggle — shrinks the list to COLLAPSED_LIMIT rows; a "show more"
 *     prompt at the bottom expands it again.
 *   - Search button — calls the onSearch prop to open the PacketSearch modal,
 *     which loads the full session packet list from the API.
 *   - Protocol badges — each protocol is rendered as a coloured pill derived
 *     from PROTO_NAMES / PROTO_COLOURS so the palette stays consistent across
 *     the dashboard.
 *
 * Props:
 *   @prop {object[]} data      - Array of packet objects from the stats API.
 *   @prop {number}   limit     - Maximum rows to display when expanded (default 18).
 *   @prop {number}   sessionId - Active session ID, passed through to search.
 *   @prop {function} onSearch  - Callback fired when the search button is clicked.
 */

import { useState } from 'react';

import ProtoBadge from '../ui/ProtoBadge';
import { formatTimestamp } from '../../utils/format';
import styles from './PacketFeed.module.css';

/** Number of rows shown when the feed is collapsed. */
const COLLAPSED_LIMIT = 6;

export default function PacketFeed({ data = [], limit = 18, onSearch}) {
  const [collapsed, setCollapsed] = useState(false);
  
  // slice to COLLAPSED_LIMIT when collapsed, otherwise respect the limit prop
  const rows = (collapsed ? data.slice(0, COLLAPSED_LIMIT) : data.slice(0, limit));

  return (
    <div className={styles.panel}>
      {/* title + packet count + search / collapse controls */}
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

      {/* packet rows — last row omits the bottom border via rowLast */}
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

      {/* expand prompt — only shown when collapsed and there are hidden rows */}
      {collapsed && data.length > COLLAPSED_LIMIT && (
        <div className={styles.more} onClick={() => setCollapsed(false)}>
          show more
        </div>
      )}
    </div>
  );
}
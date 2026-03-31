/**
 * @file SessionBar.jsx
 * @description Session selector and manager bar.
 *
 * Provides:
 *   - Dropdown to select the active session.
 *   - Create new session inline (keyboard support: Enter/Escape).
 *   - Delete sessions.
 *   - Export active session (CSV / Excel).
 *   - Aggregate stats across all sessions.
 *
 * Props:
 *   @prop {object[]}  sessions         - Array of session objects: { id, name, created_at, packet_count }.
 *   @prop {number}    activeSessionId  - Currently selected session ID.
 *   @prop {Function}  onSelect         - Callback when selecting a session (id) from the dropdown.
 *   @prop {Function}  onCreate         - Callback when creating a new session (name).
 *   @prop {Function}  onDelete         - Callback when deleting a session (id).
 *   @prop {Function}  onExport         - Callback to export a session (id, format).
 *   @prop {boolean}   isCapturing      - Whether live capture is active (disables new session input).
 */

import { useState, useEffect, useRef } from 'react';
import styles from './SessionBar.module.css';

/** Formats a timestamp for display, fallback to '—' */
function formatTimestamp(ts) {
  if (!ts) return '—';
  try {
    return new Date(ts).toLocaleDateString('en-CA', {
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return ts;
  }
}

export default function SessionBar({ sessions = [], activeSessionId, onSelect, onCreate, onDelete, onExport, isCapturing }) {
  const [open, setOpen] = useState(false);     // dropdown open state
  const [adding, setAdding] = useState(false); // inline "new session" input visible
  const [newName, setNewName] = useState("");  // new session input value
  const wrapRef = useRef(null);                // dropdown container
  const addingRef = useRef(null);              // new session input container

  const active = sessions.find((s) => s.id === activeSessionId);
  const totalPackets = sessions.reduce((sum, s) => sum + (s.packet_count || 0), 0);

  // close dropdown when clicking outside
  useEffect(() => {
    const handler = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // close new session input when clicking outside
  useEffect(() => {
    const handler = (e) => {
      if (addingRef.current && !addingRef.current.contains(e.target)) {
        setAdding(false);
        setNewName('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  /** Handles Enter/Escape key behavior for new session input */
  const handleCreate = (e) => {
    if (e.key === 'Enter' && newName.trim()) {
      onCreate(newName.trim());
      setNewName("");
      setAdding(false);
    }
    if (e.key === 'Escape') {
      setAdding(false);
      setNewName('');
    }
  };

  return (
    <div className={styles.bar}>
      {/* ── Left section: session dropdown & create ── */}
      <div className={styles.left}>
        <span className={styles.label}>session</span>

        {/* dropdown — closes on outside click via wrapRef */}
        <div ref={wrapRef} style={{ position: "relative" }}>
          <div className={styles.dropBtn} onClick={() => setOpen((o) => !o)}>
            <span>{active?.name ?? "no session"}</span>
            <span className={`${styles.arrow} ${open ? styles.arrowOpen : ''}`}>▼</span>
          </div>

          {(
            <div className={`${styles.menu} ${open ? styles.menuOpen : ''}`}>
              {sessions.map((sess, i) => (
                <div
                  key={sess.id}
                  className={`${styles.menuItem} ${i === sessions.length - 1 ? styles.menuItemLast : ''} ${sess.id === activeSessionId ? styles.menuItemActive : ''}`}
                  onClick={() => { onSelect(sess.id); setOpen(false); }}
                >
                  <div className={styles.itemLeft}>
                    {/* active dot turns green for selected session */}
                    <div className={`${styles.dot} ${sess.id === activeSessionId ? styles.dotActive : ''}`} />
                    <span className={`${styles.itemName} ${sess.id === activeSessionId ? styles.itemNameActive : ''}`}>
                      {sess.name}
                    </span>
                    <span className={styles.itemMeta}>{sess.packet_count ?? 0} pkts · {formatTimestamp(sess.created_at)}</span>
                  </div>
                  <button
                    className={styles.delBtn}
                    onClick={(e) => { e.stopPropagation(); onDelete(sess.id); }}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* toggle between "new session" button and input */}
        {adding ? (
          <div ref={addingRef}>
            <input
              className={styles.input}
              autoFocus
              placeholder="session name..."
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={handleCreate}
              disabled={isCapturing}
            />
          </div>
        ) : (
          <button className={styles.newBtn} onClick={() => setAdding(true)}>+ new</button>
        )}
      </div>

      {/* ── Right section: aggregate stats & export ── */}
      <div className={styles.right}>
        {/* export buttons — only shown when a session is selected */}
        {activeSessionId && (
          <>
            <button className={styles.exportBtn} onClick={() => onExport(activeSessionId, 'csv')}>↓ csv</button>
            <button className={styles.exportBtn} onClick={() => onExport(activeSessionId, 'excel')}>↓ excel</button>
            <div className={styles.divider} />
          </>
        )}
        
        <span className={styles.meta}>
          all sessions: <span className={`${styles.metaVal} ${styles.blue}`}>{totalPackets.toLocaleString()} pkts</span>
        </span>
        <div className={styles.divider} />
        <span className={styles.meta}>
          <span className={styles.metaVal}>{sessions.length}</span> sessions
        </span>
      </div>
    </div>
  );
}
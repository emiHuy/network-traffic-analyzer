import { useState, useEffect, useRef } from 'react';
import styles from '../styles/SessionBar.module.css';

export default function SessionBar({ sessions = [], activeSessionId, onSelect, onCreate, onDelete }) {
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const wrapRef = useRef(null);

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

  // create session on Enter, cancel on Escape
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
      <div className={styles.left}>
        <span className={styles.label}>session</span>

        {/* dropdown — closes on outside click via wrapRef */}
        <div ref={wrapRef} style={{ position: "relative" }}>
          <div className={styles.dropBtn} onClick={() => setOpen((o) => !o)}>
            <span>{active?.name ?? "no session"}</span>
            <span className={styles.arrow}>{open ? "▲" : "▼"}</span>
          </div>

          {open && (
            <div className={styles.menu}>
              {sessions.map((sess, i) => (
                <div
                  key={sess.id}
                  className={`${styles.menuItem} ${i === sessions.length - 1 ? styles.menuItemLast : ''} ${sess.id === activeSessionId ? styles.menuItemActive : ''}`}
                  onClick={() => { onSelect(sess.id); setOpen(false); }}
                >
                  <div className={styles.itemLeft}>
                    {/* active dot turns green for selected session */}
                    <div className={`${styles.dot} ${sess.id === activeSessionId ? styles.activeDot : ''}`} />
                    <span className={`${styles.itemName} ${sess.id === activeSessionId ? styles.activeItemName : ''}`}>
                      {sess.name}
                    </span>
                    <span className={styles.itemMeta}>{sess.packet_count ?? 0} pkts · {sess.created_at}</span>
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

        {/* toggle between input and button */}
        {adding ? (
          <input
            className={styles.input}
            autoFocus
            placeholder="session name..."
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={handleCreate}
          />
        ) : (
          <button className={styles.newBtn} onClick={() => setAdding(true)}>+ new</button>
        )}
      </div>

      {/* aggregate stats across all sessions */}
      <div className={styles.right}>
        <span className={styles.meta}>
          all sessions: <span className={styles.metaVal}>{totalPackets.toLocaleString()} pkts</span>
        </span>
        <div className={styles.divider} />
        <span className={styles.meta}>
          <span className={styles.metaVal}>{sessions.length}</span> sessions
        </span>
      </div>
    </div>
  );
}
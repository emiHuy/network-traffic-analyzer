import { useState, useEffect, useRef } from 'react';
import styles from './PacketSearch.module.css';
import { PROTO_NAMES, PROTO_COLOURS } from '../../constants/protocols';

// formats ISO timestamp to HH:MM:SS.mmm
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

function ProtoBadge({ protocol }) {
  const name = typeof protocol === 'number' ? (PROTO_NAMES[protocol] ?? 'UNK') : (protocol ?? 'UNK');
  const color = PROTO_COLOURS[name] ?? PROTO_COLOURS['UNK'];
  return (
    <span className={styles.badge} style={{ color, background: `${color}1f` }}>
      {name}
    </span>
  );
}

function matchesFilters(pkt, global_, fields) {
  // global search — match any field
  if (global_) {
    const q = global_.toLowerCase();
    const proto = typeof pkt.protocol === 'number' ? (PROTO_NAMES[pkt.protocol] ?? 'UNK') : (pkt.protocol ?? '');
    const haystack = [pkt.src_ip, pkt.dst_ip, proto, String(pkt.size), pkt.timestamp].join(' ').toLowerCase();
    if (!haystack.includes(q)) return false;
  }
  // per-field filters
  if (fields.src_ip && !pkt.src_ip?.toLowerCase().includes(fields.src_ip.toLowerCase())) return false;
  if (fields.dst_ip && !pkt.dst_ip?.toLowerCase().includes(fields.dst_ip.toLowerCase())) return false;
  if (fields.protocol) {
    const proto = typeof pkt.protocol === 'number' ? (PROTO_NAMES[pkt.protocol] ?? 'UNK') : (pkt.protocol ?? '');
    if (!proto.toLowerCase().includes(fields.protocol.toLowerCase())) return false;
  }
  if (fields.size && !String(pkt.size).includes(fields.size)) return false;
  if (fields.timestamp && !pkt.timestamp?.includes(fields.timestamp)) return false;
  return true;
}

export default function PacketSearch({ sessionId, onClose, fetchAllPackets }) {
  const [packets, setPackets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [global_, setGlobal] = useState('');
  const [fields, setFields] = useState({ src_ip: '', dst_ip: '', protocol: '', size: '', timestamp: '' });
  const [showFields, setShowFields] = useState(false);
  const overlayRef = useRef(null);
  
  // fetch all packets on mount
  useEffect(() => {
    async function load() {
      setLoading(true);
      const data = await fetchAllPackets(sessionId);
      setPackets(data);
      setLoading(false);
    }
    load();
  }, [sessionId]);

  // close on Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const setField = (key, val) => setFields((f) => ({ ...f, [key]: val }));
  const clearAll = () => { setGlobal(''); setFields({ src_ip: '', dst_ip: '', protocol: '', size: '', timestamp: '' }); };
  const hasFilters = global_ || Object.values(fields).some(Boolean);

  const filtered = packets.filter((p) => matchesFilters(p, global_, fields));
  const unique = (key) => [...new Set(packets.map(p => p[key]).filter(Boolean))].sort();

  return (
    <div className={styles.overlay} ref={overlayRef} onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}>
      <div className={styles.modal}>

        {/* ── header ── */}
        <div className={styles.header}>
          <span className={styles.title}>packet search</span>
          <div className={styles.headerRight}>
            <span className={styles.count}>
              {loading ? 'loading…' : `${filtered.length} / ${packets.length} packets`}
            </span>
            <button className={styles.closeBtn} onClick={onClose}>✕</button>
          </div>
        </div>

        {/* ── global search bar ── */}
        <div className={styles.searchRow}>
          <input
            className={styles.globalInput}
            placeholder="search all fields…"
            value={global_}
            onChange={(e) => setGlobal(e.target.value)}
            autoFocus
          />
          <button
            className={`${styles.fieldToggle} ${showFields ? styles.fieldToggleActive : ''}`}
            onClick={() => setShowFields((s) => !s)}
          >
            filters
          </button>
          {hasFilters && (
            <button className={styles.clearBtn} onClick={clearAll}>clear</button>
          )}
        </div>

        {/* ── per-field filters ── */}
        {showFields && (
        <div className={styles.fields}>
            {/* dropdowns for src_ip, dst_ip, protocol */}
            {['src_ip', 'dst_ip', 'protocol'].map((key) => (
            <div key={key} className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>{key.replace('_', ' ')}</label>
                <select
                className={styles.fieldSelect}
                value={fields[key]}
                onChange={(e) => setField(key, e.target.value)}
                >
                <option value="">all</option>
                {key != 'protocol' && unique(key).map((val) => <option key={val} value={val}>{val}</option>)}
                {key === 'protocol' && unique('protocol').map((val) => {
                    const name = typeof val === 'number' ? (PROTO_NAMES[val] ?? 'UNK') : val;
                    const color = PROTO_COLOURS[name] ?? PROTO_COLOURS['UNK'];
                    return <option key={val} value={name} style={{ color: `${color}` }}>{name}</option>;
                })}
                </select>
            </div>
            ))}
            {/* text inputs for size and timestamp */}
            {['size', 'timestamp'].map((key) => (
            <div key={key} className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>{key}</label>
                <input
                className={styles.fieldInput}
                placeholder={`filter ${key}…`}
                value={fields[key]}
                onChange={(e) => setField(key, e.target.value)}
                />
            </div>
            ))}
        </div>
        )}

        {/* ── table ── */}
        <div className={styles.tableWrap}>
          {loading ? (
            <div className={styles.empty}>loading packets…</div>
          ) : filtered.length === 0 ? (
            <div className={styles.empty}>no packets match</div>
          ) : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>src ip</th>
                  <th>dst ip</th>
                  <th>protocol</th>
                  <th>size</th>
                  <th>timestamp</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((pkt, i) => (
                  <tr key={i}>
                    <td className={styles.cell}>{pkt.src_ip}</td>
                    <td className={styles.cell}>{pkt.dst_ip}</td>
                    <td><ProtoBadge protocol={pkt.protocol} /></td>
                    <td>{pkt.size} B</td>
                    <td className={styles.ts}>{formatTimestamp(pkt.timestamp)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

      </div>
    </div>
  );
}

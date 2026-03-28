import { useState, useCallback } from 'react';
import styles from './AiAnalysis.module.css';

const API = 'http://localhost:8000';
const LS_KEY = 'gemini_api_key';

// ── Backend API calls ─────────────────────────────────────────────────────────

async function analyzeSession(stats, alerts, apiKey) {
  const proto = (stats?.protocol_breakdown ?? [])
    .map(p => `${p.protocol}: ${p.total}`)
    .join(', ');

  const topIps = (stats?.top_10_ips ?? [])
    .slice(0, 5)
    .map(ip => `${ip.ip} (${ip.total} pkts)`)
    .join(', ');

  const ppm = stats?.packets_per_minute ?? [];
  const peak = ppm.length ? Math.max(...ppm.map(p => p.total)) : 0;

  const alertsSummary = alerts.length === 0
    ? 'No anomalies detected.'
    : alerts.slice(0, 5)
        .map(a => `[${a.severity.toUpperCase()}] ${a.rule_triggered}: ${a.description}`)
        .join('\n');

  const res = await fetch(`${API}/ai/analyze/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key:              apiKey,
      total_packets:        stats?.total_packets ?? 0,
      avg_packet_size:      stats?.average_packet_size ?? null,
      active_hosts:         stats?.active_hosts ?? 0,
      peak_packets_per_min: peak,
      protocol_breakdown:   proto,
      top_ips:              topIps,
      alert_count:          alerts.length,
      alerts_summary:       alertsSummary,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.detail ?? `Server error ${res.status}`);
  }
  return (await res.json()).result;
}

async function analyzeAlert(alert, apiKey) {
  const res = await fetch(`${API}/ai/analyze/alert`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key:     apiKey,
      rule:        alert.rule_triggered,
      severity:    alert.severity,
      src_ip:      alert.src_ip,
      dst_ip:      alert.dst_ip,
      description: alert.description,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.detail ?? `Server error ${res.status}`);
  }
  return (await res.json()).result;
}

// ── Markdown renderer ─────────────────────────────────────────────────────────

function Markdown({ text }) {
  if (!text) return null;
  return (
    <>
      {text.split('\n').map((line, i) => {
        if (!line.trim()) return <div key={i} style={{ height: '6px' }} />;
        const parts = line.split(/\*\*(.*?)\*\*/g);
        return (
          <p key={i} style={{ margin: 0, lineHeight: 1.65 }}>
            {parts.map((part, j) =>
              j % 2 === 1 ? <strong key={j}>{part}</strong> : part
            )}
          </p>
        );
      })}
    </>
  );
}

// ── Loading skeleton ──────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className={styles.skeletonWrap}>
      {[88, 72, 80, 50, 65, 38].map((w, i) => (
        <div key={i} className={styles.skeleton} style={{ width: `${w}%` }} />
      ))}
    </div>
  );
}

// ── API key setup ─────────────────────────────────────────────────────────────

function ApiKeySetup({ onSave }) {
  const [val, setVal] = useState('');
  const [show, setShow] = useState(false);
  const [err, setErr] = useState(null);

  function save() {
    const trimmed = val.trim();
    if (!trimmed) { setErr('Please enter a key.'); return; }
    localStorage.setItem(LS_KEY, trimmed);
    setErr(null);
    onSave(trimmed);
  }

  return (
    <div className={styles.keySetup}>
      <div className={styles.keyGlyph}>✦</div>
      <p className={styles.keyTitle}>gemini api key required</p>
      <p className={styles.keyHint}>
        Get a free key at{' '}
        <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer" className={styles.keyLink}>
          aistudio.google.com/apikey
        </a>
        . Stored in your browser — only sent to your local backend.
      </p>
      <div className={styles.keyRow}>
        <input
          className={styles.keyInput}
          type={show ? 'text' : 'password'}
          placeholder="AIza..."
          value={val}
          onChange={e => { setVal(e.target.value); setErr(null); }}
          onKeyDown={e => e.key === 'Enter' && save()}
          spellCheck={false}
          autoComplete="off"
          autoFocus
        />
        <button className={styles.showBtn} onClick={() => setShow(s => !s)}>
          {show ? 'hide' : 'show'}
        </button>
        <button className={styles.saveBtn} onClick={save}>
          save
        </button>
      </div>
      {err && <div className={styles.keyError}>{err}</div>}
    </div>
  );
}

// ── Alert explainer card ──────────────────────────────────────────────────────

function AlertExplainer({ alert, apiKey }) {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function explain() {
    setLoading(true);
    setError(null);
    try {
      setResult(await analyzeAlert(alert, apiKey));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  const isHigh = alert.severity === 'high';

  return (
    <div className={`${styles.alertCard} ${isHigh ? styles.alertHigh : styles.alertMedium}`}>
      <div className={styles.alertHeader}>
        <div className={styles.alertMeta}>
          <span className={styles.ruleBadge}>{alert.rule_triggered}</span>
          <span className={`${styles.sevBadge} ${isHigh ? styles.sevHigh : styles.sevMedium}`}>
            {alert.severity}
          </span>
        </div>
        <button className={styles.inlineBtn} onClick={explain} disabled={loading}>
          {loading ? 'analyzing…' : result ? '↺ re-explain' : '✦ explain'}
        </button>
      </div>

      <p className={styles.alertDesc}>{alert.description}</p>
      <div className={styles.alertSrc}>{alert.src_ip} → {alert.dst_ip}</div>

      {error && <div className={styles.errorBox}>{error}</div>}
      {loading && !result && <Skeleton />}
      {result && (
        <div className={styles.aiResult}>
          <span className={styles.aiLabel}>✦ gemini analysis</span>
          <div className={styles.aiText}><Markdown text={result} /></div>
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function AiAnalysis({ isVisible, stats, alerts = [], sessionId }) {
  const [apiKey, setApiKey] = useState(() => localStorage.getItem(LS_KEY) ?? null);
  const [summary, setSummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState(null);

  const hasData = (stats?.total_packets ?? 0) > 0;

  const generateSummary = useCallback(async () => {
    if (!stats || !apiKey) return;
    setSummaryLoading(true);
    setSummaryError(null);
    try {
      setSummary(await analyzeSession(stats, alerts, apiKey));
    } catch (e) {
      setSummaryError(e.message);
    } finally {
      setSummaryLoading(false);
    }
  }, [stats, alerts, apiKey]);

  function clearKey() {
    localStorage.removeItem(LS_KEY);
    setApiKey(null);
    setSummary(null);
    setSummaryError(null);
  }

  return (
    <div className={styles.panel} style={{ display: isVisible ? '' : 'none' }}>

      {!apiKey && <ApiKeySetup onSave={setApiKey} />}

      {apiKey && (
        <>
          <div className={styles.keyBanner}>
            <span className={styles.keyActive}>✦ gemini api · ready</span>
            <button className={styles.clearKeyBtn} onClick={clearKey}>change key</button>
          </div>

          {/* Session summary */}
          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <span className={styles.sectionTitle}>session summary</span>
              <button
                className={styles.summaryBtn}
                onClick={generateSummary}
                disabled={summaryLoading || !hasData}
                title={!hasData ? 'No capture data yet' : undefined}
              >
                {summaryLoading ? 'analyzing…' : summary ? '↺ re-analyze' : '✦ analyze this session'}
              </button>
            </div>

            {!hasData && !summary && (
              <div className={styles.empty}>no session data yet — start a capture first</div>
            )}
            {summaryError && <div className={styles.errorBox}>{summaryError}</div>}
            {summaryLoading && !summary && <Skeleton />}

            {summary && (
              <div className={styles.summaryCard}>
                <div className={styles.summaryMeta}>
                  <span className={styles.aiLabel}>✦ gemini ai-generated</span>
                  <span className={styles.summaryStats}>
                    {stats?.total_packets?.toLocaleString()} packets · {stats?.active_hosts} hosts
                  </span>
                </div>
                <div className={styles.summaryText}><Markdown text={summary} /></div>
              </div>
            )}
          </div>

          {/* Alert explanations */}
          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <span className={styles.sectionTitle}>anomaly explanations</span>
              {alerts.length > 0 && (
                <span className={styles.alertCountBadge}>
                  {alerts.length} alert{alerts.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>

            {alerts.length === 0 ? (
              <div className={styles.empty}>
                {sessionId ? 'no alerts to explain' : 'select a session to view alerts'}
              </div>
            ) : (
              <div className={styles.alertList}>
                {alerts.map(alert => (
                  <AlertExplainer key={alert.id} alert={alert} apiKey={apiKey} />
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

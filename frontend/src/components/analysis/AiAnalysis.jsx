/**
 * @file AiAnalysis.jsx
 * @description AI-powered analysis panel for NETAnalyzer.
 *
 * Provides two analysis features powered by Google Gemini:
 *   1. Session Summary  — a high-level overview of captured traffic
 *      (protocols, top IPs, volume, and alert count).
 *   2. Alert Explainer — a per-alert card that explains what triggered
 *      the anomaly, its risk level, and a recommended action.
 *
 * API key handling:
 *   - If the backend has GEMINI_API_KEY set in its .env, it is used
 *     automatically and the key input UI is hidden.
 *   - Otherwise the user enters a key in the browser; it is persisted
 *     to localStorage (key: "gemini_api_key") and sent with each request
 *     to the local backend — never to Google directly.
 *
 * Props:
 *   @prop {boolean}  isVisible   - Controls display (tab switching).
 *   @prop {object}   stats       - Session stats from the WebSocket / REST API.
 *   @prop {object[]} alerts      - Anomaly alert objects for the active session.
 *   @prop {number}   sessionId   - Active session ID (resets AI results on change).
 *   @prop {boolean}  isCapturing - Disables analysis buttons during live capture.
 */

import { useState, useCallback, useEffect } from 'react';
import { analyzeSession, analyzeAlert, fetchAiStatus } from '../../api/client.js';
import { useToast } from '../ui/ToastContext.jsx';
import styles from './AiAnalysis.module.css';

/** localStorage key used to persist the user-supplied Gemini API key. */
const LS_KEY = 'gemini_api_key';

// ── Markdown renderer ─────────────────────────────────────────────────────────

// renders Gemini response text — supports **bold** and blank-line spacing
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

// animated placeholder bars shown while Gemini is generating a response
function Skeleton() {
  return (
    <div className={styles.skeletonWrap}>
      {[88, 72, 80, 50, 65, 38].map((w, i) => (
        <div key={i} className={styles.skeleton} style={{ width: `${w}%` }} />
      ))}
    </div>
  );
}

// ── API key input (shared by setup screen + change flow) ──────────────────────

// controlled key input with show/hide toggle — shared by setup screen and change flow
function KeyInput({ onSave, onCancel, autoFocus = true, currentValue = '' }) {
  const toast = useToast();
  const [val, setVal] = useState(currentValue);
  const [show, setShow] = useState(false);

  // validate, persist to localStorage, then notify parent
  function save() {
    const trimmed = val.trim();
    if (!trimmed) { toast.error('Please enter an API key', 'Field is blank.'); return; }
    localStorage.setItem(LS_KEY, trimmed);
    onSave(trimmed);
  }

  return (
    <div className={styles.keyInputBlock}>
      <div className={styles.keyRow}>
        <input
          className={styles.keyInput}
          type={show ? 'text' : 'password'}
          placeholder="AIza..."
          value={val}
          onChange={e => { setVal(e.target.value); }}
          onKeyDown={e => {
            if (e.key === 'Enter') save();
            if (e.key === 'Escape' && onCancel) onCancel();
          }}
          spellCheck={false}
          autoComplete="off"
          autoFocus={autoFocus}
        />
        <button className={styles.showBtn} onClick={() => setShow(s => !s)}>
          {show ? 'hide' : 'show'}
        </button>
        <button className={styles.saveBtn} onClick={save}>save</button>
        {onCancel && (
          <button className={styles.cancelBtn} onClick={onCancel}>cancel</button>
        )}
      </div>
    </div>
  );
}

// ── First-time setup screen ───────────────────────────────────────────────────

// full-panel prompt shown when neither an env key nor a browser key is available
function ApiKeySetup({ onSave }) {
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
      <KeyInput onSave={onSave} />
    </div>
  );
}

// ── Alert explainer card ──────────────────────────────────────────────────────

// single alert card with an on-demand Gemini explanation; manages its own fetch state
function AlertExplainer({ alert, apiKey, isCapturing }) {
  const toast = useToast();
  const [result, setResult] = useState(null); // Gemini response text
  const [loading, setLoading] = useState(false);

  async function explain() {
    setLoading(true);
    try {
      setResult(await analyzeAlert(alert, apiKey));
    } catch (e) {
      toast.error('AI analysis failed', e.message);
    } finally {
      setLoading(false);
    }
  }

  const isHigh = alert.severity === 'high';

  return (
    <div className={`${styles.alertCard} ${isHigh ? styles.alertHigh : styles.alertMedium}`}>
      {/* ── card header: rule badge, severity, explain button ── */}
      <div className={styles.alertHeader}>
        <div className={styles.alertMeta}>
          <span className={styles.ruleBadge}>{alert.rule_triggered}</span>
          <span className={`${styles.sevBadge} ${isHigh ? styles.sevHigh : styles.sevMedium}`}>
            {alert.severity}
          </span>
        </div>
        <button className={styles.inlineBtn} onClick={explain} disabled={loading || isCapturing}>
          {loading ? 'analyzing…' : result ? '↺ re-explain' : '✦ explain'}
        </button>
      </div>

      {/* ── alert detail ── */}
      <p className={styles.alertDesc}>{alert.description}</p>
      <div className={styles.alertSrc}>{alert.src_ip} → {alert.dst_ip}</div>

      {/* skeleton shown only while first load is in progress */}
      {loading && !result && <Skeleton />}
      {/* Gemini result block — rendered after the first successful response */}
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

export default function AiAnalysis({ isVisible, stats, alerts = [], sessionId, isCapturing }) {
  const toast = useToast();

  // null = no browser key; rely on env key or show setup screen
  const [apiKey, setApiKey] = useState(() => localStorage.getItem(LS_KEY) ?? null);
  const [envConfigured, setEnvConfigured] = useState(false);
  const [changingKey, setChangingKey] = useState(false);
  const [summary, setSummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(false);

  // check whether the backend has a GEMINI_API_KEY env var configured
  useEffect(() => {
    fetchAiStatus()
      .then(({ configured }) => setEnvConfigured(configured))
      .catch(() => setEnvConfigured(false));
  }, []);

  // clear stale AI results when the active session changes
  useEffect(() => {
    setSummary(null);
    setSummaryLoading(false);
  }, [sessionId]);

  // ready when either the env key or a browser key is available
  const ready = envConfigured || !!apiKey;
  // null tells the backend to use its own env key instead
  const activeKey = envConfigured ? null : apiKey;
  const hasData = (stats?.total_packets ?? 0) > 0;

  const generateSummary = useCallback(async () => {
    if (!stats) return;
    setSummaryLoading(true);
    try {
      setSummary(await analyzeSession(stats, alerts, activeKey));
    } catch (e) {
      toast.error('AI analysis failed', e.message);
    } finally {
      setSummaryLoading(false);
    }
  }, [stats, alerts, activeKey]);

  function handleNewKey(key) {
    setApiKey(key);
    setChangingKey(false);
    setSummary(null);
    toast.success('API key saved');
  }

  function clearKey() {
    localStorage.removeItem(LS_KEY);
    setApiKey(null);
    setChangingKey(false);
    setSummary(null);
  }

  return (
    <div className={styles.panel} style={{ display: isVisible ? '' : 'none' }}>

      {!ready && <ApiKeySetup onSave={handleNewKey} />}

      {ready && (
        <>
          {/* key banner — switches to an inline form when changing the key */}
          {changingKey ? (
            <div className={styles.keyChangeBanner}>
              <span className={styles.keyChangeLabel}>new api key</span>
              <KeyInput onSave={handleNewKey} onCancel={() => setChangingKey(false)} currentValue={apiKey} />
            </div>
          ) : (
            <div className={styles.keyBanner}>
              {envConfigured ? (
                <>
                  <span className={styles.keyActive}>✦ gemini api · env key active</span>
                 {/* offer to clear a redundant localStorage key if one exists */}
                  {apiKey && (
                    <button className={styles.clearKeyBtn} onClick={clearKey}>
                      clear ui key
                    </button>
                  )}
                </>
              ) : (
                <>
                  <span className={styles.keyActive}>✦ gemini api · ready</span>
                  <button className={styles.clearKeyBtn} onClick={() => setChangingKey(true)}>
                    change key
                  </button>
                </>
              )}
            </div>
          )}

          {/* Session summary */}
          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <span className={styles.sectionTitle}>session summary</span>
              <button
                className={styles.summaryBtn}
                onClick={generateSummary}
                disabled={summaryLoading || !hasData || isCapturing}
                title={!hasData ? 'No capture data yet' : undefined}
              >
                {summaryLoading ? 'analyzing…' : summary ? '↺ re-analyze' : '✦ analyze this session'}
              </button>
            </div>

            {isCapturing && (
              <div className={styles.empty}>capture in progress — stop capture to analyze</div>
            )}
            {!isCapturing && !hasData && !summary && (
              <div className={styles.empty}>no session data yet — start a capture first</div>
            )}

            {/* skeleton only on initial load; keeps card stable on re-analyze */}
            {summaryLoading && !summary && <Skeleton />}

            {/* result card */}
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
                  <AlertExplainer key={alert.id} alert={alert} apiKey={activeKey} isCapturing={isCapturing}/>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

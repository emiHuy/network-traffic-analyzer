/**
 * @file TopBar.jsx
 * @description Top application bar showing capture status, session timer, and start/stop controls.
 *
 * Props:
 *   @prop {number|string}  sessionId       - ID of the currently selected session (required to start capture).
 *   @prop {boolean}        isCapturing     - Whether live packet capture is active.
 *   @prop {boolean}        sessionHasData  - Whether the active session already contains data.
 *   @prop {Function}       onStart         - Callback to start capture.
 *   @prop {Function}       onStop          - Callback to stop capture.
 *   @prop {boolean}        isStopping      - Whether a stop request is in progress.
 */

import { useEffect, useRef, useState } from 'react';
import styles from './TopBar.module.css';

// formats seconds into HH:MM:SS
function fmt(s) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
}

export default function TopBar({ sessionId, isCapturing, sessionHasData, onStart, onStop, isStopping }) {
  const [elapsed, setElapsed] = useState(0);
  const intervalRef = useRef(null);

  /**
   * Starts or stops the capture timer when capture state changes.
   * Resets timer when starting a new capture.
   */
  useEffect(() => {
    if (isCapturing) {
      setElapsed(0);
      intervalRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);
    } else {
      clearInterval(intervalRef.current);
    }
    return () => clearInterval(intervalRef.current);
  }, [isCapturing]);

  return (
    <div className={styles.bar}>
      <div className={styles.logo}>
        Net<span className={styles.logoMuted}>Analyzer</span>
      </div>
  
      {/* Capture status display */}
      <div className={styles.status}>
        {isStopping ? (
          <span>stopping…</span>
        ) : isCapturing ? (
          <>
            <span><span className={styles.pulse} />capturing</span>
            <span className={styles.timer}>{fmt(elapsed)}</span>
          </>
        ) : (
          <span>idle</span>
        )}
      </div>

      {/* Start / Stop buttons */}
      <div className={styles.btns}>
        <button
          className={`${styles.btnBase} ${styles.btnStart} ${isCapturing || !sessionId || sessionHasData ? styles.btnDisabled : ''}`}
          onClick={onStart}
          disabled={isCapturing || !sessionId || sessionHasData}
        >
          ▶ start
        </button>
        <button
          className={`${styles.btnBase} ${styles.btnStop} ${!isCapturing || isStopping ? styles.btnDisabled : ''}`}
          onClick={onStop}
          disabled={!isCapturing || isStopping}
        >
          ■ stop
        </button>
      </div>
    </div>
  );
}
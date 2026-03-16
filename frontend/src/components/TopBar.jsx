import { useEffect, useRef, useState } from 'react';
import styles from '../styles/TopBar.module.css';

// formats seconds into HH:MM:SS
function fmt(s) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
}

export default function TopBar({ isCapturing, onStart, onStop }) {
  const [elapsed, setElapsed] = useState(0);
  const intervalRef = useRef(null);

  // start/stop elapsed timer when capture state changes
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

      <div className={styles.status}>
        {isCapturing ? (
          <>
            <span><span className={styles.pulse} />capturing</span>
            <span className={styles.timer}>{fmt(elapsed)}</span>
          </>
        ) : (
          <span>idle</span>
        )}
      </div>

      <div className={styles.btns}>
        <button
          className={`${styles.btnBase} ${styles.btnStart} ${isCapturing ? styles.btnDisabled : ''}`}
          onClick={onStart}
          disabled={isCapturing}
        >
          ▶ start
        </button>
        <button
          className={`${styles.btnBase} ${styles.btnStop} ${!isCapturing ? styles.btnDisabled : ''}`}
          onClick={onStop}
          disabled={!isCapturing}
        >
          ■ stop
        </button>
      </div>
    </div>
  );
}
import styles from '../styles/Toast.module.css';

const ICONS = {
  error:   '✕',
  warning: '⚠',
  success: '✓',
  info:    '◎',
  alert:   '⚑',
};

export default function ToastContainer({ toasts, onDismiss }) {
  if (!toasts.length) return null;
  return (
    <div className={styles.container}>
      {toasts.map(t => (
        <div
          key={t.id}
          className={`${styles.toast} ${styles[t.type]} ${t.exiting ? styles.exiting : ''}`}
        >
          <span className={styles.icon}>{ICONS[t.type]}</span>
          <div className={styles.body}>
            <span className={styles.message}>{t.message}</span>
            {t.detail && <span className={styles.detail}>{t.detail}</span>}
          </div>
          <button className={styles.close} onClick={() => onDismiss(t.id)}>✕</button>
        </div>
      ))}
    </div>
  );
}

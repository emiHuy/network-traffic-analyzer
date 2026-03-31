/**
 * @file ToastContainer.jsx
 * @description Dynamic toast notification container for transient messages.
 *
 * Displays toasts for system events, user actions, or alerts. Each toast includes:
 *   - An icon reflecting its type (error, warning, success, info, alert)
 *   - A main message and optional detailed text
 *   - A dismiss button to remove the toast
 *
 * Toasts support an "exiting" state for smooth fade-out animations.
 *
 * Props:
 *   @prop {Array}    toasts      - List of toast objects to display.
 *   @prop {Function} onDismiss   - Callback invoked with the toast ID when the close button is clicked.
 *
 * Toast object structure:
 *   @type {Object}
 *   @prop {string} id       - Unique identifier for the toast.
 *   @prop {string} type     - One of 'error', 'warning', 'success', 'info', 'alert'.
 *   @prop {string} message  - Main text to display.
 *   @prop {string} [detail] - Optional detailed description.
 *   @prop {boolean} [exiting] - Whether the toast is in the process of exiting (animation state).
 */

import styles from './Toast.module.css';

const ICONS = {
  error:   '✕',
  warning: '⚠',
  success: '✓',
  info:    '◎',
  alert:   '⚑',
};

export default function ToastContainer({ toasts, onDismiss }) {
  // Don't render anything if there are no toasts
  if (!toasts.length) return null;

  return (
    <div className={styles.container}>
      {toasts.map(t => (
        <div
          key={t.id}
          className={`${styles.toast} ${styles[t.type]} ${t.exiting ? styles.exiting : ''}`}
        >
          {/* Icon for toast type */}
          <span className={styles.icon}>{ICONS[t.type]}</span>

          {/* Main message and optional detail */}
          <div className={styles.body}>
            <span className={styles.message}>{t.message}</span>
            {t.detail && <span className={styles.detail}>{t.detail}</span>}
          </div>

          {/* Close button to dismiss toast */}
          <button className={styles.close} onClick={() => onDismiss(t.id)}>✕</button>
        </div>
      ))}
    </div>
  );
}

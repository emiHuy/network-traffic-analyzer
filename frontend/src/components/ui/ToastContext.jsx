/**
 * @file ToastProvider.jsx
 * @description Context provider and hooks for global toast notifications.
 *
 * Wrap your app with <ToastProvider> to enable transient toast messages anywhere.
 * Provides a convenient `useToast` hook for triggering different types of toasts:
 *   - error:   Critical issues (longer duration)
 *   - warning: Warnings requiring attention
 *   - success: Successful operations
 *   - info:    Informational messages
 *   - alert:   Persistent alerts (manual dismissal required)
 *
 * Toasts automatically fade out using an "exiting" state, except for persistent alerts.
 *
 * Components:
 *   - ToastProvider: Wraps app and maintains toast state
 *   - ToastContainer: Renders active toasts with type-specific icons and animations
 *
 * Usage:
 *   const toast = useToast();
 *   toast.success('Saved successfully!');
 *
 * Internals:
 *   - Uses `useState` to track toast array.
 *   - `useRef` generates unique IDs for each toast.
 *   - `dismiss` function sets exiting state then removes the toast after 280ms.
 *   - `addToast` adds a new toast with optional type, duration, and detail.
 *   - Each toast type has a default duration; alerts persist until manually dismissed.
 */

import { createContext, useContext, useState, useCallback, useRef } from 'react';
import ToastContainer from './ToastContainer';

// Context for toast functions
const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);

  // Dismiss toast by ID
  const dismiss = useCallback((id) => {
    // Trigger exit animation
    setToasts(prev => prev.map(t => t.id === id ? { ...t, exiting: true } : t));
    // Remove from state after animation duration
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 280);
  }, []);

  // Add a new toast
  const addToast = useCallback(({ message, type = 'info', duration = 4000, detail = null }) => {
    const id = ++idRef.current;
    setToasts(prev => [...prev, { id, message, type, detail, exiting: false }]);
    if (duration > 0) setTimeout(() => dismiss(id), duration);
    return id;
  }, [dismiss]);

  // Convenience methods for each toast type with default durations
  const toast = {
    error:   (message, detail)         => addToast({ message, type: 'error',   detail, duration: 5000 }),
    warning: (message, detail)         => addToast({ message, type: 'warning', detail, duration: 5000 }),
    success: (message, detail)         => addToast({ message, type: 'success', detail, duration: 3500 }),
    info:    (message, detail)         => addToast({ message, type: 'info',    detail, duration: 3500 }),
    alert:   (message, detail)         => addToast({ message, type: 'alert',   detail, duration: 0    }),
  };

  return (
    <ToastContext.Provider value={toast}>
      {children}
      {/* Renders all active toasts */}
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

/**
 * Hook to access toast functions
 * @throws Error if used outside <ToastProvider>
 */
export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}

import { createContext, useContext, useState, useCallback, useRef } from 'react';
import ToastContainer from './ToastContainer';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id) => {
    setToasts(prev => prev.map(t => t.id === id ? { ...t, exiting: true } : t));
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 280);
  }, []);

  const addToast = useCallback(({ message, type = 'info', duration = 4000, detail = null }) => {
    const id = ++idRef.current;
    setToasts(prev => [...prev, { id, message, type, detail, exiting: false }]);
    if (duration > 0) setTimeout(() => dismiss(id), duration);
    return id;
  }, [dismiss]);

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
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}

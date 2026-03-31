/**
 * @file index.jsx
 * @description
 * Application entry point. Initializes React, attaches the root component
 * to the DOM, and wraps the app with global providers.
 *
 * Responsibilities:
 *   - Mounts <App /> to the DOM
 *   - Enables global toast notifications via <ToastProvider>
 *   - Activates React StrictMode for development checks
 *
 * Notes:
 *   - <ToastProvider> ensures toast state and hooks are available throughout
 *     the component tree.
 *   - React.StrictMode adds additional runtime checks in development only.
 */

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { ToastProvider } from './components/ui/ToastContext.jsx';
import App from './App.jsx';

import './index.css';

// Mount the app with StrictMode and ToastProvider
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ToastProvider>
      <App />
    </ToastProvider>
  </StrictMode>,
)


import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// --- Enterprise-Grade Error Suppression ---
// Big companies filter out "noise" errors caused by browser extensions or
// minor layout shifts that do not affect the actual application logic.
if (typeof window !== 'undefined') {
  const resizeObserverLoopErr = 'ResizeObserver loop limit exceeded';
  const extensionErr = 'Extension context invalidated';

  const originalOnError = window.onerror;
  window.onerror = (msg, url, lineNo, columnNo, error) => {
    if (typeof msg === 'string') {
      if (msg.includes(resizeObserverLoopErr) || msg.includes(extensionErr)) {
        // Swallow these specific errors - they are external/browser related
        return true;
      }
    }
    // Pass other errors to the default handler (or Sentry in production)
    return originalOnError ? originalOnError(msg, url, lineNo, columnNo, error) : false;
  };

  const originalOnUnhandledRejection = window.onunhandledrejection;
  window.onunhandledrejection = (e) => {
    const errorMsg = e.reason instanceof Error ? e.reason.message : String(e.reason);
    if (errorMsg.includes(extensionErr) || errorMsg.includes(resizeObserverLoopErr)) {
      e.preventDefault();
      return;
    }
    if (originalOnUnhandledRejection) originalOnUnhandledRejection.call(window, e);
  };
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import './index.css';

// Safely register PWA Service Worker and force immediate refresh when a newer bundle activates
try {
  if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
    let swReloaded = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (swReloaded) return;
      swReloaded = true;
      window.location.reload();
    });

    const updateSW = registerSW({
      immediate: true,
      onRegisteredSW(_swUrl, registration) {
        if (registration) {
          registration.update().catch(() => undefined);
          window.setInterval(() => {
            registration.update().catch(() => undefined);
          }, 5 * 60 * 1000);
          document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
              registration.update().catch(() => undefined);
            }
          });
        }
      },
      onNeedRefresh() {
        updateSW(true).catch(() => undefined);
      },
      onRegisterError(error) {
        console.warn('Service Worker registration skipped:', error);
      },
    });
  }
} catch (err) {
  console.warn('Service Worker unavailable in this browser context:', err);
}

// Tier 1 Google Maps Platform Demo Key Quota Listeners (Module Root)
(window as unknown as { gm_authFailure?: () => void }).gm_authFailure = () => {
  window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
};

const origConsoleError = console.error;
console.error = (...args: unknown[]) => {
  origConsoleError.apply(console, args);
  const msg = args
    .map((a) => {
      try {
        return String(a);
      } catch {
        return '';
      }
    })
    .join(' ');
  if (msg.includes('OverQuotaMapError') || msg.includes('QuotaExceededError')) {
    window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
  }
};

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);

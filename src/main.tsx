import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import { App } from './ui/App';
import { ErrorBoundary } from './ui/components/ErrorBoundary';
import { detectInAppBrowser, externalOpenUrl } from './domain/inapp';
import '@fontsource-variable/atkinson-hyperlegible-next/wght.css';
import './styles.css';

registerSW({ immediate: true });

// Opened from a chat app's built-in browser? Ask it once to reopen the page in the real browser.
const inApp = detectInAppBrowser(navigator.userAgent);
const target = inApp && externalOpenUrl(inApp, location.href);
try {
  if (target && !sessionStorage.getItem('ohright-external-tried')) {
    sessionStorage.setItem('ohright-external-tried', '1');
    location.href = target;
  }
} catch {
  /* storage blocked: just show the banner */
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);

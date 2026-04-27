import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
import { HelmetProvider } from 'react-helmet-async';
import App from './App';
import './styles/tailwind.css';
import './styles/card-utilities.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 60 * 24, // 24h — kept on disk
      refetchOnWindowFocus: false,
    },
  },
});

const persister = createSyncStoragePersister({
  storage: window.localStorage,
  key: 'teajia-query-cache',
  throttleTime: 1000,
});

// Don't persist sensitive or auth-shaped queries. Anything containing these
// substrings in its query key is excluded from disk.
const NEVER_PERSIST = ['auth', 'session', 'me', 'magic'];

// Reload once when a preloaded chunk fails (e.g. after a new deployment).
// Only runs in production — in dev, Vite HMR handles chunk invalidation natively
// and forcing a reload here would cause spurious full reloads on every file save.
if (import.meta.env.PROD) {
  window.addEventListener('vite:preloadError', () => {
    if (!sessionStorage.getItem('chunkReloaded')) {
      sessionStorage.setItem('chunkReloaded', '1');
      window.location.reload();
    }
  });
  // Clear the flag once the app has loaded cleanly
  window.addEventListener('load', () => {
    sessionStorage.removeItem('chunkReloaded');
  });
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <HelmetProvider>
      <PersistQueryClientProvider
        client={queryClient}
        persistOptions={{
          persister,
          maxAge: 1000 * 60 * 60 * 24, // 24h
          dehydrateOptions: {
            shouldDehydrateQuery: (q) => {
              const keyStr = JSON.stringify(q.queryKey).toLowerCase();
              return q.state.status === 'success' && !NEVER_PERSIST.some(s => keyStr.includes(s));
            },
          },
        }}
      >
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </PersistQueryClientProvider>
    </HelmetProvider>
  </React.StrictMode>
);

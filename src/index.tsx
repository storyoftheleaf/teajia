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
const NEVER_PERSIST_ADMIN_KEYS = ['customers', 'activity_logs', 'stock_ledger'];

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
              const firstKey = Array.isArray(q.queryKey) ? String(q.queryKey[0] ?? '') : '';
              if (NEVER_PERSIST_ADMIN_KEYS.includes(firstKey)) return false;
              if (firstKey === 'products' && q.queryKey[1] !== 'public') return false;
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

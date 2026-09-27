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
      retry: 1,
      retryDelay: attemptIndex => Math.min(500 * (2 ** attemptIndex), 2_000),
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
//
// Substring matching is a blunt instrument and it has already come close to
// biting: 'me' matches any key containing the word "payment", so a query can be
// excluded from disk by pure luck and then quietly included again the next time
// someone renames it. Prefer the exact-match list below for anything whose
// exclusion actually matters.
// 'pay-access' is whether THIS viewer may see a tea master's bank details; an
// approval that lands after the page was cached must not be hidden by disk.
const NEVER_PERSIST = ['auth', 'session', 'me', 'magic', 'pay-access'];
// Matched against the FIRST element of the key, exactly. Nothing here reaches
// disk. 'profile-payment-order' carries a customer's order contents on the
// public payment page and must not outlive the tab, which is the whole reason
// its token is handed over in session storage rather than anywhere durable.
const NEVER_PERSIST_KEYS = [
  'customers', 'activity_logs', 'stock_ledger', 'tea-reference-issues',
  'profile-payment-order',
];

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
              if (NEVER_PERSIST_KEYS.includes(firstKey)) return false;
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

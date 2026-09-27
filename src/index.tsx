import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
import { HelmetProvider } from 'react-helmet-async';
import App from './App';
import { AUTH_TOKEN_CHANGED_EVENT } from './lib/api';
import { shouldPersistQueryKey } from './lib/queryPersistence';
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

// Old snapshots may contain invoices and attendees from before private query
// filtering existed. Delete that snapshot before the provider can hydrate it.
const queryStorage = (() => {
  try { return window.localStorage; } catch { return undefined; }
})();
try { queryStorage?.removeItem('teajia-query-cache'); } catch { /* storage blocked */ }

const persister = createSyncStoragePersister({
  storage: queryStorage,
  key: 'teajia-public-query-cache',
  throttleTime: 1000,
});

// Token replacement, expiry, account switch, and logout all discard private
// in-memory results. A late response belongs to its old, detached query.
window.addEventListener(AUTH_TOKEN_CHANGED_EVENT, () => queryClient.clear());

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
              return q.state.status === 'success' && shouldPersistQueryKey(q.queryKey);
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

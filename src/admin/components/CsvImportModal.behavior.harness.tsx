import React from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { ToastProvider } from './Toast';
import { CsvImportModal } from './CsvImportModal';

/**
 * Harness for `CsvImportModal.behavior.test.ts`, following the pattern in
 * `OrdersView.behavior.harness.tsx`: mount the real component with the API
 * surface it actually calls overridden by the test, so a real browser drives
 * a real upload-and-commit flow instead of a static render.
 *
 * Item 4's regression: `plainCostWords` is unit-tested, but nothing drives
 * this component's own call to it, so deleting that call would leave the
 * whole suite green while the operator started seeing raw server markers
 * again. This harness exists so that call has somewhere to be exercised.
 */
api.batches.list = async () => ({ batches: [] } as any);

let bulkCreateResult: any = { results: [] };
api.products.bulkCreate = async () => bulkCreateResult;

const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
const root = createRoot(document.getElementById('root')!);

(window as any).csvImportModalTest = {
  mount() {
    client.clear();
    root.render(
      <QueryClientProvider client={client}>
        <ToastProvider>
          <CsvImportModal isOpen onClose={() => undefined} onComplete={() => undefined} />
        </ToastProvider>
      </QueryClientProvider>,
    );
  },
  setBulkCreateResult(result: any) { bulkCreateResult = result; },
};

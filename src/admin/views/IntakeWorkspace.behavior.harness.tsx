import React from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { api } from '../../lib/api';
import { ToastProvider } from '../components/Toast';
import { IntakeWorkspace } from './IntakeWorkspace';
import '../../styles/tailwind.css';
import '../../styles/card-utilities.css';

/**
 * Harness for `IntakeWorkspace.behavior.test.ts`, following the pattern in
 * `OrdersView.behavior.harness.tsx`: mount the real component with the API
 * surface it actually calls overridden by the test, so a real browser drives
 * a real upload-and-commit flow instead of a static render.
 *
 * Item 4's regression: `plainCostWords` is unit-tested, but nothing drives
 * this component's own call to it (line ~399), so deleting that call would
 * leave the whole suite green while the operator started seeing raw server
 * markers again in the "not added" toast.
 */
api.curateImports.create = async () => ({ batch: { id: 'test-import' } } as any);
api.curateImports.get = async () => ({ sources: [], items: [] } as any);
api.curateImports.listIncomplete = async () => ({ imports: [] } as any);
let abandonCalls = 0;
api.curateImports.abandon = async () => { abandonCalls++; return {} as any; };
api.curateImports.uploadEvidence = async () => ({} as any);
api.batches.list = async () => ({ batches: [] } as any);
let purchaseFailures = 0;
const purchaseCalls: unknown[] = [];
api.purchaseOrders.create = async body => {
  purchaseCalls.push(body);
  if (purchaseFailures-- > 0) throw new Error('Purchase record unavailable');
  return { id: 'purchase-1' };
};

let bulkCreateResult: any = { inserted: 0, skipped: 0, results: [] };
let bulkCalls = 0;
api.products.bulkCreate = async () => { bulkCalls++; return bulkCreateResult; };

const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
const root = createRoot(document.getElementById('root')!);

(window as any).intakeWorkspaceTest = {
  mount() {
    client.clear();
    bulkCalls = 0;
    purchaseCalls.length = 0;
    purchaseFailures = 0;
    abandonCalls = 0;
    root.render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={['/admin/intake']}>
          <ToastProvider>
            <IntakeWorkspace />
          </ToastProvider>
        </MemoryRouter>
      </QueryClientProvider>,
    );
  },
  setBulkCreateResult(result: any) { bulkCreateResult = result; },
  failPurchase(count = 1) { purchaseFailures = count; },
  bulkCalls() { return bulkCalls; },
  purchaseCalls() { return purchaseCalls; },
  abandonCalls() { return abandonCalls; },
};

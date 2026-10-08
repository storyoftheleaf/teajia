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
const operation = async (kind: string, payload?: unknown) => {
  const response = await fetch('/__intake-operations', { method: 'POST', body: JSON.stringify({ kind, payload }) });
  const result = await response.json();
  if (!response.ok) {
    const error = new Error(result.error || 'Operation failed') as Error & { status: number };
    error.status = response.status;
    throw error;
  }
  return result;
};
api.intakeCommits.get = async () => operation('get');
api.intakeCommits.save = async (_id, payload) => operation('save', payload);
api.intakeCommits.complete = async () => operation('complete');
api.purchaseOrders.create = async body => operation('purchase', body);
api.products.bulkCreate = async (products, batchId, receiptLabel) => operation('bulk', { products, batchId, receiptLabel });

const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
const root = createRoot(document.getElementById('root')!);

(window as any).intakeWorkspaceTest = {
  mount(entry = '/admin/intake') {
    client.clear();
    abandonCalls = 0;
    root.render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={[entry]}>
          <ToastProvider>
            <IntakeWorkspace />
          </ToastProvider>
        </MemoryRouter>
      </QueryClientProvider>,
    );
  },
  setBulkCreateResult(result: any) { return operation('configure', { bulkResult: result }); },
  failPurchase(count = 1) { return operation('configure', { purchaseFailures: count }); },
  failLookup(count = 1) { return operation('configure', { getFailures: count }); },
  abandonCalls() { return abandonCalls; },
};

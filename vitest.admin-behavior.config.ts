import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: [
      'src/admin/components/OrdersView.behavior.test.ts',
      'src/admin/components/QuickInvoiceModal.behavior.test.ts',
      'src/admin/components/SettlementLedger.behavior.test.ts',
      'src/admin/components/OrderAttribution.behavior.test.ts',
    ],
    setupFiles: ['./tests/helpers/adminBehaviorIsolation.ts'],
    fileParallelism: false,
    maxWorkers: 1,
  },
});

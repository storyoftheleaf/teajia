import { afterEach, expect, it, vi } from 'vitest';
import worker from '../src/index';
import { seedIdentity, SqliteD1 } from './helpers/sqliteD1';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

it.each(['a tight statement allowance', 'an archive cleanup database error'])(
  'records fresh approval on the scheduled Worker with %s',
  async (failure) => {
    const db = new SqliteD1('migrations');
    try {
      seedIdentity(db, { accountId: 'shop' });
      db.exec(`INSERT INTO shipping_whatsapp_approval
        (account_id, template_name, language, business_account_id, transport, graph_version, state, checked_at)
        VALUES ('shop','shipping_quote','en_US','1234567890','kapso','v24.0','unavailable','2026-11-23T05:00:46.256Z')`);
      const database = {
        prepare(sql: string) {
          const statement = db.prepare(sql);
          const wrapped = {
            bind(...values: unknown[]) { statement.bind(...values); return wrapped; },
            first() { return statement.first(); },
            all() { return { ...statement.all(), meta: { rows_read: 1, rows_written: 0 } }; },
            run() {
              if (failure === 'an archive cleanup database error' && sql.includes('UPDATE curate_ar_jobs')) {
                throw new Error('Synthetic archive cleanup failure');
              }
              const result = statement.run();
              return { ...result, meta: { ...result.meta, rows_read: 1, rows_written: result.meta.changes } };
            },
          };
          return wrapped;
        },
      };
      const reserve = vi.fn(async (url: string) => {
        if (url.endsWith('/settle')) return Response.json({ ok: true });
        return Response.json({
          allowed: true, id: 'scheduled-test', rows: 100, writes: 100,
          statements: failure === 'a tight statement allowance' ? 2 : 100,
          expiresAt: Date.now() + 60_000,
        });
      });
      const provider = vi.fn(async (url: string) => {
        expect(new URL(url).pathname).toBe('/meta/whatsapp/v24.0/1234567890/message_templates');
        return Response.json({ data: [{
          name: 'shipping_quote', language: 'en_US', category: 'UTILITY', status: 'APPROVED',
          components: [{ type: 'BODY', text: '{{1}} {{2}} {{3}} {{4}} {{5}}' }],
        }] });
      });
      vi.stubGlobal('fetch', provider);
      vi.spyOn(console, 'error').mockImplementation(() => {});
      vi.spyOn(console, 'warn').mockImplementation(() => {});
      const info = vi.spyOn(console, 'info').mockImplementation(() => {});
      const scheduledTime = Date.now();
      await worker.scheduled(
        { scheduledTime, cron: '0 * * * *' } as ScheduledEvent,
        {
          DB: database, SHARED_ALLOWANCE_REQUIRED: 'true',
          SHARED_ALLOWANCE: { idFromName: () => 'account', get: () => ({ fetch: reserve }) },
          SHIPPING_PAYMENT_NOTIFICATIONS_ENABLED: 'true', SHIPPING_PAYMENT_NOTIFICATIONS_ACCOUNT_ID: 'shop',
          SHIPPING_PAYMENT_BUSINESS_ACCOUNT_ID: '1234567890', SHIPPING_PAYMENT_TEMPLATE_NAME: 'shipping_quote',
          WHATSAPP_ORDER_ACCOUNT_ID: 'shop', WHATSAPP_TRANSPORT: 'kapso', KAPSO_API_KEY: 'test-only-key',
          WHATSAPP_GRAPH_API_VERSION: 'v24.0', WHATSAPP_ORDER_TEMPLATE_LANGUAGE: 'en_US',
        } as never,
        {} as ExecutionContext,
      );
      expect(provider).toHaveBeenCalledTimes(1);
      expect(info).toHaveBeenCalledWith('Scheduled shipping approval provider attempt', {
        scheduledTime, attempt: 1, transport: 'kapso', outcome: 'http_response',
        httpStatus: 200, elapsedMs: expect.any(Number),
      });
      expect(info).toHaveBeenCalledWith('Scheduled shipping approval', expect.objectContaining({ state: 'approved' }));
      expect(reserve.mock.calls.map(([url]) => new URL(url).pathname)).toEqual(['/reserve', '/settle']);
      expect(db.sqlite.prepare('SELECT state, checked_at FROM shipping_whatsapp_approval').get()).toEqual({
        state: 'approved', checked_at: expect.not.stringMatching(/^2026-11-23T05:00:46/),
      });
    } finally {
      db.close();
    }
  },
);

import { describe, expect, it } from 'vitest';
import { sentLine } from './SentView';
import type { SendSummary } from '../types';

const base: SendSummary = {
  kind: 'invoice', id: 'inv', title: 'TJB-00007', to: 'Tia', sent_at: '2026-11-27 05:00:00', live: true, teas: 4,
  total_usd: 262.35, payment_status: 'unpaid', opened_times: 0, first_opened_at: null, last_opened_at: null,
  teas_opened: 0, counted_before: 0, orders: 1,
};

// A sent row says, in one line, what went and what came of it.
describe('sentLine', () => {
  it('says a send nobody opened', () => {
    expect(sentLine(base)).toBe('4 teas · $262.35 · not opened yet');
  });
  it('keeps the older count for a past send, saying it includes the shop', () => {
    expect(sentLine({ ...base, counted_before: 5 })).toContain('5 earlier opens, yours included');
  });
  it('says the teas looked at and the orders a collection link brought', () => {
    const line = sentLine({ ...base, kind: 'collection', total_usd: null, opened_times: 2, last_opened_at: '2026-11-27 05:00:00', teas_opened: 3, orders: 1 });
    expect(line).toMatch(/opened 2 times, last .* · 3 teas looked at · 1 order$/);
  });
});

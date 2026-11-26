import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./firstTable', () => ({ firstTableOpen: () => true }));

const store = new Map<string, string>();
vi.stubGlobal('localStorage', {
  getItem: (key: string) => store.get(key) ?? null,
  setItem: (key: string, value: string) => { store.set(key, value); },
  removeItem: (key: string) => { store.delete(key); },
});

const { captureOrderViaFromLocation, currentOrderVia, forgetOrderVia, rememberOrderVia } = await import('./orderVia');

const REF = 'aaaaaaaaaaaaaaaaaa';
const OTHER = 'bbbbbbbbbbbbbbbbbb';
const DAY = 24 * 60 * 60 * 1000;

describe('where an order request began', () => {
  beforeEach(() => store.clear());

  it('sends the reference once, and reopening its address does not bring it back', () => {
    captureOrderViaFromLocation(`?via=${REF}`, 0);
    expect(currentOrderVia(DAY)).toBe(REF);
    forgetOrderVia();
    captureOrderViaFromLocation(`?via=${REF}`, 2 * DAY);
    expect(currentOrderVia(2 * DAY)).toBeUndefined();
  });

  it('does not restart the 14 days when the same address is opened again', () => {
    captureOrderViaFromLocation(`?via=${REF}`, 0);
    captureOrderViaFromLocation(`?via=${REF}`, 10 * DAY);
    expect(currentOrderVia(15 * DAY)).toBeUndefined();
  });

  it('a fresh tap on a thank-you, or another session, starts again', () => {
    captureOrderViaFromLocation(`?via=${REF}`, 0);
    forgetOrderVia();
    rememberOrderVia(REF, DAY);
    expect(currentOrderVia(DAY)).toBe(REF);
    captureOrderViaFromLocation(`?via=${OTHER}`, 2 * DAY);
    expect(currentOrderVia(2 * DAY)).toBe(OTHER);
  });

  it('opening a used address after its 14 days counts as new', () => {
    captureOrderViaFromLocation(`?via=${REF}`, 0);
    forgetOrderVia();
    captureOrderViaFromLocation(`?via=${REF}`, 21 * DAY);
    expect(currentOrderVia(21 * DAY)).toBe(REF);
  });
});

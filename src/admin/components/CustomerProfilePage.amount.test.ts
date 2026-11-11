import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync(new URL('./CustomerProfilePage.tsx', import.meta.url), 'utf8');

describe('customer order amounts', () => {
  it('reads computed_total, the field the server sends, with total as fallback', () => {
    expect(source).toContain('order.computed_total, order.total');
  });
  it('does not print an amount straight from order.total', () => {
    expect(source).not.toContain('Number(order.total)');
  });
});

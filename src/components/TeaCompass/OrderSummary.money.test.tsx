import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
const fixture = vi.hoisted(() => ({ entries: [] as any[] }));
vi.mock('../../lib/teaCompassStore', () => ({ useTeaCompassStore: (select: any) => select({getBuyingEntries: () => fixture.entries, updateEntry: vi.fn()}) }));
vi.mock('../../lib/ledgerStore', () => ({ useLedgerStore: (select: any) => select({getOrCreatePurchaseTransaction: vi.fn(), addLineItem: vi.fn()}) }));
import { OrderSummary } from './OrderSummary';
const entry = (id: string, priceAmount: number | undefined, priceCurrency = 'Yuan') => ({id, name: id, category:'teaware', status:'buying', priceAmount, priceCurrency, buyQuantityUnits:1});
const render = (entries: any[]) => {fixture.entries=entries; return renderToStaticMarkup(<OrderSummary open onClose={() => {}}/>).replace(/<!--.*?-->/g,'');};
describe('OrderSummary recorded money display', () => {
  it('never labels a sum of different monies with the first currency', () => {
    const html=render([entry('yuan',85),entry('taiwan',1800,'NT')]);
    expect(html).not.toContain('CN¥1,885.00');
    const footer=html.split('aria-label="Totals by recorded currency"')[1].split('</div>')[0];
    expect(footer).toContain('CN¥85.00'); expect(footer).toContain('NT$1,800');
  });
  it('does not show an unknown purchase amount as a zero total', () => {
    const html=render([entry('unpriced',undefined,'USD')]);
    expect(html).not.toContain('$0.00'); expect(html).toContain('–');
  });
  it('marks a same-currency known plus unknown footer as unavailable', () => {
    const html=render([entry('known',85),entry('unknown',undefined)]);
    const footer=html.split('aria-label="Totals by recorded currency"')[1].split('</div>')[0];
    expect(footer).toContain('CN¥–'); expect(footer).not.toContain('CN¥85.00');
  });
  it('shows an unavailable empty total instead of inventing NT zero', () => {
    const footer=render([]).split('aria-label="Totals by recorded currency"')[1].split('</div>')[0];
    expect(footer).toContain('–'); expect(footer).not.toContain('NT$0');
  });
  it('shows an entered zero on its line as well as in the total', () => {
    expect((render([entry('free',0,'USD')]).match(/\$0\.00/g)||[]).length).toBeGreaterThanOrEqual(2);
  });
});

import { readFileSync } from 'node:fs';
import { transpileModule, ScriptTarget } from 'typescript';
import { describe, expect, it } from 'vitest';
import { resolveShopFreightDefault, shippingPerGramUsd } from '../src/shippingRate';
import { currencyStated } from '../src/costCurrency';

// Exercise only the actual margin-computation block, before the confirmation
// boundary. No MCP handler/tool/ticket/confirmation operation is invoked.
const source = readFileSync(new URL('../src/mcp.ts', import.meta.url), 'utf8');
const tool = source.indexOf('async function toolUpdateTeaPricing(');
const begin = source.indexOf('    let costUsd: number | null = null;', tool);
const end = source.indexOf('    const token = await issueConfirmationToken(', begin);
if (tool < 0 || begin < 0 || end < 0) throw new Error('Margin computation boundary changed; requalify the test');
const block = source.slice(begin, end);
const js = transpileModule(`async function compute() { ${block}\nreturn { costUsd, marginWarning }; }`, { compilerOptions: { target: ScriptTarget.ES2022 } }).outputText;
async function compute({ own = null, type = 'Red', yuan }: { own?: number | null; type?: string; yuan?: number } = {}) {
  const env = { DB: { prepare: (sql: string) => ({
    all: async () => ({ results: [{ currency: 'USD', rate_to_usd: 1 }, ...(yuan ? [{ currency: 'Yuan', rate_to_usd: yuan }] : [])] }),
    bind: () => ({ first: async () => ({ default_shipping_rate_per_kg: 85, default_shipping_rate_currency: 'Yuan' }) }),
  }) } };
  return new Function('env','auth','currencyStated','resolveShopFreightDefault','shippingPerGramUsd','newCostCurrency','newCostAmount','newQuantity','newShippingRatePerKg','product','newRetail', js+'; return compute();')(
    env, { accountId: 'synthetic' }, currencyStated, resolveShopFreightDefault, shippingPerGramUsd, 'USD', 100, 1000, own, { type }, .2,
  ) as Promise<{ costUsd: number | null; marginWarning: string | null }>;
}
describe('actual margin preview computation without executing MCP confirmations', () => {
  it('does not warn with an invented cost when inherited freight FX is missing', async () => {
    expect(block).not.toContain('issueConfirmationToken');
    expect(await compute()).toEqual({ costUsd: null, marginWarning: null });
  });
  it('preserves valid conversion precision', async () => {
    const value = await compute({ yuan: 7.1 });
    expect(value.costUsd).toBeCloseTo(.1 + 85 / 7.1 / 1000, 12);
    expect(value.marginWarning).toBeNull();
  });
  it('keeps valid own freight in the warning even if account FX is absent', async () => {
    expect(await compute({ own: 80 })).toEqual({ costUsd: .18, marginWarning: 'Margin will be 10% — below the 30% floor.' });
  });
  it('retains explicit free freight and teaware without needing shop FX', async () => {
    expect(await compute({ own: 0 })).toEqual({ costUsd: .1, marginWarning: null });
    expect(await compute({ type: 'Teaware' })).toEqual({ costUsd: .1, marginWarning: null });
  });
});

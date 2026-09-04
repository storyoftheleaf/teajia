import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { DEFAULT_SHIPPING_RATE_PER_KG_USD, shippingPerGramUsd } from '../src/shippingRate';

/**
 * Freight is charged on every tea, at one rate, and that rate lives in one
 * place.
 *
 * The shop once held four answers to the same question. Products defaulted to
 * 0, the intake batch to 10, the Add Product form filled in 13, and the agent
 * tool documented 10 while writing whatever it was handed, so the same tea
 * cost a different amount depending on which door it came through and a
 * hand-entered product sold with no freight in its price at all. Nobody saw
 * it, because a missing cost looks exactly like a cheap tea.
 *
 * The behaviour tests below pin the rule. The source scans after them are the
 * part that makes it permanent: a second literal anywhere in the codebase
 * fails this file, whoever writes it and whichever door they add.
 */

const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8');

describe('the shop has one freight rate', () => {
  it('is 12 USD per kg', () => {
    expect(DEFAULT_SHIPPING_RATE_PER_KG_USD).toBe(12);
  });
});

describe('what freight adds to a gram', () => {
  it('applies the default when nobody has entered a rate', () => {
    expect(shippingPerGramUsd({ storedRatePerKg: null, rateToUsd: 1, isTeaware: false }))
      .toBeCloseTo(0.012, 10);
    expect(shippingPerGramUsd({ storedRatePerKg: undefined, rateToUsd: 7.2, isTeaware: false }))
      .toBeCloseTo(0.012, 10);
  });

  it('applies the default in USD regardless of what the tea was bought in', () => {
    // The default is a USD figure, so a yuan-priced tea gets the same 12/kg of
    // freight as a dollar-priced one. Dividing the default by the exchange
    // rate would have made freight on a CNY tea a seventh of the rate.
    const cny = shippingPerGramUsd({ storedRatePerKg: null, rateToUsd: 7.2, isTeaware: false });
    const usd = shippingPerGramUsd({ storedRatePerKg: null, rateToUsd: 1, isTeaware: false });
    expect(cny).toBe(usd);
  });

  it('obeys an entered rate, read in the tea own cost currency', () => {
    // 86.4 CNY/kg at 7.2 to the dollar is 12 USD/kg: the same freight, said in
    // the currency of the invoice it was written beside.
    expect(shippingPerGramUsd({ storedRatePerKg: 86.4, rateToUsd: 7.2, isTeaware: false }))
      .toBeCloseTo(0.012, 10);
    expect(shippingPerGramUsd({ storedRatePerKg: 30, rateToUsd: 1, isTeaware: false }))
      .toBeCloseTo(0.03, 10);
  });

  it('honours an explicit zero as free freight', () => {
    // The whole point of separating NULL from 0: this one is Adrian saying so.
    expect(shippingPerGramUsd({ storedRatePerKg: 0, rateToUsd: 7.2, isTeaware: false })).toBe(0);
  });

  it('never charges freight per gram on teaware', () => {
    // Priced per piece, with its freight already inside that price.
    expect(shippingPerGramUsd({ storedRatePerKg: null, rateToUsd: 1, isTeaware: true })).toBe(0);
    expect(shippingPerGramUsd({ storedRatePerKg: 30, rateToUsd: 1, isTeaware: true })).toBe(0);
  });
});

describe('nothing else in the shop decides the rate', () => {
  const worker = read('../src/index.ts');

  it('prices through the shared helper', () => {
    expect(worker).toContain('shippingPerGramUsd({');
  });

  it('never reads a missing rate as free freight again', () => {
    // The original bug, in one expression: `|| 0` turned "nobody entered one"
    // into "this tea ships for nothing".
    expect(worker).not.toMatch(/shipping_rate_per_kg\s*(\|\||\?\?)\s*0\b/);
  });

  it('stores an unentered rate as NULL, so the two states stay distinct', () => {
    expect(worker).toContain('body.shipping_rate_per_kg ?? null');
  });

  it('states the same number in the agent tool that writes it', () => {
    const mcp = read('../src/mcp.ts');
    const description = mcp.match(/shipping_rate_per_kg:\s*\{[^}]*description:\s*'((?:[^'\\]|\\.)*)'/);
    expect(description, 'the update_tea_pricing shipping field lost its description').toBeTruthy();
    expect(description![1]).toContain(`${DEFAULT_SHIPPING_RATE_PER_KG_USD} USD/kg`);
  });

  it('fills the Add Product form in with the same number', () => {
    // The form cannot import the worker's module, so it carries the figure as
    // a string. This is what keeps the two from drifting apart, which is how
    // the form came to say 13 while the intake path said 10.
    const modal = read('../../src/admin/components/AddProductModal.tsx');
    const literals = [...modal.matchAll(/shippingRateUSD:\s*'(\d+(?:\.\d+)?)'/g)].map(m => m[1]);
    expect(literals.length, 'the Add Product form no longer sets a shipping default').toBeGreaterThan(0);
    for (const value of literals) {
      expect(Number(value)).toBe(DEFAULT_SHIPPING_RATE_PER_KG_USD);
    }
    const fallback = modal.match(/initialData\.shippingRatePerKg\s*\/\s*rate\)\s*:\s*(\d+(?:\.\d+)?)/);
    expect(fallback, 'the form lost its shipping fallback').toBeTruthy();
    expect(Number(fallback![1])).toBe(DEFAULT_SHIPPING_RATE_PER_KG_USD);
  });

  it('leaves no second hardcoded default anywhere in the worker', () => {
    // Any file that both names the rate and pins a number to it, other than
    // the module that owns the number.
    const files: Array<[string, string]> = [
      ['index.ts', worker],
      ['mcp.ts', read('../src/mcp.ts')],
      ['curateImports.ts', read('../src/curateImports.ts')],
      ['curateImportFinalize.ts', read('../src/curateImportFinalize.ts')],
    ];
    const pinned = /(shipping_rate_per_kg|shippingRatePerKg|shippingRatePerKgUsd)\s*(?:\?\?|\|\||[:=])\s*(\d+(?:\.\d+)?)/g;
    const offences: string[] = [];
    for (const [name, source] of files) {
      for (const match of source.matchAll(pinned)) {
        // A bound SQL value of 0 is fine; it is NULL that carries meaning, and
        // the tests above pin the create path. Anything else is a rate.
        offences.push(`${name}: ${match[0]}`);
      }
    }
    expect(offences, 'a second freight default appeared; put it in worker/src/shippingRate.ts instead').toEqual([]);
  });
});

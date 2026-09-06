import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  FALLBACK_SHIPPING_RATE_PER_KG,
  FALLBACK_SHIPPING_RATE_CURRENCY,
  resolveShopFreightDefault,
  shippingPerGramUsd,
} from '../src/shippingRate';

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
  it('falls back to 85 Yuan per kg when a shop has set none', () => {
    // Quoted in yuan because that is the currency the forwarder is paid in. A
    // dollar figure would be a translation frozen at the day it was typed.
    expect(FALLBACK_SHIPPING_RATE_PER_KG).toBe(85);
    expect(FALLBACK_SHIPPING_RATE_CURRENCY).toBe('Yuan');
  });

  it('reads the shop own rate ahead of the fallback', () => {
    const rates = (c: string) => ({ Yuan: 7.1, USD: 1 } as Record<string, number>)[c];
    const shop = resolveShopFreightDefault(
      { default_shipping_rate_per_kg: 60, default_shipping_rate_currency: 'Yuan' }, rates);
    expect(shop.perKg).toBe(60);
    expect(shop.perKgUsd).toBeCloseTo(60 / 7.1, 10);
  });

  it('converts the rate live rather than storing a dollar figure', () => {
    // The same 85 yuan is worth different dollars on different days, and the
    // shelf must follow the yuan. This is the whole reason the rate is not
    // held in USD.
    const at71 = resolveShopFreightDefault(null, () => 7.1).perKgUsd;
    const at74 = resolveShopFreightDefault(null, () => 7.4).perKgUsd;
    expect(at71).toBeGreaterThan(at74);
    expect(at71).toBeCloseTo(85 / 7.1, 10);
  });

  it('honours a shop rate of zero as free freight', () => {
    // Same NULL-versus-zero rule as the per-product column, one level up.
    const shop = resolveShopFreightDefault(
      { default_shipping_rate_per_kg: 0, default_shipping_rate_currency: 'Yuan' }, () => 7.1);
    expect(shop.perKgUsd).toBe(0);
  });

  it('never reads a yuan rate as dollars when its currency is unknown', () => {
    // Falling back to a rate of 1 would price 85 yuan as 85 dollars: seven
    // times the freight, and the markup would triple the error.
    const shop = resolveShopFreightDefault(
      { default_shipping_rate_per_kg: 85, default_shipping_rate_currency: 'Martian' },
      c => (c === FALLBACK_SHIPPING_RATE_CURRENCY ? 7.1 : undefined));
    expect(shop.perKgUsd).toBeCloseTo(85 / 7.1, 10);
  });
});

describe('what freight adds to a gram', () => {
  // 85 CNY at 7.1 to the dollar, which is what the shop charges today.
  const shopDefaultPerKgUsd = 85 / 7.1;

  it('applies the shop rate when nobody has entered one on the tea', () => {
    expect(shippingPerGramUsd({ storedRatePerKg: null, rateToUsd: 1, isTeaware: false, shopDefaultPerKgUsd }))
      .toBeCloseTo(shopDefaultPerKgUsd / 1000, 10);
    expect(shippingPerGramUsd({ storedRatePerKg: undefined, rateToUsd: 7.1, isTeaware: false, shopDefaultPerKgUsd }))
      .toBeCloseTo(shopDefaultPerKgUsd / 1000, 10);
  });

  it('applies the shop rate regardless of what the tea was bought in', () => {
    // The shop rate arrives already in USD, so a yuan-priced tea gets the same
    // freight as a dollar-priced one. Dividing it by the tea's exchange rate
    // would have made freight on a CNY tea a seventh of the rate.
    const cny = shippingPerGramUsd({ storedRatePerKg: null, rateToUsd: 7.1, isTeaware: false, shopDefaultPerKgUsd });
    const usd = shippingPerGramUsd({ storedRatePerKg: null, rateToUsd: 1, isTeaware: false, shopDefaultPerKgUsd });
    expect(cny).toBe(usd);
  });

  it('obeys an entered rate, read in the tea own cost currency', () => {
    // 85 CNY/kg at 7.1 to the dollar is the shop rate, said in the currency of
    // the invoice it was written beside.
    expect(shippingPerGramUsd({ storedRatePerKg: 85, rateToUsd: 7.1, isTeaware: false, shopDefaultPerKgUsd }))
      .toBeCloseTo(shopDefaultPerKgUsd / 1000, 10);
    expect(shippingPerGramUsd({ storedRatePerKg: 30, rateToUsd: 1, isTeaware: false, shopDefaultPerKgUsd }))
      .toBeCloseTo(0.03, 10);
  });

  it('honours an explicit zero as free freight', () => {
    // The whole point of separating NULL from 0: this one is Adrian saying so.
    expect(shippingPerGramUsd({ storedRatePerKg: 0, rateToUsd: 7.1, isTeaware: false, shopDefaultPerKgUsd })).toBe(0);
  });

  it('never charges freight per gram on teaware', () => {
    // Priced per piece, with its freight already inside that price.
    expect(shippingPerGramUsd({ storedRatePerKg: null, rateToUsd: 1, isTeaware: true, shopDefaultPerKgUsd })).toBe(0);
    expect(shippingPerGramUsd({ storedRatePerKg: 30, rateToUsd: 1, isTeaware: true, shopDefaultPerKgUsd })).toBe(0);
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
    const description = mcp.match(/shipping_rate_per_kg:\s*\{\s*type:\s*'number',\s*description:\s*'((?:[^'\\]|\\.)*)'/);
    expect(description, 'the update_tea_pricing shipping field lost its description').toBeTruthy();
    expect(description![1]).toContain(`${FALLBACK_SHIPPING_RATE_PER_KG}`);
  });

  it('lets the rate be changed without a deploy', () => {
    // The point of moving it onto the account. If Store Settings cannot write
    // it, the number is a constant again and a better freight deal costs a
    // release.
    const view = read('../../src/admin/views/AccountSettingsView.tsx');
    expect(view, 'Store Settings lost the freight field').toContain('default_shipping_rate_per_kg');
    expect(worker, 'the account update route will not accept the freight rate')
      .toContain("'default_shipping_rate_per_kg', 'default_shipping_rate_currency',");
    const mcp = read('../src/mcp.ts');
    expect(mcp, 'update_account_settings cannot reach the freight rate')
      .toMatch(/ACCOUNT_SETTINGS_FIELDS[\s\S]{0,400}default_shipping_rate_per_kg/);
  });

  it('reads the rate from the shop rather than from code, everywhere it prices', () => {
    // A call site that forgot the argument would silently price off whatever
    // the compiler let through. Every one of them passes it explicitly.
    //
    // The `function` group is how the declaration is told from the calls. It
    // has to be captured rather than looked for inside the match: the match
    // starts at the name, so the keyword sits just outside it, and a check for
    // it in the matched text never fires. That is what failed CI on the first
    // run of this file, which is the guard working, on itself.
    const found = [...worker.matchAll(/(function\s+)?addPricingFields\(([^)]*)\)/g)];
    const calls = found.filter(m => !m[1]).map(m => m[0]);
    expect(found.some(m => m[1]), 'addPricingFields moved or was renamed').toBe(true);
    expect(calls.length, 'nothing calls addPricingFields any more').toBeGreaterThan(0);
    for (const call of calls) {
      expect(call, `a pricing call site takes no shop rate: ${call}`).toMatch(/rates,\s*(shopDefaultPerKgUsd|resolveShopFreightDefault)/);
    }
  });

  it('agrees with the app-side copy of the number', () => {
    // The two builds share no module, so the app carries its own constant in
    // src/lib/shippingRate.ts. This is the join that keeps them equal.
    const app = read('../../src/lib/shippingRate.ts');
    const declared = app.match(/FALLBACK_SHIPPING_RATE_PER_KG\s*=\s*(\d+(?:\.\d+)?)/);
    expect(declared, 'src/lib/shippingRate.ts lost its constant').toBeTruthy();
    expect(Number(declared![1])).toBe(FALLBACK_SHIPPING_RATE_PER_KG);
    const currency = app.match(/FALLBACK_SHIPPING_RATE_CURRENCY\s*=\s*'([^']+)'/);
    expect(currency, 'src/lib/shippingRate.ts lost its fallback currency').toBeTruthy();
    expect(currency![1]).toBe(FALLBACK_SHIPPING_RATE_CURRENCY);
  });

  it('shows the rate in the inventory rather than applying it invisibly', () => {
    // Adrian's rule: the default is entered and shown, not hidden. A tea with
    // nothing recorded still prices at the default, so the row and the panel
    // must print that number rather than a blank or a dash, which would read
    // as free.
    const config = read('../../src/admin/components/inventory/config.ts');
    expect(config, 'the inventory lost its freight column').toContain("key: 'shippingRatePerKg'");
    const row = read('../../src/admin/components/inventory/InventoryRow.tsx');
    expect(row).toContain("case 'shippingRatePerKg'");
    expect(row).toContain('shippingRateUsdFor');
  });

  it('leaves no admin surface pinning a rate of its own', () => {
    // The Add Product form once filled in 13 and the edit panel fell back to
    // 13, both under a "$/kg" label, while the shop was charging something
    // else. Every admin surface reads the constant now.
    const surfaces: Array<[string, string]> = [
      ['AddProductModal.tsx', read('../../src/admin/components/AddProductModal.tsx')],
      ['ProductEditPanel.tsx', read('../../src/admin/components/ProductEditPanel.tsx')],
      ['InventoryView.tsx', read('../../src/admin/components/InventoryView.tsx')],
      ['InventoryRow.tsx', read('../../src/admin/components/inventory/InventoryRow.tsx')],
    ];
    const pinned = /(shippingRatePerKg|shippingRateUSD)\s*(?:\?\?|\|\||[:=])\s*'?(\d+(?:\.\d+)?)'?/g;
    const offences: string[] = [];
    for (const [name, source] of surfaces) {
      for (const match of source.matchAll(pinned)) offences.push(`${name}: ${match[0]}`);
    }
    expect(offences, 'an admin surface pinned its own freight rate; read the constant instead').toEqual([]);
  });

  it('leaves no instruction naming a different rate', () => {
    // The four answers were not all in code. The intake flow doc told an
    // operator the default was 10 while the shop charged something else, and a
    // doc is a door too: it is what the next session reads before it writes.
    // Records of what was done in the past are exempt, since correcting a
    // record is falsifying it; these are the files that instruct.
    const docs: Array<[string, string]> = [
      ['invoice-intake-flow.md', read('../../docs/invoice-intake-flow.md')],
      ['build-plan.md', read('../../docs/build-plan.md')],
      ['CLAUDE.md', read('../../CLAUDE.md')],
    ];
    const rate = /\$?(\d+(?:\.\d+)?)\s*(?:USD\s*|CNY\s*|Yuan\s*)?\/\s*kg/gi;
    const allowed = new Set([FALLBACK_SHIPPING_RATE_PER_KG, 12]);
    const offences: string[] = [];
    for (const [name, source] of docs) {
      for (const match of source.matchAll(rate)) {
        // 85 Yuan is the rate; 12 USD is the same rate said in dollars, which
        // the docs use to explain it and which is therefore not a second answer.
        if (allowed.has(Number(match[1]))) continue;
        // The migration's frozen `DEFAULT 10.0` is described as historical
        // where it appears; SQLite cannot alter a column default in place.
        if (/historical/i.test(source.slice(Math.max(0, match.index! - 240), match.index! + 240))) continue;
        offences.push(`${name}: ${match[0]}`);
      }
    }
    expect(offences, 'a doc teaches a freight rate the shop does not charge').toEqual([]);
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

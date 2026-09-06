import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { SHOP_MARKUP_MULTIPLIER, CURATOR_FALLBACK_MARKUP } from '../src/markup';
import { currencyStated, costNeedsCurrency } from '../src/costCurrency';

/**
 * Two failures that are one failure, and neither is arithmetic.
 *
 * A DEFAULT THAT IS COPIED BECOMES ONE FACT PER COPY, AND THEY DRIFT.
 * The markup had four homes: `* 3.0` in the worker's pricing, `* 3` in the
 * admin's preview of that same price, a `markup_multiplier` column defaulting
 * to 2.5 on every product, and a `?? 2.5` in the create path. So the shelf ran
 * at three while a column on each of those rows said two and a half. This is
 * the freight bug exactly, on a different number, and it was still live while
 * freight was being fixed. Freight became a setting because it is negotiated;
 * the markup has not been asked to vary, so it stays a constant, but it stays a
 * constant in ONE place.
 *
 * A NUMBER WITHOUT ITS UNIT IS NOT A NUMBER.
 * `cost_currency` carries `DEFAULT 'USD'`, so a row that never stated a
 * currency reads exactly like a row that chose dollars. That is absence
 * answered with a guess, and the guess is worth seven times the money: a
 * 1200 CNY invoice stored as 1200 USD prices the tea sevenfold and the schema
 * has no objection, because 1200 is a fine number. Every door that writes an
 * amount now has to say what the amount is in.
 */

const here = (rel: string) => fileURLToPath(new URL(rel, import.meta.url));
const read = (rel: string) => readFileSync(here(rel), 'utf8');
const worker = read('../src/index.ts');

describe('the markup has one home', () => {
  it('is three, the number Adrian actually quotes', () => {
    expect(SHOP_MARKUP_MULTIPLIER).toBe(3);
  });

  it('agrees with the app-side copy, which previews the same price', () => {
    // The two builds share no module, so it is written twice. This is the join.
    const app = read('../../src/lib/markup.ts');
    const declared = app.match(/SHOP_MARKUP_MULTIPLIER\s*=\s*(\d+(?:\.\d+)?)/);
    expect(declared, 'src/lib/markup.ts lost its constant').toBeTruthy();
    expect(Number(declared![1])).toBe(SHOP_MARKUP_MULTIPLIER);
  });

  it('leaves no second multiplier in any pricing path', () => {
    // The shapes that were actually there: `costPerUnitUSD * 3.0`,
    // `trueCostUSD * 3`, and a bare `?? 2.5` two thousand lines into a route.
    const sources: Array<[string, string]> = [
      ['worker/index.ts', worker],
      ['admin/utils.ts', read('../../src/admin/utils.ts')],
    ];
    // A single-digit multiplier, which is what a markup looks like. The
    // negative lookahead is what keeps `Math.round(x * 100) / 100` out of it:
    // rounding to cents is not a second opinion about the markup.
    const literal = /(cost|price|retail)[A-Za-z]*\s*\*\s*\d(?:\.\d+)?(?!\d)|markup[A-Za-z_]*\s*(?:\?\?|\|\|)\s*\d/gi;
    const offences: string[] = [];
    for (const [name, source] of sources) {
      for (const match of source.matchAll(literal)) offences.push(`${name}: ${match[0]}`);
    }
    expect(offences, 'a second markup appeared; read it from worker/src/markup.ts').toEqual([]);
  });

  it('leaves the old default nowhere in the worker, not even as a bind value', () => {
    /* The scan above reads two files and looks for a multiplier next to a word
       like `cost`. Both limits let one through: `mcp.ts` was never read, and
       `create_tea`'s listing INSERT passed the markup positionally —
       `p.fixedRetailPriceUsd, 2.5,` — which is not next to any word at all. So
       every tea added through the agent door was born carrying the default
       migration 0013 had just cleared off the whole shelf, one row at a time,
       through the door with no form and nobody watching.

       2.5 is now a number with no business being typed in the worker: the shop
       multiplies by three and the curator fallback is named in markup.ts. So
       the honest guard is the flat one. Comments are stripped first, because
       the reason a number is gone has to stay writable. */
    const stripComments = (source: string) =>
      source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
    const offences: string[] = [];
    for (const name of readdirSync(here('../src')).filter(f => f.endsWith('.ts') && f !== 'markup.ts')) {
      const source = stripComments(read(`../src/${name}`));
      for (const match of source.matchAll(/(?<![\d.])2\.5(?![\d])/g)) {
        const line = source.slice(0, match.index).split('\n').length;
        offences.push(`${name}:${line}`);
      }
    }
    expect(offences, 'the pre-0013 markup was typed back into the worker; write NULL and let it read SHOP_MARKUP_MULTIPLIER')
      .toEqual([]);
  });

  it('names the curator fallback rather than leaving it a bare literal', () => {
    // It was 2.5 while the shop ran at three, so the same tea carried two
    // prices depending on which surface asked. Adrian settled it on 2026-09-06:
    // three, everywhere. So what this pins is no longer a DIFFERENCE, it is the
    // sameness, read from the shop's own constant rather than typed again. It
    // stays named so that letting curators price differently one day has a
    // place to land instead of a literal buried in a route.
    expect(CURATOR_FALLBACK_MARKUP).toBe(SHOP_MARKUP_MULTIPLIER);
  });
});

describe('a cost says what it is in', () => {
  it('is refused at every door that can write an amount', () => {
    expect(worker, 'the cost currency guard is gone').toContain('cost_currency_required');
    // Both doors: creating a product, and updating one. The update path reads
    // the row first, because most edits move an amount on a tea whose currency
    // was settled long ago.
    // Calls, not the declaration: create and update are two separate doors and
    // a guard on only one of them is a guard on neither.
    const calls = [...worker.matchAll(/(?<!function )costMissingItsCurrency\(/g)];
    expect(calls.length, 'only one write path checks the currency').toBeGreaterThanOrEqual(2);
    expect(worker).toContain('SELECT cost_currency FROM products WHERE id = ?');
  });

  it('does not accept the shop own not-recorded sentinel as an answer', () => {
    // 'UNK' is what this codebase writes when nobody said. Letting it through
    // would make the guard a formality that types dollars for you.
    //
    // The rule moved out of the worker into `costCurrency.ts` so the agent door
    // could be held to it too, so this asks the rule itself rather than reading
    // the sentinel out of one function's text. That is the stronger question:
    // scanning for the string only ever proved somebody had typed it.
    expect(currencyStated('UNK')).toBe(false);
    expect(currencyStated('unk')).toBe(false);
    expect(currencyStated('  ')).toBe(false);
    expect(currencyStated('Yuan')).toBe(true);

    // And it is the rule the refusal actually consults: an amount whose only
    // stated currency is the sentinel still needs one.
    expect(costNeedsCurrency({ amount: 1200, payloadCurrency: 'UNK' })).toBe(true);
    expect(costNeedsCurrency({ amount: 1200, payloadCurrency: 'Yuan' })).toBe(false);
  });

  it('routes the worker refusal through that shared rule', () => {
    // Two doors with two copies of one rule is the shape that gave this shop
    // four freight rates at once.
    const fn = worker.match(/function costMissingItsCurrency[\s\S]*?\n\}/);
    expect(fn, 'costMissingItsCurrency moved or was renamed').toBeTruthy();
    expect(fn![0]).toContain('costNeedsCurrency');
  });
});

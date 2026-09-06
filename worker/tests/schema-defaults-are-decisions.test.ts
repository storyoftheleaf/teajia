import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * A column default is a decision somebody made once for every row that will
 * ever exist. This file makes each of them say so out loud.
 *
 * Three defaults have cost this shop real money, and they are the same mistake
 * in three costumes:
 *
 *   markup_multiplier DEFAULT 2.5   a POLICY NUMBER copied into every row,
 *                                   while the shop priced at three. The same
 *                                   tea carried two prices depending on which
 *                                   surface asked.
 *   shipping_rate_per_kg DEFAULT 12 the same, and migration 0008 wrote it into
 *                                   340 rows; 0010 had to undo that.
 *   cost_currency DEFAULT 'USD'     a UNIT guessed. A 1200 CNY invoice reads as
 *                                   $1200 and nothing objects, because 1200 is
 *                                   a perfectly good number.
 *
 * A state default ('draft', 'pending', 'active') is fine: a new row genuinely
 * starts somewhere. What is not fine is a default that answers a question
 * nobody asked, in a column where the honest answer is "nobody said". Those get
 * copied, and copies drift.
 *
 * So this is a registry, not a ban. Every numeric default that is not 0 or 1,
 * every currency column with a guessed unit, and every tenancy default has to
 * appear below with a reason. Adding a column with such a default fails this
 * test until somebody writes down why it is safe. That is the whole mechanism:
 * it does not stop anyone, it stops it happening SILENTLY.
 */

const schema = readFileSync(fileURLToPath(new URL('../schema.sql', import.meta.url)), 'utf8');

/**
 * Numeric defaults that are not 0 or 1, each with the reason it is acceptable.
 * 'DEBT' marks one that is known wrong and is being carried deliberately,
 * because SQLite cannot alter a column default in place and changing it needs a
 * migration plus a create-path change together.
 */
const NUMERIC_DEFAULTS: Record<string, string> = {
  // A per-row fact about that row, not a policy the shop might change.
  grams: 'sample size for this row',
  capacity: 'this vessel holds this much',
  total_capacity: 'this event seats this many',
  max_participants: 'this gathering allows this many',
  claim_window_minutes: 'this offer stays claimable this long',
  owner_share_value: '100 percent, the identity share when nobody splits it',
  // DEBT. Policy numbers copied into rows. See worker/src/markup.ts and
  // worker/src/shippingRate.ts: both are read from one place at use time now,
  // and these frozen defaults only reach a row created straight from schema.sql
  // rather than through the code paths. SQLite cannot alter them in place.
  markup_multiplier: 'DEBT: policy number; code writes NULL and reads the shop markup (0013)',
  shipping_rate_per_kg: 'DEBT: policy number; code writes NULL and reads the shop rate (0007-0010)',
  low_stock_threshold: 'DEBT: policy number; a shop-wide floor copied onto every product',
};

/** Currency columns, which are units rather than values. */
const UNIT_DEFAULTS: Record<string, string> = {
  currency_default: "the shop's OWN setting; this is where the answer lives, not a guess",
  display_currency: 'a viewing preference, changed freely and costing nothing if wrong',
  preferred_currency: 'a note about a person, not a figure anything is computed from',
  // DEBT. A cost or a price whose unit was guessed prices the row wrong by
  // whatever the exchange rate is. costMissingItsCurrency() in the worker now
  // refuses a write that does not state one; the defaults themselves remain.
  cost_currency: 'DEBT: a guessed unit on a figure the shelf price is computed from',
  purchase_currency: 'DEBT: a guessed unit on a recorded purchase',
  price_currency: "DEBT: a guessed unit, and it guesses NT",
  currency: 'DEBT: a guessed unit on a money row',
};

function found(pattern: RegExp): string[] {
  return [...schema.matchAll(pattern)].map(m => m[1]);
}

describe('every column default is a decision somebody wrote down', () => {
  it('names every numeric default that is not 0 or 1', () => {
    const columns = [...schema.matchAll(/^\s*([a-z_]+)\s+(?:REAL|INTEGER|NUMERIC)[^,\n]*?DEFAULT\s+(-?\d+(?:\.\d+)?)/gmi)]
      .filter(m => !['0', '1', '0.0', '1.0'].includes(m[2]))
      .map(m => m[1]);
    const unnamed = [...new Set(columns)].filter(c => !(c in NUMERIC_DEFAULTS));
    expect(unnamed, 'a policy number was given a default; say why in NUMERIC_DEFAULTS or use NULL').toEqual([]);
  });

  it('names every currency column that guesses its unit', () => {
    const columns = found(/^\s*([a-z_]*currency[a-z_]*)\s+TEXT[^,\n]*?DEFAULT\s+'[A-Za-z]{2,4}'/gmi);
    const unnamed = [...new Set(columns)].filter(c => !(c in UNIT_DEFAULTS));
    expect(unnamed, 'a unit was guessed; say why in UNIT_DEFAULTS or leave it NULL').toEqual([]);
  });

  it('keeps the number of tables that default their tenant from growing', () => {
    // `account_id NOT NULL DEFAULT 'acc_teajia_bali'` means a row inserted
    // without an account silently belongs to Bali. In a system whose whole
    // tenancy model is "every row carries account_id", that is the one default
    // that can put one shop's content inside another. Four tables carry it,
    // from before the platform was multi-tenant. Recorded in TODO.md; what this
    // guard does is stop a fifth appearing.
    const tables = found(/^\s*(account_id)\s+TEXT[^,\n]*?DEFAULT\s+'[a-z_]+'/gmi);
    expect(tables.length, 'another table now defaults its tenant; give it no default instead').toBeLessThanOrEqual(4);
  });

  it('never lets an insert into those tables omit the account it belongs to', () => {
    // This is the fix that matters. The default is only ever reachable by an
    // INSERT that does not name account_id, so that, not the default, is the
    // failure. Every existing insert names it; this keeps the next one honest.
    //
    // Removing the defaults instead would mean rebuilding four live tables,
    // which SQLite requires for a default change, and the live column shape
    // cannot be verified from a sandbox. A blind `INSERT INTO new SELECT *` is
    // how a table of articles gets lost. Recorded in TODO.md with what to check
    // first; this guard makes the wait safe rather than merely tolerable.
    const TENANT_DEFAULTED = ['articles', 'story_content', 'story_content_versions', 'story_photos'];
    const sources: Array<[string, string]> = [
      ['index.ts', readFileSync(fileURLToPath(new URL('../src/index.ts', import.meta.url)), 'utf8')],
      ['mcp.ts', readFileSync(fileURLToPath(new URL('../src/mcp.ts', import.meta.url)), 'utf8')],
      ['wordforgeArticleDraft.ts', readFileSync(fileURLToPath(new URL('../src/wordforgeArticleDraft.ts', import.meta.url)), 'utf8')],
    ];
    const offences: string[] = [];
    for (const [name, source] of sources) {
      for (const table of TENANT_DEFAULTED) {
        // The column list of each INSERT, up to the closing paren before VALUES
        // or SELECT. A multi-line list is normal here, hence [\s\S].
        const inserts = source.matchAll(new RegExp(`INSERT\\s+(?:OR\\s+\\w+\\s+)?INTO\\s+${table}\\s*\\(([\\s\\S]*?)\\)`, 'gi'));
        for (const match of inserts) {
          if (!/\baccount_id\b/.test(match[1])) {
            offences.push(`${name}: INSERT INTO ${table} without account_id`);
          }
        }
      }
    }
    expect(offences, 'an insert would fall through to the default tenant and land in the wrong shop').toEqual([]);
  });

  it('carries no debt that nobody has written down', () => {
    // The DEBT entries are deliberate and each names its escape route. This
    // asserts they stay explained rather than quietly becoming normal.
    const debts = [...Object.entries(NUMERIC_DEFAULTS), ...Object.entries(UNIT_DEFAULTS)]
      .filter(([, reason]) => reason.startsWith('DEBT'));
    expect(debts.length, 'debt entries vanished; either they were fixed (update this) or the registry was gutted')
      .toBeGreaterThanOrEqual(7);
    for (const [column, reason] of debts) {
      expect(reason.length, `${column} is marked DEBT with no explanation`).toBeGreaterThan(30);
    }
  });
});

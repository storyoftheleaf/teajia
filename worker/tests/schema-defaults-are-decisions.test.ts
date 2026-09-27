import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { columnDefault, migrationFiles, MIGRATIONS_DIR, seedFromMigrations } from './helpers/migratedSqlite';

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

/**
 * Money columns carrying a numeric default, INCLUDING a default of 0.
 *
 * The scan above deliberately skips 0 and 1, which is right for a counter and a
 * flag and wrong for money. On an amount, 0 is the dangerous value precisely
 * because it is a real, plausible figure: it does not read as "nobody said", it
 * reads as FREE, and the shelf prices it accordingly. `products.cost_amount`
 * was `DEFAULT 0` and four separate doors were letting it answer.
 */
const MONEY_DEFAULTS: Record<string, string> = {
  // Honest zeros: each starts a row that genuinely has none of this yet.
  shipping_cost_usd: 'an invoice with no shipping charged really did cost nothing to ship',
  total_usd: 'a running total, zero before a single line exists',
  total_tastings: 'a count of things that have happened, and none have',
  // DEBT, and the one that cost money. 0 on a cost is a free tea, not an
  // unrecorded one. Every door now either REQUIRES the cost (the form, the bulk
  // create, create_tea) or names the column NULL (the receipt proposal, the
  // cellar placement, the inbound import), so nothing in the code can reach
  // this default any more; it survives only for a row inserted straight from
  // schema.sql. SQLite cannot alter a default in place, so removing it is a
  // table rebuild, which is its own migration.
  cost_amount: 'DEBT: 0 means free, not unrecorded; every door now requires it or writes NULL',
};

/** Currency columns, which are units rather than values. */
const UNIT_DEFAULTS: Record<string, string> = {
  currency_default: "the shop's OWN setting; this is where the answer lives, not a guess",
  display_currency: 'a viewing preference, changed freely and costing nothing if wrong',
  preferred_currency: 'a note about a person, not a figure anything is computed from',
  // DEBT. A cost or a price whose unit was guessed prices the row wrong by
  // whatever the exchange rate is. costMissingItsCurrency() in the worker now
  // refuses a write that does not state one; the defaults themselves remain.
  //
  // The default cannot simply be dropped, because dropping it would not tell
  // anyone which of the existing rows had been answered — 'USD' from a choice
  // and 'USD' from the default are the same three letters. Migration 0014 adds
  // `cost_currency_source` for exactly that: every write from here forward is
  // marked as an answer, so what stays unmarked is the backlog, and
  // `list_unstated_costs` / `set_cost_currency` are how it gets worked off. The
  // default goes when the backlog reaches zero and not before.
  cost_currency: 'DEBT: a guessed unit on a figure the shelf price is computed from; 0014 makes the guesses findable',
  purchase_currency: 'DEBT: a guessed unit on a recorded purchase',
  price_currency: "DEBT: a guessed unit, and it guesses NT",
  currency: 'DEBT: a guessed unit on a money row',
};

function found(pattern: RegExp): string[] {
  return [...schema.matchAll(pattern)].map(m => m[1]);
}

/**
 * What the LIVE column actually defaults to, and what the registry claims.
 *
 * This is the half the registry was missing, and it is the half that mattered.
 * Every check above reads `worker/schema.sql`, which is a description of the
 * database maintained by hand, so a reason written beside a default was only
 * ever checked against the file that carries the default, never against the
 * database. `products.shipping_rate_per_kg` was `DEFAULT NULL` in schema.sql and
 * `DEFAULT 0` in the live table for months. The guard passed all the way
 * through, because a default that disagrees with its own written reason is
 * exactly what it could not see.
 *
 * `dflt` is what `PRAGMA table_info` reports after every migration has run.
 * `clearedBy` is filled in once a migration has changed it, and names what the
 * default WAS: the test replays the ledger up to the migration before that one
 * and checks the claim, so "0018 removed the default" is verified rather than
 * asserted, and deleting 0018 turns this red instead of quietly passing.
 */
interface LiveDefault {
  table: string;
  column: string;
  /** `PRAGMA table_info(...).dflt_value` today, verbatim. NULL means none. */
  dflt: string | null;
  reason: string;
  /** The migration that changed it, and the value it changed away from. */
  clearedBy?: { migration: string; was: string };
}

const CLEARED_BY_0018 = { migration: '0018_the_table_stops_saying_free.sql', was: '' };
const clearedBy = (was: string) => ({ ...CLEARED_BY_0018, was });

const LIVE_DEFAULTS: LiveDefault[] = [
  {
    table: 'products', column: 'shipping_rate_per_kg', dflt: null, clearedBy: clearedBy('0'),
    reason: '0 on a freight rate is Adrian saying this tea ships free, not "nobody entered one", and it '
      + 'was the default for every INSERT that did not name the column. schema.sql said NULL here from '
      + '0007 onward and was wrong the whole time; 0018 made the file true.',
  },
  {
    table: 'products', column: 'markup_multiplier', dflt: null, clearedBy: clearedBy('2.5'),
    reason: 'The multiplier the shop stopped using. 0013 cleared it off the rows and could not touch the '
      + 'default; the curator listing path reads the column, so a row carrying it priced differently from '
      + 'the shelf. NULL now, which reads SHOP_MARKUP_MULTIPLIER.',
  },
  {
    table: 'products', column: 'cost_amount', dflt: null, clearedBy: clearedBy('0'),
    reason: '0 on an amount is a free tea, not an unrecorded one, and the shelf priced it at zero times '
      + 'three. Every door already required the cost or named the column NULL; 0018 removed the last way '
      + 'to reach it.',
  },
  {
    table: 'product_listings', column: 'shipping_rate_per_kg', dflt: null, clearedBy: clearedBy('0'),
    reason: 'The same rate on the mirror, and the listing is the row a partner shop actually prices from, '
      + 'so a free-shipping default here reached a second shelf as well as this one.',
  },
  {
    table: 'product_listings', column: 'markup_multiplier', dflt: null, clearedBy: clearedBy('2.5'),
    reason: 'The same multiplier on the mirror, and this is the copy the curator listing path reads, so a '
      + 'listing carrying it priced the same tea differently from the shop shelf.',
  },
  {
    table: 'product_listings', column: 'cost_amount', dflt: null, clearedBy: clearedBy('0'),
    reason: 'The same free tea on the mirror. Carrying a tea, receiving a wholesale order and both create '
      + 'mirrors reach this column, and a cost of zero times three is a price of zero.',
  },
  {
    table: 'products', column: 'cost_currency', dflt: "'USD'",
    reason: 'DEBT: a guessed unit on the figure the shelf price is computed from. It cannot simply be '
      + 'dropped, because a chosen USD and a defaulted USD are the same three letters; 0014 added '
      + 'cost_currency_source so the unanswered rows are findable, and the default goes when that '
      + 'backlog reaches zero.',
  },
];

describe('the registry says what the LIVE column does, not what a file says', () => {
  it('reads every registered default out of the migration ledger and finds the claim honest', () => {
    const { db } = seedFromMigrations();
    try {
      const wrong: string[] = [];
      for (const entry of LIVE_DEFAULTS) {
        const actual = columnDefault(db, entry.table, entry.column);
        if (actual !== entry.dflt) {
          wrong.push(`${entry.table}.${entry.column}: registry says ${entry.dflt ?? 'no default'}, `
            + `the migrations build ${actual ?? 'no default'}`);
        }
      }
      expect(wrong, 'a default disagrees with the reason written beside it. '
        + 'Either a migration changed it and the registry was not updated, or the registry is describing '
        + 'schema.sql rather than the database.').toEqual([]);
    } finally {
      db.close();
    }
  });

  it('proves each clearedBy claim by replaying the ledger up to the migration before it', () => {
    const problems: string[] = [];
    for (const entry of LIVE_DEFAULTS) {
      if (!entry.clearedBy) continue;
      const { migration, was } = entry.clearedBy;
      if (!existsSync(join(MIGRATIONS_DIR, migration))) {
        problems.push(`${entry.table}.${entry.column} names ${migration}, which does not exist`);
        continue;
      }
      const number = migration.slice(0, 4);
      const before = migrationFiles().filter(file => file.slice(0, 4) < number).pop();
      const { db } = seedFromMigrations({ through: (before ?? '0000').slice(0, 4) });
      try {
        const actual = columnDefault(db, entry.table, entry.column);
        if (actual !== was) {
          problems.push(`${entry.table}.${entry.column}: before ${migration} the default was `
            + `${actual ?? 'none'}, not the ${was} the registry claims`);
        }
        if (actual === entry.dflt) {
          problems.push(`${entry.table}.${entry.column}: ${migration} is credited with changing the `
            + 'default and changed nothing');
        }
      } finally {
        db.close();
      }
    }
    expect(problems, 'a migration is credited with a change the ledger does not show').toEqual([]);
  });

  it('every registered default is carried with a written reason', () => {
    for (const entry of LIVE_DEFAULTS) {
      expect(entry.reason.length, `${entry.table}.${entry.column} is registered with no explanation`)
        .toBeGreaterThan(60);
    }
  });
});

describe('every column default is a decision somebody wrote down', () => {
  it('names every money default, zero included, because 0 on an amount means free', () => {
    /* Narrowed away from `capacity` and `count`: a seat count and a tally are
       not money, and a default of 0 on them is an honest empty start. */
    const columns = [...schema.matchAll(
      /^\s*([a-z_]*(?:cost|price|amount|paid|total|subtotal|balance|fee)[a-z_]*)\s+(?:REAL|INTEGER|NUMERIC)[^,\n]*?DEFAULT\s+(-?\d+(?:\.\d+)?)/gmi,
    )].map(m => m[1]).filter(c => !/capacity|count/.test(c));
    const unnamed = [...new Set(columns)].filter(c => !(c in MONEY_DEFAULTS) && !(c in NUMERIC_DEFAULTS));
    expect(unnamed, 'a money column was given a default; 0 there means free, not unknown. Say why in MONEY_DEFAULTS or use NULL')
      .toEqual([]);
  });

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
    /* All THREE registries. MONEY_DEFAULTS was added later and left out of this
       roll-up, which meant a debt could be recorded in one breath and exempted
       from the guard that keeps debts explained in the next. A registry the
       auditor does not read is a comment. */
    const debts = [...Object.entries(NUMERIC_DEFAULTS), ...Object.entries(UNIT_DEFAULTS), ...Object.entries(MONEY_DEFAULTS)]
      .filter(([, reason]) => reason.startsWith('DEBT'));
    expect(debts.length, 'debt entries vanished; either they were fixed (update this) or the registry was gutted')
      .toBeGreaterThanOrEqual(8);
    for (const [column, reason] of debts) {
      expect(reason.length, `${column} is marked DEBT with no explanation`).toBeGreaterThan(30);
    }
  });
});

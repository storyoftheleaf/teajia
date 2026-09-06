/**
 * Finding and correcting the costs whose currency nobody ever stated.
 *
 * `cost_currency` carries `DEFAULT 'USD'` on `products` and `product_listings`,
 * so on every row written before the guard in `costCurrency.ts` existed, "Adrian
 * chose dollars" and "nobody was ever asked" are the same three letters. The
 * guess is worth roughly seven times the money: a ¥1,200 invoice stored as
 * $1,200 prices the tea sevenfold, the ×3 triples it, and it surfaces as an
 * expensive tea rather than as a fault, because 1200 is a perfectly good number.
 * Adrian's own reading of his shelf is that MOST of these were not paid for in
 * dollars.
 *
 * Migration 0014 added `cost_currency_source` so that the rows nobody answered
 * are findable. These two tools are what turns findable into fixed:
 *
 *   - `list_unstated_costs` is the backlog, grouped the way the answer actually
 *     arrives. Adrian does not know tea by tea what he paid in; he knows that
 *     everything from a given vendor was settled in yuan. So the default view is
 *     by vendor, with the count and the money at stake, because one answer per
 *     vendor is a job of minutes and one answer per tea is a job nobody does.
 *   - `set_cost_currency` applies one answer to a whole vendor, or to named
 *     teas, behind the same preview/confirm every other mutation uses.
 *
 * Three things this deliberately does not do.
 *
 * IT DOES NOT GUESS FROM THE COMPASS. `tea_compass_entries.price_currency`
 * looks like evidence and is not: it carries `DEFAULT 'NT'`, the identical
 * disease in a second table, so believing it would silently retag as Taiwanese
 * every tea that ever passed through the compass without a currency.
 *
 * IT DOES NOT COPY THE RECEIPT EVIDENCE INTO THE ROW.
 * `inventory_receipt_lines.original_cost_currency` IS honest — no default, NULL
 * means nobody said — so it is joined and shown. But it is joined LIVE, on every
 * call, and never written anywhere. A default that is read cannot drift; a
 * default that is copied becomes one fact per copy. That rule is what migration
 * 0010 restored and 0013 finished, and a backfill here would be the same fault
 * wearing a fix's clothes.
 *
 * IT DOES NOT APPLY THE EVIDENCE BY ITSELF. Where a receipt disagrees with the
 * stored currency, that is shown as a disagreement and Adrian says which is
 * right. Changing a currency changes the shelf price by whatever the exchange
 * rate is; that is his call, not a migration's, and certainly not a join's.
 */
import { isRefreshedCurrency, refreshedCurrencyName, REFRESHED_CURRENCIES } from '../exchangeRateFeed';
import { CURRENCY_SOURCE_STATED } from '../costCurrency';
import type { ToolAuth, ToolDefinition, ToolEnv, ToolHandler, ToolModule } from './registry';
import { INVALID_TICKET, consumeTicket, issueTicket, previewEnvelope } from './tickets';

const KIND = 'cost_currency:set';

type SetTicket = {
  kind: typeof KIND;
  accountId: string;
  currency: string;
  productIds: string[];
  /* What the preview counted, re-checked at commit. Five minutes is long enough
     for another door to add a tea to the vendor, and confirming a count Adrian
     never saw is how a bulk action becomes a surprise. */
  selection: { by: 'vendor' | 'ids'; vendor: string | null };
};

/* ── reading the request ──────────────────────────────────────────────────── */

/**
 * A currency the daily refresh does not cover is refused where it can be chosen.
 *
 * The exchange table keys CNY as 'Yuan' and TWD as 'NT', so what gets stored has
 * to be the shop's name or the rate lookup misses and the tea stops pricing.
 * `refreshedCurrencyName` is the one place that mapping lives.
 */
function readCurrency(raw: unknown): string {
  if (typeof raw !== 'string' || raw.trim() === '') {
    throw new Error('currency is required — this is the whole point of the call');
  }
  const trimmed = raw.trim();
  if (trimmed.toUpperCase() === 'UNK') {
    throw new Error("'UNK' is this shop's sentinel for a currency nobody recorded, so it is not an answer to what a cost is in");
  }
  const name = refreshedCurrencyName(trimmed);
  if (!name || !isRefreshedCurrency(trimmed)) {
    throw new Error(
      `${trimmed} is not a currency this shop keeps a live rate for. `
      + `Choose one of: ${[...REFRESHED_CURRENCIES].join(', ')}. `
      + 'A currency outside the daily refresh prices off a figure that never changes again while looking exactly like a live rate.',
    );
  }
  return name;
}

function readProductIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) throw new Error('product_ids must be an array of product ids');
  const ids = raw.map(v => String(v ?? '').trim()).filter(Boolean);
  if (ids.length === 0) throw new Error('product_ids was empty');
  return [...new Set(ids)];
}

const placeholders = (n: number) => new Array(n).fill('?').join(', ');

/* ── the backlog ──────────────────────────────────────────────────────────── */

/**
 * The receipt join, live.
 *
 * A product can have several receipt lines. They agree or they do not, and a
 * disagreement is reported rather than resolved: two invoices in two currencies
 * for one tea is a real thing that needs a person, and picking one would be the
 * guess this whole module exists to stop.
 */
const RECEIPT_EVIDENCE_SQL = `
  SELECT product_id,
         COUNT(DISTINCT original_cost_currency) AS currencies,
         MIN(original_cost_currency)            AS currency
    FROM inventory_receipt_lines
   WHERE account_id = ? AND original_cost_currency IS NOT NULL
   GROUP BY product_id`;

async function receiptEvidence(env: ToolEnv, accountId: string) {
  const rows = await env.DB.prepare(RECEIPT_EVIDENCE_SQL).bind(accountId)
    .all<{ product_id: string; currencies: number; currency: string | null }>();
  const byProduct = new Map<string, { currency: string | null; conflicting: boolean }>();
  for (const row of rows.results ?? []) {
    byProduct.set(row.product_id, {
      currency: row.currencies === 1 ? row.currency : null,
      conflicting: row.currencies > 1,
    });
  }
  return byProduct;
}

const listUnstatedCosts: ToolHandler = async (env, auth, args) => {
  const vendorFilter = typeof args?.vendor === 'string' && args.vendor.trim() ? args.vendor.trim() : null;
  const includeTeas = args?.include_teas === true || vendorFilter !== null;

  /* Only rows with an amount. A tea with no cost recorded has no currency
     problem to answer, and padding the backlog with them makes it look
     unfinishable, which is how a backlog stops being worked. */
  const rows = await env.DB.prepare(
    `SELECT id, product_name, given_name, vendor, origin_country,
            cost_amount, cost_currency, quantity_purchased, year
       FROM products
      WHERE account_id = ?
        AND cost_currency_source IS NULL
        AND cost_amount IS NOT NULL AND cost_amount > 0
        ${vendorFilter ? 'AND vendor = ?' : ''}
      ORDER BY vendor, product_name`
  ).bind(...(vendorFilter ? [auth.accountId, vendorFilter] : [auth.accountId]))
    .all<Record<string, any>>();

  const products = rows.results ?? [];
  const evidence = await receiptEvidence(env, auth.accountId);

  const groups = new Map<string, {
    vendor: string | null; teas: number; stored_currencies: Set<string>;
    receipt_says: Set<string>; receipt_disagrees_with_stored: number; conflicting_receipts: number;
  }>();
  const teas: Record<string, unknown>[] = [];

  for (const p of products) {
    const key = p.vendor ?? '(no vendor recorded)';
    if (!groups.has(key)) {
      groups.set(key, {
        vendor: p.vendor ?? null, teas: 0, stored_currencies: new Set(),
        receipt_says: new Set(), receipt_disagrees_with_stored: 0, conflicting_receipts: 0,
      });
    }
    const g = groups.get(key)!;
    g.teas += 1;
    g.stored_currencies.add(String(p.cost_currency ?? '(none)'));

    const ev = evidence.get(String(p.id));
    if (ev?.conflicting) g.conflicting_receipts += 1;
    if (ev?.currency) {
      g.receipt_says.add(ev.currency);
      if (ev.currency.toLowerCase() !== String(p.cost_currency ?? '').toLowerCase()) {
        g.receipt_disagrees_with_stored += 1;
      }
    }

    if (includeTeas) {
      teas.push({
        product_id: p.id,
        name: p.given_name || p.product_name,
        year: p.year ?? null,
        vendor: p.vendor ?? null,
        origin_country: p.origin_country ?? null,
        cost_amount: p.cost_amount,
        stored_currency: p.cost_currency ?? null,
        /* Named for what it is. `stored_currency` is what the row says; the row
           may only be saying it because the column has a DEFAULT. */
        stored_currency_was_stated: false,
        receipt_currency: ev?.currency ?? null,
        receipt_currencies_conflict: ev?.conflicting ?? false,
      });
    }
  }

  return {
    unstated_teas: products.length,
    note: products.length === 0
      ? 'Every tea with a cost has had its currency stated.'
      : 'These rows never had a currency stated, so the stored one may just be the column default of USD. '
        + 'Answer per vendor with set_cost_currency; receipt_currency is what an intake receipt recorded, where one exists.',
    by_vendor: [...groups.values()]
      .map(g => ({
        vendor: g.vendor,
        teas: g.teas,
        stored_currencies: [...g.stored_currencies],
        receipt_says: [...g.receipt_says],
        receipt_disagrees_with_stored: g.receipt_disagrees_with_stored,
        conflicting_receipts: g.conflicting_receipts,
      }))
      .sort((a, b) => b.teas - a.teas),
    teas: includeTeas ? teas : undefined,
  };
};

/* ── the correction ───────────────────────────────────────────────────────── */

async function selectTargets(env: ToolEnv, accountId: string, args: any) {
  const vendor = typeof args?.vendor === 'string' && args.vendor.trim() ? args.vendor.trim() : null;
  const hasIds = args?.product_ids !== undefined;
  if (vendor && hasIds) {
    throw new Error('Give either vendor or product_ids, not both — two selections is two different sets of teas repriced.');
  }
  const onlyUnstated = args?.include_already_stated !== true;

  if (vendor) {
    /* A vendor-wide correction touches only the rows nobody answered, unless
       Adrian says otherwise out loud. Sweeping over a currency he deliberately
       set is how a bulk fix quietly undoes an earlier careful one. */
    const rows = await env.DB.prepare(
      `SELECT id, product_name, given_name, cost_amount, cost_currency, cost_currency_source
         FROM products
        WHERE account_id = ? AND vendor = ?
          AND cost_amount IS NOT NULL AND cost_amount > 0
          ${onlyUnstated ? 'AND cost_currency_source IS NULL' : ''}
        ORDER BY product_name`
    ).bind(accountId, vendor).all<Record<string, any>>();
    return { by: 'vendor' as const, vendor, rows: rows.results ?? [] };
  }

  const ids = readProductIds(args?.product_ids);
  const rows = await env.DB.prepare(
    `SELECT id, product_name, given_name, cost_amount, cost_currency, cost_currency_source
       FROM products
      WHERE account_id = ? AND id IN (${placeholders(ids.length)})`
  ).bind(accountId, ...ids).all<Record<string, any>>();
  const found = rows.results ?? [];
  const missing = ids.filter(id => !found.some(r => String(r.id) === id));
  if (missing.length > 0) {
    /* Named, not dropped. A silently shortened list is a correction that
       reports success over teas it never touched. */
    throw new Error(`Not in this shop: ${missing.join(', ')}`);
  }
  return { by: 'ids' as const, vendor: null, rows: found };
}

const setCostCurrency: ToolHandler = async (env, auth, args) => {
  const currency = readCurrency(args?.currency);
  const confirm = typeof args?.confirm === 'string' ? args.confirm : null;

  if (!confirm) {
    const target = await selectTargets(env, auth.accountId, args);
    if (target.rows.length === 0) {
      return {
        error: 'nothing_to_change',
        detail: target.by === 'vendor'
          ? `No tea from ${target.vendor} has a cost whose currency is still unstated. Pass include_already_stated to reach the rest.`
          : 'Those teas have no cost recorded, so there is no currency to state.',
      };
    }
    const evidence = await receiptEvidence(env, auth.accountId);
    const changing = target.rows.filter(
      r => String(r.cost_currency ?? '').toLowerCase() !== currency.toLowerCase());
    const contradicts = target.rows.filter(r => {
      const ev = evidence.get(String(r.id));
      return ev?.currency && ev.currency.toLowerCase() !== currency.toLowerCase();
    });

    const ticket: SetTicket = {
      kind: KIND, accountId: auth.accountId, currency,
      productIds: target.rows.map(r => String(r.id)),
      selection: { by: target.by, vendor: target.vendor },
    };
    const token = await issueTicket(env, ticket, auth.tokenId);
    return previewEnvelope({
      action: 'set_cost_currency',
      currency,
      teas: target.rows.length,
      currency_actually_changes_on: changing.length,
      /* The number that matters. Every one of these reprices by the exchange
         rate: a cost read as dollars that was really yuan drops about sevenfold
         when corrected, and the ×3 carries that straight to the shelf. */
      warning: changing.length > 0
        ? `${changing.length} tea(s) change currency, which changes what they cost and therefore what they sell for.`
        : 'No currency changes; this only records that the currency was stated.',
      contradicts_receipt: contradicts.length > 0
        ? contradicts.map(r => ({
            product_id: r.id,
            name: r.given_name || r.product_name,
            receipt_says: evidence.get(String(r.id))!.currency,
          }))
        : undefined,
      sample: target.rows.slice(0, 10).map(r => ({
        product_id: r.id,
        name: r.given_name || r.product_name,
        cost_amount: r.cost_amount,
        from: r.cost_currency ?? null,
        to: currency,
      })),
    }, token);
  }

  const ticket = await consumeTicket<SetTicket, typeof KIND>(env, confirm, KIND, auth);
  if (!ticket) return INVALID_TICKET;
  if (ticket.currency !== currency) return INVALID_TICKET;

  const ids = ticket.productIds;
  if (ids.length === 0) return { error: 'nothing_to_change' };

  const marks = placeholders(ids.length);
  await env.DB.batch([
    env.DB.prepare(
      `UPDATE products
          SET cost_currency = ?, cost_currency_source = ?, updated_at = datetime('now')
        WHERE account_id = ? AND id IN (${marks})`
    ).bind(currency, CURRENCY_SOURCE_STATED, auth.accountId, ...ids),
    /* The listing mirror carries its own cost and its own currency, so a
       correction that stops at `products` leaves partner catalog browse quoting
       the old one. Keyed by `legacy_product_id`, the same anchor the REST mirror
       uses. */
    env.DB.prepare(
      `UPDATE product_listings
          SET cost_currency = ?, cost_currency_source = ?, updated_at = datetime('now')
        WHERE account_id = ? AND legacy_product_id IN (${marks})`
    ).bind(currency, CURRENCY_SOURCE_STATED, auth.accountId, ...ids),
    /* `entity_id` is left null on purpose: this is one act over many teas, and
       naming one of them would make the log read as a single-product edit. The
       count and the selection are in `details`, which is what someone reading
       back a repricing actually needs. */
    env.DB.prepare(
      `INSERT INTO activity_logs (id, action, details, user_email, entity_type, entity_id, account_id)
       VALUES (?, 'COST_CURRENCY_STATED_MCP', ?, ?, 'product', NULL, ?)`
    ).bind(
      crypto.randomUUID(),
      `${ids.length} tea(s) recorded as priced in ${currency} via MCP`
        + (ticket.selection.by === 'vendor' ? ` — vendor ${ticket.selection.vendor}` : ' — named teas'),
      auth.userEmail, auth.accountId,
    ),
  ]);

  return {
    ok: true,
    currency,
    teas_updated: ids.length,
    note: 'Their costs now convert from this currency, so retail prices derived from cost have moved with them.',
  };
};

/* ── the module ───────────────────────────────────────────────────────────── */

const defs: ToolDefinition[] = [
  {
    name: 'list_unstated_costs',
    scope: 'inventory:read',
    description:
      'Teas whose cost currency was never actually stated, so the stored currency may only be the '
      + "column's default of USD. Grouped by vendor, because that is how the answer arrives: Adrian "
      + 'knows a vendor was settled in yuan, not what each tea was. Shows what an intake receipt '
      + 'recorded where one exists, and how often that disagrees with the stored currency.',
    inputSchema: {
      type: 'object',
      properties: {
        vendor: { type: 'string', description: 'Only this vendor. Implies include_teas.' },
        include_teas: { type: 'boolean', description: 'Return the individual teas as well as the per-vendor totals.' },
      },
    },
  },
  {
    name: 'set_cost_currency',
    scope: 'catalog:write',
    description:
      'Record what a cost was actually paid in, for a whole vendor or for named teas. Two-step: call '
      + 'once to see how many teas move and what any receipt says, then again with confirm. Changing a '
      + "currency changes the tea's cost and therefore its shelf price. By default this only touches "
      + 'rows whose currency was never stated.',
    inputSchema: {
      type: 'object',
      properties: {
        currency: { type: 'string', description: "The shop's name for the currency: Yuan, NT, IDR, MYR, JPY, AUD, HKD, USD." },
        vendor: { type: 'string', description: 'Apply to every unstated tea from this vendor.' },
        product_ids: { type: 'array', items: { type: 'string' }, description: 'Apply to these teas. Mutually exclusive with vendor.' },
        include_already_stated: {
          type: 'boolean',
          description: 'Also overwrite rows where a currency was deliberately stated. Off by default, so a bulk fix cannot undo a careful one.',
        },
        confirm: { type: 'string', description: 'The confirmation_token from the preview call. Single use.' },
      },
      required: ['currency'],
    },
  },
];

const handlers: Record<string, ToolHandler> = {
  list_unstated_costs: listUnstatedCosts,
  set_cost_currency: setCostCurrency,
};

export const costCurrencyTools: ToolModule = {
  area: 'cost currency',
  defs,
  handlers,
};

export const __testables = { readCurrency, readProductIds };

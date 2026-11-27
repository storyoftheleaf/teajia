/**
 * Freight rates for an agent: see all of them, and say which one a tea follows.
 *
 * Adrian, 2026-11-27: he opened "shop default" on a tea and wanted to see and
 * edit the shop's shipping, and he wants all of this work agent-based. An agent
 * could already change the shop default (`update_account_settings`) and a
 * service's rate (`update_logistics_service`), but it could not read the whole
 * picture in one call, and it could not put a tea on a service, which is the
 * only per-tea freight choice left now that a tea's own rate is retired.
 *
 * The levels, the same ones `worker/src/shippingRate.ts` prices by:
 *   1. the shop default, `accounts.default_shipping_rate_per_kg` / `_currency`;
 *   2. a logistics service a tea travels by, `products.freight_service_id`;
 *   3. an older rate of the tea's own, `products.shipping_rate_per_kg`, which
 *      still wins until it is cleared (`update_tea_pricing` clear_fields).
 *
 * The arithmetic is not repeated here. This only reads the rows and writes the
 * one column, the same validation the REST product update uses.
 */
import { canonicalCurrency } from '../../../src/lib/currency';
import { resolveShopFreightDefault } from '../shippingRate';
import type { ToolAuth, ToolEnv, ToolModule } from './registry';
import { consumeTicket, INVALID_TICKET, issueTicket, previewEnvelope, type TicketPayload } from './tickets';

interface FreightServiceTicket extends TicketPayload {
  kind: 'set_tea_freight_service';
  productId: string;
  before: string | null;
  after: string | null;
}

type ServiceRow = { id: string; logistics_company_name: string; name: string; mode: string; basis: string; rate: number; currency: string; active: number };

async function rateLookup(env: ToolEnv) {
  const rows = await env.DB.prepare('SELECT currency, rate_to_usd FROM exchange_rates').all<{ currency: string; rate_to_usd: number }>();
  const rates = new Map((rows.results ?? []).map(row => [row.currency, Number(row.rate_to_usd)]));
  return (currency: string) => {
    const key = canonicalCurrency(currency) ?? currency;
    return key === 'USD' ? 1 : rates.get(key) ?? null;
  };
}

const rateText = (s: Pick<ServiceRow, 'rate' | 'currency' | 'basis'>) =>
  `${s.rate} ${s.currency}${s.basis === 'fixed' ? ' fixed a shipment' : s.basis === 'm3' ? '/m³' : '/kg'}`;

async function listFreightRates(env: ToolEnv, auth: ToolAuth) {
  const account = await env.DB.prepare('SELECT default_shipping_rate_per_kg, default_shipping_rate_currency FROM accounts WHERE id = ?')
    .bind(auth.accountId).first<{ default_shipping_rate_per_kg: number | null; default_shipping_rate_currency: string | null }>();
  const shop = resolveShopFreightDefault(account, await rateLookup(env));
  const services = await env.DB.prepare(
    'SELECT id, logistics_company_name, name, mode, basis, rate, currency, active FROM logistics_services WHERE account_id = ? AND active = 1 ORDER BY logistics_company_name, name',
  ).bind(auth.accountId).all<ServiceRow>();
  const counts = await env.DB.prepare(
    "SELECT freight_service_id, COUNT(*) n FROM products WHERE account_id = ? AND type <> 'Teaware' AND shipping_rate_per_kg IS NULL GROUP BY freight_service_id",
  ).bind(auth.accountId).all<{ freight_service_id: string | null; n: number }>();
  const own = await env.DB.prepare(
    "SELECT id, COALESCE(given_name, product_name) name, shipping_rate_per_kg, cost_currency FROM products WHERE account_id = ? AND type <> 'Teaware' AND shipping_rate_per_kg IS NOT NULL ORDER BY name LIMIT 100",
  ).bind(auth.accountId).all<{ id: string; name: string; shipping_rate_per_kg: number; cost_currency: string | null }>();
  const countFor = (id: string | null) => (counts.results ?? []).filter(row => row.freight_service_id === id).reduce((sum, row) => sum + Number(row.n), 0);
  const activeIds = new Set((services.results ?? []).map(s => s.id));
  // A tea pointing at an archived service follows the shop default too.
  const onArchived = (counts.results ?? []).filter(row => row.freight_service_id && !activeIds.has(row.freight_service_id)).reduce((sum, row) => sum + Number(row.n), 0);
  return {
    shop_default: {
      rate_per_kg: shop.perKg, currency: shop.currency, per_kg_usd: shop.perKgUsd,
      set_by_shop: account?.default_shipping_rate_per_kg != null,
      teas_following: countFor(null) + onArchived,
      how_to_change: 'update_account_settings with default_shipping_rate_per_kg and default_shipping_rate_currency',
    },
    services: (services.results ?? []).map(s => ({
      service_id: s.id, company: s.logistics_company_name, name: s.name, mode: s.mode, basis: s.basis,
      rate: s.rate, currency: s.currency, label: rateText(s), teas_following: countFor(s.id),
      how_to_change: 'update_logistics_service with service_id',
    })),
    teas_with_own_rate: (own.results ?? []).map(t => ({ product_id: t.id, name: t.name, rate_per_kg: t.shipping_rate_per_kg, currency: t.cost_currency })),
    note: 'Freight is passed on at cost: shelf price is tea cost x3 plus freight. A tea\'s own older rate wins until cleared with update_tea_pricing clear_fields ["shipping_rate_per_kg"]. Put a tea on a service, or back on the shop default, with set_tea_freight_service.',
  };
}

async function setTeaFreightService(env: ToolEnv, auth: ToolAuth, args: any) {
  if (args?.confirm) {
    const ticket = await consumeTicket<FreightServiceTicket, 'set_tea_freight_service'>(env, String(args.confirm), 'set_tea_freight_service', auth);
    if (!ticket) return INVALID_TICKET;
    if (ticket.after) {
      const still = await env.DB.prepare('SELECT id FROM logistics_services WHERE id = ? AND account_id = ? AND active = 1').bind(ticket.after, auth.accountId).first();
      if (!still) return { error: 'That service was archived after the preview. Nothing changed.' };
    }
    const changed = await env.DB.prepare(
      "UPDATE products SET freight_service_id = ?, updated_at = datetime('now') WHERE id = ? AND account_id = ? AND freight_service_id IS ?",
    ).bind(ticket.after, ticket.productId, auth.accountId, ticket.before).run();
    if (!(changed.meta?.changes ?? 0)) return { error: 'This tea\'s freight changed after the preview. Preview again.' };
    return { committed: true, action: 'set_tea_freight_service', product_id: ticket.productId, freight_service_id: ticket.after };
  }
  const productId = typeof args?.product_id === 'string' ? args.product_id.trim() : '';
  if (!productId) return { error: 'product_id is required' };
  if (!('service_id' in (args ?? {}))) return { error: 'service_id is required: a service id, or null for the shop default' };
  const after = args.service_id === null || args.service_id === '' ? null : String(args.service_id);
  const product = await env.DB.prepare('SELECT id, type, COALESCE(given_name, product_name) name, freight_service_id, shipping_rate_per_kg FROM products WHERE id = ? AND account_id = ?')
    .bind(productId, auth.accountId).first<{ id: string; type: string | null; name: string; freight_service_id: string | null; shipping_rate_per_kg: number | null }>();
  if (!product) return { error: 'not_found' };
  if (product.type === 'Teaware') return { error: 'Teaware carries its freight in the piece cost, so it follows no service.' };
  const service = after
    ? await env.DB.prepare('SELECT id, logistics_company_name, name, mode, basis, rate, currency, active FROM logistics_services WHERE id = ? AND account_id = ? AND active = 1').bind(after, auth.accountId).first<ServiceRow>()
    : null;
  if (after && !service) return { error: 'Choose one of this shop\'s active logistics services (list_freight_rates), or null for the shop default.' };
  const before = product.freight_service_id ?? null;
  const preview = {
    action: 'set_tea_freight_service', product_id: product.id, tea: product.name,
    from: before ?? 'shop default',
    to: service ? `${service.logistics_company_name} · ${service.name}, ${rateText(service)}` : 'shop default',
    ...(product.shipping_rate_per_kg != null ? { warning: 'This tea still carries its own older rate, which wins over any service until it is cleared with update_tea_pricing clear_fields ["shipping_rate_per_kg"].' } : {}),
  };
  const ticket: FreightServiceTicket = { kind: 'set_tea_freight_service', accountId: auth.accountId, productId: product.id, before, after };
  return previewEnvelope(preview, await issueTicket(env, ticket, auth.tokenId));
}

export const freightRateTools: ToolModule = {
  area: 'freight-rates',
  defs: [
    {
      name: 'list_freight_rates', scope: 'inventory:read',
      description: 'Every freight rate in the shop in one read: the shop default (rate, currency, USD a kilo, how many teas follow it), each active logistics service with its rate and how many teas travel by it, and teas still carrying an older rate of their own. Says which tool changes each.',
      inputSchema: { type: 'object', properties: {} },
      annotations: { readOnlyHint: true },
    },
    {
      name: 'set_tea_freight_service', scope: 'stock:write',
      description: 'Choose how one tea travels home for pricing: one of the shop\'s active logistics services (service_id from list_freight_rates), or null to follow the shop default. The rate itself stays on the service or the shop. Two steps: preview, then confirm with the token after the user agrees.',
      inputSchema: { type: 'object', properties: {
        product_id: { type: 'string' },
        service_id: { type: ['string', 'null'], description: 'A logistics service id, or null for the shop default.' },
        confirm: { type: 'string', description: 'The confirmation token from the preview.' },
      } },
      annotations: { destructiveHint: false, idempotentHint: true },
    },
  ],
  handlers: { list_freight_rates: listFreightRates, set_tea_freight_service: setTeaFreightService },
};

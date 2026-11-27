/**
 * A tea's own freight rate is not typed through the product doors (Adrian,
 * 2026-11-27): rates live in Logistics with the services and the shop default.
 *
 * Still allowed:
 *   - clearing it (null), which hands the tea to its service or the shop default;
 *   - on an edit, a number only when the tea already carries a rate AND the edit
 *     changes its cost currency, because the rate is stored in that currency and
 *     the edit form carries the same dollars across.
 * A new tea never arrives with one.
 */
import { sameCurrency } from '../../src/lib/currency';

export const FREIGHT_RATE_IN_LOGISTICS_REST = 'A tea\'s freight rate is set in Logistics, not on the tea. Pick the service it travels by, or clear its old rate.';

const said = (value: unknown) => !(value === undefined || value === null || (typeof value === 'string' && value.trim() === ''));

export function freightRateWriteRefusal(
  body: Record<string, unknown>,
  existing: 'create' | { shipping_rate_per_kg?: number | null; cost_currency?: string | null } | null,
): string | null {
  if (!('shipping_rate_per_kg' in body) || !said(body.shipping_rate_per_kg)) return null;
  if (existing === 'create' || !existing) return FREIGHT_RATE_IN_LOGISTICS_REST;
  const carriedAcross = existing.shipping_rate_per_kg != null
    && said(body.cost_currency)
    && !sameCurrency(existing.cost_currency, String(body.cost_currency));
  return carriedAcross ? null : FREIGHT_RATE_IN_LOGISTICS_REST;
}

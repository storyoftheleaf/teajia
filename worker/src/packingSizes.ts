/**
 * The shop's learned packed sizes, read from its shipments (src/lib/packingSizes.ts).
 * Worked out on every read, never stored, so a corrected measurement or bill
 * improves the next estimate at once.
 */
import { learnPackingSizes, packingKindFor, type PackingLine, type PackingSizes } from '../../src/lib/packingSizes';

const parse = (json: unknown) => { try { return typeof json === 'string' ? JSON.parse(json) : null; } catch { return null; } };

export async function readPackingSizes(env: { DB: D1Database }, accountId: string): Promise<PackingSizes> {
  const { results } = await env.DB.prepare(
    `SELECT s.id AS shipment_id, s.freight_json, r.product_id, r.unit, l.quantity, l.volume_m3, l.volume_estimated,
            p.form, p.type, COALESCE(p.given_name, p.product_name) AS name
       FROM logistics_shipments s
       JOIN logistics_shipment_lines l ON l.shipment_id = s.id AND l.account_id = s.account_id
       JOIN inventory_receipt_lines r ON r.id = l.receipt_line_id AND r.account_id = l.account_id
       LEFT JOIN products p ON p.id = r.product_id AND p.account_id = r.account_id
      WHERE s.account_id = ? AND s.state <> 'cancelled'`,
  ).bind(accountId).all<Record<string, any>>();
  const lines: PackingLine[] = (results ?? []).map(r => ({
    shipment_id: r.shipment_id, product_id: r.product_id, unit: r.unit, quantity: Number(r.quantity),
    kind: packingKindFor({ unit: r.unit, form: r.form, type: r.type, name: r.name }),
    volume_m3: r.volume_m3 == null ? null : Number(r.volume_m3), volume_estimated: !!r.volume_estimated,
    freight: parse(r.freight_json),
  }));
  return learnPackingSizes(lines);
}

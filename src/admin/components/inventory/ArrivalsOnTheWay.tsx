import { Link } from 'react-router-dom';
import type { PurchaseTrackingRow } from '../../../lib/api';
import { TYPOGRAPHY_CLASSES as T } from '../../../designTokens';

/**
 * Teas ordered in Curate that have not reached the studio yet (Adrian,
 * 2026-11-27: eighteen one-item cards all saying "waiting for agent review"
 * looked stuck). They are not stuck and nothing is asked of an agent: each one
 * waits for Adrian's yes when it lands, in Curate, where the arrival is
 * approved into stock or taken off the list. So they read as one quiet list,
 * by supplier, one line a tea, and each line opens the tea in Curate.
 */
export const isCurateArrivalRow = (row: PurchaseTrackingRow) => Boolean(row.arrival_proposal) && !row.purchase && !row.receipt;

const STATE: Record<string, string> = { in_transit: 'On the way', ordered: 'Ordered' };
const amount = (quantity: number | undefined, unit: string | undefined) =>
  quantity == null ? null : unit === 'unit' ? `${quantity} ${quantity === 1 ? 'piece' : 'pieces'}` : quantity >= 1000 ? `${Number((quantity / 1000).toFixed(2))} kg` : `${quantity} g`;

export function groupArrivals(rows: PurchaseTrackingRow[]) {
  const groups = new Map<string, PurchaseTrackingRow[]>();
  for (const row of rows) {
    const supplier = row.arrival_proposal?.vendor_name || 'Supplier not recorded';
    groups.set(supplier, [...(groups.get(supplier) ?? []), row]);
  }
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
}

export function ArrivalsOnTheWay({ rows }: { rows: PurchaseTrackingRow[] }) {
  if (!rows.length) return null;
  return <section className="purchase-review-queue arrivals-on-the-way" aria-label="Teas on the way" data-testid="arrivals-on-the-way">
    <header>
      <h2 className={T.label}>On the way, not yet in stock <span>{rows.length}</span></h2>
      <p className="text-tea-text-dim">Teas ordered in Curate. When one reaches you, open it and approve the arrival into stock, or take it off if it is not coming.</p>
    </header>
    {groupArrivals(rows).map(([supplier, teas]) => <div key={supplier} className="arrivals-supplier">
      <h3 className="text-tea-text">{supplier}</h3>
      <ul>{teas.map(row => {
        const proposal = row.arrival_proposal!;
        const name = proposal.tea_name || proposal.product_name || 'Unnamed tea';
        const details = [amount(proposal.quantity, proposal.unit), STATE[proposal.acquisition_state || ''] || 'Ordered'].filter(Boolean).join(' · ');
        return <li key={row.id}>
          {proposal.compass_entry_id
            ? <Link className="tap-target arrivals-tea text-tea-text hover:text-tea-gold-lt" to={`/admin/compass?entry=${encodeURIComponent(proposal.compass_entry_id)}`}>{name}</Link>
            : <span className="arrivals-tea text-tea-text">{name}</span>}
          <span className="text-tea-text-sec tabular-nums">{details}</span>
        </li>;
      })}</ul>
    </div>)}
  </section>;
}

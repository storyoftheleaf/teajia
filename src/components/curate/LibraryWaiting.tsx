import React, { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { Product } from '../../admin/types';
import { useLibraryPurchases } from '../../lib/libraryPurchaseState';
import { libraryWaiting, type WaitingGroupId } from './teaPath';
import { entryDisplayTitle, type TeaCompassEntry } from '../TeaCompass/types';

const SHOWN = 6;

/** Waiting for you: every tea in the Library whose next step is Adrian's,
 *  under that step, in one place at the top of the Library. Each name opens
 *  the tea, where the step is one tap. It reads what is stored and writes
 *  nothing. Teas waiting on a supplier are not listed. */
export function LibraryWaiting({ entries, products, productsLoading, productsFailed, onOpen }: {
  entries: readonly TeaCompassEntry[];
  /** The Library's own read of Stock, mapped; the Library already loads it. */
  products: readonly Product[];
  productsLoading: boolean;
  productsFailed: boolean;
  onOpen: (id: string) => void;
}) {
  const purchases = useLibraryPurchases();
  const [params, setParams] = useSearchParams();
  const opened = params.get('waiting') as WaitingGroupId | null;
  const groups = useMemo(() => libraryWaiting({
    entries,
    products,
    proposals: purchases.receiptProposals ?? [],
    purchaseStatusFor: (entry, productId) => purchases.stateFor({ entryId: entry.id, productId: productId ?? entry.draftProductId, chosen: entry.decision === 'selected' }).status,
  }), [entries, products, purchases]);
  if (productsLoading || purchases.isLoading) return null;
  if (productsFailed || purchases.isError) {
    return <p role="status" className="text-ui-12 text-tea-text-sec" data-testid="library-waiting">Waiting for you can't be read just now. The Library below is unchanged.</p>;
  }
  if (groups.length === 0) return null;
  const showAll = (id: WaitingGroupId | null) => setParams(current => {
    const next = new URLSearchParams(current);
    if (id) next.set('waiting', id); else next.delete('waiting');
    return next;
  }, { replace: true }); // history: refine
  return <section aria-labelledby="library-waiting-title" className="space-y-2 border-b border-tea-border pb-3" data-testid="library-waiting">
    <h2 id="library-waiting-title" className="text-ui-14 font-medium text-tea-text">Waiting for you</h2>
    <ul className="grid gap-x-6 gap-y-2 sm:grid-cols-2 xl:grid-cols-3">
      {groups.map(group => {
        const all = opened === group.id;
        const shown = all ? group.entries : group.entries.slice(0, SHOWN);
        return <li key={group.id} className="space-y-1" data-testid={`library-waiting-${group.id}`}>
          <div className="flex items-baseline gap-2 text-ui-12 text-tea-text-sec">
            <span>{group.title}</span><span className="tabular-nums text-tea-text-dim">{group.entries.length}</span>
          </div>
          <div className="flex flex-wrap gap-1">
            {shown.map(entry => <button key={entry.id} type="button" onClick={() => onOpen(entry.id)} className="btn-chip tap-target">{entryDisplayTitle(entry)}</button>)}
            {group.entries.length > SHOWN && <button type="button" onClick={() => showAll(all ? null : group.id)} className="btn-quiet tap-target" aria-expanded={all}>
              {all ? 'Show fewer' : `${group.entries.length - SHOWN} more`}
            </button>}
          </div>
        </li>;
      })}
    </ul>
  </section>;
}

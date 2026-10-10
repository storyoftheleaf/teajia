import React, { useState } from 'react';
import { useLedgerStore } from '../../lib/ledgerStore';
import { useShopOrders } from '../CurateV2/shopOrders';
import { CartPanel } from './CartPanel';

// Order statuses that are on their way; InProcess.tsx lists the same three.
const ON_ITS_WAY = ['confirmed', 'sent', 'shipped'];

/** The doors to buying, shown only while there is something there:
 *  "Buying · 3 teas from 2 suppliers" and "In process · 2 orders". Owner screens only. */
export const BuyingEntry: React.FC<{ className?: string }> = ({ className = '' }) => {
  const [open, setOpen] = useState<'buying' | 'inprocess' | null>(null);
  const drafts = useLedgerStore((s) => s.transactions).filter((tx) => tx.direction === 'purchase' && tx.status === 'draft' && tx.items.length > 0);
  const teas = drafts.reduce((n, tx) => n + tx.items.length, 0);
  const placed = useShopOrders().orders.filter((o) => ON_ITS_WAY.includes(o.status)).length;
  const row = `w-full flex items-baseline gap-2 text-left border-b border-tea-border hover:text-tea-text ${className}`;
  return <>
    {teas > 0 && (
      <button type="button" onClick={() => setOpen('buying')} data-testid="buying-entry" className={row}>
        <span className="font-display text-ui-17 text-tea-text">Buying</span>
        <span className="num text-ui-12 text-tea-text-sec">{teas} {teas === 1 ? 'tea' : 'teas'} from {drafts.length} {drafts.length === 1 ? 'supplier' : 'suppliers'}</span>
        <span className="ml-auto text-ui-12 text-tea-gold-lt">Open</span>
      </button>
    )}
    {placed > 0 && (
      <button type="button" onClick={() => setOpen('inprocess')} data-testid="in-process-entry" className={row}>
        <span className="font-display text-ui-17 text-tea-text">In process</span>
        <span className="num text-ui-12 text-tea-text-sec">{placed} {placed === 1 ? 'order' : 'orders'} on the way</span>
        <span className="ml-auto text-ui-12 text-tea-gold-lt">Open</span>
      </button>
    )}
    <CartPanel mode={open ?? 'buying'} isOpen={open !== null} onClose={() => setOpen(null)} />
  </>;
};

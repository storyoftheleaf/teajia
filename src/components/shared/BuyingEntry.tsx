import React, { useState } from 'react';
import { useLedgerStore } from '../../lib/ledgerStore';
import { CartPanel } from './CartPanel';

/** "Buying · 3 teas from 2 suppliers": the door to the buying basket, shown only
 *  while something is wanted. Owner screens only; customers never see it. */
export const BuyingEntry: React.FC<{ className?: string }> = ({ className = '' }) => {
  const [open, setOpen] = useState(false);
  const drafts = useLedgerStore((s) => s.transactions).filter((tx) => tx.direction === 'purchase' && tx.status === 'draft' && tx.items.length > 0);
  const teas = drafts.reduce((n, tx) => n + tx.items.length, 0);
  return <>
    {teas > 0 && (
      <button type="button" onClick={() => setOpen(true)} data-testid="buying-entry"
        className={`w-full flex items-baseline gap-2 text-left border-b border-tea-border hover:text-tea-text ${className}`}>
        <span className="font-display text-ui-17 text-tea-text">Buying</span>
        <span className="num text-ui-12 text-tea-text-sec">{teas} {teas === 1 ? 'tea' : 'teas'} from {drafts.length} {drafts.length === 1 ? 'supplier' : 'suppliers'}</span>
        <span className="ml-auto text-ui-12 text-tea-gold-lt">Open</span>
      </button>
    )}
    <CartPanel mode="buying" isOpen={open} onClose={() => setOpen(false)} />
  </>;
};

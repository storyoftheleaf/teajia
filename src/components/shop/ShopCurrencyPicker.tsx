import React from 'react';
import { useAppStore } from '../../lib/store';
import { useRates } from '../../admin/hooks/useAdminData';
import type { Currency } from '../../admin/types';

/**
 * The currency every figure on the page is quoted in, named once and
 * changeable there.
 *
 * The order panel used to print the currency on each of eleven figures, which
 * is a word the reader chose themselves read back at them eleven times, and it
 * held the numbers apart so no two of them started in the same place. Naming
 * it once beside the heading frees the columns to line up, and makes the one
 * place it is said the one place it can be changed.
 *
 * The change is page-wide, not panel-wide: this writes the same store field
 * the cart and the admin bar already read, so a reader who switches here meets
 * the same currency in the basket and on the next tea they open.
 *
 * A native select, deliberately. It is the one control a phone renders as its
 * own wheel, it needs no open state, and the shop's own listbox would be a
 * second thing to build for a nine-item list.
 */
export const ShopCurrencyPicker: React.FC<{ className?: string }> = ({ className }) => {
  const currency = useAppStore(s => s.currency);
  const setCurrency = useAppStore(s => s.setCurrency);
  const { data: rates = [] } = useRates();

  // USD needs no rate table and must always be offered; the rest are whatever
  // the live table holds, so a currency we cannot convert is never listed.
  const codes = ['USD', ...rates.map(r => r.currency).filter(c => c !== 'USD' && c !== 'UNK')];

  return (
    /* The visible control is a chip the size of the label beside it; the
       select itself is a transparent 44px pad laid over it, because the tap
       floor is 44 and a 44px-tall select would set the height of the whole
       heading row it sits in. */
    <span className={`relative inline-flex shrink-0 items-center border border-tea-border px-1.5 py-[3px] transition-colors hover:border-tea-gold/40 ${className ?? ''}`}>
      <span className="pointer-events-none font-sans text-ui-10 uppercase tracking-[0.14em] text-tea-text-sec">
        {currency}
      </span>
      <span aria-hidden="true" className="pointer-events-none ml-1 font-sans text-ui-8 text-tea-text-dim">
        {'\u25BE'}
      </span>
      <select
        value={currency}
        onChange={e => setCurrency(e.target.value as Currency)}
        aria-label="Currency for every price on this page"
        className="absolute left-1/2 top-1/2 h-[44px] min-w-[44px] -translate-x-1/2 -translate-y-1/2 cursor-pointer appearance-none border-0 bg-transparent p-0 text-ui-10 opacity-0 outline-none"
        style={{ width: '100%' }}
      >
        {codes.map(code => (
          <option key={code} value={code}>
            {code}
          </option>
        ))}
      </select>
    </span>
  );
};

import React, { useState } from 'react';
import { useRates } from '../../admin/hooks/useAdminData';
import { SHOP_CURRENCY_KEYS, isoCurrencyCode, rateToUsd } from '../../lib/currency';
import { BottomSheet, SheetOption } from '../shared/BottomSheet';
import { LIBRARY_PRICE_KEY, type LibraryPricePreference } from './libraryPriceDisplay';

export function LibraryCurrencyPicker({ preference, onChange }: { preference: LibraryPricePreference; onChange: (next: LibraryPricePreference) => void }) {
  const [open, setOpen] = useState(false);
  const { data: rates = [] } = useRates();
  const code = preference.currency === 'source' ? null : isoCurrencyCode(preference.currency);
  const symbol = code ? new Intl.NumberFormat('en-US', { style: 'currency', currency: code, currencyDisplay: 'narrowSymbol' }).formatToParts(0).find(part => part.type === 'currency')?.value ?? code : '¤';
  return <>
    <button type="button" className="flex h-11 min-w-11 shrink-0 items-center justify-center rounded-md border border-tea-border bg-tea-surface px-2 text-ui-17 text-tea-text hover:bg-tea-elevated" aria-label="Price display settings" title={`Display currency: ${code ?? 'Original currency'}`} onClick={() => setOpen(true)}>{symbol}</button>
    <BottomSheet open={open} onOpenChange={setOpen} title="Price display" description="Source quotes stay unchanged in each record.">
      <div className="grid grid-cols-2 gap-1 pb-4" aria-label="Price display currency">
        {['source', ...SHOP_CURRENCY_KEYS.filter(currency => currency !== 'UNK')].map(currency => <SheetOption key={currency}
          label={currency === 'source' ? 'Original currency' : isoCurrencyCode(currency)}
          hint={currency === 'source' ? 'As quoted by the supplier' : currency !== 'USD' && rateToUsd(rates, currency) == null ? 'Rate unavailable' : undefined}
          selected={preference.currency === currency}
          onSelect={() => {
            const next = { ...preference, currency };
            onChange(next);
            try { localStorage.setItem(LIBRARY_PRICE_KEY, JSON.stringify(next)); } catch { /* Selection works without storage. */ }
            setOpen(false);
          }} />)}
      </div>
    </BottomSheet>
  </>;
}

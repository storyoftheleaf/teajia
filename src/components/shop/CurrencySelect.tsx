import React from 'react';
import type { Currency } from '../../admin/types';
import { useAppStore } from '../../lib/store';
import { AnchoredMenu } from '../shared/AnchoredMenu';
import { Icons } from '../Icons';

/**
 * Currencies the shop can display a price in. Mirrors the cart/account
 * selector so every surface agrees on the codes and symbols.
 */
const CURRENCY_OPTIONS: { code: Currency; label: string; symbol: string }[] = [
  { code: 'USD', label: 'US Dollar', symbol: '$' },
  { code: 'Yuan', label: 'Chinese Yuan', symbol: 'CN¥' },
  { code: 'IDR', label: 'Indonesian Rupiah', symbol: 'Rp' },
  { code: 'NT', label: 'Taiwan Dollar', symbol: 'NT$' },
  { code: 'JPY', label: 'Japanese Yen', symbol: 'JP¥' },
  { code: 'MYR', label: 'Malaysian Ringgit', symbol: 'RM' },
  { code: 'AUD', label: 'Australian Dollar', symbol: 'A$' },
];

/**
 * A visible currency dropdown for the shop header. Reads and writes the shared
 * session currency via useAppStore (the same store the cart + every
 * useShopPrice consumer read), so choosing here re-prices the whole shop.
 * Defaults to USD. Ads a check to the active code.
 */
export const CurrencySelect: React.FC = () => {
  const currency = useAppStore(s => s.currency);
  const setCurrency = useAppStore(s => s.setCurrency);
  const active = CURRENCY_OPTIONS.find(o => o.code === currency) ?? CURRENCY_OPTIONS[0];

  return (
    <AnchoredMenu
      align="right"
      width={208}
      className="!bg-tea-elevated"
      role="listbox"
      trigger={(props) => (
        <button
          {...props}
          type="button"
          aria-label={`Choose display currency, currently ${active.code}`}
          /* A control, and it has to look like one. It read as two dim words
             and a chevron floating in the header, which is the same treatment
             as the metadata under a title, so the one thing on this row that
             re-prices the whole shop was the quietest thing on it. A keyline,
             a faint wash and full-strength type: the same grammar the amount
             picker on a product page uses, for the same job. */
          className="tap-target inline-flex items-center gap-1.5 rounded-[3px] border border-tea-border bg-tea-gold/6 px-2.5 py-1.5 text-ui-12 text-tea-text transition-colors hover:border-tea-gold hover:bg-tea-gold/8"
        >
          <span className="font-mono tracking-wide text-tea-text-sec">{active.symbol}</span>
          <span className="tracking-[0.06em]">{active.code}</span>
          <Icons.ChevronDown className="w-3.5 h-3.5 text-tea-text-sec" />
        </button>
      )}
    >
      {(close) => (
        <div className="py-1" role="listbox" aria-label="Currency">
          {CURRENCY_OPTIONS.map((opt) => (
            <button
              key={opt.code}
              type="button"
              role="option"
              aria-selected={opt.code === currency}
              onClick={() => {
                setCurrency(opt.code);
                close();
              }}
              className="flex w-full items-center justify-between gap-3 px-3 py-2 text-ui-12 text-tea-text hover:bg-tea-accent-sub transition-colors text-left"
            >
              <span className="flex items-center gap-2">
                <span className="font-mono">{opt.symbol}</span>
                <span>{opt.label}</span>
              </span>
              {opt.code === currency && <Icons.Check className="w-3.5 h-3.5 text-tea-gold" />}
            </button>
          ))}
        </div>
      )}
    </AnchoredMenu>
  );
};

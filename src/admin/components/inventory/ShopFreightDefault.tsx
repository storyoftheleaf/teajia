import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../lib/api';
import { rateToUsd } from '../../../lib/currency';
import { FALLBACK_SHIPPING_RATE_CURRENCY, FALLBACK_SHIPPING_RATE_PER_KG } from '../../../lib/shippingRate';
import { SHOP_MARKUP_MULTIPLIER } from '../../../lib/markup';
import { useRates } from '../../hooks/useAdminData';
import { logisticsNumber } from './LogisticsControls';

/**
 * The shop default freight rate, edited here with the services (Adrian,
 * 2026-11-27: freight prices live with the distributors, in their own section).
 * It is still `accounts.default_shipping_rate_per_kg` / `_currency`: the rate
 * every tea pays when it travels by no service, or by one that cannot price
 * it. Empty means the platform default; a typed 0 is free.
 */
export const SHOP_DEFAULT_KEY = 'logistics-shop-default';

type ShopRate = { default_shipping_rate_per_kg?: number | null; default_shipping_rate_currency?: string | null };

export function shopDefaultLabel(account: ShopRate | null | undefined): string {
  const stored = account?.default_shipping_rate_per_kg;
  if (stored == null) return `${FALLBACK_SHIPPING_RATE_PER_KG} ${FALLBACK_SHIPPING_RATE_CURRENCY}/kg (platform default)`;
  return `${logisticsNumber(Number(stored))} ${account?.default_shipping_rate_currency || FALLBACK_SHIPPING_RATE_CURRENCY}/kg`;
}

/** Shop currency for new services such as My suitcase: the default's own, else the platform's. */
export const shopFreightCurrency = (account: ShopRate | null | undefined) =>
  (account?.default_shipping_rate_per_kg != null && account?.default_shipping_rate_currency) || FALLBACK_SHIPPING_RATE_CURRENCY;

export function useShopDefaultAccount(accountId: string | null, enabled: boolean) {
  return useQuery({ queryKey: [SHOP_DEFAULT_KEY, accountId], enabled: enabled && Boolean(accountId), staleTime: 60_000, queryFn: () => api.accounts.get(accountId!) as Promise<ShopRate> });
}

export function ShopFreightDefault({ accountId, account, busy, run }: { accountId: string | null; account: ShopRate | null | undefined; busy: boolean; run: (action: () => Promise<void>) => Promise<void> | void }) {
  const queryClient = useQueryClient();
  const { data: rates = [] } = useRates();
  const [editing, setEditing] = useState(false);
  const [rateText, setRateText] = useState('');
  const [currencyText, setCurrencyText] = useState('');
  const open = () => {
    setRateText(account?.default_shipping_rate_per_kg == null ? '' : String(account.default_shipping_rate_per_kg));
    setCurrencyText(account?.default_shipping_rate_currency || FALLBACK_SHIPPING_RATE_CURRENCY);
    setEditing(true);
  };
  const typed = rateText.trim() === '' ? null : Number(rateText);
  const valid = typed === null || (Number.isFinite(typed) && typed >= 0);
  const fx = rateToUsd(rates, currencyText.trim() || FALLBACK_SHIPPING_RATE_CURRENCY);
  const hint = !valid ? 'Enter a number, or leave it empty for the platform default.'
    : typed === null ? `Empty uses the platform default, ${FALLBACK_SHIPPING_RATE_PER_KG} ${FALLBACK_SHIPPING_RATE_CURRENCY}/kg.`
    : typed === 0 ? 'Zero means free freight for every tea on the shop default.'
    : fx === null ? `There is no exchange rate for ${currencyText}, so it cannot be converted.`
    : `$${(typed / fx).toFixed(2)} USD/kg today, adding $${((typed / fx / 1000) * SHOP_MARKUP_MULTIPLIER).toFixed(3)} a gram on the shelf.`;
  return <div className="logistics-service-row" data-testid="shop-freight-default">
    <span>Shop default<small className="text-tea-text-sec">Teas with no service, or one that cannot price them</small></span>
    <span>{shopDefaultLabel(account)}</span>
    {!editing && <button type="button" className="tap-target purchase-tracking-button" aria-label="Edit shop default" disabled={busy || !accountId} onClick={open}>Edit</button>}
    {editing && <form className="logistics-service-editor" onSubmit={event => {
      event.preventDefault(); if (!valid || !accountId) return;
      void run(async () => {
        await api.accounts.update(accountId, { default_shipping_rate_per_kg: typed, default_shipping_rate_currency: currencyText.trim() || null });
        await Promise.all([[SHOP_DEFAULT_KEY], ['shop-freight-default'], ['products'], ['logistics-tracking']].map(queryKey => queryClient.invalidateQueries({ queryKey })));
        setEditing(false);
      });
    }}><div className="logistics-fields">
      <label>Rate per kg<input aria-label="Shop default rate" inputMode="decimal" value={rateText} placeholder={String(FALLBACK_SHIPPING_RATE_PER_KG)} onChange={event => setRateText(event.target.value)}/></label>
      <label>Currency<input aria-label="Shop default currency" value={currencyText} placeholder={FALLBACK_SHIPPING_RATE_CURRENCY} onChange={event => setCurrencyText(event.target.value)}/></label>
    </div><div className="logistics-actions">
      <button type="submit" className="tap-target purchase-tracking-button" disabled={busy || !valid}>Save shop default</button>
      <button type="button" className="tap-target purchase-tracking-button" disabled={busy} onClick={() => setEditing(false)}>Close</button>
      <span className="text-tea-text-dim">{hint}</span>
    </div></form>}
  </div>;
}

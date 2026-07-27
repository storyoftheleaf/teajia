import { useCallback, useMemo } from 'react';
import { useAppStore } from '../../lib/store';
import { useRates } from '../../admin/hooks/useAdminData';
import { formatCurrency } from '../../admin/utils';
import { fmtShopPrice, fmtShopPricePerGram } from '../../utils/formatNumber';

/**
 * What a tea costs, in the currency the reader chose.
 *
 * Round five wrote down a promise on the product page: the published markup
 * stays fixed in USD so a crawler and a returning reader read one document,
 * while "localising the visible number is the visible page's job". The visible
 * page could not do it. Every shop formatter (`fmtShopPrice`,
 * `fmtShopPricePerGram`) prefixes a literal `$`, so the currency selector that
 * already exists in the cart changed the cart total and nothing else: a reader
 * who set Rupiah saw Rupiah at checkout and dollars on every product that led
 * them there.
 *
 * This is the same conversion the cart already performs, lifted to where the
 * price is first quoted. The rate table and the selected currency both come
 * from the surfaces that already own them, so there is one exchange rate in the
 * session rather than one per component.
 *
 * Round seven made this the only place the conversion is written. The public
 * cart and its rows each carried a private copy of the same four lines, which
 * is two conversions against one rate table and two chances for them to drift.
 * The sample, collection and compare surfaces called the raw `$` formatters
 * directly, so a reader browsing in Rupiah met dollars the moment they left the
 * product page. They all read this now.
 *
 * Deliberately not applied to structured data. `PUBLISHED_CURRENCY` on the
 * product page stays USD, because markup that varies per visitor is worse than
 * markup that is honestly fixed.
 */
export interface ShopPrice {
  /** True when the reader is being shown something other than the shop's USD. */
  localised: boolean;
  /**
   * The code the figures below are quoted in. Written into the WhatsApp
   * message so the basket the customer sends names its own currency.
   */
  code: string;
  /** A total, rounded up to a whole unit, as the shop has always quoted totals. */
  total: (usd: number) => string;
  /** A rate, carrying its own `/g`. */
  perGram: (usdPerGram: number) => string;
}

export function useShopPrice(): ShopPrice {
  const currency = useAppStore(s => s.currency);
  const { data: rates = [] } = useRates();

  // USD needs no table, and an empty table is not a reason to invent a rate.
  const localised = currency !== 'USD' && rates.length > 0;
  const code = localised ? currency : 'USD';

  const total = useCallback(
    (usd: number) => (localised ? formatCurrency(Math.ceil(usd), currency, rates) : fmtShopPrice(usd)),
    [localised, currency, rates],
  );

  const perGram = useCallback(
    (usdPerGram: number) =>
      localised ? `${formatCurrency(usdPerGram, currency, rates)}/g` : fmtShopPricePerGram(usdPerGram),
    [localised, currency, rates],
  );

  return useMemo(() => ({ localised, code, total, perGram }), [localised, code, total, perGram]);
}

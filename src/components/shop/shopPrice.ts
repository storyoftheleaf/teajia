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
 *
 * ── One rate table, twelve readers ──────────────────────────────────────────
 *
 * Twelve components call this hook, and each call opens its own subscription to
 * `useRates()`, which is `useQuery(['rates', account, user])` in
 * admin/hooks/useAdminData.ts. As of this writing:
 *
 *   TeaInventory, Shop, SharedCollection, AlcoveCard, TeawareAlcoveCard,
 *   CompareView, CollectionTab, MyCollection, PublicCart, CartItem,
 *   PopupModal, ProductPage.
 *
 * `CartItem` renders once per basket row, so the live subscription count is
 * higher than the component count, and a full basket on the product page is
 * comfortably past twenty.
 *
 * That is one network request, not twenty, and it is worth saying out loud why:
 * React Query happens to dedupe by key, and nothing at any of those call sites
 * says so. This is the same shape the product-impressions hook was given last
 * round, for the same reason. The failure mode is quiet. Change the key, the
 * account scope or the six-hour `staleTime` in one place and the app starts
 * issuing a second request for a table it already holds, or worse, shows one
 * vintage of the rate on the card and another on the page the card opens, which
 * is a tea changing price by being tapped. That exact bug is what the note
 * above this one was written about.
 *
 * The consequence for a caller: this hook is cheap, and you should call it
 * rather than thread a converted string down through props. The consequence for
 * anyone editing `useRates`: the key and the staleTime are a contract with
 * twelve files, and there is no test that will tell you if you break it.
 *
 * Shop.tsx and PublicCart.tsx currently hold both subscriptions, calling
 * `useRates()` directly *and* `useShopPrice()`. Harmless for the same dedupe
 * reason, but they are the two files that should read the table once.
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
  /**
   * The same rate, split from the unit it is quoted in.
   *
   * `perGram` bakes the unit into the string, and the unit is not always the
   * gram: a currency where a gram costs a few units is quoted per 100 g
   * instead, because "NT$73/g" rounds away everything that distinguishes one
   * tea from another. Anything that wants to set the figure and its unit
   * apart, on two lines or in two columns, has to be told which unit it got
   * rather than parse it back out of the string. Parsing it back out is what
   * put "a gram" under a per-100 g figure on the price list.
   */
  rate: (usdPerGram: number) => { value: string; unit: string };
  /** One gram in the reader's currency, without the abbreviation `total` uses. */
  perGramExact: (usdPerGram: number) => string;
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

  // A rate needs its precision. formatCurrency rounds up and drops decimals,
  // which is right for a total and wrong for a per-gram figure: it turns every
  // tea under a unit a gram into "1/g". Convert the rate, then format it with
  // the same cent precision the dollar path uses.
  const perGram = useCallback(
    (usdPerGram: number) => {
      if (!localised) return fmtShopPricePerGram(usdPerGram);
      const converted = formatCurrency(usdPerGram * 100, currency, rates);
      return `${converted} / 100 g`;
    },
    [localised, currency, rates],
  );

  const rate = useCallback(
    (usdPerGram: number) =>
      localised
        ? { value: formatCurrency(usdPerGram * 100, currency, rates), unit: 'per 100 g' }
        : { value: fmtShopPricePerGram(usdPerGram).replace(/\s*\/\s*g$/, ''), unit: 'a gram' },
    [localised, currency, rates],
  );

  /**
   * One gram, quoted in full.
   *
   * `rate` above steps up to a hundred grams in a localised currency because
   * `formatCurrency` abbreviates and would round a per-gram figure away. The
   * order panel needs the gram itself: the amount buttons are grams, the rate
   * beside them moves as those grams change, and quoting a hundred of them
   * makes the reader do arithmetic to connect the two.
   */
  const perGramExact = useCallback(
    (usdPerGram: number) =>
      localised
        ? formatCurrency(usdPerGram, currency, rates, { exact: true })
        : fmtShopPricePerGram(usdPerGram).replace(/\s*\/\s*g$/, ''),
    [localised, currency, rates],
  );

  return useMemo(
    () => ({ localised, code, total, perGram, rate, perGramExact }),
    [localised, code, total, perGram, rate, perGramExact],
  );
}

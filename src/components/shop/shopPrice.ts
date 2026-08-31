import { useCallback, useMemo } from 'react';
import { useAppStore } from '../../lib/store';
import { useRates } from '../../admin/hooks/useAdminData';
import { formatCurrency } from '../../admin/utils';
import type { Currency, ExchangeRate } from '../../admin/types';
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
/**
 * A formatted figure with the currency's own name taken off the front.
 *
 * Every formatter in the shop prefixes the currency, which is right for a
 * figure standing on its own and wrong for a column of six under a heading
 * that already names it. Keeps a leading minus or the `~` that marks a rate
 * we do not actually hold, because both of those change what the number
 * means.
 */
const stripCode = (formatted: string) => formatted.replace(/^([~-]?)[^0-9]*/, '$1');

/**
 * One gram, in the reader's currency.
 *
 * The rule Rupiah carries is that no price is ever a fraction of a rupiah, and
 * the decimal in "10.4k" is not one: that figure is 10,400 rupiah, whole. This
 * briefly rounded the whole rate up to the thousand to honour the rule, and
 * paid for it in the one column the rule was not about: with every rate landing
 * on a whole thousand, 25 g and 50 g both read "10k" and the tuo and 200 g both
 * read "9k", so the column whose entire job is to show the price falling as the
 * pack grows showed it standing still.
 *
 * `formatCurrency`'s rate path keeps one decimal on the thousands, which is a
 * hundred rupiah of precision and no fraction of anything.
 */
const quoteRate = (usdPerGram: number, currency: Currency, rates: ExchangeRate[]) =>
  formatCurrency(usdPerGram, currency, rates, { rate: true });

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
  /**
   * The same total, with the currency's own name taken off the front.
   *
   * The order panel names its currency once, in a picker beside its heading,
   * and every figure under that heading is quoted in it. Repeating "IDR" on
   * eleven figures in a list six rows long is eleven readings of a word the
   * reader chose themselves, and it pushed the numbers into a ragged right
   * margin where no two of them started in the same place.
   */
  plainTotal: (usd: number) => string;
  /** A rate, carrying its own `/g`. */
  perGram: (usdPerGram: number) => string;
  /**
   * The same rate, split from the unit it is quoted in, and with the currency
   * name taken off as `plainTotal` does.
   *
   * Always a gram. This used to step up to 100 g in a currency where a gram
   * costs thousands of units, on the reasoning that "IDR 13k/g" rounds away
   * what separates one tea from another. It does not: it rounds away the
   * hundreds, and in Rupiah the hundreds are not a price. What the step-up
   * actually cost was the reader's arithmetic, because the amounts beside it
   * are grams, so a per-100 g rate asked them to divide before they could
   * connect the two columns they were reading.
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
      return `${quoteRate(usdPerGram, currency, rates)} / g`;
    },
    [localised, currency, rates],
  );

  const plainTotal = useCallback(
    (usd: number) => stripCode(total(usd)),
    [total],
  );

  const rate = useCallback(
    (usdPerGram: number) => ({
      value: localised
        ? stripCode(quoteRate(usdPerGram, currency, rates))
        : stripCode(fmtShopPricePerGram(usdPerGram).replace(/\s*\/\s*g$/, '')),
      unit: 'per gram',
    }),
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
   *
   * Quoted to the nearest cent and no finer. Trailing precision on a rate is
   * a number nobody reads and a promise the shop does not make.
   */
  const perGramExact = useCallback(
    (usdPerGram: number) =>
      localised
        ? quoteRate(usdPerGram, currency, rates)
        : fmtShopPricePerGram(usdPerGram).replace(/\s*\/\s*g$/, ''),
    [localised, currency, rates],
  );

  return useMemo(
    () => ({ localised, code, total, plainTotal, perGram, rate, perGramExact }),
    [localised, code, total, plainTotal, perGram, rate, perGramExact],
  );
}

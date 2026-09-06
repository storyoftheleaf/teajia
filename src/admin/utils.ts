import { Currency, ExchangeRate, Product } from './types';
import type { InventoryItem } from '../types';
import { INITIAL_RATES } from './constants';
import { fetchWithTimeout } from '../lib/api';

const FALLBACK_RATES = INITIAL_RATES;

/**
 * `rate` is for a per-unit figure rather than a total.
 *
 * The IDR path below rounds up to the nearest thousand and prints "k", which
 * is right for a line total and destroys a per-gram figure: 9,215 rupiah a
 * gram becomes "10k". A rate is quoted to the nearest cent and no finer, and
 * a currency whose unit is small enough to put a rate in the thousands keeps
 * one decimal on the thousands rather than trailing digits nobody reads:
 *
 *     $0.57      under ten units, so cents
 *     NT$18      tens, where the cents are noise
 *     IDR 9.2k   thousands, abbreviated with one decimal
 */
export const formatCurrency = (amount: number, currency: Currency, rates: ExchangeRate[], opts?: { rate?: boolean }) => {
  const safeRates = rates && rates.length > 0 ? rates : FALLBACK_RATES;
  const found = safeRates.find(r => r.currency === currency);
  // Never silently multiply by 1 for a currency we have no rate for. If the
  // live table is missing it, fall back to showing the USD amount so the number
  // stays honest instead of mis-labelled.
  const rate = found?.rateToUSD;
  const value = rate ? amount * rate : amount;

  const currencyCode = currency === 'NT' ? 'TWD' :
                        currency === 'Yuan' ? 'CNY' :
                        currency === 'UNK' ? 'USD' :
                        currency;

  // No price after the decimal point, ever; always round UP. (per Adrian)
  const rounded = Math.ceil(value);

  // IDR reads large; round up to the nearest thousand and abbreviate with a K
  // (no decimals, no hundreds). e.g. 162,100 -> 162k.
  if (currencyCode === 'IDR' && !opts?.rate) {
    const thousands = Math.ceil(value / 1000);
    return `IDR ${thousands}k`;
  }

  if (opts?.rate) {
    const abs = Math.abs(value);
    // Cents only under ten units. Above that the minor unit is noise, and on
    // JPY it is a unit that does not exist.
    const digits = abs < 10 ? 2 : 0;
    const fractionDigits = abs >= 1000 ? 1 : digits;
    // Up, at whatever precision is being shown, because the shop never rounds
    // a price down. The decimal in "IDR 10.4k" is not a fraction of a rupiah,
    // it is 10,400 of them, so the figure keeps it; what gets rounded away is
    // everything finer, and that goes up. The epsilon is there so a figure
    // that is already exact at this precision does not climb a step on float
    // noise alone.
    const scaled = abs >= 1000 ? value / 1000 : value;
    const step = 10 ** fractionDigits;
    const raised = Math.ceil(scaled * step - 1e-9) / step;
    try {
      const formatted = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currencyCode,
        currencyDisplay: 'symbol',
        minimumFractionDigits: fractionDigits,
        maximumFractionDigits: fractionDigits,
      }).format(raised);
      // A rounded thousand reads better without its empty decimal.
      return abs >= 1000 ? `${formatted.replace(/\.0$/, '')}k` : formatted;
    } catch {
      const plain = `${currencyCode} ${raised.toFixed(fractionDigits)}`;
      return abs >= 1000 ? `${plain.replace(/\.0$/, '')}k` : plain;
    }
  }

  try {
    const formatted = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currencyCode,
      currencyDisplay: 'symbol',
      maximumFractionDigits: 0
    }).format(rounded);
    // Prefix with UNK~ to indicate unknown/missing source rate.
    return currency === 'UNK' ? `~${formatted}` : formatted;
  } catch (e) {
    return `${currencyCode} ${rounded}`;
  }
};

// --- CURRENCY SERVICES ---

/*
 * There is no browser-side currency feed any more, deliberately.
 *
 * There used to be one: a commercial rate API with a free one behind it,
 * fetched on every admin and shop boot, merged under whatever `/api/rates`
 * returned. Two vendors, two schedules, and a shop where the number the
 * customer read and the number the shelf was priced at came from different
 * places. The hostnames are deliberately not written here: a guard in
 * worker/tests/exchange-rate-feed.test.ts fails on any currency-feed host
 * appearing anywhere under src, and naming the old ones would defeat it.
 *
 * The worker refreshes `exchange_rates` in D1 daily from one feed, and every
 * price the worker computes (cost basis, freight, the x3) goes through that
 * table. The browser only ever converts an already-computed USD figure for
 * display. So the browser reading a fresher or different rate than the worker
 * does not make the shop more current, it makes the displayed price disagree
 * with the price the order is actually reconciled at.
 *
 * One table, one refresh, one number: `useRates` in admin/hooks/useAdminData.ts
 * reads `/api/rates` and nothing else, with INITIAL_RATES as the visible-seed
 * floor when even that is unreachable.
 */


export const calculatePricing = (
  costAmount: number,
  shippingRatePerKg: number,
  quantity: number, // grams for tea, units for teaware
  currency: Currency,
  rates: ExchangeRate[],
  isTeaware = false
) => {
  const safeRates = rates && rates.length > 0 ? rates : FALLBACK_RATES;

  // 1. Get Rate (Units of Currency per 1 USD)
  const rateObj = safeRates.find(r => r.currency === currency);
  const rateToUSD = rateObj ? rateObj.rateToUSD : 1;

  // 2. Calculate Total Cost in Source Currency
  // For tea: shipping is per KG, convert grams to KG. For teaware: no per-kg shipping.
  const totalShipping = isTeaware ? 0 : (shippingRatePerKg * (quantity > 0 ? quantity / 1000 : 0));
  const totalBatchCostSource = costAmount + totalShipping;

  // 3. Cost Per Unit (Source Currency): per gram for tea, per unit for teaware
  const costPerUnitSource = quantity > 0 ? totalBatchCostSource / quantity : 0;

  // 4. Convert to USD
  const trueCostUSD = (rateToUSD && rateToUSD > 0) ? costPerUnitSource / rateToUSD : 0;

  // 5. Suggested Retail (3x Markup)
  const suggestedRetailUSD = trueCostUSD * 3;

  return {
    totalShipping,
    costPerGramSource: costPerUnitSource,
    trueCostUSD,
    suggestedRetailUSD,
    rateUsed: rateToUSD
  };
};

/** Convert an admin Product to the public InventoryItem shape for AlcoveCard */
export const productToInventoryItem = (product: Product): InventoryItem => {
  const isTeaware = product.type === 'Teaware';
  return {
    id: product.id,
    category: isTeaware ? 'ware' : 'tea',
    type: product.type,
    form: product.form,
    pieceWeightG: product.pieceWeightG,
    soldInWholeUnits: product.soldInWholeUnits,
    name: product.givenName,
    variant: product.productName,
    year: product.year ? String(product.year) : '',
    origin: product.originRegion || product.originCountry || '',
    stock_g: isTeaware ? (product.quantityUnits || 0) : product.stockGrams,
    cost_price: String(product.costAmount),
    cost_currency: undefined,
    // For tea: price_per_gram is per-gram. For teaware: price_50g is per-unit price.
    // Use fixed retail price (locked override) if set, otherwise formula-based retail
    price_per_gram: isTeaware ? undefined : String(product.fixedRetailPriceUSD ?? product.pricePerGramUSD),
    price_50g: isTeaware ? String(product.fixedRetailPriceUSD ?? product.pricePerGramUSD) : undefined,
    pricePerUnit: isTeaware ? String(product.fixedRetailPriceUSD ?? product.pricePerGramUSD) : undefined, // Semantic alias for teaware per-unit price
    description: product.description,
    tags: product.tastingNotes || [],
    image: product.imageUrl,
    chineseName: product.chineseName,
    lore: product.lore,
    showWisdom: product.showWisdom,
    terroir: product.terroir,
    processingNotes: product.processingNotes,
    mood: product.mood,
    experience: product.experience,
    additionalImages: product.additionalImages,
    material: product.material,
    capacityMl: product.capacityMl,
    isFeatured: product.isFeatured,
    quantityUnits: product.quantityUnits,
    magazineUrl: undefined,
    tasting: product.tasting,
  };
};

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

const PRIMARY_API = 'https://api.exchangerate-api.com/v4/latest/USD';
const BACKUP_API = 'https://open.er-api.com/v6/latest/USD';
const API_KEY = import.meta.env.VITE_EXCHANGE_RATE_API_KEY;

const fetchFromUrl = async (url: string): Promise<ExchangeRate[]> => {
    const fetchUrl = API_KEY && url.includes('exchangerate-api.com') 
        ? `https://v6.exchangerate-api.com/v6/${API_KEY}/latest/USD` 
        : url;
        
    const res = await fetchWithTimeout(fetchUrl, { background: true });
    if (!res.ok) throw new Error(`Failed to fetch from ${fetchUrl}`);
    
    const data = await res.json();
    const r = data.rates || data.conversion_rates;
    const fetchedAt = new Date().toISOString();

    /* A currency the feed did not return falls back to its seeded figure and is
       stamped as never refreshed, rather than being handed back wearing this
       fetch's timestamp. The old `r['CNY'] || 7.2` did the opposite: it
       returned a two-year-old guess indistinguishable from a live rate, which
       is exactly how the shop came to price everything through an IDR rate
       nobody had touched. */
    const rate = (feedCode: string, shopKey: Currency): ExchangeRate => {
      const value = Number(r?.[feedCode]);
      if (Number.isFinite(value) && value > 0) return { currency: shopKey, rateToUSD: value, lastUpdated: fetchedAt };
      const seeded = INITIAL_RATES.find(s => s.currency === shopKey);
      return { currency: shopKey, rateToUSD: seeded?.rateToUSD ?? 1, lastUpdated: null };
    };

    return [
      { currency: 'USD', rateToUSD: 1, lastUpdated: fetchedAt },
      rate('TWD', 'NT'),
      rate('CNY', 'Yuan'),
      rate('IDR', 'IDR'),
      rate('JPY', 'JPY'),
      rate('MYR', 'MYR'),
      rate('AUD', 'AUD'),
      rate('HKD', 'HKD'),
    ];
};

export const fetchLiveRates = async (): Promise<ExchangeRate[]> => {
  try {
    ratesAreFallback = false;
    return await fetchFromUrl(PRIMARY_API);
  } catch (primaryError) {
    try {
        ratesAreFallback = false;
        return await fetchFromUrl(BACKUP_API);
    } catch (backupError) {
        console.warn("Currency API unavailable, using offline fallback rates.");
        ratesAreFallback = true;
        return FALLBACK_RATES;
    }
  }
};

export let ratesAreFallback = false;

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

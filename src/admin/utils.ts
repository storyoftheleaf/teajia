import { Currency, ExchangeRate, Product } from './types';
import type { InventoryItem } from '../types';
import { INITIAL_RATES } from './constants';

const FALLBACK_RATES = INITIAL_RATES;

export const formatCurrency = (amount: number, currency: Currency, rates: ExchangeRate[]) => {
  const safeRates = rates && rates.length > 0 ? rates : FALLBACK_RATES;
  const rate = safeRates.find(r => r.currency === currency)?.rateToUSD || 1;
  const value = amount * rate;
  
  const currencyCode = currency === 'NT' ? 'TWD' :
                       currency === 'Yuan' ? 'CNY' :
                       currency === 'UNK' ? 'USD' :
                       currency;

  try {
    const formatted = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currencyCode,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
    // Prefix with UNK~ to indicate unknown source currency
    return currency === 'UNK' ? `~${formatted}` : formatted;
  } catch (e) {
    return `${currency} ${value.toFixed(2)}`;
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
        
    const res = await fetch(fetchUrl);
    if (!res.ok) throw new Error(`Failed to fetch from ${fetchUrl}`);
    
    const data = await res.json();
    const r = data.rates || data.conversion_rates;

    return [
      { currency: 'USD', rateToUSD: 1 },
      { currency: 'NT', rateToUSD: r['TWD'] || 32.3 },
      { currency: 'Yuan', rateToUSD: r['CNY'] || 7.2 },
      { currency: 'IDR', rateToUSD: r['IDR'] || 16210 },
      { currency: 'JPY', rateToUSD: r['JPY'] || 150.0 },
      { currency: 'MYR', rateToUSD: r['MYR'] || 4.7 },
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

  // 3. Cost Per Unit (Source Currency) — per gram for tea, per unit for teaware
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
    name: product.givenName,
    variant: product.productName,
    year: product.year ? String(product.year) : '',
    origin: product.originRegion || product.originCountry || '',
    stock_g: isTeaware ? (product.quantityUnits || 0) : product.stockGrams,
    cost_price: String(product.costAmount),
    cost_currency: undefined,
    // For tea: price_per_gram is per-gram. For teaware: price_50g is per-unit price.
    price_per_gram: isTeaware ? undefined : String(product.pricePerGramUSD),
    price_50g: isTeaware ? String(product.pricePerGramUSD) : undefined,
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
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
  grams: number,
  currency: Currency,
  rates: ExchangeRate[]
) => {
  const safeRates = rates && rates.length > 0 ? rates : FALLBACK_RATES;
  
  // 1. Get Rate (Units of Currency per 1 USD)
  const rateObj = safeRates.find(r => r.currency === currency);
  const rateToUSD = rateObj ? rateObj.rateToUSD : 1;

  // 2. Calculate Total Cost in Source Currency
  // Shipping is per KG, so convert grams to KG
  const batchWeightKg = grams > 0 ? grams / 1000 : 0;
  const totalShipping = shippingRatePerKg * batchWeightKg;
  const totalBatchCostSource = costAmount + totalShipping;

  // 3. Cost Per Gram (Source Currency)
  const costPerGramSource = grams > 0 ? totalBatchCostSource / grams : 0;

  // 4. Convert to USD
  // CRITICAL FIX: Ensure we DIVIDE by the rate (e.g., 32 NT / 32 = 1 USD).
  // Some legacy systems might have multiplied. Division is correct for "Units per USD".
  const trueCostUSD = (rateToUSD && rateToUSD > 0) ? costPerGramSource / rateToUSD : 0;

  // 5. Suggested Retail (3x Markup)
  const suggestedRetailUSD = trueCostUSD * 3;

  return {
    totalShipping,
    costPerGramSource,
    trueCostUSD,
    suggestedRetailUSD,
    rateUsed: rateToUSD
  };
};

/** Convert an admin Product to the public InventoryItem shape for AlcoveCard */
export const productToInventoryItem = (product: Product): InventoryItem => ({
  id: product.id,
  category: product.type === 'Teaware' ? 'ware' : 'tea',
  type: product.type,
  name: product.givenName,
  variant: product.productName,
  year: product.year ? String(product.year) : '',
  origin: product.originRegion || product.originCountry || '',
  stock_g: product.stockGrams,
  cost_price: String(product.costAmount),
  cost_currency: undefined,
  price_per_gram: String(product.pricePerGramUSD),
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
  magazineUrl: undefined,
});
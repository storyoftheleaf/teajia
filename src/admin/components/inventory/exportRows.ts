import type { Product } from '../../types';

/**
 * One CSV row per tea for the inventory export. Kept out of InventoryView so
 * the column list can be read and tested on its own.
 */
export function inventoryExportRows(products: readonly Product[]) {
  return products.map(p => ({
    ID: p.id,
    Type: p.type,
    Year: p.year ?? '',
    'Given Name': p.givenName,
    'Chinese Name': p.chineseName ?? '',
    'Product Name': p.productName,
    Origin: p.originRegion,
    Vendor: p.vendor ?? '',
    Stock: p.stockGrams,
    Cost: p.costAmount,
    'Cost Currency': p.costCurrency,
    /* Whether that currency is an ANSWER or just the column default. Blank
       means nobody ever stated it, which is the column to sort by when
       auditing the shelf: a cost read as dollars that was really yuan is
       seven times too big and looks like an expensive tea, not a fault. */
    'Cost currency stated?': p.costCurrencySource ? 'yes' : 'no, may be the default',
    'Batch g': p.quantityPurchased,
    // Blank means the tea has no rate of its own and follows the shop's.
    // A number is a rate pinned to this tea, in the tea's own cost currency.
    'Ship rate (own currency)': p.shippingRatePerKg ?? '',
    'Ship rate source': p.shippingRatePerKg == null ? 'shop' : 'pinned to tea',
    'Retail /g USD': p.pricePerGramUSD,
    'Cost /g USD': p.costPerGramUSD,
    Public: p.isPublic ? 'yes' : 'no',
    'In shop': p.shownInShop ? 'yes' : 'no',
  }));
}

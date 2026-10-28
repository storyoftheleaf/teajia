import { canonicalCurrency, isUnrecordedCurrency, rateToUsd, type RateRow } from '../../lib/currency';
import { stagedToProduct, type StagedItem } from './intakeMapping';
import { splitByConvertibleFreight } from './intakeFreight';
import { plainCostWords } from '../../lib/costRefusalWords';

export type ConfirmedIntakeRow = { item: StagedItem; productId: string; ledgerId?: string };
type RowResult = { client_row_id?: string | null; product_id?: string; id?: string; ledger_id?: string; status: string; reason?: string };
export function confirmedIntakeRows(items: StagedItem[], response: { results?: RowResult[] }) {
  const confirmed: ConfirmedIntakeRow[] = [];
  const errors: Record<string, string> = {};
  for (const item of items) {
    const result = response.results?.find(row => row.client_row_id === item.id);
    const productId = result?.product_id || result?.id;
    if (result && ['inserted', 'replayed'].includes(result.status) && productId) confirmed.push({ item, productId, ledgerId: result.ledger_id });
    else errors[item.id] = result?.reason ? plainCostWords(result.reason) : 'This row was not confirmed. Retry to check the original import.';
  }
  return { confirmed, errors };
}

export function purchaseRecordsForIntake(rows: ConfirmedIntakeRow[], rates: readonly RateRow[], sourceName: (id: string) => string, importId: string) {
  const groups = new Map<string, ConfirmedIntakeRow[]>();
  for (const row of rows) {
    const key = row.item.vendor.trim() || sourceName(row.item.sourceId).replace(/\.[^.]+$/, '') || 'Unknown vendor';
    groups.set(key, [...(groups.get(key) || []), row]);
  }
  return [...groups].map(([vendor, lines]) => {
    const items = lines.flatMap(({ item, productId, ledgerId }) => {
      const onHand = item.type === 'Teaware' ? item.quantityUnits || item.stockGrams : item.stockGrams;
      const quantity = item.quantityPurchased || onHand;
      const received = ledgerId ? Math.min(onHand, quantity) : 0;
      const base = {product_id:productId,product_name:item.givenName || item.productName,
        unit:item.type === 'Teaware' ? 'unit' : 'g',currency:item.costCurrency,source_ref:importId,
        unit_price:quantity > 0 && item.costAmount != null ? item.costAmount / quantity : null};
      const portions = received > 0 && received < quantity ? [received,quantity-received] : [quantity];
      return portions.map((part,index)=>({...base,quantity:part,
        total_cost:item.costAmount == null ? null : item.costAmount * (quantity > 0 ? part / quantity : 1),
        source_movement_id:received > 0 && index === 0 ? ledgerId : undefined}));
    });
    let totalUsd = 0;
    for (const item of items) {
      const rate = canonicalCurrency(item.currency) === 'USD' || isUnrecordedCurrency(item.currency) ? 1 : rateToUsd(rates, item.currency);
      if (rate == null && (item.total_cost ?? 0) !== 0) throw new Error(`A purchase total needs an exchange rate for ${item.currency}. Correct it before importing.`);
      totalUsd += (item.total_cost ?? 0) / (rate ?? 1);
    }
    return { vendor_name: vendor, items_json: JSON.stringify(items), total_usd: Math.round(totalUsd * 100) / 100,
      display_currency: items[0]?.currency || 'USD', status: items.every(item => item.source_movement_id) ? 'received' : 'pending', notes: `Inventory intake · ${importId}`,
      idempotency_key: `intake-purchase:${importId}:${lines.map(row => row.item.id).sort().join(':')}` };
  });
}

export function prepareIntakeProducts(items:readonly StagedItem[],shipCurrency:string,share:(item:StagedItem)=>number,rates:readonly RateRow[]){
  const split=splitByConvertibleFreight(items,shipCurrency,share,rates);
  return {...split,products:split.priced.map(({it,extra})=>({...stagedToProduct(it,extra),client_row_id:it.id}))};
}

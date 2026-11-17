import type { Product } from '../../types';
import { fmtNum } from '../../../utils/formatNumber';
import { isoCurrencyCode } from '../../../lib/currency';
import { isCurateRow } from './sampleRows';
import { effectivePurpose } from './domain';

export function stockHoldingLabel(product: Product): string | null {
  const purpose = effectivePurpose(product);
  if (product.type === 'Teaware' || (!product.sourceCompassEntryId && purpose !== 'sample')) return null;
  const grams = product.stockGrams;
  const amount = typeof grams === 'number' && Number.isFinite(grams) && product.stockKnownAt
    ? `${fmtNum(grams)} g` : null;
  if (purpose === 'sample') return amount ? `Private sample · ${amount}` : 'Private sample';
  if (purpose === 'personal') return 'Personal stock';
  return amount ? `Shop stock · ${amount} on hand` : 'Shop stock · count needed';
}

export function sampleAcquisitionLabel(product: Product): string | null {
  if (effectivePurpose(product) !== 'sample' || isCurateRow(product.id)) return null;
  const amount = product.costAmount;
  if (amount == null || !Number.isFinite(amount)) return 'Cost not recorded';
  if (amount === 0) return 'No acquisition cost';
  const currency = product.costCurrency && product.costCurrency !== 'UNK' ? isoCurrencyCode(product.costCurrency) : '';
  return currency ? `Cost ${currency} ${fmtNum(amount)}` : `Cost ${fmtNum(amount)} · currency unrecorded`;
}

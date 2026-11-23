// Drafts written by scripts/tea-wisdom-compose/compose.mjs (phase 2), shown on
// the dev-only preview at /preview/wisdom-pilot/drafts/:productId.
import type { InventoryItem } from '../../../types';
import type { ComposedEntry } from '../../../wisdom/reference/composedEntry';

export interface DraftEntryFile {
  status: 'draft' | 'needs_review';
  composedAt: string;
  record: {
    id: string; name: string; chineseName: string | null; type: string | null; form: string | null;
    year: number | string | null; origin: string | null; stockGrams: number | null; pricePerGramUsd: number | null; tags: string[];
  };
  entry: ComposedEntry;
  claimUses: { claimId: string; rev: number | null }[];
  problems: { where: string; problem: string }[];
  unsupported: { sentence: string; why: string }[];
}

const files = import.meta.glob<DraftEntryFile>('../../../../data/tea-reference/entries/*.json', { eager: true, import: 'default' });

export const DRAFT_ENTRIES: DraftEntryFile[] = Object.values(files)
  .sort((left, right) => left.record.name.localeCompare(right.record.name));

export function draftItem(file: DraftEntryFile): InventoryItem {
  const { record } = file;
  return {
    id: record.id,
    category: 'tea',
    type: record.type ?? '',
    form: record.form ?? '',
    soldInWholeUnits: false,
    name: record.name,
    year: record.year === null ? '' : String(record.year),
    origin: record.origin ?? '',
    variant: record.name,
    stock_g: record.stockGrams ?? 0,
    cost_price: '0',
    price_per_gram: record.pricePerGramUsd === null ? '0' : String(record.pricePerGramUsd),
    description: '',
    tags: record.tags,
    image: '',
    additionalImages: [],
    ...(record.chineseName ? { chineseName: record.chineseName } : {}),
    showWisdom: true,
    tasting: {},
    cultivar: null,
  } as InventoryItem;
}

import type { TeaMenuItem } from '../../types/events';

export interface ServedTea {
  id: string;
  name: string;
  source: 'menu' | 'chest' | 'shop' | 'session';
  source_id?: string;
  product_id?: string;
  shop_slug?: string;
}

const sources = new Set<ServedTea['source']>(['menu', 'chest', 'shop', 'session']);

function parseLedger(value: string): unknown {
  if (!value.trim()) return null;
  try { return JSON.parse(value); } catch { return value; }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

export function readServedTeas(value: string): ServedTea[] {
  const ledger = parseLedger(value);
  if (!isRecord(ledger) || !Array.isArray(ledger.served_teas)) return [];
  return ledger.served_teas.filter((row): row is ServedTea =>
    isRecord(row)
      && typeof row.id === 'string' && !!row.id
      && typeof row.name === 'string' && !!row.name.trim()
      && sources.has(row.source as ServedTea['source']),
  );
}

export function readLegacyTeaNames(value: string): string[] {
  const ledger = parseLedger(value);
  const prior = isRecord(ledger) ? ledger.legacy_tea_ledger ?? ledger.teas : ledger;
  const rows = isRecord(prior) ? prior.teas : prior;
  if (!Array.isArray(rows)) return [];
  return rows.flatMap(row => {
    if (!isRecord(row)) return typeof row === 'string' && row.trim() ? [row] : [];
    const name = [row.name, row.custom_name, row.product_name, row.customName, row.productName]
      .find(candidate => typeof candidate === 'string' && candidate.trim());
    return typeof name === 'string' ? [name] : [];
  });
}

export function updateServedTeas(value: string, servedTeas: ServedTea[]): string {
  const previous = parseLedger(value);
  const ledger = isRecord(previous) ? previous : previous !== null ? { legacy_tea_ledger: previous } : {};
  return JSON.stringify({ ...ledger, served_teas: servedTeas });
}

export function duplicateServedTea(existing: ServedTea, candidate: ServedTea) {
  if (existing.id === candidate.id) return true;
  if (existing.product_id && existing.product_id === candidate.product_id) return true;
  return existing.source === candidate.source && !!existing.source_id && existing.source_id === candidate.source_id;
}

export function servedTeaFromMenu(item: TeaMenuItem, shopSlug: string | undefined): ServedTea | null {
  const name = (item.customName || item.productName || '').trim();
  if (!name) return null;
  return {
    id: item.id,
    name,
    source: 'menu',
    source_id: item.id,
    ...(item.productId ? { product_id: item.productId, ...(shopSlug ? { shop_slug: shopSlug } : {}) } : {}),
  };
}

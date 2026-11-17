import { effectiveInventoryPurpose } from './inventoryDomain';

type Holding = Record<string, any>;

// Keep the sample classification in sync with the Compass identity index.
export const COMPASS_SAMPLE_HOLDING = "(CASE WHEN inventory_purpose IS NOT NULL THEN inventory_purpose = 'sample' ELSE COALESCE(is_sample, 0) = 1 END)";

export function compassHolding(
  db: D1Database, accountId: string, entryId: string, preferSample = false,
): Promise<Holding | null> {
  return db.prepare(`SELECT * FROM products WHERE account_id = ? AND source_compass_entry_id = ?
    ORDER BY ${COMPASS_SAMPLE_HOLDING} ${preferSample ? 'DESC' : 'ASC'} LIMIT 1`)
    .bind(accountId, entryId).first<Holding>();
}

export function isCompassSample(holding: Holding | null, entryId: string): boolean {
  return !!holding && holding.source_compass_entry_id === entryId
    && effectiveInventoryPurpose(holding).purpose === 'sample';
}

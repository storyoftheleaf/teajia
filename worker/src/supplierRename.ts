/**
 * Renaming a supplier, everywhere, in one go.
 *
 * A supplier is a `customers` row tagged vendor, and its name is copied by hand
 * into a dozen other places: the teas a person tasted, the shelf, the orders,
 * the visits, the arrivals. Fixing "Master Bo" on the supplier card alone left
 * every one of those saying the old name, so a rename has to walk all of them.
 *
 * Two ways a row can belong to a supplier, and they are treated differently:
 *
 *   - **By id.** The row carries `vendor_id`. It is that supplier's whatever
 *     its text says, so its name column is overwritten with the new name.
 *   - **By text.** The row carries only the name (older rows, receipts, batches
 *     typed by hand). It is matched on account + the old name, ignoring case and
 *     surrounding spaces, and only when it names no supplier by id, so a
 *     different supplier who happens to share the name is never touched.
 *
 * Everything is scoped by `account_id`, and everything lands in ONE `batch()`:
 * D1 runs a batch as a single transaction, so a rename is whole or it did not
 * happen. The preview and the apply read the same table list, so the counts a
 * person confirms are the counts that change.
 *
 * Rows tied to the supplier by id and holding no name at all (its profile, its
 * freight bills, its quotes, its to-dos) need nothing: they follow the card.
 */
import type { ToolEnv } from './mcpTools/registry';

type Db = ToolEnv['DB'];

/** A name column that can hold a supplier's name, and how its rows are tied to a supplier. */
interface NameColumn {
  table: string;
  /** What a person calls these rows. */
  label: string;
  nameColumn: string;
  /** The column that holds the supplier's id, when the table has one. */
  idColumn?: string;
}

/**
 * The only list. Adding a table here adds it to the preview, the apply and the
 * test that walks them. `customers` itself is handled apart (it is the card).
 */
export const SUPPLIER_NAME_COLUMNS: NameColumn[] = [
  { table: 'tea_compass_entries', label: 'teas in Curate', nameColumn: 'vendor_name', idColumn: 'vendor_id' },
  { table: 'products', label: 'teas on the shelf', nameColumn: 'vendor', idColumn: 'vendor_id' },
  { table: 'product_listings', label: 'shelf listings', nameColumn: 'vendor', idColumn: 'vendor_id' },
  { table: 'purchase_orders', label: 'orders', nameColumn: 'vendor_name', idColumn: 'vendor_id' },
  { table: 'curate_visits', label: 'visits', nameColumn: 'vendor_name', idColumn: 'vendor_id' },
  { table: 'curate_import_vendor_groups', label: 'imported lists', nameColumn: 'proposed_vendor_name', idColumn: 'resolved_vendor_customer_id' },
  { table: 'inventory_receipts', label: 'arrivals', nameColumn: 'vendor_name' },
  { table: 'batches', label: 'intake batches', nameColumn: 'vendor' },
];

export class SupplierRenameRefusal extends Error {
  constructor(message: string, readonly status: number, readonly code: string) {
    super(message);
  }
}

export interface SupplierRenameCount {
  table: string;
  label: string;
  /** Rows tied to this supplier by its id. */
  by_id: number;
  /** Rows that only held the old name as text. */
  by_name: number;
}

export interface SupplierRenamePreview {
  vendor_id: string;
  old_name: string;
  new_name: string;
  counts: SupplierRenameCount[];
  /** Everything that would change, the card included. */
  total: number;
}

const NAME_MAX = 200;

/** Main supplier names are English/romanized; Chinese belongs in chinese_name. */
export function cleanSupplierName(raw: unknown): string {
  const name = typeof raw === 'string' ? raw.replace(/\s+/g, ' ').trim() : '';
  if (!name) throw new SupplierRenameRefusal('Type the new name first.', 400, 'name_required');
  if (name.length > NAME_MAX) throw new SupplierRenameRefusal(`A name can be at most ${NAME_MAX} characters.`, 400, 'name_too_long');
  if (/\p{Script=Han}/u.test(name)) throw new SupplierRenameRefusal('Use an English or romanized supplier name. Put Chinese in the Chinese name field.', 400, 'english_name_required');
  return name;
}

interface SupplierCard { id: string; name: string }

async function loadSupplier(db: Db, accountId: string, vendorId: string): Promise<SupplierCard> {
  const row = await db.prepare(
    `SELECT id, name, tags, type FROM customers
      WHERE id = ? AND account_id = ? AND deleted_at IS NULL AND merged_into_id IS NULL`
  ).bind(vendorId, accountId).first<{ id: string; name: string; tags: string | null; type: string | null }>();
  if (!row) throw new SupplierRenameRefusal('No such supplier in this shop.', 404, 'not_found');
  if (!(/vendor/i.test(row.tags ?? '') || row.type === 'vendor' || row.type === 'supplier')) {
    throw new SupplierRenameRefusal('That person is not a supplier, so this is not the place to rename them.', 400, 'not_a_supplier');
  }
  return { id: row.id, name: row.name };
}

/** Another supplier already called this, which would make two of them indistinguishable by name. */
async function assertNoNameClash(db: Db, accountId: string, vendorId: string, name: string): Promise<void> {
  const clash = await db.prepare(
    `SELECT id FROM customers
      WHERE account_id = ? AND id <> ? AND deleted_at IS NULL AND archived_at IS NULL AND merged_into_id IS NULL
        AND (tags LIKE '%vendor%' OR type IN ('vendor', 'supplier'))
        AND LOWER(TRIM(name)) = LOWER(TRIM(?)) LIMIT 1`
  ).bind(accountId, vendorId, name).first<{ id: string }>();
  if (clash) {
    throw new SupplierRenameRefusal(
      `Another supplier is already called "${name}". Rename or merge that one first, so the two never share a name.`,
      409, 'name_taken',
    );
  }
}

/** The rows tied by id whose stored name is not already the new one. */
function idWhere(col: NameColumn): string {
  return `account_id = ? AND ${col.idColumn} = ? AND COALESCE(${col.nameColumn}, '') <> ?`;
}

/** The rows that name the supplier only in text, and no supplier by id. */
function textWhere(col: NameColumn): string {
  const unlinked = col.idColumn ? `AND (${col.idColumn} IS NULL OR ${col.idColumn} = '') ` : '';
  return `account_id = ? ${unlinked}AND LOWER(TRIM(COALESCE(${col.nameColumn}, ''))) = LOWER(TRIM(?)) AND COALESCE(${col.nameColumn}, '') <> ?`;
}

async function count(db: Db, table: string, where: string, binds: unknown[]): Promise<number> {
  const row = await db.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE ${where}`).bind(...binds).first<{ n: number }>();
  return Number(row?.n ?? 0);
}

/** What a rename to `rawName` would change, counted from the live rows. Writes nothing. */
export async function previewSupplierRename(
  db: Db, accountId: string, vendorId: string, rawName: unknown,
): Promise<SupplierRenamePreview> {
  const newName = cleanSupplierName(rawName);
  const card = await loadSupplier(db, accountId, vendorId);
  const sameName = card.name === newName;
  if (!sameName) await assertNoNameClash(db, accountId, vendorId, newName);

  const counts: SupplierRenameCount[] = [{ table: 'customers', label: 'the supplier card', by_id: sameName ? 0 : 1, by_name: 0 }];
  for (const col of SUPPLIER_NAME_COLUMNS) {
    const byId = col.idColumn ? await count(db, col.table, idWhere(col), [accountId, vendorId, newName]) : 0;
    const byName = await count(db, col.table, textWhere(col), [accountId, card.name, newName]);
    counts.push({ table: col.table, label: col.label, by_id: byId, by_name: byName });
  }
  // An older contact-only edit may already have corrected the card while
  // leaving its id-linked copies stale. Reconcile those copies without using
  // an old text alias to guess which unlinked or other supplier rows belong.
  if (sameName && !counts.slice(1).some(count => count.by_id > 0)) {
    throw new SupplierRenameRefusal('That is already the name.', 400, 'unchanged');
  }
  const total = counts.reduce((sum, c) => sum + c.by_id + c.by_name, 0);
  return { vendor_id: card.id, old_name: card.name, new_name: newName, counts, total };
}

/**
 * Rename the supplier and every record that carries its name, all or nothing.
 * `expectedOldName` is what the screen showed when the person decided: if the
 * name moved under them (another session renamed it) nothing is written.
 */
export async function applySupplierRename(
  db: Db, accountId: string, vendorId: string, rawName: unknown, expectedOldName?: unknown,
  additionalStatements: ReturnType<Db['prepare']>[] = [],
): Promise<SupplierRenamePreview> {
  const preview = await previewSupplierRename(db, accountId, vendorId, rawName);
  if (typeof expectedOldName === 'string' && expectedOldName.trim() && expectedOldName.trim() !== preview.old_name) {
    throw new SupplierRenameRefusal(
      `This supplier is now called "${preview.old_name}", not "${expectedOldName.trim()}". Look again before renaming.`,
      409, 'name_changed',
    );
  }
  const { new_name: newName, old_name: oldName } = preview;

  const statements = oldName === newName ? [] : [
    db.prepare(`UPDATE customers SET name = ?, updated_at = datetime('now') WHERE id = ? AND account_id = ?`)
      .bind(newName, vendorId, accountId),
  ];
  for (const col of SUPPLIER_NAME_COLUMNS) {
    if (col.idColumn) {
      statements.push(
        db.prepare(`UPDATE ${col.table} SET ${col.nameColumn} = ? WHERE ${idWhere(col)}`)
          .bind(newName, accountId, vendorId, newName),
      );
    }
    // After the id pass, so a row tied by id is never counted a second time as text.
    statements.push(
      db.prepare(`UPDATE ${col.table} SET ${col.nameColumn} = ? WHERE ${textWhere(col)}`)
        .bind(newName, accountId, oldName, newName),
    );
  }
  // A contact editor may save other fields with the correction. They must
  // commit with the names, so a failed contact edit cannot leave a half-save.
  await db.batch([...statements, ...additionalStatements]);
  return preview;
}

export interface SupplierFreightBill {
  id: string;
  leg: string;
  mode: string | null;
  total_amount: number;
  currency: string;
  weight_kg: number;
  /** Total divided by weight, in the currency it was paid in. */
  per_kg: number;
  /** The same in dollars, or null when the shop has no rate for the currency (never a rate of 1). */
  per_kg_usd: number | null;
  transit_days: number | null;
  observed_on: string;
  /** The newest bill for its leg, the one the order estimates use. */
  current: boolean;
}

/** Every freight bill recorded for this supplier, newest first, the current one per leg marked. */
export async function listSupplierFreight(db: Db, accountId: string, vendorId: string): Promise<SupplierFreightBill[]> {
  await loadSupplier(db, accountId, vendorId);
  const [bills, rateRows] = await Promise.all([
    db.prepare(
      `SELECT id, leg, mode, total_amount, currency, weight_kg, transit_days, observed_on
         FROM curate_freight_costs WHERE account_id = ? AND vendor_id = ?
        ORDER BY observed_on DESC, created_at DESC`
    ).bind(accountId, vendorId).all<{
      id: string; leg: string; mode: string | null; total_amount: number; currency: string;
      weight_kg: number; transit_days: number | null; observed_on: string;
    }>(),
    db.prepare('SELECT currency, rate_to_usd FROM exchange_rates').all<{ currency: string; rate_to_usd: number }>(),
  ]);
  const rates = new Map<string, number>();
  for (const r of rateRows.results ?? []) if (Number(r.rate_to_usd) > 0) rates.set(String(r.currency).toLowerCase(), Number(r.rate_to_usd));

  const seen = new Set<string>();
  return (bills.results ?? []).map((b) => {
    const key = b.leg.trim().toLowerCase();
    const current = !seen.has(key);
    seen.add(key);
    const perKg = b.total_amount / b.weight_kg;
    const rate = /^usd$/i.test(b.currency) ? 1 : rates.get(b.currency.toLowerCase());
    return {
      ...b,
      per_kg: Math.round(perKg * 100) / 100,
      per_kg_usd: rate ? Math.round((perKg / rate) * 100) / 100 : null,
      current,
    };
  });
}

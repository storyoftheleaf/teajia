/** Statement builders: callers batch these with the originating Curate/sample write. */
export type CompassSampleState = 'requested' | 'received' | 'tasted';
const SAMPLE_STATES = new Set(['requested', 'received', 'untasted', 'tasted', 'favorite', 'ordering', 'ordered', 'passed']);
export function compassStateForSample(status: string): CompassSampleState {
  if (!SAMPLE_STATES.has(status)) throw new Error('Invalid sample status');
  return status === 'requested' ? 'requested' : status === 'received' || status === 'untasted' ? 'received' : 'tasted';
}
async function stableId(kind: string, parts: string[]) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(parts)));
  return `${kind}-${Array.from(new Uint8Array(digest)).map(n => n.toString(16).padStart(2, '0')).join('')}`;
}
export async function prepareCompassSampleWrite(
  db: D1Database,
  scope: { accountId: string; userId: string; pendingVendorId?: string },
  entry: Record<string, any>,
  input: { entryId: string; state?: CompassSampleState; grams?: number; preferredSetId?: string; preferredSampleId?: string },
): Promise<{ statements: D1PreparedStatement[]; sampleId: string; setId: string }> {
  const { accountId, userId } = scope;
  if (!accountId || !userId || (entry.id && entry.id !== input.entryId) || (entry.account_id && entry.account_id !== accountId) || (entry.user_id && entry.user_id !== userId)) throw new Error('Curate tea is outside this account or owner');
  const stored = await db.prepare('SELECT account_id, user_id FROM tea_compass_entries WHERE id = ?').bind(input.entryId).first<Record<string, any>>();
  if (stored && (stored.account_id !== accountId || stored.user_id !== userId)) throw new Error('Curate tea is outside this account or owner');
  const state = input.state ?? entry.sample_state ?? 'requested';
  if (!['requested', 'received', 'tasted'].includes(state)) throw new Error('Invalid sample_state');
  if (input.grams !== undefined && (typeof input.grams !== 'number' || !Number.isFinite(input.grams) || input.grams < 0)) throw new Error('sample_grams must be a non-negative finite number');
  const vendorId = entry.vendor_id || null;
  if (vendorId && scope.pendingVendorId !== vendorId && !await db.prepare('SELECT id FROM customers WHERE id = ? AND account_id = ?').bind(vendorId, accountId).first()) throw new Error('Sample vendor is outside this account');
  const productId = entry.draft_product_id || null;
  if (productId && !await db.prepare('SELECT id FROM products WHERE id = ? AND account_id = ?').bind(productId, accountId).first()) throw new Error('Sample product is outside this account');
  let sample: Record<string, any> | null = null;
  if (input.preferredSampleId) {
    const preferred = await db.prepare('SELECT * FROM tea_samples WHERE id = ?').bind(input.preferredSampleId).first<Record<string, any>>();
    if (preferred && (preferred.account_id !== accountId || preferred.compass_entry_id !== input.entryId)) throw new Error('Sample link is outside this Curate tea');
  }
  sample = await db.prepare(`SELECT s.* FROM tea_samples s JOIN tea_sample_sets ss ON ss.id = s.set_id AND ss.account_id = s.account_id
    WHERE s.account_id = ? AND s.compass_entry_id = ? AND ss.archived = 0 AND ss.purpose = 'sourcing' ORDER BY s.created_at, s.id LIMIT 1`).bind(accountId, input.entryId).first<Record<string, any>>();
  let set: Record<string, any> | null = null;
  if (input.preferredSetId) {
    set = await db.prepare('SELECT * FROM tea_sample_sets WHERE id = ?').bind(input.preferredSetId).first<Record<string, any>>();
    if (!set || set.account_id !== accountId || set.archived || set.purpose !== 'sourcing' || set.source_id !== vendorId) throw new Error('Sample set is not an open sourcing set for this account/vendor');
  }
  if (sample && !set) {
    const existingSet = await db.prepare('SELECT * FROM tea_sample_sets WHERE id = ? AND account_id = ?').bind(sample.set_id, accountId).first<Record<string, any>>();
    if (existingSet?.source_id === vendorId) set = existingSet;
  }
  if (!set && vendorId) set = await db.prepare("SELECT * FROM tea_sample_sets WHERE account_id = ? AND source_id = ? AND purpose = 'sourcing' AND archived = 0 ORDER BY created_at, id LIMIT 1").bind(accountId, vendorId).first<Record<string, any>>();
  const group = vendorId ?? `entry:${input.entryId}`;
  // Archived batches remain history. Their stable identities select a new generation.
  const history = !set
    ? await db.prepare(vendorId
      ? "SELECT id FROM tea_sample_sets WHERE account_id = ? AND purpose = 'sourcing' AND archived = 1 AND source_id = ? ORDER BY id"
      : `SELECT ss.id FROM tea_sample_sets ss
           WHERE ss.account_id = ? AND ss.purpose = 'sourcing' AND ss.archived = 1 AND ss.source_id IS NULL
             AND EXISTS (SELECT 1 FROM tea_samples s WHERE s.set_id = ss.id AND s.account_id = ss.account_id AND s.compass_entry_id = ?)
           ORDER BY ss.id`)
      .bind(accountId, vendorId ?? input.entryId).all<{ id: string }>()
    : { results: [] };
  const setId = set?.id ?? await stableId('curate-set', [accountId, group, ...history.results.map(r => r.id)]);
  const sampleId = sample?.id ?? await stableId('curate-sample', [accountId, input.entryId, setId]);
  // Deterministic IDs make retries converge; they are not proof of ownership.
  // A pre-existing collision must fail before any entry/link mutation is queued.
  const candidateSet = await db.prepare('SELECT account_id, source_id, purpose, archived FROM tea_sample_sets WHERE id = ?')
    .bind(setId).first<Record<string, any>>();
  if (candidateSet && (candidateSet.account_id !== accountId || candidateSet.source_id !== vendorId || candidateSet.purpose !== 'sourcing' || candidateSet.archived)) {
    throw new Error('Generated sample set identity conflicts with this account/vendor');
  }
  const candidateSample = await db.prepare('SELECT account_id, compass_entry_id FROM tea_samples WHERE id = ?')
    .bind(sampleId).first<Record<string, any>>();
  if (candidateSample && (candidateSample.account_id !== accountId || candidateSample.compass_entry_id !== input.entryId)) {
    throw new Error('Generated sample identity conflicts with this account/Curate tea');
  }
  const statements: D1PreparedStatement[] = [];
  if (!set) statements.push(db.prepare(`INSERT INTO tea_sample_sets (id, name, source_id, source_name, purpose, account_id, user_id)
    VALUES (?, ?, ?, ?, 'sourcing', ?, ?) ON CONFLICT(id) DO NOTHING`).bind(setId, entry.vendor_name ? `${entry.vendor_name} samples` : 'Curate samples', vendorId, entry.vendor_name ?? null, accountId, userId));
  const photos = typeof entry.photos === 'string' ? entry.photos : JSON.stringify(entry.photos ?? []);
  statements.push(db.prepare(`INSERT INTO tea_samples (id, name, chinese_name, type, form, year, origin_region, source_id, source_name, product_id, compass_entry_id, set_id, status, grams, photos, account_id, created_by, user_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO NOTHING`).bind(sampleId, entry.name ?? '', entry.chinese_name ?? null, entry.type ?? null, entry.form ?? null, entry.year ?? null, entry.origin_region ?? null, vendorId, entry.vendor_name ?? null, productId, input.entryId, setId, state, input.grams ?? 10, photos, accountId, userId, userId));
  if (vendorId) statements.push(db.prepare("UPDATE tea_sample_sets SET source_id = ?, source_name = ?, updated_at = datetime('now') WHERE id = ? AND account_id = ? AND source_id IS NULL").bind(vendorId, entry.vendor_name ?? null, setId, accountId));
  // Preserve richer shelf choices, and never turn an already received sample back into a request.
  statements.push(db.prepare(`UPDATE tea_samples SET name = ?, chinese_name = ?, type = ?, form = ?, year = ?, origin_region = ?, source_id = ?, source_name = ?, product_id = ?, photos = ?, set_id = ?,
    status = CASE WHEN status IN ('favorite','ordering','ordered','passed','tasted') THEN status WHEN ? = 'tasted' THEN 'tasted' WHEN ? = 'received' THEN 'received' ELSE status END,
    grams = CASE WHEN ? IS NULL THEN grams ELSE ? END, updated_at = datetime('now') WHERE id = ? AND account_id = ? AND compass_entry_id = ?`).bind(entry.name ?? '', entry.chinese_name ?? null, entry.type ?? null, entry.form ?? null, entry.year ?? null, entry.origin_region ?? null, vendorId, entry.vendor_name ?? null, productId, photos, setId, state, state, input.grams ?? null, input.grams ?? null, sampleId, accountId, input.entryId));
  statements.push(db.prepare(`UPDATE tea_compass_entries SET sample_set_id = ?, sample_state = (SELECT CASE WHEN status = 'requested' THEN 'requested' WHEN status IN ('received','untasted') THEN 'received' ELSE 'tasted' END FROM tea_samples WHERE id = ? AND account_id = ?), updated_at = datetime('now') WHERE id = ? AND account_id = ? AND user_id = ?`).bind(setId, sampleId, accountId, input.entryId, accountId, userId));
  return { statements, sampleId, setId };
}
export async function prepareSampleLifecycleSync(db: D1Database, accountId: string, input: { sampleId: string; status: string; hasTasting?: boolean }): Promise<D1PreparedStatement[]> {
  const state = input.hasTasting ? 'tasted' : compassStateForSample(input.status);
  const row = await db.prepare('SELECT compass_entry_id FROM tea_samples WHERE id = ? AND account_id = ?').bind(input.sampleId, accountId).first<{compass_entry_id: string | null}>();
  if (!row) throw new Error('No sample in this account');
  const statements: D1PreparedStatement[] = [];
  if (input.hasTasting) statements.push(db.prepare("UPDATE tea_samples SET status = CASE WHEN status IN ('requested','received','untasted') THEN 'tasted' ELSE status END, updated_at = datetime('now') WHERE id = ? AND account_id = ?").bind(input.sampleId, accountId));
  statements.push(db.prepare("UPDATE tea_compass_entries SET sample_state = ?, sample_set_id = (SELECT set_id FROM tea_samples WHERE id = ? AND account_id = ?), updated_at = datetime('now') WHERE id = (SELECT compass_entry_id FROM tea_samples WHERE id = ? AND account_id = ?) AND account_id = ?").bind(state, input.sampleId, accountId, input.sampleId, accountId, accountId));
  return statements;
}

type HoldingRow = Record<string, any>;

/** One reading for the Samples-only inventory view and agent stock answers. */
export async function readCurateHoldings(db: D1Database, accountId: string, options: {teaId?:string; samplesOnly?:boolean} = {}) {
  // Read each account's rows once. The former correlated SUM scanned products
  // again for every tea, then ran a recursive sample query for every result.
  // That exhausted the live D1 allowance with ordinary use (2026-10-25).
  const entries = (await db.prepare(`SELECT * FROM tea_compass_entries
    WHERE account_id=? ORDER BY vendor_name,name,id`).bind(accountId).all<HoldingRow>()).results;
  const roots = entries.filter(entry => entry.deleted_at == null && entry.archived_at == null
    && entry.merged_into_id == null && (!options.teaId || entry.id === options.teaId));
  if (!roots.length) return [];

  const rootIds = new Set(roots.map(entry => entry.id));
  const byId = new Map(entries.map(entry => [entry.id, entry]));
  const rootForEntry = new Map<string, string>();
  // Preserve the old recursive query's depth-20 boundary. Archived/deleted
  // merge children still carry physical stock; only canonical roots are hidden.
  // The account-scoped map also prevents traversing a cross-account parent.
  for (const entry of entries) {
    let current = entry;
    for (let depth = 0; depth <= 20; depth += 1) {
      if (rootIds.has(current.id)) {
        rootForEntry.set(entry.id, current.id);
        break;
      }
      const parent = byId.get(current.merged_into_id);
      if (!parent) break;
      current = parent;
    }
  }

  const draftRoots = new Map<string, Set<string>>();
  for (const entry of entries) {
    const root = rootForEntry.get(entry.id);
    if (!root || !entry.draft_product_id) continue;
    const linked = draftRoots.get(entry.draft_product_id) ?? new Set<string>();
    linked.add(root);
    draftRoots.set(entry.draft_product_id, linked);
  }
  const products = (await db.prepare(`SELECT id,source_compass_entry_id,stock_grams FROM products
    WHERE account_id=? AND (inventory_purpose IS NULL OR inventory_purpose!='sample')`)
    .bind(accountId).all<HoldingRow>()).results;
  const stockByRoot = new Map<string, number>();
  for (const product of products) {
    const linked = new Set(draftRoots.get(product.id));
    const sourceRoot = rootForEntry.get(product.source_compass_entry_id);
    if (sourceRoot) linked.add(sourceRoot);
    // The old SQL used OR: two links to the same physical product count once.
    for (const root of linked) stockByRoot.set(root,
      (stockByRoot.get(root) ?? 0) + Number(product.stock_grams ?? 0));
  }

  const portions = (await db.prepare(`SELECT s.id,s.name,s.grams,s.grams_known,s.status,s.set_id,s.compass_entry_id
    FROM tea_samples s JOIN tea_sample_sets st ON st.id=s.set_id AND st.account_id=s.account_id
    WHERE s.archived_at IS NULL AND s.account_id=? AND COALESCE(st.archived,0)=0
    ORDER BY s.created_at,s.id`).bind(accountId).all<HoldingRow>()).results;
  const samplesByRoot = new Map<string, HoldingRow[]>();
  for (const sample of portions) {
    const root = rootForEntry.get(sample.compass_entry_id);
    if (!root) continue;
    const samples = samplesByRoot.get(root) ?? [];
    samples.push({ ...sample, grams: sample.grams_known === 0 ? null : sample.grams });
    samplesByRoot.set(root, samples);
  }

  const holdings = [];
  for (const root of roots) {
    const stock_grams = stockByRoot.get(root.id) ?? 0;
    const entry: HoldingRow = { ...root, stock_grams };
    const samples = samplesByRoot.get(root.id) ?? [];
    const receivedPortion = samples.some(sample => ['received','untasted','tasted','favorite','ordering','ordered','passed'].includes(sample.status));
    if (options.samplesOnly && ((!['received','tasted'].includes(entry.sample_state) && !receivedPortion) || stock_grams > 0)) continue;
    holdings.push({ entry, stock_grams, sample_grams: samples.length && samples.every(sample => sample.grams !== null)
      ? samples.reduce((sum, sample) => sum + Number(sample.grams ?? 0), 0) : null, samples });
  }
  return holdings;
}

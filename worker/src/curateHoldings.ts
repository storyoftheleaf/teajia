/**
 * One reading for the Samples-only inventory view and agent stock answers.
 *
 * Rows read scale with the ANSWER, not with the shelf. Until 2026-10-25 this
 * ran a correlated `SUM(products.stock_grams)` once per compass entry and then
 * a SECOND recursive query per entry for that entry's sample portions, so a
 * single listing read 93,817 rows; `search_tea` reached it on every call and a
 * day of ordinary use exhausted D1's free-tier daily row-read allowance, at
 * which point the whole API answers nothing. The merge families, the stock
 * behind each family and every sample portion are now each read ONCE, and the
 * per-entry assembly happens in JavaScript.
 *
 * Output is byte-for-byte what it was, which is the whole constraint here. Two
 * details carry that:
 *
 * - **A product may be reached BOTH ways and must still be counted once.** The
 *   old SUM had one `OR` between "a product whose `source_compass_entry_id` is
 *   a family member" and "a product a family member holds as its
 *   `draft_product_id`", so a product satisfying both was summed once. `links`
 *   is therefore a `UNION` of (family root, product id) PAIRS, deduplicated
 *   before anything is added up — two sums added together would double it.
 *   The grams ride along in that row so the total needs no second pass over
 *   `products`, and they cannot change the deduplication: one product id
 *   carries one `stock_grams`, so a duplicate pair is a duplicate triple.
 * - **A family with links but no recorded grams reads 0, not absent.** `SUM`
 *   skips NULLs and returns NULL for no rows; the old `COALESCE(...,0)` sat
 *   outside the scalar subquery, so the `LEFT JOIN` plus `COALESCE` here lands
 *   on the same answer whether the family has no products or no grams.
 */
export async function readCurateHoldings(db: D1Database, accountId: string, options: {teaId?:string; teaIds?:string[]; samplesOnly?:boolean} = {}) {
  // One id or a handful: `search_tea` scores entries first and asks only for the
  // teas it is going to print, so the merge-family recursion starts from those
  // roots rather than from every tea in the shop.
  const ids = options.teaIds ?? (options.teaId !== undefined ? [options.teaId] : null);
  if (ids && ids.length === 0) return [];
  const rootFilter = ids ? ` AND id IN (${ids.map(()=>'?').join(',')})` : '';
  const entryFilter = ids ? ` AND e.id IN (${ids.map(()=>'?').join(',')})` : '';
  // `roots` is the canonical teas asked for; `family` walks each root down
  // through everything merged into it, exactly as before and with the same
  // depth-20 stop. Both reads below share this head so the two answers describe
  // the same families.
  const familyCte = `WITH RECURSIVE roots(id) AS (
    SELECT id FROM tea_compass_entries WHERE account_id=? AND deleted_at IS NULL AND merged_into_id IS NULL AND archived_at IS NULL${rootFilter}
  ), family(root,id,depth) AS (
    SELECT id,id,0 FROM roots
    UNION ALL SELECT f.root,e.id,f.depth+1 FROM tea_compass_entries e JOIN family f ON e.merged_into_id=f.id
      WHERE e.account_id=? AND f.depth<20
  )`;
  const rootBinds = ids ? [accountId, ...ids] : [accountId];

  const rowsQuery = db.prepare(`${familyCte}, family_entries(root,id,draft_product_id) AS (
    SELECT f.root,t.id,t.draft_product_id FROM family f JOIN tea_compass_entries t ON t.id=f.id AND t.account_id=?
  ), links(root,product_id,grams) AS (
    SELECT fe.root,p.id,p.stock_grams FROM products p JOIN family_entries fe ON fe.id=p.source_compass_entry_id
      WHERE p.account_id=? AND (p.inventory_purpose IS NULL OR p.inventory_purpose!='sample')
    UNION
    SELECT fe.root,p.id,p.stock_grams FROM family_entries fe JOIN products p ON p.id=fe.draft_product_id
      WHERE p.account_id=? AND (p.inventory_purpose IS NULL OR p.inventory_purpose!='sample')
  ), stock(root,grams) AS (
    SELECT root,SUM(grams) FROM links GROUP BY root
  ) SELECT e.*,COALESCE(s.grams,0) AS stock_grams
    FROM tea_compass_entries e LEFT JOIN stock s ON s.root=e.id
    WHERE e.account_id=? AND e.deleted_at IS NULL AND e.archived_at IS NULL AND e.merged_into_id IS NULL${entryFilter}
    ORDER BY e.vendor_name,e.name,e.id`)
    .bind(...rootBinds, accountId, accountId, accountId, accountId, accountId, ...(ids ?? []))
    .all<Record<string,any>>();

  // Every portion for every family in one read, tagged with the family it
  // belongs to. Ordered by root first so the per-tea order is still
  // created_at then id.
  const portionsQuery = db.prepare(`${familyCte}
    SELECT f.root AS holding_root,s.id,s.name,s.grams,s.grams_known,s.status,s.set_id,s.compass_entry_id FROM tea_samples s
      JOIN family f ON f.id=s.compass_entry_id
      JOIN tea_sample_sets st ON st.id=s.set_id AND st.account_id=s.account_id
      WHERE s.archived_at IS NULL AND s.account_id=? AND COALESCE(st.archived,0)=0 ORDER BY f.root,s.created_at,s.id`)
    .bind(...rootBinds, accountId, accountId)
    .all<Record<string,any>>();

  const [rows, portions] = await Promise.all([rowsQuery, portionsQuery]);
  const byRoot = new Map<string, Record<string,any>[]>();
  for (const {holding_root, ...sample} of portions.results) {
    const list = byRoot.get(String(holding_root)) ?? [];
    list.push({...sample, grams: sample.grams_known===0 ? null : sample.grams});
    byRoot.set(String(holding_root), list);
  }

  const holdings=[];
  for(const entry of rows.results) {
    const samples: Record<string,any>[] = byRoot.get(String(entry.id)) ?? [];
    const receivedPortion = samples.some(sample => ['received','untasted','tasted','favorite','ordering','ordered','passed'].includes(sample.status));
    if(options.samplesOnly && ((!['received','tasted'].includes(entry.sample_state) && !receivedPortion) || Number(entry.stock_grams)>0)) continue;
    holdings.push({ entry, stock_grams:Number(entry.stock_grams), sample_grams:samples.length&&samples.every(sample=>sample.grams!==null)?samples.reduce((sum,s)=>sum+Number(s.grams??0),0):null, samples });
  }
  return holdings;
}

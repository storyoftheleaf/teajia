/** One reading for the Samples-only inventory view and agent stock answers. */
export async function readCurateHoldings(db: D1Database, accountId: string, options: {teaId?:string; samplesOnly?:boolean} = {}) {
  const rows = await db.prepare(`WITH RECURSIVE family(root,id,depth) AS (
    SELECT id,id,0 FROM tea_compass_entries WHERE account_id=? AND deleted_at IS NULL AND merged_into_id IS NULL AND archived_at IS NULL
    UNION ALL SELECT f.root,e.id,f.depth+1 FROM tea_compass_entries e JOIN family f ON e.merged_into_id=f.id
      WHERE e.account_id=? AND f.depth<20
  ) SELECT e.*,
    COALESCE((SELECT SUM(p.stock_grams) FROM products p WHERE p.account_id=e.account_id AND (p.inventory_purpose IS NULL OR p.inventory_purpose!='sample')
      AND (p.source_compass_entry_id IN (SELECT id FROM family WHERE root=e.id)
        OR p.id IN (SELECT t.draft_product_id FROM tea_compass_entries t JOIN family f ON f.id=t.id WHERE f.root=e.id AND t.account_id=e.account_id))),0) AS stock_grams
    FROM tea_compass_entries e WHERE e.account_id=? AND e.deleted_at IS NULL AND e.archived_at IS NULL AND e.merged_into_id IS NULL
    ${options.teaId ? 'AND e.id=?' : ''} ORDER BY e.vendor_name,e.name,e.id`).bind(accountId,accountId,accountId,...(options.teaId?[options.teaId]:[])).all<Record<string,any>>();
  const holdings=[];
  for(const entry of rows.results) {
    const portions=await db.prepare(`WITH RECURSIVE ids(id,depth) AS (
      SELECT id,0 FROM tea_compass_entries WHERE id=? AND account_id=?
      UNION ALL SELECT e.id,i.depth+1 FROM tea_compass_entries e JOIN ids i ON e.merged_into_id=i.id WHERE e.account_id=? AND i.depth<20
    ) SELECT s.id,s.name,s.grams,s.grams_known,s.status,s.set_id,s.compass_entry_id FROM tea_samples s
      JOIN tea_sample_sets st ON st.id=s.set_id AND st.account_id=s.account_id
      WHERE s.archived_at IS NULL AND s.account_id=? AND s.compass_entry_id IN (SELECT id FROM ids) AND COALESCE(st.archived,0)=0 ORDER BY s.created_at,s.id`)
      .bind(entry.id,accountId,accountId,accountId).all<Record<string,any>>();
    const samples:Record<string,any>[]=portions.results.map(sample=>({...sample,grams:sample.grams_known===0?null:sample.grams}));
    const receivedPortion = samples.some(sample => ['received','untasted','tasted','favorite','ordering','ordered','passed'].includes(sample.status));
    if(options.samplesOnly && ((!['received','tasted'].includes(entry.sample_state) && !receivedPortion) || Number(entry.stock_grams)>0)) continue;
    holdings.push({ entry, stock_grams:Number(entry.stock_grams), sample_grams:samples.length&&samples.every(sample=>sample.grams!==null)?samples.reduce((sum,s)=>sum+Number(s.grams??0),0):null, samples });
  }
  return holdings;
}

/** One read model for the agent and the human tracking screen. No writes on read. */
export async function readPurchaseTracking(env: { DB:D1Database }, accountId:string, onlyId?:string) {
  const [purchaseResult,receiptResult,lineResult,historyResult,sourceResult,proposalResult,draftResult] = await Promise.all([
    env.DB.prepare('SELECT * FROM purchase_orders WHERE account_id=? ORDER BY created_at DESC').bind(accountId).all<Record<string,any>>(),
    env.DB.prepare('SELECT * FROM inventory_receipts WHERE account_id=? ORDER BY created_at DESC').bind(accountId).all<Record<string,any>>(),
    env.DB.prepare(`SELECT l.*,COALESCE(p.given_name,p.product_name,'Unnamed item') product_name,CASE WHEN l.unit='g' THEN COALESCE(p.stock_grams,0) ELSE COALESCE(p.quantity_units,0) END current_on_hand FROM inventory_receipt_lines l JOIN products p ON p.id=l.product_id AND p.account_id=l.account_id WHERE l.account_id=? ORDER BY l.created_at,l.id`).bind(accountId).all<Record<string,any>>(),
    env.DB.prepare(`SELECT s.id,l.id line_id,s.product_id,s.delta quantity,l.unit unit,s.balance_after,s.created_at recorded_at,s.user_email recorded_by,s.note,l.receipt_id FROM stock_ledger s JOIN inventory_receipt_lines l ON (l.id=s.inventory_receipt_line_id OR l.source_movement_id=s.id) AND l.account_id=s.account_id WHERE s.account_id=? ORDER BY s.created_at DESC,s.id DESC`).bind(accountId).all<Record<string,any>>(),
    env.DB.prepare(`SELECT r.inventory_receipt_id receipt_id,b.id import_id,b.title FROM curate_import_receipts r JOIN curate_import_batches b ON b.id=r.batch_id AND b.account_id=r.account_id WHERE r.account_id=?`).bind(accountId).all<Record<string,any>>(),
    env.DB.prepare("SELECT r.*,COALESCE(c.name,e.vendor_name) vendor_name FROM curate_receipt_proposals r LEFT JOIN tea_compass_entries e ON e.id=r.compass_entry_id AND e.account_id=r.account_id LEFT JOIN customers c ON c.id=e.vendor_id AND c.account_id=e.account_id WHERE r.account_id=? AND r.status='pending' ORDER BY r.created_at DESC").bind(accountId).all<Record<string,any>>(),
    env.DB.prepare("SELECT b.id,b.title,b.created_at,b.analysis_state,b.review_state,(SELECT COUNT(*) FROM curate_import_items i WHERE i.batch_id=b.id AND i.account_id=b.account_id AND i.review_state<>'abandoned') item_count FROM curate_import_batches b WHERE b.account_id=? AND b.review_state NOT IN ('completed','abandoned') ORDER BY b.created_at DESC").bind(accountId).all<Record<string,any>>(),
  ]);
  const lines=new Map<string,any[]>(),history=new Map<string,any[]>();
  for(const line of lineResult.results??[]) { const group=lines.get(line.receipt_id)??[];group.push(line);lines.set(line.receipt_id,group); }
  for(const movement of historyResult.results??[]) { const group=history.get(movement.receipt_id)??[];const {receipt_id,...entry}=movement;group.push(entry);history.set(receipt_id,group); }
  const receipts=new Map((receiptResult.results??[]).map(receipt=>[receipt.id,{...receipt,lines:lines.get(receipt.id)??[]} as Record<string,any>]));
  const sources=new Map((sourceResult.results??[]).map(({receipt_id,...source})=>[receipt_id,source]));
  const used=new Set<string>();
  const makeRow=(purchase:Record<string,any>|null,receipt:Record<string,any>|null)=>{
    const attention:Array<{code:string;message:string}>=[];
    if(purchase&&!receipt&&!['received','cancelled'].includes(purchase.status)) attention.push(purchase.status==='pending'&&String(purchase.create_request_key??'').startsWith('intake:') ? {code:'historical_stock_link',message:'Earlier stock needs its original arrival linked; do not receive it again.'} : {code:'missing_receipt',message:'Items need matching before this purchase can be tracked.'});
    if(receipt&&!['received','cancelled'].includes(receipt.state)&&receipt.eta&&Date.parse(receipt.eta+'T23:59:59Z')<Date.now()) attention.push({code:'overdue',message:'Expected arrival date has passed.'});
    return {id:purchase?.id??`receipt:${receipt!.id}`,purchase,receipt,arrival_proposal:null as Record<string,any>|null,invoice_draft:null as Record<string,any>|null,attention,history:receipt?history.get(receipt.id)??[]:[],source_document:receipt?sources.get(receipt.id)??null:null};
  };
  const rows=(purchaseResult.results??[]).map(purchase=>{const receipt=receipts.get(purchase.receipt_id)??null;if(receipt)used.add(receipt.id);return makeRow(purchase,receipt);});
  for(const receipt of receipts.values())if(!used.has(receipt.id))rows.push(makeRow(null,receipt));
  for(const proposal of proposalResult.results??[]){
    const orderId=/^order:([^:]+):/.exec(String(proposal.idempotency_key??''))?.[1];
    const linked=orderId?rows.find(row=>row.purchase?.id===orderId):null;
    if(linked){if(!linked.receipt)linked.arrival_proposal=proposal;continue;}
    rows.push({id:`proposal:${proposal.id}`,purchase:null,receipt:null,arrival_proposal:proposal,invoice_draft:null,attention:[{code:'legacy_arrival',message:'Arrival is waiting for agent review.'}],history:[],source_document:null});
  }
  for(const draft of draftResult.results??[]){
    const attention={code:'invoice_review',message:'Invoice needs review before items can be tracked.'};
    const represented=rows.filter(row=>row.source_document?.import_id===draft.id);
    if(represented.length){for(const row of represented){row.attention.push(attention);row.invoice_draft=draft;}continue;}
    rows.push({id:`import:${draft.id}`,purchase:null,receipt:null,arrival_proposal:null,invoice_draft:draft,attention:[attention],history:[],source_document:{import_id:draft.id,title:draft.title}});
  }
  return {rows:onlyId?rows.filter(row=>row.id===onlyId||row.receipt?.id===onlyId):rows};
}

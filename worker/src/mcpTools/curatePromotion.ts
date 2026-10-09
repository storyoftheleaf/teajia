import type { ToolModule, ToolEnv, ToolAuth } from './registry';
import { issueTicket, consumeTicket, previewEnvelope, INVALID_TICKET } from './tickets';
import { requireCurateManager, type CurateGuard } from '../curateMutations';
import { loadPromotableCompassEntry, promoteCompassEntry, promotionRowGuard, promotionCapture, CompassPromotionError } from '../curatePromotion';
import { compassVendorId } from '../curateReceiptProduct';
import { sha256Hex } from '../inquiryDomain';

type Row = Record<string, any>;
interface PromotionTicket {
  kind:'curate:promote'; accountId:string; userId:string; entry:Row; guards:CurateGuard[]; agent:string;
}
async function preview(env:ToolEnv,auth:ToolAuth,args:any) {
  const id = typeof args?.tea_id === 'string' ? args.tea_id.trim() : '';
  if(!id) throw new Error('tea_id is required');
  const entry=await loadPromotableCompassEntry(env.DB,auth,id,true);
  const guards:CurateGuard[]=[promotionRowGuard('tea_compass_entries',entry)];
  const vendorId=await compassVendorId(env.DB,auth.accountId,entry);
  // Both the linked vendor and the legacy name-resolution set must stay unchanged.
  const vendors=(await env.DB.prepare('SELECT * FROM customers WHERE account_id = ? AND (id = ? OR lower(trim(name)) = lower(trim(?)))')
    .bind(auth.accountId,entry.vendor_id??null,entry.vendor_name??null).all<Row>()).results;
  guards.push({sql:'(SELECT COUNT(*) FROM customers WHERE account_id = ? AND (id = ? OR lower(trim(name)) = lower(trim(?)))) = ?',values:[auth.accountId,entry.vendor_id??null,entry.vendor_name??null,vendors.length]});
  guards.push(...vendors.map(row=>promotionRowGuard('customers',row)));
  const products=(await env.DB.prepare('SELECT * FROM products WHERE account_id = ? AND (id = ? OR source_compass_entry_id = ?)')
    .bind(auth.accountId,entry.draft_product_id??null,entry.id).all<Row>()).results;
  guards.push({sql:'(SELECT COUNT(*) FROM products WHERE account_id = ? AND (id = ? OR source_compass_entry_id = ?)) = ?',values:[auth.accountId,entry.draft_product_id??null,entry.id,products.length]});
  guards.push(...products.map(row=>promotionRowGuard('products',row)));
  const existing=products.find(row=>row.id===entry.draft_product_id)??products.find(row=>row.source_compass_entry_id===entry.id);
  const capture=promotionCapture(entry);
  const ticket:PromotionTicket={kind:'curate:promote',accountId:auth.accountId,userId:auth.userId,entry,guards,agent:typeof args.agent==='string'?args.agent.slice(0,100):'an agent'};
  return previewEnvelope({action:'promote_to_inventory',tea_id:entry.id,name:existing?.product_name??capture.name,vendor_id:existing?.vendor_id??vendorId,
    existing_product_id:existing?.id??null,already_promoted:!!existing,
    creates:existing?null:{status:'Draft',is_public:0,shown_in_shop:0,stock_grams:0,quantity_units:entry.category==='teaware'?0:null,cost_amount:null,cost_currency:null,quantity_purchased:null,shipping_rate_per_kg:null,markup_multiplier:null},
    physical_holdings_preserved:true,samples_preserved:true,
    message:existing?'Link this tea to its existing inventory product.':'Create a private Draft inventory product. Quoted prices and sample grams do not become paid cost or shop stock; a reviewed arrival supplies those.'},await issueTicket(env,ticket,auth.tokenId));
}
export const curatePromotionTools:ToolModule={
  area:'Curate inventory promotion',
  defs:[{name:'curate_promote_tea',scope:'stock:write',description:'Preview and confirm linking a Curate tea to shop inventory. Creates a private Draft with unknown cost and zero stock, or reuses its existing product identity. Does not publish, receive stock, or move samples. Requires Curate management. Read the preview to Adrian and obtain his approval before confirming.',inputSchema:{type:'object',properties:{tea_id:{type:'string'},agent:{type:'string'},confirm:{type:'string',description:'The five-minute confirmation token from the approved preview.'}},additionalProperties:false}}],
  handlers:{curate_promote_tea:async(env,auth,args)=>{
    await requireCurateManager(env.DB,auth);
    if(!args?.confirm) return preview(env,auth,args);
    const ticket=await consumeTicket<PromotionTicket,'curate:promote'>(env,String(args.confirm),'curate:promote',auth);
    if(!ticket||ticket.userId!==auth.userId) return INVALID_TICKET;
    const valid=await env.DB.prepare(`SELECT ${ticket.guards.map(g=>g.sql).join(' AND ')} AS valid`).bind(...ticket.guards.flatMap(g=>g.values)).first<{valid:number}>();
    if(!valid?.valid) return {error:'stale_preview',message:'The tea, vendor or inventory identity changed. Preview again.'};
    try {
      const {status,...result}=await promoteCompassEntry(env.DB,auth.accountId,ticket.entry,{auth,guards:ticket.guards,agent:ticket.agent,key:await sha256Hex(String(args.confirm))});
      return {committed:true,...result};
    } catch(error) {
      if(error instanceof CompassPromotionError && error.status===409) return {error:'stale_preview',message:'The tea, vendor or inventory identity changed. Preview again.'};
      throw error;
    }
  }},
};

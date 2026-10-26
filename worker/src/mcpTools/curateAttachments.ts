import { listCurateAttachments, uploadCurateAttachment } from '../curateAttachments';
import { readCurateHoldingsPage, DEFAULT_CURATE_HOLDINGS_PAGE, MAX_CURATE_HOLDINGS_PAGE } from '../curateHoldings';
import { requireCurateManager } from '../curateMutations';
import type { ToolModule } from './registry';
const target={entity_type:{type:'string',enum:['tea','vendor','arrival','quote']},entity_id:{type:'string'}};
export const curateAttachmentTools:ToolModule={area:'curate-evidence-and-holdings',defs:[
 {name:'curate_upload_attachment',scope:'stock:write',description:'Upload a JPEG/PNG/WebP/PDF from chat file bytes as base64 and privately attach it to a tea, vendor, arrival or quote with a role. Preview first, then send the SAME bytes and confirmation token after approval. Maximum6MiB. No public URL required, never puts documents in notes or on the storefront.',inputSchema:{type:'object',properties:{...target,role:{type:'string',enum:['leaf','liquor','wrapper','label','pricelist','businesscard','source_document']},filename:{type:'string'},mime_type:{type:'string'},data_base64:{type:'string'},agent:{type:'string'},confirm:{type:'string'}},required:['entity_type','entity_id','role','filename','mime_type','data_base64','agent'],additionalProperties:false}},
 {name:'curate_list_attachments',scope:'inventory:read',description:'Read private attachment metadata for one shop record. File content stays authenticated.',inputSchema:{type:'object',properties:{...target,agent:{type:'string'}},required:['entity_type','entity_id'],additionalProperties:false}},
 {name:'curate_stock',scope:'inventory:read',description:'Read what remains of a Curate tea: operational sample grams separately from full stock grams. Reads the same balances as Inventory Samples only; never assumes sample grams are sale stock. Without a tea_id it answers ONE page of '+DEFAULT_CURATE_HOLDINGS_PAGE+' teas (limit up to '+MAX_CURATE_HOLDINGS_PAGE+'); follow next_cursor while has_more is true rather than asking for the whole shelf at once.',inputSchema:{type:'object',properties:{tea_id:{type:'string'},samples_only:{type:'boolean'},limit:{type:'integer',minimum:1,maximum:MAX_CURATE_HOLDINGS_PAGE},cursor:{type:'string'},agent:{type:'string'}},additionalProperties:false}}
],handlers:{
 curate_upload_attachment:(env,auth,args)=>uploadCurateAttachment(env,auth,args),
 curate_list_attachments:async(env,auth,args)=>{await requireCurateManager(env.DB,auth);return {attachments:await listCurateAttachments(env.DB,auth,args.entity_type,args.entity_id)};},
 // One page, with the cursor to continue. It used to answer every tea in the
 // shop, which is the read that exhausted D1's daily allowance; `holdings`
 // stays the first key so a caller reading `result.holdings` is unaffected.
 curate_stock:async(env,auth,args)=>{await requireCurateManager(env.DB,auth);
  const page=await readCurateHoldingsPage(env.DB,auth.accountId,{teaId:args?.tea_id,samplesOnly:args?.samples_only===true,limit:args?.limit,cursor:args?.cursor});
  return {holdings:page.holdings,has_more:page.has_more,next_cursor:page.next_cursor,page_size:page.limit};}
}};

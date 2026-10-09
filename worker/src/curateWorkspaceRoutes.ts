import type { ToolAuth, ToolEnv } from './mcpTools/registry';
import { requireCurateManager, confirmCurateMutation, previewCurateUndo, readCurateHistory } from './curateMutations';
import { readVendorStructuredProfile, prepareVendorStructuredProfileWrite } from './curateVendorProfile';
import { getCurateQuote, listCurateQuotes, prepareCurateQuoteWrite } from './curateQuotes';
import { listCurateAttachments, readCurateAttachment, uploadCurateAttachment, type AttachmentTarget } from './curateAttachments';
import { readCurateHoldings } from './curateHoldings';
import { curateManageModule } from './mcpTools/curateManage';
import { curateSupplyTools } from './mcpTools/curateSupply';

async function boundedJson(request:Request) {
  const reader=request.body?.getReader(); if(!reader) return {};
  let size=0; const chunks:Uint8Array[]=[];
  for(;;){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>9*1024*1024){await reader.cancel();throw new Error('Request exceeds9MiB');}chunks.push(value);}
  const bytes=new Uint8Array(size);let at=0;for(const c of chunks){bytes.set(c,at);at+=c.length;}
  const value=JSON.parse(new TextDecoder().decode(bytes));
  if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('An object is required');return value;
}
export async function handleCurateWorkspace(request:Request,env:ToolEnv,auth:ToolAuth):Promise<Response>{
  try {
    await requireCurateManager(env.DB,auth);
    const url=new URL(request.url),path=url.pathname,method=request.method;
    const allowed = /\/vendors\/[^/]+\/profile$/.test(path) ? ['GET','PUT']
      : /\/quotes\/[^/]+$/.test(path) ? ['GET','PUT']
      : path.endsWith('/quotes') ? ['GET','POST']
      : path.endsWith('/attachments') ? ['GET','POST']
      : /\/(correct|undo|order)$/.test(path) ? ['POST'] : ['GET'];
    if(!allowed.includes(method)) return Response.json({error:'Method not allowed'},{status:405,headers:{Allow:allowed.join(', ')}});
    const vendor=path.match(/^\/api\/curate\/vendors\/([^/]+)\/profile$/);
    if(vendor){
      const id=decodeURIComponent(vendor[1]);
      if(method==='PUT'){
        const write=await prepareVendorStructuredProfileWrite(env.DB,{...auth,agent:auth.userEmail || 'Shop app'},id,await boundedJson(request));
        await env.DB.batch(write.statements);
      }
      const row=await readVendorStructuredProfile(env.DB,auth,id);
      return Response.json(row??{error:'Vendor not found'},{status:row?200:404});
    }
    const quote=path.match(/^\/api\/curate\/quotes(?:\/([^/]+))?$/);
    if(quote){
      let id=quote[1]?decodeURIComponent(quote[1]):undefined;
      if(method==='POST'||method==='PUT'){
        const body=await boundedJson(request);
        if(method==='POST' && body.id !== undefined) {
          if(typeof body.id!=='string'||!/^[a-zA-Z0-9_-]{8,100}$/.test(body.id)) throw new Error('A valid quote request id is required');
          id=body.id;delete body.id;
          const existing=await getCurateQuote(env.DB,auth,id!);
          if(existing) return Response.json(existing);
        }
        const write=await prepareCurateQuoteWrite(env.DB,{...auth,agent:auth.userEmail || 'Shop app'},body,id);
        await env.DB.batch(write.statements);id=write.id;
      }
      if(!id)return Response.json(await listCurateQuotes(env.DB,auth,url.searchParams.get('vendor_id')||undefined));
      const row=await getCurateQuote(env.DB,auth,id);return Response.json(row??{error:'Quote not found'},{status:row?200:404});
    }
    const content=path.match(/^\/api\/curate\/attachments\/([^/]+)\/content$/);
    if(content)return readCurateAttachment(env,auth,decodeURIComponent(content[1]));
    if(path==='/api/curate/attachments'){
      if(method==='POST')return Response.json(await uploadCurateAttachment(env,auth,await boundedJson(request)));
      return Response.json(await listCurateAttachments(env.DB,auth,url.searchParams.get('entity_type') as AttachmentTarget,url.searchParams.get('entity_id')||''));
    }
    if(path==='/api/curate/holdings')return Response.json(await readCurateHoldings(env.DB,auth.accountId,{teaId:url.searchParams.get('tea_id')||undefined,samplesOnly:url.searchParams.get('samples_only')==='true'}));
    if(path==='/api/curate/history')return Response.json(await readCurateHistory(env,auth,{entity_type:url.searchParams.get('entity_type')||undefined,entity_id:url.searchParams.get('entity_id')||undefined}));
    if(path==='/api/curate/correct'){
      const body=await boundedJson(request);
      return Response.json(await curateManageModule.handlers.curate_correct(env,auth,body.confirm?{confirmation_token:body.confirm}:{...body.command,agent:auth.userEmail || 'Shop app'}));
    }
    if(path==='/api/curate/undo'){
      const body=await boundedJson(request);
      return Response.json(body.confirm?await confirmCurateMutation(env,auth,body.confirm):await previewCurateUndo(env,auth,auth.userEmail || 'Shop app',body.mutation_id));
    }
    if(path==='/api/curate/order')return Response.json(await curateSupplyTools.handlers.curate_order(env,auth,{...await boundedJson(request),agent:auth.userEmail || 'Shop app'}));
    return Response.json({error:'Not found'},{status:404});
  }catch(error){const message=(error as Error).message;return Response.json({error:message},{status:/permission|member|manage|owner|denied|authoriz/i.test(message)?403:400});}
}

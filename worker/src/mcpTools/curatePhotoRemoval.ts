/** Optional local unlink + external backup Trash. Each part keeps its own audit.
 * Local confirmation runs first: a stale local preview never touches Drive.
 * Partial completion is explicit; local undo never claims to restore Google. */
import {previewCurateMutation,confirmCurateMutation,requireCurateManager} from '../curateMutations';
import {sha256Hex} from '../inquiryDomain';
import {curateDrivePhoto} from './curateDrivePhotos';
import {issueTicket,consumeTicket,previewEnvelope,INVALID_TICKET} from './tickets';
import type {ToolAuth,ToolEnv} from './registry';
type Ticket={kind:'curate:remove_photo_drive';accountId:string;userId:string;teaId:string;photo:string;localToken:string;driveToken:string|null;drivePreview:Record<string,unknown>;result?:Record<string,unknown>};
const KIND='curate:remove_photo_drive';
export async function previewCuratePhotoRemoval(env:ToolEnv,auth:ToolAuth,args:any) {
 await requireCurateManager(env.DB,auth);
 if(args?.action!=='remove_photo'||args?.entity!=='tea'||args?.trash_drive!==true) throw new Error('Compound removal requires remove_photo on a tea with trash_drive:true');
 const agent=typeof args.agent==='string'?args.agent:'an agent';
 const local=await previewCurateMutation(env,auth,{action:'remove_photo',entity:'tea',id:args.id,photo:args.photo},agent);
 const drive=await curateDrivePhoto(env,auth,{tea_id:args.id,photo:args.photo,action:'trash',agent}) as any;
 if(drive.error) return drive;
 if(!drive.confirmation_token&&!drive.unchanged) throw new Error('Could not preview the exact Google Drive backup');
 const ticket:Ticket={kind:KIND,accountId:auth.accountId,userId:auth.userId,teaId:args.id,photo:args.photo,localToken:local.confirmation_token,driveToken:drive.confirmation_token??null,drivePreview:drive.preview??{unchanged:true,file:drive.file}};
 return previewEnvelope({action:'remove_photo',trash_drive:true,tea_id:args.id,photo:args.photo,local:{...local.preview,photo_removal:{asset_retained:true,drive_cleanup:'trash_after_local_confirmation'}},drive:ticket.drivePreview,note:'Remove this URL from the tea, then move its exact Google Drive backup to Trash. Media bucket bytes stay. A Drive failure or timeout leaves the local removal recorded and reports the separate Drive outcome; there is no automatic rollback.',undo:'curate_undo restores the tea URL only. Restoring the Google backup requires a separate curate_drive_photo restore preview and confirmation.'},await issueTicket(env,ticket,auth.tokenId));
}
/** Null means a different tool's token, so curate_correct can use its normal gate. */
export async function confirmCuratePhotoRemoval(env:ToolEnv,auth:ToolAuth,token:string):Promise<Record<string,unknown>|null> {
 const hash=await sha256Hex(token);
 const row=await env.DB.prepare('SELECT payload_json,token_id,consumed_at FROM mcp_confirmation_tickets WHERE token_hash=? AND account_id=? AND kind=?').bind(hash,auth.accountId,KIND).first<{payload_json:string;token_id:string;consumed_at:number|null}>();
 if(!row) return null;
 await requireCurateManager(env.DB,auth);
 let payload:Ticket;try{payload=JSON.parse(row.payload_json);}catch{return INVALID_TICKET;}
 if(row.token_id!==auth.tokenId||payload.userId!==auth.userId) return INVALID_TICKET;
 if(row.consumed_at!=null) return payload.result??{error:'compound_confirmation_already_claimed',message:'No action was repeated. Inspect the tea’s local history and Drive operations to determine the completed parts.'};
 const ticket=await consumeTicket<Ticket,typeof KIND>(env,token,KIND,auth);
 if(!ticket) return INVALID_TICKET;
 const persist=async(result:Record<string,unknown>)=>{
  await env.DB.prepare('UPDATE mcp_confirmation_tickets SET payload_json=? WHERE token_hash=? AND account_id=? AND kind=?').bind(JSON.stringify({...ticket,result}),hash,auth.accountId,KIND).run();return result;
 };
 const local=await confirmCurateMutation(env,auth,ticket.localToken) as any;
 if(!local.confirmed) return persist({confirmed:false,photo_removed:false,local,drive:{status:'not_started'},message:'The local removal did not apply; Google Drive was not changed.'});
 await persist({confirmed:true,photo_removed:true,mutation_id:local.mutation_id,drive:{status:'not_verified'},message:'Local removal is recorded. Inspect Drive operations if this request does not return a verified backup result.'});
 let drive:any;
 try {
  if(ticket.driveToken) drive=await curateDrivePhoto(env,auth,{confirmation_token:ticket.driveToken});
  else {
   const checked=await curateDrivePhoto(env,auth,{tea_id:ticket.teaId,photo:ticket.photo,action:'trash'}) as any;
   drive=checked.unchanged?{unchanged:true,status:'succeeded',file:checked.file}:{status:'not_applied',error:checked.error??'drive_file_changed_since_preview',message:'The backup changed after preview; preview a separate Drive cleanup.'};
  }
 }
 catch {drive={status:'unverified',message:'Google cleanup could not be verified. Read curate_tea_photos Drive operations before making another backup change.'};}
 if(drive.error&&!drive.status) drive={...drive,status:'not_applied'};
 return persist({confirmed:true,photo_removed:true,mutation_id:local.mutation_id,drive,completed:drive.status==='succeeded',message:drive.status==='succeeded'?'Tea photo removed; exact Drive backup is in Trash.':'Tea photo removed. Google Drive cleanup is incomplete or unverified; the local removal was not rolled back.'});
}

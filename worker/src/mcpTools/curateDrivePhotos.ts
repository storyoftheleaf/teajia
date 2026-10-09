/** Explicit external backup changes, with their own durable operation ledger.
 * A removed tea URL is still selectable through its retained Drive mapping. */
import { requireCurateManager } from '../curateMutations';
import { driveLink, driveSeal, readDrivePhoto, setDrivePhotoTrashed, DrivePhotoHttpError, type DriveEnv, type DriveLink, type DrivePhotoState } from '../curateDrive';
import { sha256Hex } from '../inquiryDomain';
import { issueTicket, consumeTicket, previewEnvelope, INVALID_TICKET } from './tickets';
import type { ToolAuth, ToolEnv, ToolModule } from './registry';
type Env = ToolEnv & DriveEnv & { KEY_ENCRYPTION_SECRET?: string };
type Mapping = { id:string; account_id:string; compass_entry_id:string; photo_url:string; drive_file_id:string; web_view_link:string|null };
type Ticket = { kind:'curate:drive_photo';accountId:string;userId:string;mapping:Mapping;connection:string;before:DrivePhotoState;action:'trash'|'restore';agent:string;operationId?:string;operationUpdatedAt?:string;operationAttemptId?:string };
type Operation = {id:string;account_id:string;mapping_id:string;compass_entry_id:string;photo_url:string;drive_file_id:string;action:'trash'|'restore';status:string;actor_user_id:string;actor_token_id:string;connection_fingerprint:string;updated_at:string;attempt_id:string};
const managerGuard = `EXISTS(SELECT 1 FROM account_members WHERE account_id=? AND user_id=? AND status='active' AND (role='owner' OR (role IN ('staff','admin') AND CASE WHEN json_valid(permissions) THEN json_extract(permissions,'$.curate_manage') ELSE 0 END=1)))`;
const fingerprint = (link:DriveLink) => sha256Hex(JSON.stringify(link));
async function selected(env:Env, auth:ToolAuth, teaId:string, photo:string) {
 const tea=await env.DB.prepare('SELECT id,name FROM tea_compass_entries WHERE account_id=? AND id=?').bind(auth.accountId,teaId).first<{id:string;name:string}>();
 const mapping=await env.DB.prepare('SELECT id,account_id,compass_entry_id,photo_url,drive_file_id,web_view_link FROM curate_drive_files WHERE account_id=? AND compass_entry_id=? AND photo_url=?').bind(auth.accountId,teaId,photo).first<Mapping>();
 if(!tea||!mapping) throw new Error('No exact synced photo for this tea in this shop');
 const link=await driveLink(env,auth.accountId);
 if(!link||link.last_error==='reconnect') throw new Error('Connect this shop’s Google Drive first');
 const refs=await env.DB.prepare('SELECT COUNT(*) AS n FROM curate_drive_files WHERE drive_file_id=?').bind(mapping.drive_file_id).first<{n:number}>();
 if(refs?.n!==1) throw new Error('This Drive backup is shared by other photo mappings; it cannot be trashed or restored here');
 return {tea,mapping,link};
}
async function updateStatus(env:Env,id:string,attemptId:string,status:string,after:DrivePhotoState|null,error:string|null) {
 return !!await env.DB.prepare("UPDATE curate_drive_photo_operations SET status=?,after_json=?,error=?,updated_at=datetime('now') WHERE id=? AND attempt_id=? AND status IN ('pending','unknown') RETURNING id").bind(status,after?JSON.stringify(after):null,error,id,attemptId).first();
}
async function currentOutcome(env:Env,auth:ToolAuth,id:string) {
 const row=await env.DB.prepare('SELECT status FROM curate_drive_photo_operations WHERE id=? AND account_id=?').bind(id,auth.accountId).first<{status:string}>();
 return {operation_id:id,status:row?.status??'unknown'};
}
/** Retry means reconcile the exact operation by reading Google, never repeat a write. */
async function reconcile(env:Env,auth:ToolAuth,id:string,expectedAttempt?:string) {
 const op=await env.DB.prepare('SELECT * FROM curate_drive_photo_operations WHERE id=? AND account_id=?').bind(id,auth.accountId).first<Operation>();
 if(!op) return {error:'operation_not_found'};
 if(expectedAttempt&&op.attempt_id!==expectedAttempt) return currentOutcome(env,auth,id);
 if(op.status==='succeeded'||op.status==='failed') return {operation_id:id,status:op.status};
 const s=await selected(env,auth,op.compass_entry_id,op.photo_url);
 if(s.mapping.id!==op.mapping_id||s.mapping.drive_file_id!==op.drive_file_id||await fingerprint(s.link)!==op.connection_fingerprint) return {operation_id:id,status:op.status,error:'backup_or_connection_changed'};
 try {
  const state=await readDrivePhoto(env,driveSeal(env),s.link,op.drive_file_id);
  if(state.trashed===(op.action==='trash')) {if(await updateStatus(env,id,op.attempt_id,'succeeded',state,null)) return {operation_id:id,status:'succeeded',file:state};return currentOutcome(env,auth,id);}
  await updateStatus(env,id,op.attempt_id,'unknown',state,'Drive has not confirmed the requested state; reconcile again before any new operation');
 } catch {await updateStatus(env,id,op.attempt_id,'unknown',null,'Could not verify the exact Drive file');}
 return {...await currentOutcome(env,auth,id),message:'No write was repeated. Reconcile this operation again to verify the remote result.'};
}
export async function curateDrivePhoto(rawEnv:ToolEnv,auth:ToolAuth,args:any) {
 const env=rawEnv as Env;
 await requireCurateManager(env.DB,auth);
 if(args?.operation_id) {
  if(!args.retry) return reconcile(env,auth,String(args.operation_id));
  const op=await env.DB.prepare('SELECT * FROM curate_drive_photo_operations WHERE id=? AND account_id=?').bind(String(args.operation_id),auth.accountId).first<Operation>();
  if(!op||!['pending','unknown'].includes(op.status)) return {error:'operation_not_retryable'};
  if(Date.now()-Date.parse(op.updated_at.replace(' ','T')+'Z')<60000) return {error:'operation_still_running',operation_id:op.id,message:'Allow 60 seconds for the original request to settle before previewing a retry.'};
  const selectedBackup=await selected(env,auth,op.compass_entry_id,op.photo_url);
  if(selectedBackup.mapping.id!==op.mapping_id||selectedBackup.mapping.drive_file_id!==op.drive_file_id||await fingerprint(selectedBackup.link)!==op.connection_fingerprint) return {error:'backup_or_connection_changed',operation_id:op.id};
  const state=await readDrivePhoto(env,driveSeal(env),selectedBackup.link,op.drive_file_id);
  if(state.trashed===(op.action==='trash')) return reconcile(env,auth,op.id);
  if(op.action==='trash'&&!state.capabilities?.canTrash || op.action==='restore'&&(!state.explicitlyTrashed||!state.capabilities?.canUntrash)) throw new Error('Google does not allow this exact photo retry');
  const ticket:Ticket={kind:'curate:drive_photo',accountId:auth.accountId,userId:auth.userId,mapping:selectedBackup.mapping,connection:op.connection_fingerprint,before:state,action:op.action,agent:typeof args.agent==='string'?args.agent.slice(0,100):'an agent',operationId:op.id,operationUpdatedAt:op.updated_at,operationAttemptId:op.attempt_id};
  return previewEnvelope({action:op.action,retry_of:op.id,tea:selectedBackup.tea.name,photo:op.photo_url,file_id:state.id,file_name:state.name,note:'Explicitly retry the same desired Google Trash state. This never requests the opposite action or deletes media bytes.'},await issueTicket(env,ticket,auth.tokenId));
 }
 if(args?.confirmation_token) {
  const ticket=await consumeTicket<Ticket,'curate:drive_photo'>(env,String(args.confirmation_token),'curate:drive_photo',auth);
  if(!ticket||ticket.userId!==auth.userId) return INVALID_TICKET;
  const s=await selected(env,auth,ticket.mapping.compass_entry_id,ticket.mapping.photo_url);
  if(JSON.stringify(s.mapping)!==JSON.stringify(ticket.mapping)||await fingerprint(s.link)!==ticket.connection) return {error:'backup_or_connection_changed'};
  const state=await readDrivePhoto(env,driveSeal(env),s.link,s.mapping.drive_file_id);
  if(JSON.stringify(state)!==JSON.stringify(ticket.before)) return {error:'drive_file_changed_since_preview'};
  await requireCurateManager(env.DB,auth);
  // Persist intent before contacting Google. The partial unique index prevents
  // opposite operations while a timeout leaves the result uncertain.
  const id=ticket.operationId??crypto.randomUUID();
  const attemptId=crypto.randomUUID();
  if(ticket.operationId) {
   const claimed=await env.DB.prepare(`UPDATE curate_drive_photo_operations SET status='pending',attempt_id=?,updated_at=datetime('now'),attempts_json=json_insert(attempts_json,'$[#]',json(?)) WHERE id=? AND account_id=? AND status IN ('pending','unknown') AND updated_at=? AND attempt_id=? AND ${managerGuard} AND EXISTS(SELECT 1 FROM curate_drive_files WHERE id=? AND account_id=? AND compass_entry_id=? AND drive_file_id=? AND photo_url=? AND web_view_link IS ?) AND EXISTS(SELECT 1 FROM curate_drive_links WHERE account_id=? AND refresh_token_encrypted=? AND google_email IS ? AND root_folder_id IS ? AND last_error IS ?) AND (SELECT COUNT(*) FROM curate_drive_files WHERE drive_file_id=?)=1 RETURNING id`).bind(attemptId,JSON.stringify({actor_user_id:auth.userId,actor_token_id:auth.tokenId,agent_name:ticket.agent,at:new Date().toISOString()}),id,auth.accountId,ticket.operationUpdatedAt,ticket.operationAttemptId,auth.accountId,auth.userId,s.mapping.id,auth.accountId,s.mapping.compass_entry_id,s.mapping.drive_file_id,s.mapping.photo_url,s.mapping.web_view_link,auth.accountId,s.link.refresh_token_encrypted,s.link.google_email,s.link.root_folder_id,s.link.last_error,s.mapping.drive_file_id).first();
   if(!claimed) return {error:'operation_changed_since_preview',operation_id:id};
  } else {
  try { await env.DB.prepare(`INSERT INTO curate_drive_photo_operations(id,account_id,mapping_id,compass_entry_id,photo_url,drive_file_id,action,status,attempt_id,actor_user_id,actor_token_id,agent_name,connection_fingerprint,before_json)
   SELECT ?,?,?,?,?,?,?,'pending',?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM curate_drive_files WHERE id=? AND account_id=? AND drive_file_id=? AND photo_url=?)
   AND EXISTS(SELECT 1 FROM curate_drive_links WHERE account_id=? AND refresh_token_encrypted=?)
   AND (SELECT COUNT(*) FROM curate_drive_files WHERE drive_file_id=?)=1 AND ${managerGuard}`).bind(id,auth.accountId,s.mapping.id,s.mapping.compass_entry_id,s.mapping.photo_url,s.mapping.drive_file_id,ticket.action,attemptId,auth.userId,auth.tokenId,ticket.agent,ticket.connection,JSON.stringify(state),s.mapping.id,auth.accountId,s.mapping.drive_file_id,s.mapping.photo_url,auth.accountId,s.link.refresh_token_encrypted,s.mapping.drive_file_id,auth.accountId,auth.userId).run(); }
  catch(e) {
   const existing=await env.DB.prepare("SELECT id FROM curate_drive_photo_operations WHERE account_id=? AND drive_file_id=? AND status IN ('pending','unknown')").bind(auth.accountId,s.mapping.drive_file_id).first<{id:string}>();
   if(existing) return {error:'unverified_drive_operation',operation_id:existing.id};
   throw e;
  }
  }
  if(!await env.DB.prepare('SELECT id FROM curate_drive_photo_operations WHERE id=?').bind(id).first()) return {error:'backup_or_connection_changed'};
  try {await setDrivePhotoTrashed(env,driveSeal(env),s.link,s.mapping.drive_file_id,ticket.action==='trash');}
  catch(e) {
   const definite=e instanceof DrivePhotoHttpError && e.status>=400 && e.status<500 && e.status!==408 && e.status!==429;
   await updateStatus(env,id,attemptId,definite?'failed':'unknown',null,definite?(e as Error).message:'Google write outcome could not be verified');
   if(definite) return {...await currentOutcome(env,auth,id),error:(e as Error).message};
  }
  try {return await reconcile(env,auth,id,attemptId);} catch {await updateStatus(env,id,attemptId,'unknown',null,'Verification interrupted; reconcile using operation_id');return currentOutcome(env,auth,id);}
 }
 if(args?.action!=='trash'&&args?.action!=='restore') throw new Error('action must be trash or restore');
 if(typeof args.tea_id!=='string'||typeof args.photo!=='string') throw new Error('tea_id and exact synced photo URL are required');
 const s=await selected(env,auth,args.tea_id,args.photo);
 const outstanding=await env.DB.prepare("SELECT id FROM curate_drive_photo_operations WHERE account_id=? AND drive_file_id=? AND status IN ('pending','unknown')").bind(auth.accountId,s.mapping.drive_file_id).first<{id:string}>();
 if(outstanding) return {error:'unverified_drive_operation',operation_id:outstanding.id,message:'Reconcile the outstanding operation before previewing another change.'};
 const state=await readDrivePhoto(env,driveSeal(env),s.link,s.mapping.drive_file_id);
 if(state.trashed===(args.action==='trash')) return {unchanged:true,file:state};
 if(args.action==='restore'&&!state.explicitlyTrashed) throw new Error('The photo is inside a trashed folder; restore that folder in Google Drive first');
 if(args.action==='trash'&&!state.capabilities?.canTrash || args.action==='restore'&&!state.capabilities?.canUntrash) throw new Error('Google does not allow this photo operation');
 const ticket:Ticket={kind:'curate:drive_photo',accountId:auth.accountId,userId:auth.userId,mapping:s.mapping,connection:await fingerprint(s.link),before:state,action:args.action,agent:typeof args.agent==='string'?args.agent.slice(0,100):'an agent'};
 return previewEnvelope({action:args.action,tea_id:s.tea.id,tea:s.tea.name,photo:s.mapping.photo_url,file_id:state.id,file_name:state.name,drive_url:s.mapping.web_view_link,google_email:s.link.google_email,shared_backup_references:0,note:args.action==='trash'?'Move only this Google Drive backup to Trash. Google normally permanently deletes trash after 30 days; restore sooner. The tea photo and media bucket bytes remain.':'Restore this exact Google Drive file. This does not reattach its URL to the tea.',undo:'Use curate_drive_photo action restore with a fresh preview; generic curate_undo cannot reverse a Drive operation.'},await issueTicket(env,ticket,auth.tokenId));
}
export const curateDrivePhotosModule:ToolModule={area:'curate Drive backups',defs:[{name:'curate_drive_photo',scope:'stock:write',annotations:{destructiveHint:true},description:'Preview and confirm trash/restore of an exact synced Curate photo backup in this shop’s Google Drive. Works after its URL was removed from the tea. Never permanently deletes or removes media bucket bytes. Principal-bound confirmation required. operation_id reconciles an uncertain remote result without repeating a write.',inputSchema:{type:'object',properties:{tea_id:{type:'string'},photo:{type:'string',description:'Exact photo_url from curate_tea_photos drive mappings; no arbitrary Drive file IDs.'},action:{type:'string',enum:['trash','restore']},agent:{type:'string'},confirmation_token:{type:'string'},retry:{type:'boolean',description:'With operation_id: preview an explicitly approved retry of the same action after 60 seconds; then use confirmation_token.'},operation_id:{type:'string',description:'Read/reconcile a previous operation, including after a timeout.'}},additionalProperties:false}}],handlers:{curate_drive_photo:curateDrivePhoto}};

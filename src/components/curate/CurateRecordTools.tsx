import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../../lib/api';
import { useAppStore } from '../../lib/store';
import { TYPOGRAPHY_CLASSES as T } from '../../designTokens';

type Entity = 'tea' | 'vendor' | 'arrival' | 'quote';
type Props = { entityType: Entity; entityId: string; onChanged?: () => void };
type Change = { entity_type?: string; entity_id?: string; entity?: string; id?: string; before: Record<string, unknown> | null; after: Record<string, unknown> | null };
const roles = { leaf: 'Leaf', liquor: 'Liquor', wrapper: 'Wrapper', label: 'Label', pricelist: 'Price list', businesscard: 'Business card', source_document: 'Source document' };
const hidden = new Set(['account_id','user_id','created_by_user_id','created_at','updated_at','object_key','sha256']);
const label = (key: string) => key.replace(/_/g, ' ');
function valueText(value: unknown): string {
  if (value === null || value === undefined || value === '') return 'Not set';
  if (Array.isArray(value)) return value.length ? value.map(valueText).join('; ') : 'None';
  if (typeof value === 'object') return Object.entries(value).map(([k,v]) => `${label(k)}: ${valueText(v)}`).join(', ');
  if (typeof value === 'string' && /^[\[{]/.test(value)) { try { return valueText(JSON.parse(value)); } catch { /* Exact text remains readable. */ } }
  return String(value);
}
export function CurateChangePreview({ changes }: { changes: Change[] }) {
  return <div className="space-y-3">{changes.map((change, i) => <div key={i} className="min-w-0 border border-tea-border rounded-md p-3">
    <p className={T.label}>{label(change.entity_type || change.entity || 'record')}: {String(change.after?.name || change.before?.name || change.entity_id || change.id)}</p>
    <dl className="space-y-2 mt-2">{Object.keys({ ...change.before, ...change.after }).filter(key => !hidden.has(key) && JSON.stringify(change.before?.[key]) !== JSON.stringify(change.after?.[key])).map(key => <div key={key} className="break-words text-ui-12">
      <dt className="text-tea-text-dim capitalize">{label(key)}</dt><dd>{valueText(change.before?.[key])} → {valueText(change.after?.[key])}</dd>
    </div>)}</dl>
  </div>)}</div>;
}
function PrivateImagePreview({ id, filename }: { id: string; filename: string }) {
  const alive=useRef(true);
  useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
  const [url,setUrl]=useState(''); const [error,setError]=useState(''); const [loading,setLoading]=useState(false);
  useEffect(()=>()=>{if(url)URL.revokeObjectURL(url);},[url]);
  const preview=async()=>{setLoading(true);setError('');try {const blob=await api.curateWorkspace.attachmentBlob(id);if(alive.current)setUrl(URL.createObjectURL(blob));} catch {setError('Could not open this photo. Try again.');} finally {setLoading(false);}};
  return <div className="w-full min-w-0">{url ? <><img src={url} alt={filename} className="max-h-72 max-w-full rounded-md object-contain" /><button type="button" className="tap-target text-ui-12 mt-2" onClick={()=>setUrl('')}>Hide photo</button></> : <button type="button" className="tap-target text-ui-12 text-tea-gold" disabled={loading} onClick={()=>void preview()}>{loading?'Opening photo…':'View photo'}</button>}{error&&<p role="alert" className="text-ui-12">{error}</p>}</div>;
}
export function CurateRecordTools(props: Props) {
  const accountId = useAppStore(state => state.activeAccountId);
  return <RecordToolsInner key={`${accountId}:${props.entityType}:${props.entityId}`} {...props} />;
}
function RecordToolsInner({ entityType, entityId, onChanged }: Props) {
  const [attachments, setAttachments] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [role, setRole] = useState('source_document');
  const [file, setFile] = useState<File | null>(null);
  const [pending, setPending] = useState<{ kind: 'upload'|'correct'|'undo'; input: Record<string, unknown>; token: string; preview: any } | null>(null);
  const confirmationRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (pending) confirmationRef.current?.scrollIntoView({ block: 'center' }); }, [pending]);
  const refresh = useCallback(async () => {
    const [files, changes] = await Promise.all([api.curateWorkspace.attachments(entityType,entityId), api.curateWorkspace.history(entityType,entityId)]);
    setAttachments(files); setHistory(changes.history || []);
  }, [entityType,entityId]);
  useEffect(() => { setPending(null); setFile(null); setError(''); void refresh().catch(e => setError(e.message)); }, [refresh]);
  const perform = async (action: () => Promise<void>) => { setBusy(true);setError('');try { await action(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } };
  const previewUpload = () => perform(async () => {
    if (!file) throw new Error('Choose a photo or document first.');
    if (file.size > 6*1024*1024) throw new Error('Choose a file no larger than 6 MiB.');
    const data = await new Promise<string>((resolve,reject) => { const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=()=>reject(new Error('Could not read this file.'));reader.readAsDataURL(file); });
    const input={entity_type:entityType,entity_id:entityId,role,filename:file.name,mime_type:file.type,data_base64:data};
    const result=await api.curateWorkspace.upload(input);
    if(!result.confirmation_token) throw new Error(result.message||result.error||'Could not preview attachment.');
    setPending({kind:'upload',input,token:result.confirmation_token,preview:result.preview});
  });
  const previewRemove = (id: string) => perform(async () => {
    const input={entity:'attachment',action:'delete',id}; const result=await api.curateWorkspace.correct(input);
    if(!result.confirmation_token) throw new Error(result.message||result.error||'Could not preview removal.');
    setPending({kind:'correct',input,token:result.confirmation_token,preview:result.preview});
  });
  const previewUndo = (mutationId?: string) => perform(async () => {
    const result=await api.curateWorkspace.undo(undefined,mutationId);
    if(!result.confirmation_token) throw new Error(result.message||result.error||'Could not preview undo.');
    setPending({kind:'undo',input:{mutation_id:mutationId},token:result.confirmation_token,preview:result.preview});
  });
  const confirm = () => perform(async () => {
    if(!pending) return;
    const result=pending.kind==='upload' ? await api.curateWorkspace.upload({...pending.input,confirm:pending.token}) : pending.kind==='undo' ? await api.curateWorkspace.undo(pending.token) : await api.curateWorkspace.correct(pending.input,pending.token);
    if(!result.confirmed) { setPending(null);throw new Error(result.message||result.error||'The record changed. Preview again.'); }
    setPending(null);setFile(null);await refresh();onChanged?.();
  });
  const download = (attachment: any) => perform(async () => {
    const blob=await api.curateWorkspace.attachmentBlob(attachment.id);const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=attachment.filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  });
  return <section className="space-y-4 min-w-0 text-tea-text" aria-label="Files and change history">
    <div className="border-t border-tea-border pt-4 space-y-3">
      <h3 className={T.h3}>Photos &amp; source documents</h3>
      <p className={`${T.body} text-tea-text-dim`}>Private to your shop. JPEG, PNG, WebP or PDF, up to 6 MiB.</p>
      {attachments.map(a => <div key={a.id} className="flex flex-wrap items-center gap-3 border border-tea-border rounded-md p-3 min-w-0">
        <button type="button" disabled={busy} className="tap-target text-left text-tea-gold break-all flex-1" onClick={()=>void download(a)}>{a.filename}<span className="block text-ui-11 text-tea-text-dim">{roles[a.role as keyof typeof roles]||a.role}</span></button>
        <button type="button" disabled={busy} className="tap-target text-ui-12" onClick={()=>void previewRemove(a.id)}>Remove</button>
        {a.mime_type?.startsWith('image/') && <PrivateImagePreview key={a.id} id={a.id} filename={a.filename} />}
      </div>)}
      <div className="flex flex-wrap gap-3 items-center">
        <label className={`${T.label} min-w-0 flex-1`}>Choose file<input className="block mt-2 w-full min-w-0 text-ui-12" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" disabled={busy||!!pending} onChange={e=>setFile(e.target.files?.[0]||null)} /></label>
        <label className={T.label}>Role<select aria-label="Attachment role" className="block min-h-11 bg-tea-surface border border-tea-border rounded-md px-2 mt-2" value={role} disabled={busy||!!pending} onChange={e=>setRole(e.target.value)}>{Object.entries(roles).filter(([key])=>key!=='businesscard'||entityType==='vendor').map(([key,name])=><option key={key} value={key}>{name}</option>)}</select></label>
        <button type="button" className="min-h-11 px-3 border border-tea-border rounded-md" disabled={busy||!file||!!pending} onClick={()=>void previewUpload()}>Preview attachment</button>
      </div>
    </div>
    {pending && <div ref={confirmationRef} className="bg-tea-elevated border border-tea-border rounded-md p-4 space-y-3" role="region" aria-label="Confirm change">
      <h3 className={T.h3}>{pending.kind==='upload'?'Attach this file?':pending.kind==='undo'?(pending.input.mutation_id?'Undo this change?':'Undo the last shop change?'):'Remove this attachment?'}</h3>
      {pending.kind==='upload' ? <p className={`${T.body} break-all`}>{pending.preview.filename} · {roles[pending.preview.role as keyof typeof roles]} · {Math.ceil(pending.preview.size_bytes/1024)} KB</p> : <CurateChangePreview changes={pending.preview.changes||[]} />}
      <div className="flex flex-wrap gap-3"><button type="button" className="min-h-11 px-4" disabled={busy} onClick={()=>setPending(null)}>Cancel</button><button type="button" className="cta-solid min-h-11 px-4 rounded-md" disabled={busy} onClick={()=>void confirm()}>Confirm change</button></div>
    </div>}
    {error && <p role="alert" className={`${T.body} text-tea-text`}>{error}</p>}
    <details className="border-t border-tea-border pt-3">
      <summary className={`${T.label} cursor-pointer min-h-11`}>Change history ({history.length})</summary>
      <p className="text-ui-12 text-tea-text-dim mb-3">Choose a recorded change to review its undo. Later edits to the affected records are protected.</p>
      <button type="button" className="min-h-11 px-3 border border-tea-border rounded-md mb-4" disabled={busy||!!pending} onClick={()=>void previewUndo()}>Preview undo of last shop change</button>
      <div className="space-y-4">{history.map(h=><article key={h.id} className="space-y-2"><div className="flex flex-wrap items-center justify-between gap-2"><p className={T.label}>{h.agent_name||h.actor_user_id} · {new Date(h.confirmed_at).toLocaleString()}</p>{h.undone_by ? <span className={T.label}>Undone</span> : !h.undo_of && !String(h.command_type).endsWith(':with_side_effects') && <button type="button" className="tap-target text-ui-12" disabled={busy||!!pending} onClick={()=>void previewUndo(h.id)}>Preview undo</button>}</div><CurateChangePreview changes={(h.records||[]).map((r:any)=>({entity_type:r.entity_type,entity_id:r.entity_id,before:JSON.parse(r.before_json),after:JSON.parse(r.after_json)}))} /></article>)}</div>
    </details>
  </section>;
}

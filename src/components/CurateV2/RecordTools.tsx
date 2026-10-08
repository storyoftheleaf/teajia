import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../../lib/api';
import { useAppStore } from '../../lib/store';

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
function ChangePreview({ changes }: { changes: Change[] }) {
  return <div className="space-y-3">{changes.map((change, i) => <div key={i} className="min-w-0 rounded-[3px] border border-tea-border p-3">
    <p className="curate-v2-label">{label(change.entity_type || change.entity || 'record')}: {String(change.after?.name || change.before?.name || change.entity_id || change.id)}</p>
    <dl className="space-y-2 mt-2">{Object.keys({ ...change.before, ...change.after }).filter(key => !hidden.has(key) && JSON.stringify(change.before?.[key]) !== JSON.stringify(change.after?.[key])).map(key => <div key={key} className="break-words text-ui-12">
      <dt className="capitalize text-tea-text-sec">{label(key)}</dt><dd className="font-mono">{valueText(change.before?.[key])} → {valueText(change.after?.[key])}</dd>
    </div>)}</dl>
  </div>)}</div>;
}
function PrivateImagePreview({ id, filename }: { id: string; filename: string }) {
  const alive=useRef(true);
  useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
  const [url,setUrl]=useState(''); const [error,setError]=useState(''); const [loading,setLoading]=useState(false);
  useEffect(()=>()=>{if(url)URL.revokeObjectURL(url);},[url]);
  const preview=async()=>{setLoading(true);setError('');try {const blob=await api.curateWorkspace.attachmentBlob(id);if(alive.current)setUrl(URL.createObjectURL(blob));} catch {setError('Could not open this photo. Try again.');} finally {setLoading(false);}};
  return <div className="w-full min-w-0">{url ? <><img src={url} alt={filename} className="max-h-72 max-w-full rounded-[3px] object-contain" /><button type="button" className="curate-v2-word tap-target mt-2" onClick={()=>setUrl('')}>Hide photo</button></> : <button type="button" className="curate-v2-word tap-target" disabled={loading} onClick={()=>void preview()}>{loading?'Opening photo…':'View photo'}</button>}{error&&<p role="alert" className="text-ui-13 text-tea-text-sec">{error}</p>}</div>;
}
export function RecordTools(props: Props) {
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
  const previewUndo = () => perform(async () => {
    const result=await api.curateWorkspace.undo();
    if(!result.confirmation_token) throw new Error(result.message||result.error||'Could not preview undo.');
    setPending({kind:'undo',input:{},token:result.confirmation_token,preview:result.preview});
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
  return <section className="curate-v2 min-w-0 text-tea-text" aria-label="Files and change history">
    <div className="curate-v2-heading"><h3>Photos &amp; source documents</h3></div>
    <div className="space-y-3 px-4 pt-3">
      <p className="font-body text-ui-14 italic leading-relaxed text-tea-text-sec">Private to your shop. JPEG, PNG, WebP or PDF, up to 6 MiB.</p>
      {attachments.map(a => <div key={a.id} className="flex min-w-0 flex-wrap items-center gap-3 rounded-[3px] border border-tea-border p-3">
        <button type="button" disabled={busy} className="tap-target min-w-0 flex-1 break-all text-left font-display text-ui-17 text-tea-gold" onClick={()=>void download(a)}>{a.filename}<span className="curate-v2-label block">{roles[a.role as keyof typeof roles]||a.role}</span></button>
        <button type="button" disabled={busy} className="curate-v2-word tap-target" onClick={()=>void previewRemove(a.id)}>Remove</button>
        {a.mime_type?.startsWith('image/') && <PrivateImagePreview key={a.id} id={a.id} filename={a.filename} />}
      </div>)}
    </div>
    <label className="curate-v2-line mt-3 border-t border-tea-border"><span className="curate-v2-label">Choose file</span><input className="min-w-0 flex-1 text-right font-mono text-ui-12 text-tea-text-sec" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" disabled={busy||!!pending} onChange={e=>setFile(e.target.files?.[0]||null)} /></label>
    <label className="curate-v2-line"><span className="curate-v2-label">Role</span><select aria-label="Attachment role" className="curate-v2-select flex-1" value={role} disabled={busy||!!pending} onChange={e=>setRole(e.target.value)}>{Object.entries(roles).filter(([key])=>key!=='businesscard'||entityType==='vendor').map(([key,name])=><option key={key} value={key}>{name}</option>)}</select></label>
    <div className="px-4 pt-3"><button type="button" className="curate-v2-frame is-tall" disabled={busy||!file||!!pending} onClick={()=>void previewUpload()}>Preview attachment</button></div>
    {pending && <div className="mx-4 mt-4 space-y-3 rounded-[3px] border border-tea-gold p-4" role="region" aria-label="Confirm change">
      <h3 className="font-display text-ui-20 text-tea-text">{pending.kind==='upload'?'Attach this file?':pending.kind==='undo'?'Undo the last shop change?':'Remove this attachment?'}</h3>
      {pending.kind==='upload' ? <p className="break-all font-mono text-ui-13">{pending.preview.filename} · {roles[pending.preview.role as keyof typeof roles]} · {Math.ceil(pending.preview.size_bytes/1024)} KB</p> : <ChangePreview changes={pending.preview.changes||[]} />}
      <div className="flex flex-wrap justify-between gap-3"><button type="button" className="curate-v2-word tap-target text-tea-text-sec" disabled={busy} onClick={()=>setPending(null)}>Cancel</button><button type="button" className="curate-v2-frame is-on is-tall" disabled={busy} onClick={()=>void confirm()}>Confirm change</button></div>
    </div>}
    {error && <p role="alert" className="px-4 pt-3 text-ui-14 text-tea-text">{error}</p>}
    <details className="mt-3 border-t border-tea-border px-4 pt-1">
      <summary className="curate-v2-label flex min-h-11 cursor-pointer items-center">Change history ({history.length})</summary>
      <p className="mb-3 font-body text-ui-14 italic text-tea-text-sec">Recorded changes since this feature was added. Undo previews the latest confirmed change across the shop.</p>
      <button type="button" className="curate-v2-frame is-tall mb-4" disabled={busy||!!pending} onClick={()=>void previewUndo()}>Preview undo of last shop change</button>
      <div className="space-y-4 pb-3">{history.map(h=><article key={h.id} className="space-y-2"><p className="curate-v2-label">{h.agent_name||h.actor_user_id} · {new Date(h.confirmed_at).toLocaleString()}</p><ChangePreview changes={(h.records||[]).map((r:any)=>({entity_type:r.entity_type,entity_id:r.entity_id,before:JSON.parse(r.before_json),after:JSON.parse(r.after_json)}))} /></article>)}</div>
    </details>
  </section>;
}

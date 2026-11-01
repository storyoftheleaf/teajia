import { Check, X, Trash2 } from 'lucide-react';
import { useAppStore } from '../../../../lib/store';
import type { CustomerTasting } from '../../../../types';
import React, { useRef, useState } from 'react';
import { BottomSheet } from '../../../../components/shared/BottomSheet';
import { TYPOGRAPHY_CLASSES as T } from '../../../../designTokens';
import { enteredYear } from '../../../enteredYear';
import { enteredNumber } from '../../../productUpdatePayload';
import { effectivePurpose } from '../domain';
import type { Product } from '../../../types';

export type SaveField = (field: keyof Product, value: unknown) => Promise<void>;
export type MiniField = 'productName' | 'givenName' | 'year' | 'fixedRetailPriceUSD' | 'costAmount';
const labels: Record<MiniField,string> = { productName:'Tea name',givenName:'Given name',year:'Year / vintage',fixedRetailPriceUSD:'Retail · USD per gram',costAmount:'Purchase cost' };
export function MiniEditSheet({ product, field, onSave, onClose }: {product:Product;field:MiniField;onSave:SaveField;onClose:()=>void}) {
  const original=product[field];
  const label=field==='fixedRetailPriceUSD'&&product.type==='Teaware'?'Retail · USD per piece':labels[field];
  const [value,setValue]=useState(original == null || original==='Unnamed' || (field==='givenName' && String(original).trim()===product.productName?.trim()) ? '' : String(original));
  const [saving,setSaving]=useState(false),[error,setError]=useState('');
  const savingRef=useRef(false);
  const numeric=field==='fixedRetailPriceUSD'||field==='costAmount';
  const help=field==='productName'?'Edit the original name on this same record.':field==='givenName'?'Your chosen name for this tea. The original tea name stays unchanged.':field==='year'?'An exact year or an approximate decade, for example 1998 or 1980s. Clear to leave it unknown.':field==='fixedRetailPriceUSD'?`A fixed retail override in USD per ${product.type==='Teaware'?'piece':'gram'}. Clear to return to calculated retail. A typed zero is an explicit zero price.`:`Total purchase cost in ${product.costCurrency || 'USD'}.`;
  async function save(){
    if(savingRef.current)return;
    setError('');
    try{
      if(field==='productName'&&!value.trim())throw new Error('Enter a name.');
      const next=field==='year'?enteredYear(value):numeric?enteredNumber(value):value.trim();
      if(numeric && value.trim()!=='' && (next===null || Number(next)<0))throw new Error('Enter zero or a positive number.');
      savingRef.current=true;setSaving(true);await onSave(field,next);onClose();
    }catch(e){setError(e instanceof Error?e.message:'Could not save. Try again.')}finally{savingRef.current=false;setSaving(false)}
  }
  return <BottomSheet open onOpenChange={open=>{if(!open&&!savingRef.current)onClose()}} title={label} description={product.productName}><div className="stock-mini-sheet space-y-3 px-2 pb-3">
    <p className={`${T.link} text-tea-text-sec`}>{help}</p>
    <label className={`${T.label} block text-tea-text-dim`} htmlFor="stock-mini-value">{label}</label>
    <input id="stock-mini-value" aria-label={label} type={numeric?'number':'text'} inputMode={numeric?'decimal':field==='year'?'text':undefined} value={value} disabled={saving} onChange={e=>setValue(e.target.value)} className="w-full min-h-11 rounded-md border border-tea-border bg-tea-surface px-3 text-ui-16 text-tea-text focus:border-tea-gold focus:outline-none"/>
    {error&&<p role="alert" className={`${T.link} text-tea-text-sec`}>{error}</p>}
    <button type="button" disabled={saving} onClick={save} className={`${T.nav} cta-solid min-h-11 rounded-md w-full px-3 py-3 disabled:opacity-50`}>{saving?'Saving…':'Save'}</button>
  </div></BottomSheet>
}

function DetailTextField({label, value, field, onSave}:{label:string;value?:string;field:keyof Product;onSave:SaveField}) {
 const [editing,setEditing]=useState(false),[draft,setDraft]=useState(''),[saving,setSaving]=useState(false),[error,setError]=useState('');
 const pending=useRef(false);
 async function save(){if(pending.current)return;pending.current=true;setSaving(true);setError('');try{await onSave(field,draft.trim());setEditing(false)}catch(e){setError(e instanceof Error?e.message:'Could not save.')}finally{pending.current=false;setSaving(false)}}
 return <div className="border-b border-tea-border py-1"><div className="flex items-center justify-between gap-3 min-h-11"><dt className={`${T.label} shrink-0 text-tea-text-dim`}>{label}</dt><dd className="min-w-0 flex-1">
 {editing?<form className="flex items-center gap-1" onSubmit={event=>{event.preventDefault();void save()}}><input autoFocus aria-label={label} value={draft} disabled={saving} onChange={e=>setDraft(e.target.value)} onKeyDown={e=>{if(e.key==='Escape'&&!saving)setEditing(false)}} className="min-w-0 w-full min-h-11 rounded border border-tea-border bg-tea-surface px-2 text-ui-16 text-tea-text"/><button aria-label={`Save ${label}`} disabled={saving} className="tap-target shrink-0 p-2 text-tea-text" type="submit"><Check size={16}/></button><button aria-label={`Cancel ${label}`} disabled={saving} className="tap-target shrink-0 p-2 text-tea-text-sec" type="button" onClick={()=>setEditing(false)}><X size={16}/></button></form>:<button type="button" aria-label={`Edit ${label}`} onClick={()=>{setDraft(value||'');setError('');setEditing(true)}} className={`${T.link} min-h-11 w-full text-right text-tea-text break-words`}>{value||'Add'}</button>}
 </dd></div>{error&&<p role="alert" className={`${T.link} text-tea-text-sec`}>{error}</p>}</div>;
}

const date=(value?:string|null)=>value?new Date(value).toLocaleDateString(undefined,{day:'numeric',month:'short',year:'numeric'}):'Not yet verified';
export function MiniMoreSheet({product,journal,place,onClose,onEdit,onDelete,onHistory,onJournal,onFreight,onForm,onTaste,onCount,freightUsd,onSave}:{product:Product;journal?:CustomerTasting;place:string;onClose:()=>void;onEdit:()=>void;onDelete:()=>void;onHistory:()=>void;onJournal:()=>void;onFreight:()=>void;onForm:()=>void;onTaste:()=>void;onCount:(trigger:HTMLElement)=>void;freightUsd:number|null;onSave:SaveField}){
 const activeUser=useAppStore(state=>state.activeUserId);
 const [saving,setSaving]=useState(false),[error,setError]=useState('');
  const savingRef=useRef(false);
 async function purpose(value:string){if(savingRef.current)return;savingRef.current=true;setSaving(true);setError('');try{await onSave('inventoryPurpose',value)}catch(e){setError(e instanceof Error?e.message:'Could not save purpose.')}finally{savingRef.current=false;setSaving(false)}}
 const row=(label:string,value:React.ReactNode,action?:(element:HTMLElement)=>void)=><div className="flex items-center justify-between gap-3 border-b border-tea-border py-1"><dt className={`${T.label} text-tea-text-dim`}>{label}</dt><dd className={`${T.link} min-w-0 text-tea-text text-right`}>{action?<button type="button" disabled={saving} aria-label={`Edit ${label}`} onClick={event=>action(event.currentTarget)} className="min-h-11 text-right">{value||'Add'}</button>:value}</dd></div>;
 return <BottomSheet open onOpenChange={open=>{if(!open&&!savingRef.current)onClose()}} title="Tea details" description={product.productName}><div className="stock-mini-sheet px-2 pb-3 space-y-3">
 <dl>
 {row('Current shop',place)}
 {row('Last counted',date(product.stockVerifiedAt||product.stockKnownAt),onCount)}
 {row('Stock confidence',product.recheckStock?'Needs recount':product.stockKnownAt||product.stockVerifiedAt?'Recorded':'Count not verified',onCount)}
 {row('Owner',product.ownerUserId?product.ownerUserId===activeUser?'You':'Member-owned':'Shop-owned',onEdit)}
 {row('Last tasted',journal?date(journal.tastings.at(-1)?.createdAt||journal.createdAt):'Not recorded',onTaste)}
 {row('Your verdict',journal?.note.verdict,onTaste)}
 {row('Your rating',journal?.note.rating!=null?String(journal.note.rating):null,onTaste)}
 {([['Tea name','productName'],['Given name','givenName'],['Chinese name','chineseName'],['Country','originCountry'],['Region','originRegion'],['Source','vendor']] as const).map(([label,field])=><DetailTextField key={field} label={label} value={product[field]||''} field={field} onSave={onSave}/>)}
 {row('Type',product.type,onForm)}{row('Form',product.form,onForm)}
 {row('One piece',product.pieceWeightG?`${product.pieceWeightG} g`:null,onForm)}
 {product.inTransit&&row('Incoming',`${product.inTransitGrams??'—'} g${product.inTransitEta?' · '+date(product.inTransitEta):''}`,onEdit)}
 {row('Restockable',product.canReorder?'Yes':'No',()=>{if(savingRef.current)return;savingRef.current=true;setSaving(true);setError('');void onSave('canReorder',!product.canReorder).catch(e=>setError(e instanceof Error?e.message:'Could not save.')).finally(()=>{savingRef.current=false;setSaving(false)})})}
 </dl>
 <fieldset disabled={saving}><legend className={`${T.label} mb-2 text-tea-text-dim`}>Purpose</legend><div className="grid grid-cols-3 gap-1">{(['working','sample','personal'] as const).map(v=><button type="button" key={v} aria-pressed={effectivePurpose(product)===v} onClick={()=>{void purpose(v)}} className={`${T.link} min-h-11 rounded-md border border-tea-border px-2 ${effectivePurpose(product)===v?'bg-tea-accent-sub text-tea-text':'text-tea-text-sec'}`}>{v==='working'?'Shop stock':v==='sample'?'Sample':'Personal'}</button>)}</div></fieldset>
 {error&&<p role="alert" className={`${T.link} text-tea-text-sec`}>{error}</p>}
 <div className="grid grid-cols-2 gap-2">{[[`Freight ${product.type==='Teaware'?'included':freightUsd==null?'—':'$'+freightUsd.toFixed(2)+'/kg'}`,onFreight],['Stock history',onHistory],['Personal journal',onJournal],['Full editor',onEdit]].map(([label,action])=><button type="button" key={label as string} disabled={saving} onClick={action as ()=>void} className={`${T.link} min-h-11 rounded-md border border-tea-border bg-tea-surface px-2 text-tea-text`}>{label as string}</button>)}</div>
 <button type="button" disabled={saving} onClick={onDelete} className={`${T.link} flex items-center justify-center gap-2 min-h-11 w-full rounded-md border border-tea-border bg-tea-surface text-tea-text-sec hover:text-tea-text`}><Trash2 size={16} aria-hidden="true"/>Delete {product.type==='Teaware'?'item':'tea'}</button>
 <p className={`${T.link} text-tea-text-sec`}>The full editor keeps pricing, brewing and tasting profiles, linked writing, shop visibility, collections and sales tools available.</p>
 </div></BottomSheet>
}

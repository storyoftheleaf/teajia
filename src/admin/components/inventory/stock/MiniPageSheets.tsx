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
const date=(value?:string|null)=>value?new Date(value).toLocaleDateString(undefined,{day:'numeric',month:'short',year:'numeric'}):'Not yet verified';
export function MiniMoreSheet({product,journal,place,onClose,onEdit,onHistory,onJournal,onFreight,freightUsd,onSave}:{product:Product;journal?:CustomerTasting;place:string;onClose:()=>void;onEdit:()=>void;onHistory:()=>void;onJournal:()=>void;onFreight:()=>void;freightUsd:number|null;onSave:SaveField}){
 const activeUser=useAppStore(state=>state.activeUserId);
 const [saving,setSaving]=useState(false),[error,setError]=useState('');
  const savingRef=useRef(false);
 async function purpose(value:string){if(savingRef.current)return;savingRef.current=true;setSaving(true);setError('');try{await onSave('inventoryPurpose',value)}catch(e){setError(e instanceof Error?e.message:'Could not save purpose.')}finally{savingRef.current=false;setSaving(false)}}
 const row=(label:string,value:React.ReactNode)=>value?<div className="flex flex-wrap justify-between gap-2 border-b border-tea-border py-2"><dt className={`${T.label} text-tea-text-dim`}>{label}</dt><dd className={`${T.link} text-tea-text text-right`}>{value}</dd></div>:null;
 return <BottomSheet open onOpenChange={open=>{if(!open&&!savingRef.current)onClose()}} title="Tea details" description={product.productName}><div className="stock-mini-sheet px-2 pb-3 space-y-3">
 <dl>{row('Current shop',place)}{row('Last counted',date(product.stockVerifiedAt||product.stockKnownAt))}{row('Stock confidence',product.recheckStock?'Needs recount':product.stockKnownAt||product.stockVerifiedAt?'Recorded':'Count not verified')}{row('Owner',product.ownerUserId?product.ownerUserId===activeUser?'You':'Member-owned':'Shop-owned')}{row('Last tasted',journal?date(journal.tastings.at(-1)?.createdAt||journal.createdAt):'Not recorded')}{row('Your verdict',journal?.note.verdict)}{row('Your rating',journal?.note.rating!=null?String(journal.note.rating):null)}{row('Chinese name',product.chineseName)}{row('Origin',[product.originRegion,product.originCountry].filter(Boolean).join(' · '))}{row('Source',product.vendor)}{row('Form',product.form)}{row('One piece',product.pieceWeightG?`${product.pieceWeightG} g${product.soldInWholeUnits?' · whole units only':''}`:null)}{row('Incoming',product.inTransit?`${product.inTransitGrams??'—'} g${product.inTransitEta?' · '+date(product.inTransitEta):''}`:null)}{row('Restockable',product.canReorder?'Yes':null)}</dl>
 <fieldset disabled={saving}><legend className={`${T.label} mb-2 text-tea-text-dim`}>Purpose</legend><div className="grid grid-cols-3 gap-1">{(['working','sample','personal'] as const).map(v=><button type="button" key={v} aria-pressed={effectivePurpose(product)===v} onClick={()=>{void purpose(v)}} className={`${T.link} min-h-11 rounded-md border border-tea-border px-2 ${effectivePurpose(product)===v?'bg-tea-accent-sub text-tea-text':'text-tea-text-sec'}`}>{v==='working'?'Shop stock':v==='sample'?'Sample':'Personal'}</button>)}</div></fieldset>
 {error&&<p role="alert" className={`${T.link} text-tea-text-sec`}>{error}</p>}
 <div className="grid grid-cols-2 gap-2">{[[`Freight ${product.type==='Teaware'?'included':freightUsd==null?'—':'$'+freightUsd.toFixed(2)+'/kg'}`,onFreight],['Stock history',onHistory],['Personal journal',onJournal],['Full editor',onEdit]].map(([label,action])=><button type="button" key={label as string} disabled={saving} onClick={action as ()=>void} className={`${T.link} min-h-11 rounded-md border border-tea-border bg-tea-surface px-2 text-tea-text`}>{label as string}</button>)}</div>
 <p className={`${T.link} text-tea-text-sec`}>The full editor keeps pricing, brewing and tasting profiles, linked writing, shop visibility, collections and sales tools available.</p>
 </div></BottomSheet>
}

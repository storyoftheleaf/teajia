import React, { useState, useSyncExternalStore } from 'react';
import { Camera, MoreHorizontal } from 'lucide-react';
import { TYPOGRAPHY_CLASSES as T } from '../../../../designTokens';
import { useAppStore } from '../../../../lib/store';
import { getStockTypeFinish } from '../../../themeUtils';
import { fmtNum } from '../../../../utils/formatNumber';
import { GhostInput } from '../../../../admin/components/ProductEditPanel';
import type { Product } from '../../../../admin/types';
import { FormPricingSheet, type SaveFormPricing } from './FormPricingSheet';
import { FreightSheet } from './FreightSheet';
import { QuickPhotoSheet } from './QuickPhotoSheet';
import { MiniEditSheet, MiniMoreSheet, type MiniField, type SaveField } from './MiniPageSheets';

export interface StockField { key:string;label:string;content:React.ReactNode;className:string;id?:string }
const phone=window.matchMedia('(max-width:767px)');
const subscribe=(notify:()=>void)=>{phone.addEventListener('change',notify);return()=>phone.removeEventListener('change',notify)};
export function useStockPhone(){return useSyncExternalStore(subscribe,()=>phone.matches)}
type Panel='form'|'freight'|'photos'|'more'|MiniField|null;
export function StockMobileRecord({product,name,fields,editing,index,onEdit,onUpdate,onSaveChange,onTaste,onJournal,onHistory,freightUsd,onSavePricing,onStockChange,onDelete}:{
 product:Product;name:string;fields:StockField[];editing:boolean;index:number;onEdit:()=>void;onUpdate:(value:string)=>void;
 onDelete:()=>void;onStockChange:(trigger:HTMLElement)=>void;onSavePricing:SaveFormPricing;onSaveChange:SaveField;onTaste:()=>void;onJournal:()=>void;onHistory:()=>void;freightUsd:number|null;
}){
 const studyParams = import.meta.env.DEV ? new URLSearchParams(window.location.search) : undefined;
 // Fine metalwork is the normal Stock finish; alternative finishes are local studies.
 const polish = Number(studyParams?.get('cardPolish') ?? (studyParams?.has('cardStudy') ? '0' : '4'));
 const polishVariant = polish >= 1 && polish <= 4 ? String(polish) : undefined;
 const study = polishVariant ? 2 : Number(studyParams?.get('cardStudy'));
 const studyVariant = study >= 1 && study <= 5 ? String(study) : undefined;
 const finish = studyVariant ? getStockTypeFinish(product.type) : undefined;
 const groupBy=useAppStore(s=>s.inventoryGroupBy);
 const place=useAppStore(s=>s.memberships.find(m=>m.account_id===s.activeAccountId)?.account_name||s.activeAccount?.name||'Current shop');
 const journal=useAppStore(s=>s.tastingJournal.find(e=>!e.archived&&e.productId===product.id&&e.accountId===s.activeAccountId));
 const [panel,setPanel]=useState<Panel>(null);
 const corePrice=fields.find(f=>f.key==='pricePerGramUSD')||fields.find(f=>f.key==='costPerGramUSD')||fields.find(f=>f.key==='costAmount');
 const stock=fields.find(f=>f.key==='stockGrams'||f.key==='quantityUnits');
 const metrics=[stock,corePrice].filter(Boolean) as StockField[];
 const details=fields.filter(f=>!(groupBy==='vendor'&&f.key==='vendor')&&!['productName','type','year','shippingRatePerKg',...metrics.map(m=>m.key)].includes(f.key));
 const sourceLabel=product.vendor?.trim() || [product.originRegion,product.originCountry].filter(Boolean).join(' · ') || 'Source not set';
 const houseName=product.givenName?.trim();
 const distinctName=houseName&&houseName!=='Unnamed'&&houseName!==product.productName?.trim();
 const field=(f:StockField)=><span key={f.key} id={f.id} data-field={f.key} className={`stock-field ${f.className}`}>{f.content}</span>;
 const open=(next:Panel)=>(e:React.MouseEvent)=>{e.stopPropagation();setPanel(next)};
 const leave=(action:()=>void)=>()=>{setPanel(null);action()};
 const metricLabel=(f:StockField)=>f.key==='stockGrams'?'Stock · g':f.key==='quantityUnits'?'Units':f.key==='pricePerGramUSD'?(product.type==='Teaware'?'Retail / unit':'Retail / g'):f.key==='costPerGramUSD'?'Cost / g':f.label;
 const reference=(value:React.ReactNode,label:string)=><><span className="stock-number">{value}</span><span className="stock-caption" aria-hidden="true">{label}</span></>;

 return <article onPointerDown={e=>e.stopPropagation()} onClick={e=>e.stopPropagation()} className="stock-record stock-mini-workspace" aria-label={name} data-card-study={studyVariant} data-card-polish={polishVariant} style={finish ? { '--stock-tea-hue': finish.tint, '--stock-tea-label': finish.text, '--stock-strip-l': finish.lightness } as React.CSSProperties : undefined}>
  <header className="stock-identity">
   <div className="stock-title-line">
    <div className="stock-title" id={`cell-${index}-0`}>{editing?<GhostInput id={`ghost-${index}-0`} ariaLabel="Product name" value={name} onSave={onUpdate} className={T.h3}/>:<button type="button" className={`tap-target ${T.h3}`} title={name} aria-label={`Edit name for ${name}`} onClick={open('productName')}>{name}</button>}</div>
    <button type="button" className="tap-target stock-inline-edit stock-given-name" title={houseName||'Add given name'} aria-label={`Edit given name for ${name}`} onClick={open('givenName')}>{distinctName?houseName:'Name'}</button>
    <button type="button" className="tap-target stock-more-action" aria-label={`More details for ${name}`} onClick={open('more')}><MoreHorizontal size={15}/></button>
   </div>
   <div className="stock-subtitle">
    <button type="button" className="tap-target stock-inline-edit stock-source-label" aria-label={`Source for ${name}: ${sourceLabel}`} title={sourceLabel} onClick={open('more')}><span>{sourceLabel}</span></button>
    <button type="button" data-field="type" className="tap-target stock-inline-edit" aria-label={`Edit type for ${name}`} onClick={open('form')}><span>{product.type||'Choose type'}</span></button>
    <button type="button" className="tap-target stock-inline-edit stock-form-edit" aria-label={`Edit form and pricing for ${name}`} onClick={open('form')}>{String(product.form||'').startsWith('Loose')?'Loose leaf':product.form||'Choose form'}{product.pieceWeightG ? ` · ${product.pieceWeightG} g` : ''}</button>
   </div>
  </header>
  <div className="stock-details">{details.map(f=><div key={f.key} className="stock-detail" data-detail={f.key} title={f.label}><span className={`stock-detail-label ${T.label}`} data-kind={f.key}>{f.label}</span>{field(f)}</div>)}</div>
  <div className="stock-workbar">
   <dl className="stock-figures" aria-label="Stock and pricing">
    <div className="stock-figure stock-year-figure"><dt className={T.label}>Year</dt><dd><button type="button" className="tap-target" aria-label={`Edit year in figures for ${name}`} onClick={open('year')}>{reference(product.year??'Add','Year')}</button></dd></div>
    {metrics.map(f=><div className="stock-figure" key={f.key}>
     <dt className={T.label}>{metricLabel(f)}</dt>
     <dd>{f.key==='pricePerGramUSD'
      ?<button type="button" className="tap-target stock-retail-edit" aria-label={`Edit retail price for ${name}`} onClick={open('fixedRetailPriceUSD')}>{reference(product.fixedRetailPriceUSD != null || product.pricePerGramUSD != null ? fmtNum(product.fixedRetailPriceUSD ?? product.pricePerGramUSD) : '\u2014',metricLabel(f))}</button>
      :f.key==='stockGrams'||f.key==='quantityUnits'
       ?<button type="button" className="tap-target stock-quantity-edit" aria-label={`Change stock for ${name}`} onClick={event=>{event.stopPropagation();onStockChange(event.currentTarget)}}>{reference(Math.round(f.key==='quantityUnits'?(product.quantityUnits??0):(product.stockGrams??0)),metricLabel(f))}</button>
       :<>{field(f)}<span className="stock-caption" aria-hidden="true">{metricLabel(f)}</span></>}
     </dd>
    </div>)}
   </dl>
   <div className="stock-quick-actions" onPointerDown={e=>e.stopPropagation()}>
    <button type="button" className="tap-target stock-camera-action" aria-label={`Photos for ${name}`} title="Take photo or open photo library" onClick={open('photos')}><Camera size={17}/></button>
    <button type="button" className="tap-target stock-tasting-action" aria-label={`${journal?'Edit':'Record'} tasting for ${name}`} onClick={e=>{e.stopPropagation();onTaste()}}><svg className="stock-tasting-icon" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 8h16c-.7 6-3.2 10-8 10S4.7 14 4 8Z"/><path d="M9 18v2h6v-2"/></svg><span className="stock-tasting-label">{journal?'Edit tasting':'Taste'}</span></button>
   </div>
  </div>
  <div className="contents" onClick={e=>e.stopPropagation()} onPointerDown={e=>e.stopPropagation()}>
   {panel==='form'&&<FormPricingSheet product={product} onSave={onSavePricing} onClose={()=>setPanel(null)}/>}
   {panel==='freight'&&<FreightSheet product={product} onSave={v=>onSaveChange('shippingRatePerKg',v)} onClose={()=>setPanel(null)}/>}
   {panel==='photos'&&<QuickPhotoSheet product={product} onSave={onSaveChange} onClose={()=>setPanel(null)}/>}
   {panel==='more'&&<MiniMoreSheet onDelete={leave(onDelete)} product={product} journal={journal} place={place} onClose={()=>setPanel(null)} onEdit={leave(onEdit)} onHistory={leave(onHistory)} onJournal={leave(onJournal)} onFreight={()=>setPanel('freight')} freightUsd={freightUsd} onSave={onSaveChange}/>}
   {(['productName','givenName','year','fixedRetailPriceUSD','costAmount'] as const).includes(panel as MiniField)&&<MiniEditSheet key={panel} product={product} field={panel as MiniField} onSave={onSaveChange} onClose={()=>setPanel(null)}/>}
  </div>
 </article>
}

import React, { useState } from 'react';
import { AlertCircle, Check, ChevronDown, ChevronUp } from 'lucide-react';
import type { CurateImportItem } from '../../../lib/api';
import { importBlockingMessage, withoutImportDerivedFields } from './importReviewDomain';

interface ImportItemRowProps {
  item: CurateImportItem;
  busy: boolean;
  onUpdate: (updates: Partial<CurateImportItem>) => Promise<boolean>;
}

const fieldClass = 'mt-1 min-h-11 w-full rounded-md border border-tea-border bg-tea-elevated px-3 text-ui-16 text-tea-text outline-none focus:border-tea-gold lg:text-ui-13';
const value = (input: unknown) => input == null ? '' : String(input);
const packEquation = (item: CurateImportItem) => {
  const pack = item.pack_weight && item.weight_unit ? `${item.pack_weight}${item.weight_unit}` : null;
  const count = item.pack_count ? `×${item.pack_count}` : null;
  const price = item.price_amount != null ? `${item.currency || ''} ${item.price_amount}${item.price_basis === 'per_pack' ? ' each' : ''}`.trim() : null;
  return [pack && [pack, count].filter(Boolean).join(' '), price].filter(Boolean).join(' · ') || 'Quantity or cost needs review';
};

export const ImportItemRow: React.FC<ImportItemRowProps> = ({ item, busy, onUpdate }) => {
  const [expanded, setExpanded] = useState(false);
  const blockerKeys = (item.blocking_fields || []).map(field => field.replace(/_/g, '').toLocaleLowerCase());
  const identityBlocked = blockerKeys.some(field => ['duplicateidentity', 'compassentryid', 'proposedcompassentryid'].includes(field));
  const productBlocked = blockerKeys.some(field => ['productid', 'proposedproductid', 'inventoryholding'].includes(field));
  const identityCandidates = Array.isArray(item.parsed_data?.identityCandidates) ? item.parsed_data.identityCandidates as Array<{ id: string; name?: string }> : [];
  const productCandidates = Array.isArray(item.parsed_data?.productCandidates) ? item.parsed_data.productCandidates as Array<{ id: string; name?: string }> : [];
  const [draft, setDraft] = useState({
    english_name: value(item.english_name || item.name), original_name: value(item.original_name),
    pack_weight: value(item.pack_weight), weight_unit: value(item.weight_unit), pack_count: value(item.pack_count),
    price_amount: value(item.price_amount), currency: value(item.currency), price_basis: value(item.price_basis || 'unknown'),
    tea_type: value(item.parsed_data?.teaType), classification: value(item.parsed_data?.classification), year: value(item.parsed_data?.year),
    form: value(item.parsed_data?.form), origin: value(item.parsed_data?.originRegion), description: value(item.parsed_data?.description),
    purpose: value(item.parsed_data?.inventoryPurpose), compass_entry_id: value(item.parsed_data?.compassEntryId || (!identityBlocked && item.proposed_compass_entry_id) || (!identityBlocked && 'new')),
    product_id: value(item.parsed_data?.productId || (!productBlocked && item.proposed_product_id) || (!productBlocked && 'new')),
    acquired: item.parsed_data?.acquiredIntoStock === true ? 'yes' : '',
  });
  const label = item.english_name || item.name || item.raw_text || `Item ${item.position + 1}`;
  const blocking = importBlockingMessage(item);
  const editLabel = item.category === 'tea' ? 'tea' : 'item';
  const set = (key: keyof typeof draft, next: string) => setDraft(current => ({ ...current, [key]: next }));
  const submit = async () => {
    const parsedValues = {
      ...withoutImportDerivedFields(item.parsed_data), teaType: draft.tea_type.trim() || null, classification: draft.classification.trim() || null,
      year: draft.year ? Number(draft.year) : null, form: draft.form.trim() || null, originRegion: draft.origin.trim() || null,
      description: draft.description.trim() || null, inventoryPurpose: draft.purpose || null,
      compassEntryId: draft.compass_entry_id || null, productId: draft.product_id || null, acquiredIntoStock: draft.acquired === 'yes',
      packWeight: draft.pack_weight ? Number(draft.pack_weight) : null, weightUnit: draft.weight_unit || null,
      packCount: draft.pack_count ? Number(draft.pack_count) : null, priceAmount: draft.price_amount ? Number(draft.price_amount) : null,
      currency: draft.currency.trim().toUpperCase() || null, priceBasis: draft.price_basis,
    };
    const updates: Partial<CurateImportItem> = {
      name: draft.english_name.trim() || null, english_name: draft.english_name.trim() || null, original_name: draft.original_name.trim() || null,
      pack_weight: draft.pack_weight ? Number(draft.pack_weight) : null, weight_unit: (draft.weight_unit || null) as CurateImportItem['weight_unit'],
      pack_count: draft.pack_count ? Number(draft.pack_count) : null, price_amount: draft.price_amount ? Number(draft.price_amount) : null,
      currency: draft.currency.trim().toUpperCase() || null, price_basis: draft.price_basis as CurateImportItem['price_basis'],
      parsed_data: parsedValues,
    };
    if (await onUpdate(updates)) setExpanded(false);
  };
  return (
    <article data-testid="import-item-row" className="py-2">
      <div className="flex min-w-0 items-start gap-2">
        <span className={`mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${blocking ? 'text-tea-gold' : 'bg-tea-accent-sub text-tea-gold'}`} aria-label={blocking ? 'Needs review' : 'Ready'}>{blocking ? <AlertCircle size={16} /> : <Check size={13} />}</span>
        <div className="min-w-0 flex-1">
          <p className="break-words text-ui-14 font-medium leading-snug text-tea-text">{label}</p>
          {item.original_name && <p className="break-words font-chinese text-ui-12 text-tea-text-sec">{item.original_name}</p>}
          <p className="mt-0.5 break-words font-mono text-ui-10 text-tea-text-dim">{packEquation(item)}{item.total_quantity_grams ? ` · ${item.total_quantity_grams}g total` : ''}{item.line_cost != null ? ` · ${item.currency || ''} ${item.line_cost}` : ''}</p>
          {blocking && <p role="alert" className="mt-1 text-ui-11 text-tea-gold">{blocking}</p>}
        </div>
        <button type="button" aria-expanded={expanded} onClick={() => setExpanded(open => !open)} className="tap-target flex min-h-11 shrink-0 items-center gap-1 text-ui-10 text-tea-text-sec hover:text-tea-text">{expanded ? 'Close editing' : `Edit ${editLabel}`}{expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}</button>
      </div>
      {expanded && (
        <div className="mt-3 space-y-3 border-l-2 border-tea-border pl-3">
          {item.raw_text && <div><p className="text-ui-10 uppercase tracking-[1.2px] text-tea-text-dim">Original evidence</p><p className="mt-1 break-words text-ui-12 text-tea-text-sec">{item.raw_text}</p></div>}
          <label className="block text-ui-11 text-tea-text-sec">English inventory name<input value={draft.english_name} onChange={event => set('english_name', event.target.value)} className={fieldClass} /></label>
          <label className="block text-ui-11 text-tea-text-sec">Original or Chinese name<input value={draft.original_name} onChange={event => set('original_name', event.target.value)} className={fieldClass} /></label>
          <label className="block text-ui-11 text-tea-text-sec">Tea type or classification<input value={draft.tea_type} onChange={event => set('tea_type', event.target.value)} className={fieldClass} /></label>
          <label className="block text-ui-11 text-tea-text-sec">Classification<input value={draft.classification} onChange={event => set('classification', event.target.value)} className={fieldClass} /></label>
          <label className="block text-ui-11 text-tea-text-sec">Year<input inputMode="numeric" value={draft.year} onChange={event => set('year', event.target.value)} className={fieldClass} /></label>
          <label className="block text-ui-11 text-tea-text-sec">Form<input value={draft.form} onChange={event => set('form', event.target.value)} placeholder="Cake, loose, brick…" className={fieldClass} /></label>
          <label className="block text-ui-11 text-tea-text-sec">Origin<input value={draft.origin} onChange={event => set('origin', event.target.value)} className={fieldClass} /></label>
          <label className="block text-ui-11 text-tea-text-sec">Description<textarea rows={3} value={draft.description} onChange={event => set('description', event.target.value)} className={`${fieldClass} py-2`} /></label>
          <label className="block text-ui-11 text-tea-text-sec">Pack weight<input inputMode="decimal" value={draft.pack_weight} onChange={event => set('pack_weight', event.target.value)} className={fieldClass} /></label>
          <label className="block text-ui-11 text-tea-text-sec">Weight unit<select value={draft.weight_unit} onChange={event => set('weight_unit', event.target.value)} className={fieldClass}><option value="">Choose unit</option><option value="g">g</option><option value="kg">kg</option><option value="count">count</option></select></label>
          <label className="block text-ui-11 text-tea-text-sec">Pack count<input inputMode="numeric" value={draft.pack_count} onChange={event => set('pack_count', event.target.value)} className={fieldClass} /></label>
          <label className="block text-ui-11 text-tea-text-sec">Price amount<input inputMode="decimal" value={draft.price_amount} onChange={event => set('price_amount', event.target.value)} className={fieldClass} /></label>
          <label className="block text-ui-11 text-tea-text-sec">Currency<input value={draft.currency} onChange={event => set('currency', event.target.value)} placeholder="CNY" className={fieldClass} /></label>
          <label className="block text-ui-11 text-tea-text-sec">Price interpretation<select value={draft.price_basis} onChange={event => set('price_basis', event.target.value)} className={fieldClass}><option value="unknown">Choose interpretation</option><option value="per_pack">Per pack</option><option value="line_total">Line total</option></select></label>
          <label className="block text-ui-11 text-tea-text-sec">Inventory purpose<select value={draft.purpose} onChange={event => set('purpose', event.target.value)} className={fieldClass}><option value="">Choose purpose</option><option value="working">Tea service</option><option value="personal">Personal collection</option><option value="sample">Sample</option></select></label>
          <label className="block text-ui-11 text-tea-text-sec">Compass tea identity<select value={draft.compass_entry_id} onChange={event => set('compass_entry_id', event.target.value)} className={fieldClass}><option value="">Choose identity resolution</option>{item.proposed_compass_entry_id && <option value={item.proposed_compass_entry_id}>Use proposed Compass match</option>}{identityCandidates.filter(candidate => candidate.id !== item.proposed_compass_entry_id).map(candidate => <option key={candidate.id} value={candidate.id}>Use {candidate.name || 'existing Compass identity'}</option>)}<option value="new">Create a new Compass identity</option></select></label>
          <label className="block text-ui-11 text-tea-text-sec">Inventory holding<select value={draft.product_id} onChange={event => set('product_id', event.target.value)} className={fieldClass}><option value="">Choose holding resolution</option>{item.proposed_product_id && <option value={item.proposed_product_id}>Use proposed Inventory holding</option>}{productCandidates.filter(candidate => candidate.id !== item.proposed_product_id).map(candidate => <option key={candidate.id} value={candidate.id}>Use {candidate.name || 'existing Inventory holding'}</option>)}<option value="new">Create a new Inventory holding</option></select></label>
          <label className="block text-ui-11 text-tea-text-sec">Acquired into physical stock<select value={draft.acquired} onChange={event => set('acquired', event.target.value)} className={fieldClass}><option value="">Needs confirmation</option><option value="yes">Yes, add to physical stock</option></select></label>
          <div className="flex justify-between gap-3"><button type="button" onClick={() => setExpanded(false)} className="tap-target min-h-11 text-ui-12 text-tea-text-sec hover:text-tea-text">Cancel</button><button type="button" disabled={busy || !draft.english_name.trim()} onClick={() => void submit()} className="tap-target min-h-11 rounded-md bg-tea-gold px-4 text-ui-12 font-medium text-tea-bg disabled:opacity-50">{busy ? 'Saving…' : `Save ${editLabel}`}</button></div>
        </div>
      )}
    </article>
  );
};

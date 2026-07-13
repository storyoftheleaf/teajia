import React, { useState } from 'react';
import { AlertCircle, Check, ChevronDown, ChevronUp } from 'lucide-react';
import type { CurateImportItem } from '../../../lib/api';
import { importBlockingMessage } from './importReviewDomain';

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
  const [draft, setDraft] = useState({
    english_name: value(item.english_name || item.name), original_name: value(item.original_name),
    pack_weight: value(item.pack_weight), weight_unit: value(item.weight_unit), pack_count: value(item.pack_count),
    price_amount: value(item.price_amount), currency: value(item.currency), price_basis: value(item.price_basis || 'unknown'),
    tea_type: value(item.parsed_data?.teaType), origin: value(item.parsed_data?.originRegion), purpose: value(item.parsed_data?.inventoryPurpose),
  });
  const label = item.english_name || item.name || item.raw_text || `Item ${item.position + 1}`;
  const blocking = importBlockingMessage(item);
  const set = (key: keyof typeof draft, next: string) => setDraft(current => ({ ...current, [key]: next }));
  const submit = async () => {
    const updates: Partial<CurateImportItem> = {
      name: draft.english_name.trim() || null, english_name: draft.english_name.trim() || null, original_name: draft.original_name.trim() || null,
      pack_weight: draft.pack_weight ? Number(draft.pack_weight) : null, weight_unit: (draft.weight_unit || null) as CurateImportItem['weight_unit'],
      pack_count: draft.pack_count ? Number(draft.pack_count) : null, price_amount: draft.price_amount ? Number(draft.price_amount) : null,
      currency: draft.currency.trim().toUpperCase() || null, price_basis: draft.price_basis as CurateImportItem['price_basis'],
      parsed_data: { ...item.parsed_data, teaType: draft.tea_type.trim() || null, originRegion: draft.origin.trim() || null, inventoryPurpose: draft.purpose || null },
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
        <button type="button" aria-expanded={expanded} onClick={() => setExpanded(open => !open)} className="tap-target flex min-h-11 shrink-0 items-center gap-1 text-ui-10 text-tea-text-sec hover:text-tea-text">{expanded ? 'Close editing' : 'Edit tea'}{expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}</button>
      </div>
      {expanded && (
        <div className="mt-3 space-y-3 border-l-2 border-tea-border pl-3">
          {item.raw_text && <div><p className="text-ui-10 uppercase tracking-[1.2px] text-tea-text-dim">Original evidence</p><p className="mt-1 break-words text-ui-12 text-tea-text-sec">{item.raw_text}</p></div>}
          <label className="block text-ui-11 text-tea-text-sec">English inventory name<input value={draft.english_name} onChange={event => set('english_name', event.target.value)} className={fieldClass} /></label>
          <label className="block text-ui-11 text-tea-text-sec">Original or Chinese name<input value={draft.original_name} onChange={event => set('original_name', event.target.value)} className={fieldClass} /></label>
          <label className="block text-ui-11 text-tea-text-sec">Tea type or classification<input value={draft.tea_type} onChange={event => set('tea_type', event.target.value)} className={fieldClass} /></label>
          <label className="block text-ui-11 text-tea-text-sec">Origin<input value={draft.origin} onChange={event => set('origin', event.target.value)} className={fieldClass} /></label>
          <label className="block text-ui-11 text-tea-text-sec">Pack weight<input inputMode="decimal" value={draft.pack_weight} onChange={event => set('pack_weight', event.target.value)} className={fieldClass} /></label>
          <label className="block text-ui-11 text-tea-text-sec">Weight unit<select value={draft.weight_unit} onChange={event => set('weight_unit', event.target.value)} className={fieldClass}><option value="">Choose unit</option><option value="g">g</option><option value="kg">kg</option><option value="count">count</option></select></label>
          <label className="block text-ui-11 text-tea-text-sec">Pack count<input inputMode="numeric" value={draft.pack_count} onChange={event => set('pack_count', event.target.value)} className={fieldClass} /></label>
          <label className="block text-ui-11 text-tea-text-sec">Price amount<input inputMode="decimal" value={draft.price_amount} onChange={event => set('price_amount', event.target.value)} className={fieldClass} /></label>
          <label className="block text-ui-11 text-tea-text-sec">Currency<input value={draft.currency} onChange={event => set('currency', event.target.value)} placeholder="CNY" className={fieldClass} /></label>
          <label className="block text-ui-11 text-tea-text-sec">Price interpretation<select value={draft.price_basis} onChange={event => set('price_basis', event.target.value)} className={fieldClass}><option value="unknown">Choose interpretation</option><option value="per_pack">Per pack</option><option value="line_total">Line total</option></select></label>
          <label className="block text-ui-11 text-tea-text-sec">Inventory purpose<select value={draft.purpose} onChange={event => set('purpose', event.target.value)} className={fieldClass}><option value="">Choose purpose</option><option value="service">Tea service</option><option value="retail">Retail</option><option value="personal">Personal collection</option><option value="sample">Sample</option></select></label>
          <div className="flex justify-between gap-3"><button type="button" onClick={() => setExpanded(false)} className="tap-target min-h-11 text-ui-12 text-tea-text-sec hover:text-tea-text">Cancel</button><button type="button" disabled={busy || !draft.english_name.trim()} onClick={() => void submit()} className="tap-target min-h-11 rounded-md bg-tea-gold px-4 text-ui-12 font-medium text-tea-bg disabled:opacity-50">{busy ? 'Saving…' : 'Save tea'}</button></div>
        </div>
      )}
    </article>
  );
};

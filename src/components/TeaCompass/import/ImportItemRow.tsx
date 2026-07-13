import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, Check, ChevronDown, ChevronUp } from 'lucide-react';
import type { CurateImportItem, CurateImportItemUpdate, CurateImportReviewedField, LookupState } from '../../../lib/api';
import { buildImportCorrectionParsedData, compatibleImportHoldings, importBlockingMessage, reviewedFieldsForImportSave, validateImportHoldingSelection, type ImportMatchOption } from './importReviewDomain';
import { ImportMatchPicker } from './ImportMatchPicker';

export interface ImportIdentityOption extends ImportMatchOption { category: 'tea' | 'teaware' }
export interface ImportHoldingOption extends ImportMatchOption { category: 'tea' | 'teaware'; compassEntryId: string | null; purpose: string | null }

interface ImportItemRowProps {
  item: CurateImportItem;
  busy: boolean;
  identityLookup: LookupState<ImportIdentityOption>;
  holdingLookup: LookupState<ImportHoldingOption>;
  onRetryIdentities: () => void;
  onRetryHoldings: () => void;
  onUpdate: (updates: CurateImportItemUpdate) => Promise<boolean>;
}

const fieldClass = 'mt-1 min-h-11 w-full rounded-md border border-tea-border bg-tea-elevated px-3 text-ui-16 text-tea-text outline-none focus:border-tea-gold lg:text-ui-13';
const value = (input: unknown) => input == null ? '' : String(input);
const draftFromItem = (item: CurateImportItem, identityBlocked: boolean, productBlocked: boolean) => ({
  english_name: value(item.english_name || item.name), original_name: value(item.original_name),
  pack_weight: value(item.pack_weight), weight_unit: value(item.weight_unit), pack_count: value(item.pack_count),
  price_amount: value(item.price_amount_exact ?? item.parsed_data?.priceAmountExact ?? item.price_amount), currency: value(item.currency), price_basis: value(item.price_basis || 'unknown'),
  tea_type: value(item.parsed_data?.type), classification: value(item.parsed_data?.classification), year: value(item.parsed_data?.year),
  form: value(item.parsed_data?.form), origin: value(item.parsed_data?.originRegion), description: value(item.parsed_data?.description),
  purpose: value(item.parsed_data?.inventoryPurpose), compass_entry_id: value(identityBlocked ? '' : item.proposed_compass_entry_id || (item.duplicate_resolution === 'new' && 'new') || 'new'),
  product_id: value(productBlocked ? '' : item.proposed_product_id || 'new'),
  acquired: item.acquired === true ? 'yes' : '',
});
const packEquation = (item: CurateImportItem) => {
  const pack = item.pack_weight && item.weight_unit ? `${item.pack_weight}${item.weight_unit}` : null;
  const count = item.pack_count ? `×${item.pack_count}` : null;
  const displayPrice = item.price_amount_exact ?? item.price_amount;
  const price = displayPrice != null ? `${item.currency || ''} ${displayPrice}${item.price_basis === 'per_pack' ? ' each' : ''}`.trim() : null;
  return [pack && [pack, count].filter(Boolean).join(' '), price].filter(Boolean).join(' · ') || 'Quantity or cost needs review';
};
const evidenceReferenceLabel = (reference: string) => {
  const separator = reference.indexOf(':');
  const source = separator < 0 ? reference : reference.slice(0, separator);
  const locator = separator < 0 ? '' : reference.slice(separator + 1);
  const page = locator.match(/^page=(\d+)$/);
  if (page) return `${source} · Page ${page[1]}`;
  const range = locator.match(/^(\d+)-(\d+)$/);
  if (range) return `${source} · Text range ${range[1]}–${range[2]}`;
  if (locator.startsWith('region=')) return `${source} · Image region`;
  return source;
};

export const ImportItemRow: React.FC<ImportItemRowProps> = ({ item, busy, identityLookup, holdingLookup, onRetryIdentities, onRetryHoldings, onUpdate }) => {
  const [expanded, setExpanded] = useState(false);
  const [detailsExpanded, setDetailsExpanded] = useState(false);
  const identityResolutionTouched = useRef(false);
  const holdingResolutionTouched = useRef(false);
  const blockerKeys = (item.blocking_fields || []).map(field => field.replace(/_/g, '').toLocaleLowerCase());
  const identityBlocked = blockerKeys.some(field => ['identity', 'duplicateidentity', 'compassentryid', 'proposedcompassentryid'].includes(field));
  const productBlocked = blockerKeys.some(field => ['identity', 'productid', 'proposedproductid', 'inventoryholding'].includes(field));
  const [draft, setDraft] = useState(() => draftFromItem(item, identityBlocked, productBlocked));
  const label = item.english_name || item.name || item.raw_text || `Item ${item.position + 1}`;
  const headingId = `import-item-${item.id}-heading`;
  const identityOptions = useMemo(() => identityLookup.options.filter(option => option.category === item.category), [identityLookup.options, item.category]);
  const identityState = useMemo<LookupState<ImportIdentityOption>>(() => ({ ...identityLookup, options: identityOptions, status: identityLookup.status === 'ready' && identityOptions.length === 0 ? 'empty' : identityLookup.status }), [identityLookup, identityOptions]);
  const selectedIdentityId = draft.compass_entry_id && draft.compass_entry_id !== 'new' ? draft.compass_entry_id : null;
  const holdingOptions = useMemo(() => compatibleImportHoldings(holdingLookup.options, {
    category: item.category, compassEntryId: selectedIdentityId, purpose: draft.purpose || null,
  }), [draft.purpose, holdingLookup.options, item.category, selectedIdentityId]);
  const holdingState = useMemo<LookupState<ImportHoldingOption>>(() => ({ ...holdingLookup, options: holdingOptions, status: holdingLookup.status === 'ready' && holdingOptions.length === 0 ? 'empty' : holdingLookup.status }), [holdingLookup, holdingOptions]);
  const proposedIdentityName = identityLookup.options.find(option => option.id === item.proposed_compass_entry_id)?.name || (item.proposed_compass_entry_id ? `Library identity ${item.proposed_compass_entry_id}` : 'New Library identity');
  const compatibleProposedHolding = holdingOptions.find(option => option.id === item.proposed_product_id);
  const proposedHoldingName = compatibleProposedHolding?.name || 'New Inventory holding';
  useEffect(() => {
    if (!expanded) return;
    setDraft(draftFromItem(item, identityBlocked, productBlocked));
    setDetailsExpanded(false);
    identityResolutionTouched.current = false;
    holdingResolutionTouched.current = false;
  }, [expanded, item, identityBlocked, productBlocked]);
  useEffect(() => {
    if (holdingLookup.status !== 'ready' && holdingLookup.status !== 'empty') return;
    const productId = validateImportHoldingSelection(draft.product_id, holdingLookup.options, { category: item.category, compassEntryId: selectedIdentityId, purpose: draft.purpose || null });
    if (productId === draft.product_id) return;
    setDraft(current => ({ ...current, product_id: productId }));
    holdingResolutionTouched.current = true;
  }, [draft.product_id, draft.purpose, holdingLookup.options, holdingLookup.status, item.category, selectedIdentityId]);
  const blocking = importBlockingMessage(item);
  const editLabel = item.category === 'tea' ? 'tea' : 'item';
  const hasBlocker = (...keys: string[]) => blockerKeys.some(field => keys.includes(field));
  const quantityBlocking = hasBlocker('packweight', 'weightunit', 'packcount', 'totalquantitygrams', 'totalunits', 'quantity');
  const costBlocking = hasBlocker('priceamount', 'linecost', 'pricebasis', 'currency');
  const identitySelectionBlocking = identityBlocked || productBlocked;
  const acquisitionBlocking = hasBlocker('acquired', 'acquisitionstate', 'physicalstock', 'acquiredintostock', 'inventorypurpose', 'purpose');
  const namingBlocking = hasBlocker('englishname', 'englishinventoryname', 'translation', 'originalname', 'chinesename', 'name');
  const evidenceReferences = Array.isArray(item.parsed_data?.evidenceRefs) ? item.parsed_data.evidenceRefs.filter((reference): reference is string => typeof reference === 'string') : [];
  const set = (key: keyof typeof draft, next: string) => setDraft(current => ({ ...current, [key]: next }));
  const setPurpose = (purpose: string) => {
    const productId = validateImportHoldingSelection(draft.product_id, holdingLookup.options, { category: item.category, compassEntryId: selectedIdentityId, purpose: purpose || null });
    if (productId !== draft.product_id) holdingResolutionTouched.current = true;
    setDraft(current => ({ ...current, purpose, product_id: productId }));
  };
  const setIdentity = (compassEntryId: string) => {
    const selectedCompassId = compassEntryId && compassEntryId !== 'new' ? compassEntryId : null;
    const productId = compassEntryId === 'new' ? 'new' : validateImportHoldingSelection(draft.product_id, holdingLookup.options, { category: item.category, compassEntryId: selectedCompassId, purpose: draft.purpose || null });
    identityResolutionTouched.current = true;
    if (productId !== draft.product_id) holdingResolutionTouched.current = true;
    setDraft(current => ({ ...current, compass_entry_id: compassEntryId, product_id: productId }));
  };
  const submit = async () => {
    const parsedValues = buildImportCorrectionParsedData(item.parsed_data, {
      englishName: draft.english_name.trim() || null, originalName: draft.original_name.trim() || null,
      type: draft.tea_type.trim() || null, classification: draft.classification.trim() || null,
      year: draft.year ? Number(draft.year) : null, form: draft.form.trim() || null, originRegion: draft.origin.trim() || null,
      description: draft.description.trim() || null, inventoryPurpose: draft.purpose || null,
      compassSelection: draft.compass_entry_id || null, productSelection: draft.product_id || null,
      identityTouched: identityResolutionTouched.current, productSelectionTouched: holdingResolutionTouched.current, acquired: draft.acquired === 'yes',
      packWeight: draft.pack_weight ? Number(draft.pack_weight) : null, weightUnit: draft.weight_unit || null,
      packCount: draft.pack_count ? Number(draft.pack_count) : null, priceAmount: draft.price_amount.trim() || null,
      currency: draft.currency.trim().toUpperCase() || null, priceBasis: draft.price_basis,
    });
    const visibleMaterialFields: CurateImportReviewedField[] = [
      ...(namingBlocking || detailsExpanded ? ['englishName' as const] : []),
      ...(quantityBlocking || detailsExpanded ? ['packWeight' as const, 'weightUnit' as const, 'packCount' as const] : []),
      ...(costBlocking || detailsExpanded ? ['priceBasis' as const, 'priceAmount' as const, 'currency' as const] : []),
      ...(acquisitionBlocking || detailsExpanded ? ['acquired' as const] : []),
    ];
    const reviewedFields = reviewedFieldsForImportSave(item, draft.compass_entry_id, draft.product_id, identityResolutionTouched.current || holdingResolutionTouched.current, visibleMaterialFields);
    const updates: CurateImportItemUpdate = {
      name: draft.english_name.trim() || null, english_name: draft.english_name.trim() || null, original_name: draft.original_name.trim() || null,
      pack_weight: draft.pack_weight ? Number(draft.pack_weight) : null, weight_unit: (draft.weight_unit || null) as CurateImportItem['weight_unit'],
      pack_count: draft.pack_count ? Number(draft.pack_count) : null,
      currency: draft.currency.trim().toUpperCase() || null, price_basis: draft.price_basis as CurateImportItem['price_basis'],
      parsed_data: parsedValues,
      ...(reviewedFields.length ? { reviewed_fields: reviewedFields } : {}),
    };
    if (await onUpdate(updates)) setExpanded(false);
  };
  const quantityFields = <>
    <label className="block text-ui-11 text-tea-text-sec">Pack weight<input inputMode="decimal" value={draft.pack_weight} onChange={event => set('pack_weight', event.target.value)} className={fieldClass} /></label>
    <label className="block text-ui-11 text-tea-text-sec">Weight unit<select value={draft.weight_unit} onChange={event => set('weight_unit', event.target.value)} className={fieldClass}><option value="">Choose unit</option><option value="g">g</option><option value="kg">kg</option><option value="count">count</option></select></label>
    <label className="block text-ui-11 text-tea-text-sec">Pack count<input inputMode="numeric" value={draft.pack_count} onChange={event => set('pack_count', event.target.value)} className={fieldClass} /></label>
  </>;
  const costFields = <>
    <label className="block text-ui-11 text-tea-text-sec">Price amount<input inputMode="decimal" value={draft.price_amount} onChange={event => set('price_amount', event.target.value)} className={fieldClass} /></label>
    <label className="block text-ui-11 text-tea-text-sec">Currency<input value={draft.currency} onChange={event => set('currency', event.target.value)} placeholder="CNY" className={fieldClass} /></label>
    <label className="block text-ui-11 text-tea-text-sec">Price interpretation<select value={draft.price_basis} onChange={event => set('price_basis', event.target.value)} className={fieldClass}><option value="unknown">Choose interpretation</option><option value="per_pack">Per pack</option><option value="line_total">Line total</option></select></label>
  </>;
  const identityFields = <>
    <div><ImportMatchPicker label="Match tea" lookup={identityState} selectedId={draft.compass_entry_id} proposedId={item.proposed_compass_entry_id} proposedName={proposedIdentityName} newOptionLabel="Create new Library identity" disabled={busy} onRetry={onRetryIdentities} onSelect={setIdentity} /><p className="mt-1 text-ui-10 text-tea-text-dim">Library tea identity</p></div>
    <div><ImportMatchPicker label="Choose stock record" lookup={holdingState} selectedId={draft.product_id} proposedId={compatibleProposedHolding?.id} proposedName={proposedHoldingName} newOptionLabel="Create new Inventory holding" disabled={busy} onRetry={onRetryHoldings} onSelect={selection => { holdingResolutionTouched.current = true; set('product_id', selection); }} /><p className="mt-1 text-ui-10 text-tea-text-dim">Inventory holding</p></div>
  </>;
  const acquisitionFields = <>
    <label className="block text-ui-11 text-tea-text-sec">Inventory purpose<select value={draft.purpose} onChange={event => setPurpose(event.target.value)} className={fieldClass}><option value="">Choose purpose</option><option value="working">Tea service</option><option value="personal">Personal collection</option><option value="sample">Sample</option></select></label>
    <label className="block text-ui-11 text-tea-text-sec">Acquired into physical stock<select value={draft.acquired} onChange={event => set('acquired', event.target.value)} className={fieldClass}><option value="">Needs confirmation</option><option value="yes">Yes, add to physical stock</option></select></label>
  </>;
  const namingFields = <>
    <label className="block text-ui-11 text-tea-text-sec">English inventory name<input value={draft.english_name} onChange={event => set('english_name', event.target.value)} className={fieldClass} /></label>
    <label className="block text-ui-11 text-tea-text-sec">Original or Chinese name<input value={draft.original_name} onChange={event => set('original_name', event.target.value)} className={fieldClass} /></label>
  </>;
  return (
    <article data-testid="import-item-row" data-import-item-id={item.id} data-blocked={blocking ? 'true' : 'false'} aria-labelledby={headingId} tabIndex={-1} className="scroll-mt-24 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50">
      <div className="flex min-w-0 items-start gap-2">
        <span className={`mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${blocking ? 'text-tea-gold' : 'bg-tea-accent-sub text-tea-gold'}`} aria-label={blocking ? 'Needs review' : 'Ready'}>{blocking ? <AlertCircle size={16} /> : <Check size={13} />}</span>
        <div className="min-w-0 flex-1">
          <h6 id={headingId} className="break-words font-display text-ui-20 leading-snug text-tea-text">{label}</h6>
          {item.original_name && <p className="break-words font-chinese text-ui-12 text-tea-text-sec">{item.original_name}</p>}
          <p className="mt-0.5 break-words font-mono text-ui-10 text-tea-text-dim">{packEquation(item)}{item.total_quantity_grams ? ` · ${item.total_quantity_grams}g total` : ''}{item.line_cost != null ? ` · ${item.currency || ''} ${item.line_cost}` : ''}</p>
          {blocking && <p role="alert" className="mt-1 text-ui-11 text-tea-gold">{blocking}</p>}
        </div>
        <button type="button" disabled={busy} aria-expanded={expanded} onClick={() => setExpanded(open => !open)} className="tap-target flex min-h-11 shrink-0 items-center gap-1 text-ui-10 text-tea-text-sec hover:text-tea-text disabled:opacity-50">{expanded ? 'Close editing' : `Edit ${editLabel}`}{expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}</button>
      </div>
      {expanded && (
        <fieldset disabled={busy} className="mt-3 space-y-3 border-t border-tea-border pt-3">
          {(item.raw_text || evidenceReferences.length > 0) && <div><p className="text-ui-10 uppercase tracking-[1.2px] text-tea-text-sec">Evidence used for this item</p>{item.raw_text && <p className="mt-1 break-words text-ui-12 text-tea-text-sec">{item.raw_text}</p>}{evidenceReferences.map(reference => <p key={reference} className="mt-1 break-words font-mono text-ui-10 text-tea-text-sec">{evidenceReferenceLabel(reference)}</p>)}</div>}
          {namingBlocking && namingFields}
          {identitySelectionBlocking && identityFields}
          {quantityBlocking && quantityFields}
          {costBlocking && costFields}
          {acquisitionBlocking && acquisitionFields}
          <button type="button" aria-expanded={detailsExpanded} onClick={() => setDetailsExpanded(open => !open)} className="tap-target flex min-h-11 w-full items-center justify-between border-y border-tea-border text-left text-ui-12 text-tea-text-sec hover:text-tea-text"><span>All details</span>{detailsExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}</button>
          {detailsExpanded && <div className="space-y-3">
            {!namingBlocking && namingFields}
            <label className="block text-ui-11 text-tea-text-sec">Tea type<input value={draft.tea_type} onChange={event => set('tea_type', event.target.value)} placeholder="Pu’er, oolong, white…" className={fieldClass} /></label>
            <label className="block text-ui-11 text-tea-text-sec">Production or classification<input value={draft.classification} onChange={event => set('classification', event.target.value)} placeholder="Raw, ripe, charcoal-roasted…" className={fieldClass} /></label>
            <label className="block text-ui-11 text-tea-text-sec">Year<input inputMode="numeric" value={draft.year} onChange={event => set('year', event.target.value)} className={fieldClass} /></label>
            <label className="block text-ui-11 text-tea-text-sec">Form<input value={draft.form} onChange={event => set('form', event.target.value)} placeholder="Cake, loose, brick…" className={fieldClass} /></label>
            <label className="block text-ui-11 text-tea-text-sec">Origin<input value={draft.origin} onChange={event => set('origin', event.target.value)} className={fieldClass} /></label>
            <label className="block text-ui-11 text-tea-text-sec">Description<textarea rows={3} value={draft.description} onChange={event => set('description', event.target.value)} className={`${fieldClass} py-2`} /></label>
            {!identitySelectionBlocking && identityFields}
            {!quantityBlocking && quantityFields}
            {!costBlocking && costFields}
            {!acquisitionBlocking && acquisitionFields}
          </div>}
          <div className="flex justify-between gap-3"><button type="button" onClick={() => setExpanded(false)} className="tap-target min-h-11 text-ui-12 text-tea-text-sec hover:text-tea-text">Cancel</button><button type="button" disabled={busy || !draft.english_name.trim()} onClick={() => void submit()} className="tap-target min-h-11 rounded-md bg-tea-gold px-4 text-ui-12 font-medium text-tea-bg disabled:opacity-50">{busy ? 'Saving…' : `Save ${editLabel}`}</button></div>
        </fieldset>
      )}
    </article>
  );
};

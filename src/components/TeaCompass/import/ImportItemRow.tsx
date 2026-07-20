import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, Check, ChevronDown, ChevronUp } from 'lucide-react';
import type { CurateImportCanonicalField, CurateImportDisposition, CurateImportInventoryPurpose, CurateImportItem, CurateImportItemUpdate, CurateImportReviewedField, LookupState } from '../../../lib/api';
import { buildImportCorrectionParsedData, compatibleImportHoldings, importBlockingMessage, importDisposition, resolveImportBlockingFields, reviewedFieldsForImportSave, validateImportHoldingSelection, withoutImportDerivedFields, type ImportMatchOption } from './importReviewDomain';
import { importFieldProvenance, importSourceExcerpt } from './importEvidence';
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
  english_name: value(item.english_name || item.name), original_name: value(item.original_name), chinese_name: value(item.chinese_name ?? item.parsed_data?.chineseName),
  pack_weight: value(item.pack_weight), weight_unit: value(item.weight_unit), pack_count: value(item.pack_count),
  price_amount: value(item.price_amount_exact ?? item.parsed_data?.priceAmountExact ?? item.price_amount), currency: value(item.currency), price_basis: value(item.price_basis || 'unknown'),
  tea_type: value(item.parsed_data?.type), classification: value(item.parsed_data?.classification), year: value(item.parsed_data?.year),
  form: value(item.parsed_data?.form), origin_country: value(item.parsed_data?.originCountry), origin: value(item.parsed_data?.originRegion), description: value(item.parsed_data?.description),
  purpose: value(item.parsed_data?.inventoryPurpose), compass_entry_id: value(identityBlocked ? '' : item.proposed_compass_entry_id || (item.duplicate_resolution === 'new' && 'new') || 'new'),
  product_id: value(productBlocked ? '' : item.proposed_product_id || 'new'),
  disposition: value(importDisposition(item)),
});
const packEquation = (item: CurateImportItem) => {
  const pack = item.pack_weight && item.weight_unit ? `${item.pack_weight}${item.weight_unit}` : null;
  const count = item.pack_count ? `×${item.pack_count}` : null;
  const displayPrice = item.price_amount_exact ?? item.parsed_data?.priceAmountExact ?? item.price_amount;
  const price = displayPrice != null ? `${item.currency || ''} ${displayPrice}${item.price_basis === 'per_pack' ? ' each' : item.price_basis === 'line_total' ? ' line total' : ''}`.trim() : null;
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
const DISPOSITION_OPTIONS: Array<{ value: CurateImportDisposition; label: string; detail: string }> = [
  { value: 'received', label: 'Received now', detail: 'Add stock now' },
  { value: 'in_transit', label: 'In transit', detail: 'Create a pending receipt' },
  { value: 'library_only', label: 'Library only', detail: 'Identity record, no stock' },
];

export const ImportItemRow: React.FC<ImportItemRowProps> = ({ item, busy, identityLookup, holdingLookup, onRetryIdentities, onRetryHoldings, onUpdate }) => {
  const [expanded, setExpanded] = useState(false);
  const [detailsExpanded, setDetailsExpanded] = useState(false);
  const identityResolutionTouched = useRef(false);
  const holdingResolutionTouched = useRef(false);
  const currentDisposition = importDisposition(item);
  const blockerKeys = resolveImportBlockingFields(item.blocking_fields || [], { ...item.parsed_data, disposition: currentDisposition, acquired: item.acquired }).map(field => field.replace(/_/g, '').toLocaleLowerCase());
  const identityBlocked = blockerKeys.some(field => ['identity', 'duplicateidentity', 'compassentryid', 'proposedcompassentryid'].includes(field));
  const productBlocked = blockerKeys.some(field => ['identity', 'productid', 'proposedproductid', 'inventoryholding'].includes(field));
  const [draft, setDraft] = useState(() => draftFromItem(item, identityBlocked, productBlocked));
  const label = item.english_name || item.name || item.raw_text || `Item ${item.position + 1}`;
  const headingId = `import-item-${item.id}-heading`;
  const identityOptions = useMemo(() => identityLookup.options.filter(option => option.category === item.category), [identityLookup.options, item.category]);
  const identityState = useMemo<LookupState<ImportIdentityOption>>(() => ({ ...identityLookup, options: identityOptions, status: identityLookup.status === 'ready' && identityOptions.length === 0 ? 'empty' : identityLookup.status }), [identityLookup, identityOptions]);
  const selectedIdentityId = draft.compass_entry_id && draft.compass_entry_id !== 'new' ? draft.compass_entry_id : null;
  const holdingOptions = useMemo(() => compatibleImportHoldings(holdingLookup.options, {
    category: item.category, compassEntryId: selectedIdentityId, purpose: draft.purpose || null, disposition: draft.disposition as CurateImportDisposition || null,
  }), [draft.disposition, draft.purpose, holdingLookup.options, item.category, selectedIdentityId]);
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
    const productId = validateImportHoldingSelection(draft.product_id, holdingLookup.options, { category: item.category, compassEntryId: selectedIdentityId, purpose: draft.purpose || null, disposition: draft.disposition as CurateImportDisposition || null });
    if (productId === draft.product_id) return;
    setDraft(current => ({ ...current, product_id: productId }));
    holdingResolutionTouched.current = true;
  }, [draft.disposition, draft.product_id, draft.purpose, holdingLookup.options, holdingLookup.status, item.category, selectedIdentityId]);
  const blocking = importBlockingMessage(item);
  const editLabel = item.category === 'tea' ? 'tea' : 'item';
  const hasBlocker = (...keys: string[]) => blockerKeys.some(field => keys.includes(field));
  const quantityBlocking = hasBlocker('packweight', 'weightunit', 'packcount', 'totalquantitygrams', 'totalunits', 'quantity');
  const costBlocking = hasBlocker('priceamount', 'linecost', 'pricebasis', 'currency');
  const identitySelectionBlocking = identityBlocked || productBlocked;
  const acquisitionBlocking = hasBlocker('acquired', 'acquisitionstate', 'physicalstock', 'acquiredintostock', 'inventorypurpose', 'purpose');
  const namingBlocking = hasBlocker('englishname', 'englishinventoryname', 'translation', 'originalname', 'chinesename', 'name');
  const evidenceReferences = Array.isArray(item.parsed_data?.evidenceRefs) ? item.parsed_data.evidenceRefs.filter((reference): reference is string => typeof reference === 'string') : [];
  const sourceExcerpt = importSourceExcerpt(item.parsed_data, item.raw_text);
  const exactLineCost = item.line_cost_exact ?? (typeof item.parsed_data.lineCostExact === 'string' ? item.parsed_data.lineCostExact : null) ?? item.line_cost;
  const provenance = (field: CurateImportCanonicalField, fieldValue: unknown) => importFieldProvenance({ ...item.parsed_data, uncertainty: item.uncertainty }, field, fieldValue, item.manually_corrected_fields);
  const ProvenanceLabel = ({ field, fieldValue }: { field: CurateImportCanonicalField; fieldValue: unknown }) => {
    const state = provenance(field, fieldValue);
    return <span data-provenance={state.state} className={`inline-flex rounded-md px-1.5 py-0.5 text-ui-9 ${state.state === 'uncertain' ? 'bg-tea-accent-sub text-tea-gold' : 'text-tea-text-dim'}`}>{state.label}</span>;
  };
  const set = (key: keyof typeof draft, next: string) => setDraft(current => ({ ...current, [key]: next }));
  const setPurpose = (purpose: string) => {
    const productId = validateImportHoldingSelection(draft.product_id, holdingLookup.options, { category: item.category, compassEntryId: selectedIdentityId, purpose: purpose || null, disposition: draft.disposition as CurateImportDisposition || null });
    if (productId !== draft.product_id) holdingResolutionTouched.current = true;
    setDraft(current => ({ ...current, purpose, product_id: productId }));
  };
  const setIdentity = (compassEntryId: string) => {
    const selectedCompassId = compassEntryId && compassEntryId !== 'new' ? compassEntryId : null;
    const productId = compassEntryId === 'new' ? 'new' : validateImportHoldingSelection(draft.product_id, holdingLookup.options, { category: item.category, compassEntryId: selectedCompassId, purpose: draft.purpose || null, disposition: draft.disposition as CurateImportDisposition || null });
    identityResolutionTouched.current = true;
    if (productId !== draft.product_id) holdingResolutionTouched.current = true;
    setDraft(current => ({ ...current, compass_entry_id: compassEntryId, product_id: productId }));
  };
  const updateDisposition = async (disposition: CurateImportDisposition) => {
    const libraryOnly = disposition === 'library_only';
    const parsedData = {
      ...withoutImportDerivedFields(item.parsed_data),
      disposition,
      acquired: disposition === 'received',
      inventoryPurpose: libraryOnly ? null : item.parsed_data.inventoryPurpose ?? null,
      proposedProductId: libraryOnly ? null : item.parsed_data.proposedProductId ?? item.proposed_product_id ?? null,
      holdingResolution: libraryOnly ? null : item.parsed_data.holdingResolution ?? { kind: 'unresolved' },
    };
    await onUpdate({ parsed_data: parsedData, reviewed_fields: ['disposition'] });
  };
  const submit = async () => {
    const parsedValues = buildImportCorrectionParsedData(item.parsed_data, {
      englishName: draft.english_name.trim() || null, originalName: draft.original_name.trim() || null, chineseName: draft.chinese_name.trim() || null,
      type: draft.tea_type.trim() || null, classification: draft.classification.trim() || null,
      year: draft.year ? Number(draft.year) : null, form: draft.form.trim() || null, originCountry: draft.origin_country.trim() || null, originRegion: draft.origin.trim() || null,
      description: draft.description.trim() || null, inventoryPurpose: (draft.purpose || null) as CurateImportInventoryPurpose | null,
      compassSelection: draft.compass_entry_id || null, productSelection: draft.product_id || null,
      identityTouched: identityResolutionTouched.current, productSelectionTouched: holdingResolutionTouched.current,
      disposition: draft.disposition as CurateImportDisposition, acquired: draft.disposition === 'received',
      packWeight: draft.pack_weight ? Number(draft.pack_weight) : null, weightUnit: (draft.weight_unit || null) as CurateImportItem['weight_unit'],
      packCount: draft.pack_count ? Number(draft.pack_count) : null, priceAmount: draft.price_amount.trim() || null,
      currency: draft.currency.trim().toUpperCase() || null, priceBasis: draft.price_basis as CurateImportItem['price_basis'],
    });
    const visibleMaterialFields: CurateImportReviewedField[] = [
      ...(namingBlocking || detailsExpanded ? ['englishName' as const] : []),
      ...(quantityBlocking || detailsExpanded ? ['packWeight' as const, 'weightUnit' as const, 'packCount' as const] : []),
      ...(costBlocking || detailsExpanded ? ['priceBasis' as const, 'priceAmount' as const, 'currency' as const] : []),
      ...(draft.disposition !== 'library_only' && (acquisitionBlocking || detailsExpanded) ? ['inventoryPurpose' as const] : []),
      'disposition' as const,
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
    <label className="block text-ui-11 text-tea-text-sec">Pack weight <ProvenanceLabel field="packWeight" fieldValue={item.pack_weight} /><input aria-label="Pack weight" inputMode="decimal" value={draft.pack_weight} onChange={event => set('pack_weight', event.target.value)} className={fieldClass} /></label>
    <label className="block text-ui-11 text-tea-text-sec">Weight unit <ProvenanceLabel field="weightUnit" fieldValue={item.weight_unit} /><select aria-label="Weight unit" value={draft.weight_unit} onChange={event => set('weight_unit', event.target.value)} className={fieldClass}><option value="">Choose unit</option><option value="g">g</option><option value="kg">kg</option><option value="count">count</option></select></label>
    <label className="block text-ui-11 text-tea-text-sec">Pack count <ProvenanceLabel field="packCount" fieldValue={item.pack_count} /><input aria-label="Pack count" inputMode="numeric" value={draft.pack_count} onChange={event => set('pack_count', event.target.value)} className={fieldClass} /></label>
  </>;
  const costFields = <>
    <label className="block text-ui-11 text-tea-text-sec">Price amount <ProvenanceLabel field="priceAmountExact" fieldValue={item.price_amount_exact ?? item.price_amount} /><input aria-label="Price amount" inputMode="decimal" value={draft.price_amount} onChange={event => set('price_amount', event.target.value)} className={fieldClass} /></label>
    <label className="block text-ui-11 text-tea-text-sec">Currency <ProvenanceLabel field="currency" fieldValue={item.currency} /><input aria-label="Currency" value={draft.currency} onChange={event => set('currency', event.target.value)} placeholder="CNY" className={fieldClass} /></label>
    <label className="block text-ui-11 text-tea-text-sec">Price interpretation <ProvenanceLabel field="priceBasis" fieldValue={item.price_basis} /><select aria-label="Price interpretation" value={draft.price_basis} onChange={event => set('price_basis', event.target.value)} className={fieldClass}><option value="unknown">Choose interpretation</option><option value="per_pack">Per pack</option><option value="line_total">Line total</option></select></label>
  </>;
  const identityFields = <>
    <div><ImportMatchPicker label={item.category === 'tea' ? 'Match tea' : 'Match teaware'} lookup={identityState} selectedId={draft.compass_entry_id} proposedId={item.proposed_compass_entry_id} proposedName={proposedIdentityName} newOptionLabel="Create new Library identity" disabled={busy} onRetry={onRetryIdentities} onSelect={setIdentity} /><p className="mt-1 text-ui-10 text-tea-text-dim">Library {item.category === 'tea' ? 'tea' : 'teaware'} identity</p></div>
    {draft.disposition !== 'library_only' && <div><ImportMatchPicker label="Choose stock record" lookup={holdingState} selectedId={draft.product_id} proposedId={compatibleProposedHolding?.id} proposedName={proposedHoldingName} newOptionLabel="Create new Inventory holding" disabled={busy} onRetry={onRetryHoldings} onSelect={selection => { holdingResolutionTouched.current = true; set('product_id', selection); }} /><p className="mt-1 text-ui-10 text-tea-text-dim">Inventory holding</p></div>}
  </>;
  const acquisitionFields = draft.disposition === 'library_only' ? null : <>
    <label className="block text-ui-11 text-tea-text-sec">Inventory purpose <ProvenanceLabel field="inventoryPurpose" fieldValue={item.parsed_data.inventoryPurpose} /><select aria-label="Inventory purpose" value={draft.purpose} onChange={event => setPurpose(event.target.value)} className={fieldClass}><option value="">Choose purpose</option><option value="working">Tea service</option><option value="personal">Personal collection</option><option value="sample">Sample</option></select></label>
  </>;
  const namingFields = <>
    <label className="block text-ui-11 text-tea-text-sec">English inventory name <ProvenanceLabel field="englishName" fieldValue={item.english_name} /><input aria-label="English inventory name" value={draft.english_name} onChange={event => set('english_name', event.target.value)} className={fieldClass} /></label>
    <label className="block text-ui-11 text-tea-text-sec">Original supplier name <ProvenanceLabel field="originalName" fieldValue={item.original_name} /><input aria-label="Original supplier name" value={draft.original_name} onChange={event => set('original_name', event.target.value)} className={fieldClass} /></label>
    <label className="block text-ui-11 text-tea-text-sec">Chinese name <ProvenanceLabel field="chineseName" fieldValue={item.chinese_name} /><input aria-label="Chinese name" value={draft.chinese_name} onChange={event => set('chinese_name', event.target.value)} className={fieldClass} /></label>
  </>;
  return (
    <article data-testid="import-item-row" data-import-item-id={item.id} data-blocked={blocking ? 'true' : 'false'} aria-labelledby={headingId} tabIndex={-1} className="scroll-mt-24 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50">
      <div className="flex min-w-0 items-start gap-2">
        <span className={`mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${blocking ? 'text-tea-gold' : 'bg-tea-accent-sub text-tea-gold'}`} aria-label={blocking ? 'Needs review' : 'Ready'}>{blocking ? <AlertCircle size={16} /> : <Check size={13} />}</span>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-baseline gap-1"><h6 id={headingId} className="break-words font-display text-ui-20 leading-snug text-tea-text">{label}</h6><ProvenanceLabel field="englishName" fieldValue={item.english_name || item.name} /></div>
          {(item.original_name || item.chinese_name) && <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-0.5">
            {item.original_name && <div className="inline-flex min-w-0 flex-wrap items-baseline gap-1"><p className="break-words text-ui-11 text-tea-text-sec"><span className="text-tea-text-dim">Original:</span> {item.original_name}</p><ProvenanceLabel field="originalName" fieldValue={item.original_name} /></div>}
            {item.chinese_name && <div className="inline-flex min-w-0 flex-wrap items-baseline gap-1"><p className="break-words font-chinese text-ui-12 text-tea-text-sec"><span className="font-body text-ui-10 text-tea-text-dim">Chinese:</span> {item.chinese_name}</p><ProvenanceLabel field="chineseName" fieldValue={item.chinese_name} /></div>}
          </div>}
          <p className="mt-0.5 break-words font-mono text-ui-10 text-tea-text-dim">{packEquation(item)}{item.total_quantity_grams ? ` · ${item.total_quantity_grams}g total` : item.total_units ? ` · ${item.total_units} ${item.total_units === 1 ? 'unit' : 'units'} total` : ''}{exactLineCost != null ? ` · ${item.currency || ''} ${exactLineCost} line cost` : ''}</p>
          {item.parsed_data.classification && <p className="mt-1 break-words text-ui-10 text-tea-text-sec">{String(item.parsed_data.classification)}<ProvenanceLabel field="classification" fieldValue={item.parsed_data.classification} /></p>}
          {blocking && <p role="alert" className="mt-1 text-ui-11 text-tea-gold">{blocking}</p>}
        </div>
        <button type="button" disabled={busy} aria-expanded={expanded} onClick={() => setExpanded(open => !open)} className="tap-target flex min-h-11 shrink-0 items-center gap-1 text-ui-10 text-tea-text-sec hover:text-tea-text disabled:opacity-50">{expanded ? 'Close editing' : `Edit ${editLabel}`}{expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}</button>
      </div>
      {sourceExcerpt && <div data-testid="import-source-excerpt" className="ml-7 mt-2 min-w-0 border-l border-tea-border pl-3"><p className="text-ui-9 uppercase tracking-[1.2px] text-tea-text-dim">Exact source excerpt</p><p className="mt-1 whitespace-pre-wrap break-words font-body text-ui-12 leading-relaxed text-tea-text-sec">{sourceExcerpt}</p></div>}
      <div role="radiogroup" aria-label={`Destination for ${label}`} className="ml-7 mt-3 grid min-w-0 grid-cols-3 gap-1">
        {DISPOSITION_OPTIONS.map(option => {
          const selected = currentDisposition === option.value;
          return <button key={option.value} type="button" role="radio" aria-checked={selected} disabled={busy} onClick={() => void updateDisposition(option.value)} className={`tap-target min-h-11 min-w-0 rounded-md border px-2 py-1.5 text-left disabled:opacity-50 ${selected ? 'border-tea-gold bg-tea-accent-sub text-tea-gold' : 'border-tea-border text-tea-text-sec hover:text-tea-text'}`}><span className="block text-ui-11 font-medium">{option.label}</span><span className="block break-words text-ui-9">{option.detail}</span></button>;
        })}
      </div>
      {expanded && (
        <fieldset disabled={busy} className="mt-3 space-y-3 border-t border-tea-border pt-3">
          {evidenceReferences.length > 0 && <div><p className="text-ui-10 uppercase tracking-[1.2px] text-tea-text-sec">Record location</p>{evidenceReferences.map(reference => <p key={reference} className="mt-1 break-words font-mono text-ui-10 text-tea-text-sec">{evidenceReferenceLabel(reference)}</p>)}</div>}
          {namingBlocking && namingFields}
          {identitySelectionBlocking && identityFields}
          {quantityBlocking && quantityFields}
          {costBlocking && costFields}
          {acquisitionBlocking && acquisitionFields}
          <button type="button" aria-expanded={detailsExpanded} onClick={() => setDetailsExpanded(open => !open)} className="tap-target flex min-h-11 w-full items-center justify-between border-y border-tea-border text-left text-ui-12 text-tea-text-sec hover:text-tea-text"><span>All details</span>{detailsExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}</button>
          {detailsExpanded && <div className="space-y-3">
            {!namingBlocking && namingFields}
            <label className="block text-ui-11 text-tea-text-sec">Tea type <ProvenanceLabel field="type" fieldValue={item.parsed_data.type} /><input aria-label="Tea type" value={draft.tea_type} onChange={event => set('tea_type', event.target.value)} placeholder="Pu’er, oolong, white…" className={fieldClass} /></label>
            <label className="block text-ui-11 text-tea-text-sec">Production or classification <ProvenanceLabel field="classification" fieldValue={item.parsed_data.classification} /><input aria-label="Production or classification" value={draft.classification} onChange={event => set('classification', event.target.value)} placeholder="Raw, ripe, charcoal-roasted…" className={fieldClass} /></label>
            <label className="block text-ui-11 text-tea-text-sec">Year <ProvenanceLabel field="year" fieldValue={item.parsed_data.year} /><input aria-label="Year" inputMode="numeric" value={draft.year} onChange={event => set('year', event.target.value)} className={fieldClass} /></label>
            <label className="block text-ui-11 text-tea-text-sec">Form <ProvenanceLabel field="form" fieldValue={item.parsed_data.form} /><input aria-label="Form" value={draft.form} onChange={event => set('form', event.target.value)} placeholder="Cake, loose, brick…" className={fieldClass} /></label>
            <label className="block text-ui-11 text-tea-text-sec">Origin country <ProvenanceLabel field="originCountry" fieldValue={item.parsed_data.originCountry} /><input aria-label="Origin country" value={draft.origin_country} onChange={event => set('origin_country', event.target.value)} className={fieldClass} /></label>
            <label className="block text-ui-11 text-tea-text-sec">Origin region <ProvenanceLabel field="originRegion" fieldValue={item.parsed_data.originRegion} /><input aria-label="Origin region" value={draft.origin} onChange={event => set('origin', event.target.value)} className={fieldClass} /></label>
            <label className="block text-ui-11 text-tea-text-sec">Description <ProvenanceLabel field="description" fieldValue={item.parsed_data.description} /><textarea aria-label="Description" rows={3} value={draft.description} onChange={event => set('description', event.target.value)} className={`${fieldClass} py-2`} /></label>
            {!identitySelectionBlocking && identityFields}
            {!quantityBlocking && quantityFields}
            {!costBlocking && costFields}
            {!acquisitionBlocking && acquisitionFields}
          </div>}
          <div className="flex justify-between gap-3"><button type="button" onClick={() => setExpanded(false)} className="tap-target min-h-11 text-ui-12 text-tea-text-sec hover:text-tea-text">Cancel</button><button type="button" disabled={busy || !draft.english_name.trim() || !draft.disposition} onClick={() => void submit()} className="tap-target min-h-11 rounded-md bg-tea-gold px-4 text-ui-12 font-medium text-tea-bg disabled:opacity-50">{busy ? 'Saving…' : `Save ${editLabel}`}</button></div>
        </fieldset>
      )}
    </article>
  );
};

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, Check } from 'lucide-react';
import type { CurateImportDisposition, CurateImportInventoryPurpose, CurateImportItem, CurateImportItemUpdate, CurateImportReviewedField, LookupState } from '../../../lib/api';
import { CurateActionBand, CurateDisclosure, CurateField } from '../CuratePrimitives';
import {
  buildImportCorrectionParsedData,
  compatibleImportHoldings,
  effectiveImportBlockingFields,
  importBlockingMessage,
  importDraftQuantityCostEquation,
  importDisposition,
  importFieldNeedsConfirmation,
  importQuantityCostEquation,
  reviewedFieldsForImportSave,
  validateImportHoldingSelection,
  type ImportMatchOption,
} from './importReviewDomain';
import { ImportMatchPicker } from './ImportMatchPicker';

export interface ImportIdentityOption extends ImportMatchOption { category: 'tea' | 'teaware' }
export interface ImportHoldingOption extends ImportMatchOption { category: 'tea' | 'teaware'; compassEntryId: string | null; purpose: string | null }

interface ImportItemRowProps {
  item: CurateImportItem;
  blockingFields?: string[];
  busy: boolean;
  open?: boolean;
  identityLookup: LookupState<ImportIdentityOption>;
  holdingLookup: LookupState<ImportHoldingOption>;
  onOpen?: () => void;
  onClose?: () => void;
  onSaved?: (itemId: string) => void;
  onRetryIdentities: () => void;
  onRetryHoldings: () => void;
  onUpdate: (updates: CurateImportItemUpdate, onRetrySuccess?: () => void) => Promise<boolean>;
}

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

export const ImportItemRow: React.FC<ImportItemRowProps> = ({
  item, blockingFields, busy, open, identityLookup, holdingLookup, onOpen, onClose, onSaved,
  onRetryIdentities, onRetryHoldings, onUpdate,
}) => {
  const [localOpen, setLocalOpen] = useState(false);
  const expanded = open ?? localOpen;
  const effectiveBlockers = blockingFields ?? effectiveImportBlockingFields(item);
  const normalizedBlockers = effectiveBlockers.map(field => field.replace(/_/g, '').toLocaleLowerCase());
  const identityBlocked = normalizedBlockers.some(field => ['identity', 'duplicateidentity', 'compassentryid', 'proposedcompassentryid'].includes(field));
  const productBlocked = normalizedBlockers.some(field => ['identity', 'productid', 'proposedproductid', 'inventoryholding'].includes(field));
  const [draft, setDraft] = useState(() => draftFromItem(item, identityBlocked, productBlocked));
  const [detailsExpanded, setDetailsExpanded] = useState(() => expanded && effectiveBlockers.length === 0);
  const reviewRef = useRef<HTMLButtonElement>(null);
  const identityResolutionTouched = useRef(false);
  const holdingResolutionTouched = useRef(false);
  const wasExpanded = useRef(false);
  const initializedItemId = useRef(item.id);
  const label = item.english_name || item.name || (item.category === 'tea' ? 'Unnamed tea' : 'Unnamed item');
  const editLabel = item.category === 'tea' ? 'tea' : 'item';
  const headingId = `import-item-${item.id}-heading`;
  const blocking = importBlockingMessage({ ...item, blocking_fields: effectiveBlockers });
  const needsConfirm = (field: Parameters<typeof importFieldNeedsConfirmation>[0]) => importFieldNeedsConfirmation(field, effectiveBlockers);

  const identityOptions = useMemo(() => identityLookup.options.filter(option => option.category === item.category), [identityLookup.options, item.category]);
  const identityState = useMemo<LookupState<ImportIdentityOption>>(() => ({
    ...identityLookup,
    options: identityOptions,
    status: identityLookup.status === 'ready' && identityOptions.length === 0 ? 'empty' : identityLookup.status,
  }), [identityLookup, identityOptions]);
  const selectedIdentityId = draft.compass_entry_id && draft.compass_entry_id !== 'new' ? draft.compass_entry_id : null;
  const holdingOptions = useMemo(() => compatibleImportHoldings(holdingLookup.options, {
    category: item.category, compassEntryId: selectedIdentityId, purpose: draft.purpose || null,
    disposition: (draft.disposition || null) as CurateImportDisposition | null,
  }), [draft.disposition, draft.purpose, holdingLookup.options, item.category, selectedIdentityId]);
  const holdingState = useMemo<LookupState<ImportHoldingOption>>(() => ({
    ...holdingLookup,
    options: holdingOptions,
    status: holdingLookup.status === 'ready' && holdingOptions.length === 0 ? 'empty' : holdingLookup.status,
  }), [holdingLookup, holdingOptions]);
  const proposedIdentityName = identityLookup.options.find(option => option.id === item.proposed_compass_entry_id)?.name
    || (item.proposed_compass_entry_id ? 'Suggested Library identity' : 'New Library identity');
  const compatibleProposedHolding = holdingOptions.find(option => option.id === item.proposed_product_id);

  useEffect(() => {
    const opening = expanded && (!wasExpanded.current || initializedItemId.current !== item.id);
    if (opening) {
      setDraft(draftFromItem(item, identityBlocked, productBlocked));
      setDetailsExpanded(effectiveBlockers.length === 0);
      identityResolutionTouched.current = false;
      holdingResolutionTouched.current = false;
      initializedItemId.current = item.id;
    }
    wasExpanded.current = expanded;
  }, [effectiveBlockers.length, expanded, identityBlocked, item, productBlocked]);

  useEffect(() => {
    if (!expanded || (holdingLookup.status !== 'ready' && holdingLookup.status !== 'empty')) return;
    const productId = validateImportHoldingSelection(draft.product_id, holdingLookup.options, {
      category: item.category, compassEntryId: selectedIdentityId, purpose: draft.purpose || null,
      disposition: (draft.disposition || null) as CurateImportDisposition | null,
    });
    if (productId === draft.product_id) return;
    setDraft(current => ({ ...current, product_id: productId }));
    holdingResolutionTouched.current = true;
  }, [draft.disposition, draft.product_id, draft.purpose, expanded, holdingLookup.options, holdingLookup.status, item.category, selectedIdentityId]);

  const set = (key: keyof typeof draft, next: string) => setDraft(current => ({ ...current, [key]: next }));
  const setPurpose = (purpose: string) => {
    const productId = validateImportHoldingSelection(draft.product_id, holdingLookup.options, {
      category: item.category, compassEntryId: selectedIdentityId, purpose: purpose || null,
      disposition: (draft.disposition || null) as CurateImportDisposition | null,
    });
    if (productId !== draft.product_id) holdingResolutionTouched.current = true;
    setDraft(current => ({ ...current, purpose, product_id: productId }));
  };
  const setIdentity = (compassEntryId: string) => {
    const nextIdentityId = compassEntryId && compassEntryId !== 'new' ? compassEntryId : null;
    const productId = compassEntryId === 'new' ? 'new' : validateImportHoldingSelection(draft.product_id, holdingLookup.options, {
      category: item.category, compassEntryId: nextIdentityId, purpose: draft.purpose || null,
      disposition: (draft.disposition || null) as CurateImportDisposition | null,
    });
    identityResolutionTouched.current = true;
    if (productId !== draft.product_id) holdingResolutionTouched.current = true;
    setDraft(current => ({ ...current, compass_entry_id: compassEntryId, product_id: productId }));
  };
  const requestOpen = () => onOpen ? onOpen() : setLocalOpen(true);
  const cancel = () => {
    if (onClose) onClose(); else setLocalOpen(false);
    const focusReview = () => reviewRef.current?.focus();
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(focusReview); else focusReview();
  };

  const submit = async () => {
    const parsedValues = buildImportCorrectionParsedData(item.parsed_data, {
      englishName: draft.english_name.trim() || null, originalName: draft.original_name.trim() || null, chineseName: draft.chinese_name.trim() || null,
      type: draft.tea_type.trim() || null, classification: draft.classification.trim() || null, year: draft.year ? Number(draft.year) : null,
      form: draft.form.trim() || null, originCountry: draft.origin_country.trim() || null, originRegion: draft.origin.trim() || null,
      description: draft.description.trim() || null, inventoryPurpose: (draft.purpose || null) as CurateImportInventoryPurpose | null,
      compassSelection: draft.compass_entry_id || null, productSelection: draft.product_id || null,
      identityTouched: identityResolutionTouched.current, productSelectionTouched: holdingResolutionTouched.current,
      disposition: draft.disposition as CurateImportDisposition, acquired: draft.disposition === 'received',
      packWeight: draft.pack_weight ? Number(draft.pack_weight) : null, weightUnit: (draft.weight_unit || null) as CurateImportItem['weight_unit'],
      packCount: draft.pack_count ? Number(draft.pack_count) : null, priceAmount: draft.price_amount.trim() || null,
      currency: draft.currency.trim().toUpperCase() || null, priceBasis: draft.price_basis as CurateImportItem['price_basis'],
    });
    const visibleMaterialFields: CurateImportReviewedField[] = [
      ...(needsConfirm('englishName') ? ['englishName' as const] : []),
      ...(needsConfirm('packWeight') || needsConfirm('weightUnit') || needsConfirm('packCount') ? ['packWeight' as const, 'weightUnit' as const, 'packCount' as const] : []),
      ...(needsConfirm('priceAmount') || needsConfirm('currency') || needsConfirm('priceBasis') ? ['priceBasis' as const, 'priceAmount' as const, 'currency' as const] : []),
      ...(needsConfirm('inventoryPurpose') ? ['inventoryPurpose' as const] : []),
      'disposition',
    ];
    const reviewedFields = reviewedFieldsForImportSave(
      item, draft.compass_entry_id, draft.product_id,
      identityResolutionTouched.current || holdingResolutionTouched.current, visibleMaterialFields,
    );
    const updates: CurateImportItemUpdate = {
      name: draft.english_name.trim() || null, english_name: draft.english_name.trim() || null,
      original_name: draft.original_name.trim() || null,
      pack_weight: draft.pack_weight ? Number(draft.pack_weight) : null,
      weight_unit: (draft.weight_unit || null) as CurateImportItem['weight_unit'],
      pack_count: draft.pack_count ? Number(draft.pack_count) : null,
      currency: draft.currency.trim().toUpperCase() || null,
      price_basis: draft.price_basis as CurateImportItem['price_basis'],
      parsed_data: parsedValues,
      ...(reviewedFields.length ? { reviewed_fields: reviewedFields } : {}),
    };
    const completeSave = () => {
      if (onSaved) onSaved(item.id); else setLocalOpen(false);
    };
    if (!await onUpdate(updates, completeSave)) return;
    completeSave();
  };

  const field = (name: Parameters<typeof needsConfirm>[0]) => needsConfirm(name) ? 'Confirm' : undefined;
  const draftEquation = importDraftQuantityCostEquation({
    packWeight: draft.pack_weight,
    weightUnit: draft.weight_unit,
    packCount: draft.pack_count,
    priceAmount: draft.price_amount,
    currency: draft.currency,
    priceBasis: draft.price_basis,
  });
  const identityFields = ['englishName', 'chineseName', 'originalName', 'type', 'year', 'originCountry', 'originRegion', 'classification', 'form', 'description'] as const;
  const purchaseFields = ['packWeight', 'weightUnit', 'packCount', 'priceAmount', 'currency', 'priceBasis'] as const;
  const inventoryFields = ['disposition', 'identity', 'holding', 'inventoryPurpose'] as const;
  const hasBlocked = (fields: readonly Parameters<typeof needsConfirm>[0][]) => fields.some(needsConfirm);
  const hasRemaining = (fields: readonly Parameters<typeof needsConfirm>[0][]) => fields.some(name => !needsConfirm(name));
  const show = (name: Parameters<typeof needsConfirm>[0], blocked: boolean) => needsConfirm(name) === blocked;

  const renderIdentityFields = (blocked: boolean) => <>
    {show('englishName', blocked) && <CurateField label="English name" status={field('englishName')}><input aria-label="English name" value={draft.english_name} onChange={event => set('english_name', event.target.value)} /></CurateField>}
    {(show('chineseName', blocked) || show('originalName', blocked)) && <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {show('chineseName', blocked) && <CurateField label="Chinese name" status={field('chineseName')}><input aria-label="Chinese name" value={draft.chinese_name} onChange={event => set('chinese_name', event.target.value)} /></CurateField>}
      {show('originalName', blocked) && <CurateField label="Original name" status={field('originalName')}><input aria-label="Original name" value={draft.original_name} onChange={event => set('original_name', event.target.value)} /></CurateField>}
    </div>}
    {(show('type', blocked) || show('year', blocked)) && <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {show('type', blocked) && <CurateField label="Tea type" status={field('type')}><input aria-label="Tea type" value={draft.tea_type} onChange={event => set('tea_type', event.target.value)} /></CurateField>}
      {show('year', blocked) && <CurateField label="Year" status={field('year')}><input aria-label="Year" inputMode="numeric" value={draft.year} onChange={event => set('year', event.target.value)} /></CurateField>}
    </div>}
    {(show('originCountry', blocked) || show('originRegion', blocked)) && <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {show('originCountry', blocked) && <CurateField label="Origin country" status={field('originCountry')}><input aria-label="Origin country" value={draft.origin_country} onChange={event => set('origin_country', event.target.value)} /></CurateField>}
      {show('originRegion', blocked) && <CurateField label="Origin region" status={field('originRegion')}><input aria-label="Origin region" value={draft.origin} onChange={event => set('origin', event.target.value)} /></CurateField>}
    </div>}
    {show('classification', blocked) && <CurateField label="Production or classification" status={field('classification')}><input aria-label="Production or classification" value={draft.classification} onChange={event => set('classification', event.target.value)} /></CurateField>}
    {show('form', blocked) && <CurateField label="Form" status={field('form')}><input aria-label="Form" value={draft.form} onChange={event => set('form', event.target.value)} /></CurateField>}
    {show('description', blocked) && <CurateField label="Description" status={field('description')}><textarea aria-label="Description" rows={3} value={draft.description} onChange={event => set('description', event.target.value)} /></CurateField>}
  </>;

  const renderPurchaseFields = (blocked: boolean) => <>
    {(show('packWeight', blocked) || show('weightUnit', blocked) || show('packCount', blocked)) && <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
      {show('packWeight', blocked) && <CurateField label="Pack weight" status={field('packWeight')}><input aria-label="Pack weight" inputMode="decimal" value={draft.pack_weight} onChange={event => set('pack_weight', event.target.value)} /></CurateField>}
      {show('weightUnit', blocked) && <CurateField label="Weight unit" status={field('weightUnit')}><select aria-label="Weight unit" value={draft.weight_unit} onChange={event => set('weight_unit', event.target.value)}><option value="">Choose unit</option><option value="g">g</option><option value="kg">kg</option><option value="count">count</option></select></CurateField>}
      {show('packCount', blocked) && <CurateField label="Pack count" status={field('packCount')}><input aria-label="Pack count" inputMode="numeric" value={draft.pack_count} onChange={event => set('pack_count', event.target.value)} /></CurateField>}
    </div>}
    {(show('priceAmount', blocked) || show('currency', blocked) || show('priceBasis', blocked)) && <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
      {show('priceAmount', blocked) && <CurateField label="Price" status={field('priceAmount')}><input aria-label="Price amount" inputMode="decimal" value={draft.price_amount} onChange={event => set('price_amount', event.target.value)} /></CurateField>}
      {show('currency', blocked) && <CurateField label="Currency" status={field('currency')}><input aria-label="Currency" value={draft.currency} onChange={event => set('currency', event.target.value)} /></CurateField>}
      {show('priceBasis', blocked) && <CurateField label="Price interpretation" status={field('priceBasis')}><select aria-label="Price interpretation" value={draft.price_basis} onChange={event => set('price_basis', event.target.value)}><option value="unknown">Choose interpretation</option><option value="per_pack">Per pack</option><option value="line_total">Line total</option></select></CurateField>}
    </div>}
    <p className="curate-support break-words font-mono text-tea-text-dim">{draftEquation}</p>
  </>;

  const renderInventoryFields = (blocked: boolean) => <>
    {show('disposition', blocked) && <CurateField label="Destination" status={field('disposition')}><select aria-label="Destination" value={draft.disposition} onChange={event => set('disposition', event.target.value)}><option value="">Choose destination</option><option value="received">Received now</option><option value="in_transit">In transit</option><option value="library_only">Library only</option></select></CurateField>}
    {show('identity', blocked) && <div className="space-y-1">
      <div className="flex items-center justify-between"><p className="curate-support text-tea-text-sec">Library match</p>{blocked && <span className="curate-inline-label text-tea-gold">Confirm</span>}</div>
      <ImportMatchPicker label={item.category === 'tea' ? 'Match tea' : 'Match teaware'} lookup={identityState} selectedId={draft.compass_entry_id} proposedId={item.proposed_compass_entry_id} proposedName={proposedIdentityName} newOptionLabel="Create new Library identity" disabled={busy} onRetry={onRetryIdentities} onSelect={setIdentity} />
    </div>}
    {draft.disposition !== 'library_only' && show('holding', blocked) && <div className="space-y-1">
      <div className="flex items-center justify-between"><p className="curate-support text-tea-text-sec">Inventory holding</p>{blocked && <span className="curate-inline-label text-tea-gold">Confirm</span>}</div>
      <ImportMatchPicker label="Choose stock record" lookup={holdingState} selectedId={draft.product_id} proposedId={compatibleProposedHolding?.id} proposedName={compatibleProposedHolding?.name || 'New Inventory holding'} newOptionLabel="Create new Inventory holding" disabled={busy} onRetry={onRetryHoldings} onSelect={selection => { holdingResolutionTouched.current = true; set('product_id', selection); }} />
    </div>}
    {draft.disposition !== 'library_only' && show('inventoryPurpose', blocked) && <CurateField label="Inventory purpose" status={field('inventoryPurpose')}><select aria-label="Inventory purpose" value={draft.purpose} onChange={event => setPurpose(event.target.value)}><option value="">Choose purpose</option><option value="working">Tea service</option><option value="personal">Personal collection</option><option value="sample">Sample</option></select></CurateField>}
  </>;
  return (
    <article data-testid="import-item-row" data-import-item-id={item.id} data-blocked={effectiveBlockers.length ? 'true' : 'false'} aria-labelledby={headingId} tabIndex={-1} className="scroll-mt-24 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50">
      <div className="flex min-w-0 items-start gap-2">
        <span className={`mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${effectiveBlockers.length ? 'text-tea-gold' : 'bg-tea-accent-sub text-tea-gold'}`} aria-label={effectiveBlockers.length ? 'Needs attention' : 'Ready'}>{effectiveBlockers.length ? <AlertCircle size={16} /> : <Check size={13} />}</span>
        <div className="min-w-0 flex-1">
          <h6 id={headingId} className="break-words font-display text-ui-20 leading-snug text-tea-text">{label}</h6>
          {(item.original_name || item.chinese_name) && <p className="mt-0.5 break-words text-ui-12 text-tea-text-sec">
            {[item.original_name, item.chinese_name].filter((name, index, names) => name && names.indexOf(name) === index).join(' · ')}
          </p>}
          <p className="mt-0.5 break-words font-mono text-ui-10 text-tea-text-dim">{importQuantityCostEquation(item)}</p>
          {blocking && <p role="alert" className="mt-1 text-ui-11 text-tea-gold">{blocking}</p>}
        </div>
        <button ref={reviewRef} type="button" disabled={busy} aria-expanded={expanded} onClick={requestOpen} className="curate-action curate-compact-target shrink-0 text-tea-text-sec hover:text-tea-text disabled:opacity-50">Review</button>
      </div>

      {expanded && <fieldset disabled={busy} data-import-editor data-curate-source data-visual-layout="continuous-sheet" className="mt-3 border-t border-tea-border">
        {hasBlocked(identityFields) && <section className="curate-cluster curate-zone-identity space-y-2" data-zone="identity" aria-labelledby={`${headingId}-identity`}>
          <h5 id={`${headingId}-identity`} className="curate-section-title">Identity</h5>
          {renderIdentityFields(true)}
        </section>}
        {hasBlocked(purchaseFields) && <section className="curate-cluster curate-zone-purchase space-y-2" data-zone="purchase" aria-labelledby={`${headingId}-purchase`}>
          <h5 id={`${headingId}-purchase`} className="curate-section-title">Purchase</h5>
          {renderPurchaseFields(true)}
        </section>}
        {hasBlocked(inventoryFields) && <section className="curate-cluster curate-zone-notes space-y-2" data-zone="inventory" aria-labelledby={`${headingId}-inventory`}>
          <h5 id={`${headingId}-inventory`} className="curate-section-title">Inventory</h5>
          {renderInventoryFields(true)}
        </section>}
        <div className="curate-cluster">
          <CurateDisclosure id={`import-${item.id}-more-details`} label="More tea details" open={detailsExpanded} onToggle={() => setDetailsExpanded(current => !current)} disabled={busy}>
            <div className="space-y-3 pt-2">
              {hasRemaining(identityFields) && <section className="space-y-2" data-detail-zone="identity" aria-labelledby={`${headingId}-identity-details`}>
                <h5 id={`${headingId}-identity-details`} className="curate-section-title">Identity</h5>
                {renderIdentityFields(false)}
              </section>}
              {hasRemaining(purchaseFields) && <section className="space-y-2" data-detail-zone="purchase" aria-labelledby={`${headingId}-purchase-details`}>
                <h5 id={`${headingId}-purchase-details`} className="curate-section-title">Purchase</h5>
                {renderPurchaseFields(false)}
              </section>}
              {hasRemaining(inventoryFields) && <section className="space-y-2" data-detail-zone="inventory" aria-labelledby={`${headingId}-inventory-details`}>
                <h5 id={`${headingId}-inventory-details`} className="curate-section-title">Inventory</h5>
                {renderInventoryFields(false)}
              </section>}
            </div>
          </CurateDisclosure>
          <CurateActionBand className="mt-2" neutral={[{ label: 'Cancel', onClick: cancel, disabled: busy }]} primary={{ label: `Save ${editLabel}`, busy, busyLabel: 'Saving…', disabled: !draft.english_name.trim() || !draft.disposition, onClick: () => void submit() }} columns={{ base: 2 }} />
        </div>
      </fieldset>}
    </article>
  );
};

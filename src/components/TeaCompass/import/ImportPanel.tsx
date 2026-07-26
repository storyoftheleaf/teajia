import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { api, ApiError, type CurateImportDetail, type CurateImportFinalizeResult, type CurateImportItem, type CurateImportItemUpdate, type CurateImportSourceKind, type LookupState } from '../../../lib/api';
import { ImportInput } from './ImportInput';
import { ImportBatchReview } from './ImportBatchReview';
import type { ImportDraft, ImportPanelState } from './importTypes';
import { TYPOGRAPHY_CLASSES } from '../../../designTokens';
import type { CurateJourney } from '../types';
import type { ImportVendorOption } from './ImportVendorGroup';
import { normalizeImportDetail } from './importReviewDomain';
import { clearImportDraft, loadImportDraft, saveImportDraft } from './importDraftStorage';
import { ImportEvidencePreview } from './ImportEvidencePreview';
import { failedImportSourceIds, unmatchedImportEvidence } from './importEvidenceSelection';
import { ImportEvidenceCard } from './ImportEvidenceCard';
import type { ImportHoldingOption, ImportIdentityOption } from './ImportItemRow';
import { ImportCompletionSummary } from './ImportCompletionSummary';
import { ImportFolioHeader } from './ImportFolioHeader';
import { folioPhase, folioPhaseContext } from './importFolioPresentation';
import { importRunErrorMessage } from './importErrorMessage';
import { ImportDeleteAction } from './ImportDeleteAction';

interface ImportPanelProps {
  initialDetail: CurateImportDetail | null;
  onDetailChange: (detail: CurateImportDetail) => void;
  onFinalized: (result: CurateImportFinalizeResult) => void | Promise<void>;
  onClose: () => void;
  onNew: () => void;
  accountId: string;
}

const parseDraftItems = (draft: ImportDraft) => {
  return draft.text.split(/\r?\n/).map(line => line.trim()).filter(Boolean).map((line, position) => {
    const uncertain = line.startsWith('?');
    const name = line.replace(/^\?\s*/, '').split(/[-—]/)[0].trim();
    return {
      position, category: /\b(pot|cup|bowl|gaiwan|kettle)\b/i.test(line) ? 'teaware' as const : 'tea' as const,
      name, raw_text: line, parsed_data: { name }, confidence: uncertain ? 0.42 : 0.9,
      uncertainty: uncertain ? { name: 'Could be a transliteration' } : {},
    };
  });
};

const errorMessage = (error: unknown, fallback: string) => {
  if (error instanceof ApiError) {
    const issues = error.data?.issues || error.data?.errors || error.data?.blocking;
    if (Array.isArray(issues)) {
      const messages = issues.map(issue => typeof issue === 'string' ? issue : issue && typeof issue === 'object' && 'message' in issue ? String(issue.message) : '').filter(Boolean);
      if (messages.length) return messages.join(' ');
    }
  }
  return error instanceof Error ? error.message : fallback;
};

const loadingLookup = <T,>(): LookupState<T> => ({ status: 'loading', options: [], error: null });
const completedLookup = <T,>(options: T[]): LookupState<T> => ({ status: options.length ? 'ready' : 'empty', options, error: null });
const lookupRows = (result: unknown, key: string): Array<Record<string, unknown>> => Array.isArray(result)
  ? result as Array<Record<string, unknown>>
  : result && typeof result === 'object' && key in result && Array.isArray((result as Record<string, unknown>)[key])
    ? (result as Record<string, unknown>)[key] as Array<Record<string, unknown>> : [];

export const ImportPanel: React.FC<ImportPanelProps> = ({ initialDetail, onDetailChange, onFinalized, onClose, onNew, accountId }) => {
  const [draft, setDraft] = useState<ImportDraft>(() => {
    const saved = initialDetail ? null : loadImportDraft(accountId);
    return {
      text: saved?.text ?? '', sourceKind: 'paste', journeyId: saved?.journeyId ?? null,
      evidence: (saved?.attachments ?? []).map(item => ({ ...item, file: null, status: 'reselect' as const, error: null })),
    };
  });
  const [state, setState] = useState<ImportPanelState>({ phase: initialDetail ? 'review' : 'input', detail: initialDetail, error: null });
  const [journeyLookup, setJourneyLookup] = useState<LookupState<CurateJourney>>(loadingLookup);
  const [vendorLookup, setVendorLookup] = useState<LookupState<ImportVendorOption>>(loadingLookup);
  const [identityLookup, setIdentityLookup] = useState<LookupState<ImportIdentityOption>>(loadingLookup);
  const [holdingLookup, setHoldingLookup] = useState<LookupState<ImportHoldingOption>>(loadingLookup);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [operationError, setOperationError] = useState<string | null>(null);
  const [confirmClose, setConfirmClose] = useState(false);
  const [completion, setCompletion] = useState<CurateImportFinalizeResult | null>(null);
  const normalizedDetail = useMemo(() => state.detail ? normalizeImportDetail(state.detail) : null, [state.detail]);
  const retryAction = useRef<null | (() => Promise<void>)>(null);
  const createIdempotencyKey = useRef(crypto.randomUUID());
  const closeRef = useRef<HTMLButtonElement>(null);
  const submitRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const evidenceKind: CurateImportSourceKind = useMemo(() => draft.evidence.some(item => item.kind === 'photo') ? 'photo' : draft.evidence.length ? 'invoice' : 'paste', [draft.evidence]);
  const draftDirty = state.phase !== 'review' && (draft.text.trim().length > 0 || draft.journeyId !== null || draft.evidence.length > 0);
  const persistedEvidenceSources = state.detail?.sources.filter(source => source.r2_object_key) ?? [];
  const unmatchedLocalEvidence = unmatchedImportEvidence(draft.evidence, state.detail?.sources ?? []);
  const currentFolioPhase = folioPhase({ phase: state.phase, completion: Boolean(completion) });
  const folioContext = folioPhaseContext(currentFolioPhase, normalizedDetail, completion);

  const preserveDraft = () => saveImportDraft(accountId, {
    text: draft.text,
    journeyId: draft.journeyId,
    attachments: draft.evidence.map(({ id, name, size, type, kind }) => ({ id, name, size, type, kind })),
  });
  const requestClose = () => {
    if (busyId) return;
    if (!draftDirty) return onClose();
    preserveDraft();
    setConfirmClose(true);
  };

  useEffect(() => { closeRef.current?.focus(); }, []);
  useEffect(() => {
    const overlay = overlayRef.current;
    const surface = overlay?.parentElement;
    if (!overlay || !surface) return;
    const siblings = Array.from(surface.children).filter(child => child !== overlay) as HTMLElement[];
    const previous = siblings.map(element => ({ element, ariaHidden: element.getAttribute('aria-hidden'), inert: element.inert }));
    siblings.forEach(element => { element.setAttribute('aria-hidden', 'true'); element.inert = true; });
    return () => previous.forEach(({ element, ariaHidden, inert }) => {
      if (ariaHidden == null) element.removeAttribute('aria-hidden'); else element.setAttribute('aria-hidden', ariaHidden);
      element.inert = inert;
    });
  }, []);
  useEffect(() => {
    if (!initialDetail && draftDirty) preserveDraft();
  }, [accountId, draft, draftDirty, initialDetail]);
  const loadJourneys = () => {
    setJourneyLookup(loadingLookup());
    void api.curateContext.listJourneys().then(result => setJourneyLookup(completedLookup(result.journeys))).catch(error => setJourneyLookup({ status: 'error', options: [], error: errorMessage(error, 'Could not load sourcing runs') }));
  };
  const loadVendors = () => {
    setVendorLookup(loadingLookup());
    void api.customers.list(undefined, 'vendor').then((result: unknown) => setVendorLookup(completedLookup(lookupRows(result, 'customers').map(row => ({ id: String(row.id), name: String(row.name || row.company_name || 'Unnamed vendor') })))))
      .catch(error => setVendorLookup({ status: 'error', options: [], error: errorMessage(error, 'Could not load existing vendors') }));
  };
  const loadIdentities = () => {
    setIdentityLookup(loadingLookup());
    void api.compass.list().then((result: unknown) => {
      const options = lookupRows(result, 'entries').map(row => ({
        id: String(row.id), name: String(row.name || row.english_name || row.chinese_name || 'Unnamed Library identity'),
        category: row.category === 'teaware' ? 'teaware' as const : 'tea' as const,
        subtitle: [row.chinese_name, row.year, row.origin_region].filter(Boolean).join(' · ') || null,
      }));
      setIdentityLookup(completedLookup(options));
    }).catch(error => setIdentityLookup({ status: 'error', options: [], error: errorMessage(error, 'Could not load Library identities') }));
  };
  const loadHoldings = () => {
    setHoldingLookup(loadingLookup());
    void api.products.list().then((result: unknown) => {
      const options = lookupRows(result, 'products').map(row => ({
        id: String(row.id), name: String(row.given_name || row.product_name || row.name || 'Unnamed Inventory holding'),
        category: String(row.type || row.category).toLocaleLowerCase() === 'teaware' ? 'teaware' as const : 'tea' as const,
        compassEntryId: typeof row.source_compass_entry_id === 'string' ? row.source_compass_entry_id : typeof row.sourceCompassEntryId === 'string' ? row.sourceCompassEntryId : null,
        purpose: typeof row.inventory_purpose === 'string' ? row.inventory_purpose : typeof row.inventoryPurpose === 'string' ? row.inventoryPurpose : null,
        subtitle: [row.inventory_purpose || row.inventoryPurpose, row.vendor].filter(Boolean).join(' · ') || null,
      }));
      setHoldingLookup(completedLookup(options));
    }).catch(error => setHoldingLookup({ status: 'error', options: [], error: errorMessage(error, 'Could not load Inventory holdings') }));
  };
  useEffect(() => { loadJourneys(); loadVendors(); loadIdentities(); loadHoldings(); }, [accountId]);
  useEffect(() => {
    const batchId = initialDetail?.batch.id;
    if (!batchId) return;
    let active = true;
    let refreshing = false;
    const refresh = async () => {
      if (refreshing) return;
      refreshing = true;
      try {
        const latest = await api.curateImports.get(batchId);
        if (!latest?.batch || latest.batch.id !== batchId) return;
        const detail = normalizeImportDetail(latest);
        if (!active) return;
        setState(current => current.phase === 'review' && current.detail?.batch.id === batchId
          ? { ...current, detail, error: null }
          : current);
        onDetailChange(detail);
      } catch {
        // Keep the last saved review available when a background refresh fails.
      } finally {
        refreshing = false;
      }
    };
    void refresh();
    window.addEventListener('focus', refresh);
    return () => {
      active = false;
      window.removeEventListener('focus', refresh);
    };
  }, [accountId, initialDetail?.batch.id, onDetailChange]);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        if (confirmClose) { setConfirmClose(false); requestAnimationFrame(() => closeRef.current?.focus()); return; }
        return requestClose();
      }
      if (event.key !== 'Tab' || !panelRef.current) return;
      const controls = Array.from(panelRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), textarea, input:not([disabled]):not([tabindex="-1"]), select:not([disabled]), [tabindex]:not([tabindex="-1"])')).filter(el => !el.hasAttribute('hidden') && el.getAttribute('aria-hidden') !== 'true');
      if (!controls.length) return;
      const first = controls[0]; const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [busyId, confirmClose, draftDirty, onClose]);

  const runImport = async () => {
    if (busyId) return;
    retryAction.current = null;
    setOperationError(null);
    setBusyId('__import');
    setState(current => ({ ...current, phase: 'parsing', error: null }));
    let detail = state.detail;
    try {
      await new Promise(resolve => window.setTimeout(resolve, 250));
      const reviewText = draft.text.trim();
      if (!detail) {
        detail = await api.curateImports.create({
          idempotency_key: createIdempotencyKey.current,
          journey_id: draft.journeyId || undefined,
          title: draft.evidence[0]?.name || 'Imported list', source_kind: draft.text.trim() ? 'paste' : evidenceKind,
          pasted_text: reviewText || undefined, items: parseDraftItems({ ...draft, text: reviewText }),
        });
        detail = normalizeImportDetail(detail);
        setState(current => ({ ...current, detail }));
      }
      const savedEvidenceIds = new Set(detail.sources.map(source => String(source.metadata?.client_evidence_id || '')).filter(Boolean));
      const uploadable = draft.evidence.filter(evidence => evidence.file
        && !(evidence.status === 'failed' && (evidence.error === 'Files must be 5 MB or smaller' || evidence.error === 'This file type cannot be analyzed'))
        && !savedEvidenceIds.has(evidence.id));
      if (uploadable.length) setDraft(current => ({ ...current, evidence: current.evidence.map(item => uploadable.some(candidate => candidate.id === item.id) ? { ...item, status: 'uploading', error: null } : item) }));
      const uploadResults = await Promise.all(uploadable.map(async evidence => {
        try {
          const source = await api.curateImports.uploadEvidence(detail!.batch.id, evidence.file!, evidence.id);
          const status = source.analysis_status === 'reference_only' ? 'reference_only' as const : 'pending' as const;
          setDraft(current => ({ ...current, evidence: current.evidence.map(item => item.id === evidence.id ? { ...item, status, error: null } : item) }));
          return { source, evidenceId: evidence.id, error: null };
        } catch (error) {
          const message = errorMessage(error, 'Record upload failed');
          setDraft(current => ({ ...current, evidence: current.evidence.map(item => item.id === evidence.id ? { ...item, status: 'failed', error: message } : item) }));
          return { source: null, evidenceId: evidence.id, error: message };
        }
      }));
      const uploadedSources = uploadResults.flatMap(result => result.source ? [result.source] : []);
      if (uploadedSources.length) {
        const known = new Set(detail.sources.map(source => source.id));
        detail = { ...detail, sources: [...detail.sources, ...uploadedSources.filter(source => !known.has(source.id))] };
        setState(current => ({ ...current, detail }));
        onDetailChange(detail);
      }
      const uploadFailure = uploadResults.find(result => result.error);
      if (uploadFailure && !detail.sources.length) throw new Error(uploadFailure.error!);
      const analysisWasComplete = detail.batch.analysis_state === 'complete' || detail.batch.analysis_state === 'completed';
      const newlyUploadedSourceIds = uploadedSources.filter(source => source.analysis_status !== 'reference_only').map(source => source.id);
      const retrySourceIds = detail.batch.analysis_state === 'failed'
        ? failedImportSourceIds(detail.sources)
        : analysisWasComplete ? newlyUploadedSourceIds : undefined;
      if (detail.batch.analysis_state === 'failed' && !retrySourceIds?.length) throw new Error('No failed records are available to retry');
      if (!analysisWasComplete || retrySourceIds?.length) detail = normalizeImportDetail(await api.curateImports.analyze(detail.batch.id, retrySourceIds));
      if (uploadFailure) throw new Error(uploadFailure.error!);
      clearImportDraft(accountId);
      setState({ phase: 'review', detail, error: null });
      onDetailChange(detail);
    } catch (error) {
      if (detail?.batch.id) {
        try {
          detail = normalizeImportDetail(await api.curateImports.get(detail.batch.id));
          onDetailChange(detail);
        } catch { /* Keep the last saved detail when refresh itself is unavailable. */ }
      }
      setState(current => ({ ...current, phase: 'error', detail: detail ?? current.detail, error: draft.text.trim() ? importRunErrorMessage(error) : errorMessage(error, 'Import failed') }));
    } finally { setBusyId(null); }
  };
  const replaceItem = (updated: CurateImportItem) => {
    setState(current => {
      if (!current.detail) return current;
      const detail = { ...current.detail, items: current.detail.items.map(item => item.id === updated.id ? updated : item) };
      return { ...current, detail };
    });
  };
  const refreshDetail = async (batchId: string) => {
    const detail = normalizeImportDetail(await api.curateImports.get(batchId));
    setState(current => ({ ...current, detail })); onDetailChange(detail);
  };
  const updateItem = async (item: CurateImportItem, updates: CurateImportItemUpdate, onRetrySuccess?: () => void) => {
    if (busyId) return false;
    setBusyId(item.id);
    const action = async () => { replaceItem(await api.curateImports.updateItem(item.batch_id, item.id, updates)); await refreshDetail(item.batch_id); };
    try { setOperationError(null); await action(); return true; }
    catch (error) {
      retryAction.current = async () => { await action(); onRetrySuccess?.(); };
      setOperationError(errorMessage(error, 'Could not save correction'));
      return false;
    }
    finally { setBusyId(null); }
  };
  const setJourney = async (journeyId: string | null): Promise<boolean> => {
    if (!state.detail || busyId) return false;
    setBusyId('__journey');
    const action = async () => { const batchId = state.detail!.batch.id; await api.curateImports.setJourney(batchId, journeyId); await refreshDetail(batchId); };
    try { setOperationError(null); await action(); return true; }
    catch (error) { retryAction.current = action; setOperationError(errorMessage(error, 'Could not change sourcing run')); return false; }
    finally { setBusyId(null); }
  };
  const createJourney = async (input: { name: string; season?: string; year?: number }): Promise<boolean> => {
    if (busyId) return false;
    setBusyId('__create-journey');
    let journey: CurateJourney | null = null;
    const action = async () => {
      const createdJourney = journey ?? await api.curateContext.createJourney(input);
      journey = createdJourney;
      setJourneyLookup(current => completedLookup(current.options.some(candidate => candidate.id === createdJourney.id) ? current.options : [...current.options, createdJourney]));
      setDraft(current => ({ ...current, journeyId: createdJourney.id }));
      if (state.detail) {
        const batchId = state.detail.batch.id;
        await api.curateImports.setJourney(batchId, createdJourney.id);
        await refreshDetail(batchId);
      }
    };
    try { setOperationError(null); await action(); return true; }
    catch (error) { retryAction.current = action; setOperationError(errorMessage(error, 'Could not create sourcing run')); return false; }
    finally { setBusyId(null); }
  };
  const changeVendor = async (groupId: string, vendorId: string): Promise<boolean> => {
    if (!state.detail || busyId) return false;
    setBusyId(`group:${groupId}`);
    const action = async () => { await api.curateImports.updateGroup(state.detail!.batch.id, groupId, { resolved_vendor_customer_id: vendorId }); await refreshDetail(state.detail!.batch.id); };
    try { setOperationError(null); await action(); return true; }
    catch (error) { retryAction.current = action; setOperationError(errorMessage(error, 'Could not change vendor')); return false; }
    finally { setBusyId(null); }
  };
  const createVendor = async (groupId: string, name: string): Promise<boolean> => {
    if (!state.detail || busyId) return false;
    setBusyId(`group:${groupId}`);
    const action = async () => { await api.curateImports.createVendorForGroup(state.detail!.batch.id, groupId, { name }); await refreshDetail(state.detail!.batch.id); };
    try { setOperationError(null); await action(); return true; }
    catch (error) { retryAction.current = action; setOperationError(errorMessage(error, 'Could not create vendor')); return false; }
    finally { setBusyId(null); }
  };
  const retryAnalysis = async (sourceIds?: string[]) => {
    if (!state.detail || busyId) return;
    setBusyId(sourceIds?.length === 1 ? `source:${sourceIds[0]}` : '__analysis');
    const action = async () => { const detail = normalizeImportDetail(await api.curateImports.analyze(state.detail!.batch.id, sourceIds)); setState({ phase: 'review', detail, error: null }); onDetailChange(detail); };
    try { setOperationError(null); await action(); retryAction.current = null; }
    catch (error) { retryAction.current = action; setOperationError(errorMessage(error, 'Could not analyze saved records')); }
    finally { setBusyId(null); }
  };
  const finalize = async () => {
    if (!state.detail || busyId) return;
    setBusyId('__finalize');
    const action = async () => {
      const batchId = state.detail!.batch.id;
      const result = await api.curateImports.finalize(batchId, `curate-import-finalize:${batchId}`);
      setCompletion(result);
      try { await onFinalized(result); } catch { /* The durable receipt summary remains available if background refresh fails. */ }
    };
    try { setOperationError(null); await action(); }
    catch (error) { retryAction.current = action; setOperationError(errorMessage(error, 'Could not add this import to Inventory')); }
    finally { setBusyId(null); }
  };
  const abandon = async () => {
    if (!state.detail || busyId) return;
    setBusyId('__abandon');
    const action = async () => { await api.curateImports.abandon(state.detail!.batch.id); onDetailChange({ ...state.detail!, batch: { ...state.detail!.batch, review_state: 'abandoned' } }); onClose(); };
    try { setOperationError(null); await action(); retryAction.current = null; }
    catch (error) { retryAction.current = action; setOperationError(errorMessage(error, 'Could not delete import')); }
    finally { setBusyId(null); }
  };

  return (
    <div ref={overlayRef} data-testid="import-folio-shell" className="fixed inset-0 sidebar-inset z-modal bg-tea-bg text-tea-text" role="presentation">
      <div ref={panelRef} role="dialog" aria-modal="true" aria-label="Import into Curate" className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-tea-bg">
        <ImportFolioHeader phase={currentFolioPhase} context={folioContext} busy={Boolean(busyId)} closeRef={closeRef} onClose={requestClose} />
        <div className="min-h-0 flex-1 overflow-y-auto" aria-live="polite">
          <div className={`pb-nav mx-auto w-full max-w-3xl ${state.phase === 'review' ? 'px-2 py-2 sm:px-4 lg:py-4' : 'px-4 py-7 sm:px-6 lg:py-10'}`}>
          {confirmClose && <div role="group" aria-label="Keep import draft" className="mb-4 rounded-md border border-tea-border bg-tea-surface p-4">
            <h3 className={`${TYPOGRAPHY_CLASSES.h3} text-tea-text`}>Keep import draft?</h3>
            <p className="mt-2 text-ui-13 leading-relaxed text-tea-text-sec">Your pasted text, sourcing run, and attachment names are saved for this account. Files will need to be reselected.</p>
            <div className="mt-4 flex justify-between gap-3">
              <button type="button" onClick={() => { clearImportDraft(accountId); setConfirmClose(false); onClose(); }} className="tap-target min-h-11 text-ui-12 text-tea-text-sec hover:text-tea-text">Discard draft</button>
              <button type="button" autoFocus onClick={() => { preserveDraft(); setConfirmClose(false); onClose(); }} className="tap-target min-h-11 rounded-md bg-tea-gold px-4 text-ui-12 font-medium text-tea-bg">Keep draft</button>
            </div>
          </div>}
          {state.phase === 'input' && <ImportInput draft={draft} onChange={setDraft} onSubmit={runImport} submitRef={submitRef} journeyLookup={journeyLookup} onRetryJourneys={loadJourneys} busy={Boolean(busyId)} onCreateJourney={createJourney} />}
          {state.phase === 'parsing' && <div className="space-y-4"><div role="status" className="flex min-h-32 items-center justify-center gap-3 text-ui-14 text-tea-text-sec"><Loader2 className="animate-spin" size={18} /> Analyzing your record…</div><ImportEvidencePreview evidence={draft.evidence} /></div>}
          {state.phase === 'error' && <div className="space-y-4">
            {persistedEvidenceSources.length > 0 && <div className="space-y-2" aria-label="Persisted record outcomes">{persistedEvidenceSources.map(source => <ImportEvidenceCard key={source.id} source={source} />)}</div>}
            <ImportEvidencePreview evidence={unmatchedLocalEvidence} />
            <div role="alert" className="space-y-4 rounded-md border border-tea-border bg-tea-surface p-4"><p className="text-ui-14 text-tea-text">{state.error}</p><div className="flex flex-wrap items-center justify-between gap-3">{state.detail && <ImportDeleteAction busy={Boolean(busyId)} onDelete={abandon} compact />}{(!state.detail || state.detail.batch.analysis_state !== 'failed' || failedImportSourceIds(state.detail.sources).length > 0) && <button type="button" disabled={Boolean(busyId)} onClick={runImport} className="tap-target min-h-11 rounded-md border border-tea-gold px-4 text-ui-12 text-tea-gold hover:border-tea-gold hover:text-tea-gold-lt disabled:opacity-50">Retry import</button>}</div></div>
          </div>}
          {operationError && <div role="alert" className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-md border border-tea-border bg-tea-surface p-3 text-ui-12 text-tea-text"><span>{operationError}</span><button type="button" disabled={!!busyId} onClick={async () => { if (!retryAction.current || busyId) return; setBusyId('__retry'); setOperationError(null); try { await retryAction.current(); retryAction.current = null; } catch (error) { setOperationError(error instanceof Error ? error.message : 'Action failed again'); } finally { setBusyId(null); } }} className="tap-target text-tea-gold disabled:opacity-50">Retry action</button></div>}
          {state.phase === 'review' && normalizedDetail && (completion
            ? <ImportCompletionSummary detail={normalizedDetail} result={completion} onClose={onClose} onNew={onNew} />
            : <ImportBatchReview detail={normalizedDetail} journeyLookup={journeyLookup} vendorLookup={vendorLookup} identityLookup={identityLookup} holdingLookup={holdingLookup} busyId={busyId} onRetryJourneys={loadJourneys} onRetryVendors={loadVendors} onRetryIdentities={loadIdentities} onRetryHoldings={loadHoldings} onUpdate={updateItem} onSetJourney={setJourney} onCreateJourney={createJourney} onChangeVendor={changeVendor} onCreateVendor={createVendor} onFinalize={finalize} onRetryAnalysis={retryAnalysis} onDefer={onClose} onNew={onNew} onAbandon={abandon} />)}
          </div>
        </div>
      </div>
    </div>
  );
};

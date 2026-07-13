import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, X } from 'lucide-react';
import { api, ApiError, type CurateImportDetail, type CurateImportFinalizeResult, type CurateImportItem, type CurateImportSourceKind } from '../../../lib/api';
import { ImportInput } from './ImportInput';
import { ImportBatchReview } from './ImportBatchReview';
import type { ImportDraft, ImportPanelState } from './importTypes';
import { TYPOGRAPHY_CLASSES } from '../../../designTokens';
import { extractImportEvidence } from './importEvidence';
import type { CurateJourney } from '../types';
import type { ImportVendorOption } from './ImportVendorGroup';

interface ImportPanelProps {
  initialDetail: CurateImportDetail | null;
  onDetailChange: (detail: CurateImportDetail) => void;
  onFinalized: (result: CurateImportFinalizeResult) => void | Promise<void>;
  onClose: () => void;
  onNew: () => void;
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

const normalizedDetail = (detail: CurateImportDetail): CurateImportDetail => ({
  ...detail,
  groups: (detail.groups || []).map(group => ({ ...group, confidence: group.confidence ?? group.vendor_confidence ?? null })),
  items: detail.items.map(item => {
    const parsed = item.parsed_data || {};
    return {
      ...item,
      english_name: (parsed.englishName as string | null | undefined) ?? item.english_name,
      original_name: (parsed.originalName as string | null | undefined) ?? item.original_name,
      pack_weight: (parsed.packWeight as number | null | undefined) ?? item.pack_weight,
      weight_unit: (parsed.weightUnit as CurateImportItem['weight_unit']) ?? item.weight_unit,
      pack_count: (parsed.packCount as number | null | undefined) ?? item.pack_count,
      price_amount: (parsed.priceAmount as number | null | undefined) ?? item.price_amount,
      currency: (parsed.currency as string | null | undefined) ?? item.currency,
      price_basis: (parsed.priceBasis as CurateImportItem['price_basis']) ?? item.price_basis,
      total_quantity_grams: (parsed.totalQuantityGrams as number | null | undefined) ?? item.total_quantity_grams,
      total_units: (parsed.totalUnits as number | null | undefined) ?? item.total_units,
      line_cost: (parsed.lineCost as number | null | undefined) ?? item.line_cost,
      unit_cost: (parsed.unitCost as number | null | undefined) ?? item.unit_cost,
      blocking_fields: parsed.blockingFields ? (parsed.blockingFields as string[]).map(field => field.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`)) : item.blocking_fields ?? [],
    };
  }),
});
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

export const ImportPanel: React.FC<ImportPanelProps> = ({ initialDetail, onDetailChange, onFinalized, onClose, onNew }) => {
  const [draft, setDraft] = useState<ImportDraft>({ text: '', evidence: [], sourceKind: 'paste', journeyId: null });
  const [state, setState] = useState<ImportPanelState>({ phase: initialDetail ? 'review' : 'input', detail: initialDetail, error: null });
  const [journeys, setJourneys] = useState<CurateJourney[]>([]);
  const [vendorOptions, setVendorOptions] = useState<ImportVendorOption[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [operationError, setOperationError] = useState<string | null>(null);
  const retryAction = useRef<null | (() => Promise<void>)>(null);
  const createIdempotencyKey = useRef(crypto.randomUUID());
  const closeRef = useRef<HTMLButtonElement>(null);
  const submitRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const evidenceKind: CurateImportSourceKind = useMemo(() => draft.evidence.some(item => item.kind === 'photo') ? 'photo' : draft.evidence.length ? 'invoice' : 'paste', [draft.evidence]);

  useEffect(() => { closeRef.current?.focus(); }, []);
  useEffect(() => {
    void api.curateContext.listJourneys().then(result => setJourneys(result.journeys)).catch(() => setJourneys([]));
    void api.customers.list(undefined, 'vendor').then((result: unknown) => {
      const rows = Array.isArray(result) ? result : result && typeof result === 'object' && 'customers' in result && Array.isArray(result.customers) ? result.customers : [];
      setVendorOptions(rows.map((row: Record<string, unknown>) => ({ id: String(row.id), name: String(row.name || row.company_name || 'Unnamed vendor') })));
    }).catch(() => setVendorOptions([]));
  }, []);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') return onClose();
      if (event.key !== 'Tab' || !panelRef.current) return;
      const controls = Array.from(panelRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), textarea, input:not([disabled]):not([tabindex="-1"]), select:not([disabled]), [tabindex]:not([tabindex="-1"])')).filter(el => !el.hasAttribute('hidden') && el.getAttribute('aria-hidden') !== 'true');
      if (!controls.length) return;
      const first = controls[0]; const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const runImport = async () => {
    setState(current => ({ ...current, phase: 'parsing', error: null }));
    await new Promise(resolve => window.setTimeout(resolve, 250));
    try {
      const attachmentText = (await Promise.all(draft.evidence.map(item => extractImportEvidence(item.file)))).filter(Boolean).join('\n');
      const reviewText = [draft.text.trim(), attachmentText].filter(Boolean).join('\n');
      let detail = state.detail;
      if (!detail) {
        detail = await api.curateImports.create({
          idempotency_key: createIdempotencyKey.current,
          journey_id: draft.journeyId || undefined,
          title: draft.evidence[0]?.file.name || 'Imported list', source_kind: draft.text.trim() ? 'paste' : evidenceKind,
          pasted_text: reviewText || undefined, items: parseDraftItems({ ...draft, text: reviewText }),
        });
        detail = normalizedDetail(detail);
        setState(current => ({ ...current, detail }));
      }
      const savedEvidenceIds = new Set(detail.sources.map(source => String(source.metadata?.client_evidence_id || '')).filter(Boolean));
      for (const evidence of draft.evidence) {
        if (savedEvidenceIds.has(evidence.id)) continue;
        const source = await api.curateImports.uploadEvidence(detail.batch.id, evidence.file, evidence.id);
        detail = { ...detail, sources: [...detail.sources, source] };
        savedEvidenceIds.add(evidence.id);
        setState(current => ({ ...current, detail }));
        onDetailChange(detail);
      }
      detail = normalizedDetail(await api.curateImports.analyze(detail.batch.id));
      setState({ phase: 'review', detail, error: null });
      onDetailChange(detail);
    } catch (error) {
      setState(current => ({ ...current, phase: 'error', error: errorMessage(error, 'Import failed') }));
    }
  };
  const replaceItem = (updated: CurateImportItem) => {
    setState(current => {
      if (!current.detail) return current;
      const detail = { ...current.detail, items: current.detail.items.map(item => item.id === updated.id ? updated : item) };
      return { ...current, detail };
    });
  };
  const refreshDetail = async (batchId: string) => {
    const detail = normalizedDetail(await api.curateImports.get(batchId));
    setState(current => ({ ...current, detail })); onDetailChange(detail);
  };
  const updateItem = async (item: CurateImportItem, updates: Partial<CurateImportItem>) => {
    if (busyId) return false;
    setBusyId(item.id);
    const action = async () => { replaceItem(await api.curateImports.updateItem(item.batch_id, item.id, updates)); await refreshDetail(item.batch_id); };
    try { setOperationError(null); await action(); return true; }
    catch (error) { retryAction.current = action; setOperationError(errorMessage(error, 'Could not save correction')); return false; }
    finally { setBusyId(null); }
  };
  const setJourney = async (journeyId: string | null): Promise<boolean> => {
    if (!state.detail || busyId) return false;
    setBusyId('__journey');
    const action = async () => { const detail = normalizedDetail(await api.curateImports.setJourney(state.detail!.batch.id, journeyId)); setState(current => ({ ...current, detail })); onDetailChange(detail); };
    try { setOperationError(null); await action(); return true; }
    catch (error) { retryAction.current = action; setOperationError(errorMessage(error, 'Could not change sourcing run')); return false; }
    finally { setBusyId(null); }
  };
  const createJourney = async (input: { name: string; season?: string; year?: number }): Promise<boolean> => {
    if (busyId) return false;
    setBusyId('__create-journey');
    let journey: CurateJourney | null = null;
    const action = async () => {
      journey = journey || await api.curateContext.createJourney(input);
      setJourneys(current => current.some(candidate => candidate.id === journey.id) ? current : [...current, journey]);
      setDraft(current => ({ ...current, journeyId: journey.id }));
      if (state.detail) {
        const detail = normalizedDetail(await api.curateImports.setJourney(state.detail.batch.id, journey.id));
        setState(current => ({ ...current, detail })); onDetailChange(detail);
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
  const retryAnalysis = async () => {
    if (!state.detail || busyId) return;
    setBusyId('__analysis');
    const action = async () => { const detail = normalizedDetail(await api.curateImports.analyze(state.detail!.batch.id)); setState({ phase: 'review', detail, error: null }); onDetailChange(detail); };
    try { setOperationError(null); await action(); }
    catch (error) { retryAction.current = action; setOperationError(errorMessage(error, 'Could not analyze saved evidence')); }
    finally { setBusyId(null); }
  };
  const finalize = async () => {
    if (!state.detail || busyId) return;
    setBusyId('__finalize');
    const action = async () => {
      const batchId = state.detail!.batch.id;
      const result = await api.curateImports.finalize(batchId, `curate-import-finalize:${batchId}`);
      await onFinalized(result);
    };
    try { setOperationError(null); await action(); }
    catch (error) { retryAction.current = action; setOperationError(errorMessage(error, 'Could not add this import to Inventory')); }
    finally { setBusyId(null); }
  };
  const abandon = async () => {
    if (!state.detail || busyId) return;
    setBusyId('__abandon');
    try { setOperationError(null); await api.curateImports.abandon(state.detail.batch.id); onDetailChange({ ...state.detail, batch: { ...state.detail.batch, review_state: 'abandoned' } }); onClose(); }
    catch (error) { setOperationError(errorMessage(error, 'Could not abandon import')); }
    finally { setBusyId(null); }
  };

  return (
    <div className="fixed inset-0 z-modal flex bg-tea-bg/80" role="presentation">
      <div ref={panelRef} role="dialog" aria-modal="true" aria-labelledby="curate-import-title" className="ml-auto flex h-full w-full max-w-2xl flex-col overflow-hidden border-l border-tea-border bg-tea-elevated text-tea-text">
        <header className="flex min-h-14 shrink-0 items-center gap-3 border-b border-tea-border px-4">
          <button ref={closeRef} type="button" onClick={onClose} aria-label="Close Import" className="tap-target flex h-8 w-8 items-center justify-center text-tea-text-sec hover:text-tea-text"><X size={18} /></button>
          <div><h2 id="curate-import-title" className={`${TYPOGRAPHY_CLASSES.h3} text-tea-text`}>Import into Curate</h2><p className="text-ui-11 text-tea-text-dim">Capture now. Decide later.</p></div>
        </header>
        <div className="pb-nav flex-1 overflow-y-auto px-4 py-5 sm:px-6" aria-live="polite">
          {state.phase === 'input' && <ImportInput draft={draft} onChange={setDraft} onSubmit={runImport} submitRef={submitRef} journeys={journeys} onCreateJourney={createJourney} />}
          {state.phase === 'parsing' && <div role="status" className="flex min-h-48 items-center justify-center gap-3 text-ui-14 text-tea-text-sec"><Loader2 className="animate-spin" size={18} /> Analyzing your evidence…</div>}
          {state.phase === 'error' && <div role="alert" className="space-y-4 rounded-md border border-tea-border bg-tea-surface p-4"><p className="text-ui-14 text-tea-text">{state.error}</p><button type="button" onClick={runImport} className="tap-target min-h-11 rounded-md border border-tea-gold px-4 text-ui-12 text-tea-gold">Retry import</button></div>}
          {operationError && <div role="alert" className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-md border border-tea-border bg-tea-surface p-3 text-ui-12 text-tea-text"><span>{operationError}</span><button type="button" disabled={!!busyId} onClick={async () => { if (!retryAction.current || busyId) return; setBusyId('__retry'); setOperationError(null); try { await retryAction.current(); retryAction.current = null; } catch (error) { setOperationError(error instanceof Error ? error.message : 'Action failed again'); } finally { setBusyId(null); } }} className="tap-target text-tea-gold disabled:opacity-50">Retry action</button></div>}
          {state.phase === 'review' && state.detail && <ImportBatchReview detail={normalizedDetail(state.detail)} journeys={journeys} vendorOptions={vendorOptions} busyId={busyId} onUpdate={updateItem} onSetJourney={setJourney} onCreateJourney={createJourney} onChangeVendor={changeVendor} onCreateVendor={createVendor} onFinalize={finalize} onRetryAnalysis={retryAnalysis} onDefer={onClose} onNew={onNew} onAbandon={abandon} />}
        </div>
      </div>
    </div>
  );
};

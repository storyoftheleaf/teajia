import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, X } from 'lucide-react';
import { api, type CurateImportDetail, type CurateImportItem, type CurateImportSourceKind } from '../../../lib/api';
import { ImportInput } from './ImportInput';
import { ImportBatchReview } from './ImportBatchReview';
import type { ImportDraft, ImportPanelState } from './importTypes';
import { TYPOGRAPHY_CLASSES } from '../../../designTokens';
import { extractImportEvidence } from './importEvidence';

interface ImportPanelProps {
  initialDetail: CurateImportDetail | null;
  activeCompassEntryId: string | null;
  onDetailChange: (detail: CurateImportDetail) => void;
  onAccepted: (item: CurateImportItem) => void | Promise<void>;
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

export const ImportPanel: React.FC<ImportPanelProps> = ({ initialDetail, activeCompassEntryId, onDetailChange, onAccepted, onClose, onNew }) => {
  const [draft, setDraft] = useState<ImportDraft>({ text: '', evidence: [], sourceKind: 'paste' });
  const [state, setState] = useState<ImportPanelState>({ phase: initialDetail ? 'review' : 'input', detail: initialDetail, error: null });
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
          title: draft.evidence[0]?.file.name || 'Imported list', source_kind: draft.text.trim() ? 'paste' : evidenceKind,
          pasted_text: reviewText || undefined, items: parseDraftItems({ ...draft, text: reviewText }),
        });
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
      detail = await api.curateImports.get(detail.batch.id);
      setState({ phase: 'review', detail, error: null });
      onDetailChange(detail);
    } catch (error) {
      setState(current => ({ ...current, phase: 'error', error: error instanceof Error ? error.message : 'Import failed' }));
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
    const detail = await api.curateImports.get(batchId);
    setState(current => ({ ...current, detail })); onDetailChange(detail);
  };
  const updateItem = async (item: CurateImportItem, updates: Partial<CurateImportItem>) => {
    if (busyId) return false;
    setBusyId(item.id);
    const action = async () => { replaceItem(await api.curateImports.updateItem(item.batch_id, item.id, updates)); await refreshDetail(item.batch_id); };
    try { setOperationError(null); await action(); return true; }
    catch (error) { retryAction.current = action; setOperationError(error instanceof Error ? error.message : 'Could not save correction'); return false; }
    finally { setBusyId(null); }
  };
  const accept = async (item: CurateImportItem, open = true) => {
    if (busyId || item.compass_entry_id) return;
    setBusyId(item.id);
    const action = async () => { const updated = await api.curateImports.acceptItem(item.batch_id, item.id); replaceItem(updated); await refreshDetail(item.batch_id); if (open) await onAccepted(updated); };
    try { setOperationError(null); await action(); }
    catch (error) { retryAction.current = action; setOperationError(error instanceof Error ? error.message : 'Could not accept item'); }
    finally { setBusyId(null); }
  };
  const merge = async (item: CurateImportItem) => {
    if (!activeCompassEntryId) return;
    setBusyId(item.id);
    const action = async () => { replaceItem(await api.curateImports.mergeItem(item.batch_id, item.id, activeCompassEntryId)); await refreshDetail(item.batch_id); };
    try { setOperationError(null); await action(); }
    catch (error) { retryAction.current = action; setOperationError(error instanceof Error ? error.message : 'Could not merge item'); }
    finally { setBusyId(null); }
  };
  const acceptAll = async () => {
    const remaining = state.detail?.items.filter(item => (item.review_state === 'pending' || item.review_state === 'reviewing') && Object.keys(item.uncertainty || {}).length === 0) || [];
    for (const item of remaining) await accept(item, false);
  };
  const addItem = async (name: string, category: 'tea' | 'teaware', onSuccess: () => void) => {
    if (!state.detail || busyId) return false;
    setBusyId('__add');
    const action = async () => { await api.curateImports.addItem(state.detail!.batch.id, { name, category, source_id: state.detail!.sources[0]?.id }); await refreshDetail(state.detail!.batch.id); onSuccess(); };
    try { setOperationError(null); await action(); return true; }
    catch (error) { retryAction.current = action; setOperationError(error instanceof Error ? error.message : 'Could not add review item'); return false; }
    finally { setBusyId(null); }
  };
  const abandon = async () => {
    if (!state.detail || busyId) return;
    setBusyId('__abandon');
    try { setOperationError(null); await api.curateImports.abandon(state.detail.batch.id); onDetailChange({ ...state.detail, batch: { ...state.detail.batch, review_state: 'abandoned' } }); onClose(); }
    catch (error) { setOperationError(error instanceof Error ? error.message : 'Could not abandon import'); }
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
          {state.phase === 'input' && <ImportInput draft={draft} onChange={setDraft} onSubmit={runImport} submitRef={submitRef} />}
          {state.phase === 'parsing' && <div role="status" className="flex min-h-48 items-center justify-center gap-3 text-ui-14 text-tea-text-sec"><Loader2 className="animate-spin" size={18} /> Parsing your evidence…</div>}
          {state.phase === 'error' && <div role="alert" className="space-y-4 rounded-md border border-tea-border bg-tea-surface p-4"><p className="text-ui-14 text-tea-text">{state.error}</p><button type="button" onClick={runImport} className="tap-target min-h-11 rounded-md border border-tea-gold px-4 text-ui-12 text-tea-gold">Retry import</button></div>}
          {operationError && <div role="alert" className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-md border border-tea-border bg-tea-surface p-3 text-ui-12 text-tea-text"><span>{operationError}</span><button type="button" disabled={!!busyId} onClick={async () => { if (!retryAction.current || busyId) return; setBusyId('__retry'); setOperationError(null); try { await retryAction.current(); retryAction.current = null; } catch (error) { setOperationError(error instanceof Error ? error.message : 'Action failed again'); } finally { setBusyId(null); } }} className="tap-target text-tea-gold disabled:opacity-50">Retry action</button></div>}
          {state.phase === 'review' && state.detail && <ImportBatchReview detail={state.detail} busyId={busyId} onUpdate={updateItem} onAccept={accept} onMerge={merge} onAcceptAll={acceptAll} onDefer={onClose} onNew={onNew} onAddItem={addItem} onAbandon={abandon} />}
        </div>
      </div>
    </div>
  );
};

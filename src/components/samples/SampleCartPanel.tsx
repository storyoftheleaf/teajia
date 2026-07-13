import React, { useState } from 'react';
import { FlaskConical, Printer, MessageCircle, BookOpen, Trash2, X, Check } from 'lucide-react';
import { useSampleCartStore } from '../../samples/sampleCartStore';
import { useSampleStore } from '../../samples/sampleStore';
import { sampleRepository } from '../../samples/sampleRepository';
import {
  buildSampleBatchDraft,
  sampleListSignatureForRetry,
  saveSampleBatchLifecycle,
} from '../../samples/sampleLifecycle';
import { useTeaCompassStore } from '../../lib/teaCompassStore';
import { syncCompassEntries } from '../../lib/teaCompassSync';
import { useAppStore } from '../../lib/store';

const GRAM_PRESETS = [5, 10, 15, 25, 50];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildWhatsAppText(items: ReturnType<typeof useSampleCartStore.getState>['items']): string {
  if (items.length === 0) return '';

  const grouped = new Map<string, typeof items>();
  for (const item of items) {
    const vendor = item.vendorName || 'Unknown Vendor';
    if (!grouped.has(vendor)) grouped.set(vendor, []);
    grouped.get(vendor)!.push(item);
  }

  const lines: string[] = ['*Sample List*', ''];
  for (const [vendor, vendorItems] of grouped) {
    lines.push(`_${vendor}_`);
    for (const item of vendorItems) {
      const name = item.chineseName ? `${item.name} (${item.chineseName})` : item.name;
      lines.push(`• ${name} — ${item.grams}g`);
    }
    lines.push('');
  }
  lines.push(`_${items.length} tea${items.length !== 1 ? 's' : ''} · ${items.reduce((s, i) => s + i.grams, 0)}g total_`);
  return lines.join('\n');
}

function buildPrintContent(items: ReturnType<typeof useSampleCartStore.getState>['items']): string {
  const grouped = new Map<string, typeof items>();
  for (const item of items) {
    const vendor = item.vendorName || 'Unknown Vendor';
    if (!grouped.has(vendor)) grouped.set(vendor, []);
    grouped.get(vendor)!.push(item);
  }

  let html = `<html><head><title>Sample List</title><style>
    body { font-family: Georgia, serif; padding: 40px; color: #222; max-width: 600px; }
    h1 { font-size: 22px; margin-bottom: 24px; }
    h2 { font-size: 13px; text-transform: uppercase; letter-spacing: 0.1em; color: #777; margin: 20px 0 8px; border-bottom: 1px solid #eee; padding-bottom: 4px; }
    li { font-size: 14px; margin: 6px 0; list-style: none; display: flex; justify-content: space-between; }
    .grams { color: #888; font-size: 12px; }
    .total { margin-top: 24px; font-size: 12px; color: #999; border-top: 1px solid #eee; padding-top: 12px; }
  </style></head><body>`;
  html += `<h1>Sample List</h1>`;
  for (const [vendor, vendorItems] of grouped) {
    html += `<h2>${vendor}</h2><ul>`;
    for (const item of vendorItems) {
      const name = item.chineseName ? `${item.name} <span style="color:#888">${item.chineseName}</span>` : item.name;
      html += `<li><span>${name}</span><span class="grams">${item.grams}g</span></li>`;
    }
    html += `</ul>`;
  }
  const totalGrams = items.reduce((s, i) => s + i.grams, 0);
  html += `<div class="total">${items.length} tea${items.length !== 1 ? 's' : ''} · ${totalGrams}g total</div>`;
  html += `</body></html>`;
  return html;
}

// ─── Component ────────────────────────────────────────────────────────────────

interface SampleCartPanelProps {
  onClose?: () => void;
  onCaptureTea?: () => void;
  onBrowseLibrary?: () => void;
}

export const SampleCartPanel: React.FC<SampleCartPanelProps> = ({ onClose, onCaptureTea, onBrowseLibrary }) => {
  const items = useSampleCartStore((s) => s.items);
  const removeItem = useSampleCartStore((s) => s.removeItem);
  const updateGrams = useSampleCartStore((s) => s.updateGrams);
  const clear = useSampleCartStore((s) => s.clear);
  const pendingOperation = useSampleCartStore((s) => s.pendingOperation);
  const setPendingOperation = useSampleCartStore((s) => s.setPendingOperation);
  const completePendingOperation = useSampleCartStore((s) => s.completePendingOperation);
  const releasePendingOperation = useSampleCartStore((s) => s.releasePendingOperation);

  const addSample = useSampleStore((s) => s.addSample);
  const addSampleSet = useSampleStore((s) => s.addSampleSet);
  const accountScopeId = useSampleStore((s) => s.accountScopeId);
  const discardSampleSet = useSampleStore((s) => s.discardSampleSet);

  const [savedConfirm, setSavedConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [discarding, setDiscarding] = useState(false);
  const [discardError, setDiscardError] = useState<string | null>(null);

  const isEmpty = items.length === 0;
  const operationLocked = pendingOperation != null;
  const totalGrams = items.reduce((s, i) => s + i.grams, 0);

  // Group by vendor
  const grouped = React.useMemo(() => {
    const map = new Map<string, typeof items>();
    for (const item of items) {
      const v = item.vendorName || 'Unknown';
      if (!map.has(v)) map.set(v, []);
      map.get(v)!.push(item);
    }
    return [...map.entries()];
  }, [items]);

  const handlePrint = () => {
    const win = window.open('', '_blank', 'width=700,height=600');
    if (!win) return;
    win.document.write(buildPrintContent(items));
    win.document.close();
    win.focus();
    win.print();
  };

  const handleWhatsApp = () => {
    const text = buildWhatsAppText(items);
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  const handleSaveAsSet = async () => {
    if (saving) return;
    const accountId = useAppStore.getState().activeAccountId;
    if (!accountId || accountScopeId !== accountId) {
      setSaveError('Choose an account, then retry saving this sample list.');
      return;
    }
    setSaving(true);
    setSaveError(null);
    const signature = sampleListSignatureForRetry(items);
    if (pendingOperation && pendingOperation.signature !== signature) {
      setSaveError('This locked batch no longer matches the visible list. Reload the account before retrying; no new batch was created.');
      setSaving(false);
      return;
    }
    const draft = pendingOperation ?? buildSampleBatchDraft(items);
    if (draft !== pendingOperation) setPendingOperation(draft);

    try {
      await saveSampleBatchLifecycle({
        accountId,
        draft,
        isCurrentAccount: (expected) => (
          useAppStore.getState().activeAccountId === expected
          && useSampleStore.getState().accountScopeId === expected
          && useTeaCompassStore.getState().accountScopeId === expected
        ),
        persistSamples: async ({ sampleSet, samples }) => {
          const state = useSampleStore.getState();
          if (!state.getSampleSet(sampleSet.id)) addSampleSet(sampleSet);
          for (const sample of samples) {
            if (!useSampleStore.getState().getSample(sample.id)) addSample(sample);
          }
          const result = await sampleRepository.sync(accountId);
          if (result.status !== 'synced') throw new Error('The sample batch did not finish syncing. Retry when the connection is available.');
        },
        getCompassEntry: (id) => useTeaCompassStore.getState().entries.find((entry) => entry.id === id),
        updateCompassEntry: (id, update) => useTeaCompassStore.getState().updateEntry(id, update),
        persistCompass: async (entryIds) => {
          await syncCompassEntries(accountId);
          const current = useTeaCompassStore.getState();
          if (current.accountScopeId !== accountId || entryIds.some((id) => !current.entries.find((entry) => entry.id === id)?.synced)) {
            throw new Error('The batch was saved, but Library linkage is still pending. Retry to finish linking it.');
          }
        },
        clearList: () => {
          if (!completePendingOperation(draft.sampleSet.id)) {
            throw new Error('The sample batch was saved, but the list changed before completion. Review the current list before saving again.');
          }
        },
      });
      setSavedConfirm(true);
      setTimeout(() => setSavedConfirm(false), 3000);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'This sample list could not be saved. Retry without clearing it.');
    } finally {
      setSaving(false);
    }
  };

  const handleDiscardDraft = async () => {
    const operation = useSampleCartStore.getState().pendingOperation;
    const accountId = useAppStore.getState().activeAccountId;
    if (!operation || !accountId || accountScopeId !== accountId) {
      setDiscardError('The pending batch account is no longer active. Return to that account and retry.');
      return;
    }
    setDiscarding(true);
    setDiscardError(null);
    try {
      discardSampleSet(operation.sampleSet.id);
      const result = await sampleRepository.sync(accountId);
      const sampleState = useSampleStore.getState();
      const cartState = useSampleCartStore.getState();
      if (
        result.status !== 'synced'
        || useAppStore.getState().activeAccountId !== accountId
        || sampleState.accountScopeId !== accountId
        || cartState.accountScopeId !== accountId
        || cartState.pendingOperation?.sampleSet.id !== operation.sampleSet.id
        || sampleState.getSampleSet(operation.sampleSet.id)
        || sampleState.samples.some((sample) => sample.setId === operation.sampleSet.id)
        || sampleState.sampleSetTombstones.includes(operation.sampleSet.id)
      ) {
        throw new Error('The saved draft could not be removed yet. It remains locked; retry discard when the connection is available.');
      }
      if (!releasePendingOperation(operation.sampleSet.id)) {
        throw new Error('The active pending batch changed before cleanup completed. Its list remains locked.');
      }
      setSaveError(null);
    } catch (error) {
      setDiscardError(error instanceof Error ? error.message : 'The saved draft could not be removed. It remains locked.');
    } finally {
      setDiscarding(false);
    }
  };

  return (
    <div className="flex flex-col h-full">

      {/* ── Header ── */}
      <div className="shrink-0 flex items-center justify-between px-4 pt-4 pb-3 border-b border-tea-border">
        <div className="flex items-center gap-2">
          <FlaskConical size={15} className="text-tea-gold" />
          <span className="font-serif text-ui-15 text-tea-text">Sample List</span>
          {!isEmpty && (
            <span className="text-ui-11 text-tea-text-dim tabular-nums">
              {items.length} tea{items.length !== 1 ? 's' : ''} · {totalGrams}g
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {!isEmpty && (
            <button
              type="button"
              onClick={clear}
              disabled={operationLocked}
              className="p-1.5 rounded-md text-tea-text-dim hover:text-tea-text-sec hover:bg-tea-elevated transition-colors disabled:opacity-40"
              aria-label="Clear all"
              title={operationLocked ? 'Finish the pending batch before clearing this list' : 'Clear all'}
            >
              <Trash2 size={13} />
            </button>
          )}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-md text-tea-text-sec hover:text-tea-text transition-colors"
              aria-label="Close"
            >
              <X size={15} />
            </button>
          )}
        </div>
      </div>

      {/* ── Content ── */}
      <div className="flex-1 min-h-0 overflow-y-auto" style={{ scrollbarGutter: 'stable' }}>
        {savedConfirm ? (
          <div className="flex min-h-40 items-center justify-center gap-2 px-6 text-ui-12 text-tea-gold">
            <Check size={13} />
            Saved as sample batch — list cleared
          </div>
        ) : isEmpty ? (
          <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
            <FlaskConical size={28} className="text-tea-gold/20 mb-4" />
            <p className="font-serif text-ui-14 text-tea-text/50 mb-1">Your sample list is empty</p>
            <p className="text-ui-12 text-tea-text-dim max-w-[200px] leading-relaxed">
              Tap the flask icon on any tea to add it here.
            </p>
            {(onCaptureTea || onBrowseLibrary) && (
              <div className="mt-5 flex flex-wrap justify-center gap-2">
                {onCaptureTea && <button type="button" onClick={onCaptureTea} className="tap-target min-h-11 rounded-md bg-tea-accent-sub px-4 text-ui-12 text-tea-gold">Capture tea</button>}
                {onBrowseLibrary && <button type="button" onClick={onBrowseLibrary} className="tap-target min-h-11 rounded-md px-4 text-ui-12 text-tea-text-sec hover:bg-tea-accent-sub hover:text-tea-text">Browse Library</button>}
              </div>
            )}
          </div>
        ) : (
          <div className="divide-y divide-tea-border">
            {grouped.map(([vendor, vendorItems]) => (
              <div key={vendor}>
                <div className="px-4 py-2 bg-tea-elevated/50">
                  <span className="text-ui-10 uppercase tracking-[0.12em] text-tea-text-dim font-medium">
                    {vendor}
                  </span>
                </div>
                <div className="divide-y divide-tea-border/50">
                  {vendorItems.map((item) => (
                    <div key={item.id} className="px-4 py-3">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="min-w-0">
                          <p className="text-ui-13 text-tea-text font-serif truncate">{item.name || 'Unnamed'}</p>
                          {item.chineseName && (
                            <p className="text-ui-11 text-tea-text-dim font-chinese leading-snug">{item.chineseName}</p>
                          )}
                          {item.type && (
                            <p className="text-ui-10 text-tea-text-dim mt-0.5">{item.type}</p>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => removeItem(item.id)}
                          disabled={operationLocked}
                          className="shrink-0 p-1 rounded text-tea-text-dim hover:text-tea-text-sec hover:bg-tea-elevated transition-colors mt-0.5 disabled:opacity-40"
                          aria-label="Remove"
                        >
                          <X size={12} />
                        </button>
                      </div>

                      {/* Gram presets */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {GRAM_PRESETS.map((g) => (
                          <button
                            key={g}
                            type="button"
                            onClick={() => updateGrams(item.id, g)}
                            disabled={operationLocked}
                            className={`px-2.5 py-1 rounded-md text-ui-11 font-medium transition-colors ${
                              item.grams === g
                                ? 'bg-tea-gold/15 text-tea-gold'
                                : 'bg-tea-elevated text-tea-text-dim hover:text-tea-text-sec hover:bg-tea-surface'
                            }`}
                          >
                            {g}g
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Footer actions ── */}
      {!isEmpty && (
        <div className="shrink-0 px-4 py-3 border-t border-tea-border space-y-2">

          <>
              {operationLocked && (
                <p className="rounded-md bg-tea-elevated px-3 py-2 text-ui-12 text-tea-text-sec">
                  This saved batch is locked until Library linkage finishes. Retry to complete it; list edits are paused to prevent duplicates.
                </p>
              )}
              {saveError && (
                <p role="alert" className="rounded-md bg-tea-elevated px-3 py-2 text-ui-12 text-tea-text-sec">
                  {saveError}
                </p>
              )}
              {discardError && <p role="alert" className="rounded-md bg-tea-elevated px-3 py-2 text-ui-12 text-tea-text-sec">{discardError}</p>}
              <div className="flex items-center justify-between gap-2">
                {saveError && operationLocked && (
                  <button
                    type="button"
                    onClick={handleDiscardDraft}
                    disabled={saving || discarding}
                    className="tap-target min-h-11 px-2 text-ui-12 text-tea-text-sec hover:text-tea-text disabled:opacity-50"
                  >
                    {discarding ? 'Discarding…' : 'Discard saved draft'}
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleSaveAsSet}
                  disabled={saving || discarding}
                  className="min-h-11 flex-1 flex items-center justify-center gap-2 rounded-xl bg-tea-gold/10 text-tea-gold text-ui-12 font-semibold hover:bg-tea-gold/15 transition-colors disabled:opacity-50"
                >
                  <BookOpen size={13} />
                  {saving ? 'Saving sample batch…' : saveError ? 'Retry saving sample batch' : operationLocked ? 'Retry saved batch' : 'Save as sample batch'}
                </button>
              </div>
          </>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border border-tea-border text-tea-text-sec text-ui-12 hover:bg-tea-surface transition-colors"
            >
              <Printer size={13} />
              Print
            </button>
            <button
              type="button"
              onClick={handleWhatsApp}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border border-tea-border text-tea-text-sec text-ui-12 hover:bg-tea-surface transition-colors"
            >
              <MessageCircle size={13} />
              WhatsApp
            </button>
          </div>
        </div>
      )}

    </div>
  );
};

export default SampleCartPanel;

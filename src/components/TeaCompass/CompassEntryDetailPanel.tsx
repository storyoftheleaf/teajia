import { CurateRecordTools } from '../curate/CurateRecordTools';
import { hydrateCompassEntries } from '../../lib/teaCompassSync';
import { StructuredTeaFields } from './StructuredTeaFields';
import React, { useEffect, useState } from 'react';
import { TeaRecordFields } from './TeaRecordFields';
import { PhotoCapture } from './PhotoCapture';
import { TYPOGRAPHY_CLASSES as T } from '../../designTokens';
import { useNavigate } from 'react-router-dom';
import { Droplets, Share2, ShoppingBag, Star, Trash2, X } from 'lucide-react';
import { useTeaCompassStore } from '../../lib/teaCompassStore';
import { TastingProfileStrip } from '../tasting/TastingProfileStrip';
import { getDateGroup } from './BrowseCard';
import { entryDisplayTitle } from './types';
import { AddToSampleButton } from '../samples/AddToSampleButton';
import { DecisionControl } from './DecisionControl';
import { CreateInventoryRecordAction } from './CreateInventoryRecordAction';
import { useLedgerStore } from '../../lib/ledgerStore';
import { useLibraryPurchases, purchaseStateLabel } from '../../lib/libraryPurchaseState';
import { TastingSession } from '../tasting/TastingSession';
import type { TastingData } from '../../types';
import type { CompassVerdict } from './types';

interface CompassEntryDetailPanelProps {
  entryId: string;
  onEdit?: (id: string) => void;
  onOpenInventory?: (productId: string) => void;
  onClose: () => void;
  onShare?: (id: string) => void;
  onAcquire?: (id: string) => void;
}

const SECTION_LABEL = 'text-ui-12 text-tea-text-dim font-medium mb-2';

export const CompassEntryDetailPanel: React.FC<CompassEntryDetailPanelProps> = ({
  entryId,
  onEdit,
  onOpenInventory,
  onClose,
  onShare,
  onAcquire,
}) => {
  const navigate = useNavigate();
  const entry = useTeaCompassStore((s) => s.pendingEntries.find(e => e.id === entryId) ?? s.entries.find(e => e.id === entryId));
  const syncError = useTeaCompassStore(s => s.syncError);
  const accountScopeId = useTeaCompassStore(s => s.accountScopeId);
  const accountScopeRevision = useTeaCompassStore(s => s.accountScopeRevision);
  const updateEntry = (id: string, patch: Parameters<ReturnType<typeof useTeaCompassStore.getState>['updateEntry']>[1]) => {
    const store = useTeaCompassStore.getState();
    if (store.accountScopeId !== accountScopeId || store.accountScopeRevision !== accountScopeRevision) return;
    store.updateEntry(id, patch);
  };
  const removeEntry = useTeaCompassStore((s) => s.removeEntry);
  const ledgerTransactions = useLedgerStore((s) => s.transactions);
  const ledgerAccountId = useLedgerStore(s => s.accountScopeId);
  const transactions = ledgerAccountId === accountScopeId ? ledgerTransactions : [];
  const purchases = useLibraryPurchases();
  const [tastingOpen, setTastingOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => { setConfirmDelete(false); }, [entryId]);

  if (!entry) return null;

  const validPhotos = (entry.photos || []).filter(Boolean);
  const hasTasting = entry.tasting && Object.values(entry.tasting).some(
    (v) => Array.isArray(v) ? v.length > 0 : v != null
  );
  const hasTastingHistory = (entry.tastingHistory?.length ?? 0) > 0;
  const purchase = purchases.stateFor({ entryId: entry.id, productId: entry.draftProductId, chosen: entry.decision === 'selected' });
  const purchaseLabel = purchaseStateLabel(purchase);
  const isInLedger = transactions.some((transaction) => transaction.direction === 'purchase' && transaction.items.some((item) => item.compassEntryId === entry.id || (entry.draftProductId && item.productId === entry.draftProductId)));
  const openLedger = () => {
    if (purchase.draftTransactionId) useLedgerStore.getState().setActiveTransaction(purchase.draftTransactionId);
    navigate('/admin/compass?tab=ledger');
  };
  const typeLabel = entry.type || (entry.category === 'teaware' ? 'Teaware' : 'Tea');


  return (
    <div className="flex h-full min-w-0 flex-col" data-testid="library-entry-detail">

      {/* ── Header ── */}
      <div className="shrink-0 px-6 pt-5 pb-4 border-b border-tea-border">
        <div className="flex items-start gap-3">
          <button
            type="button"
            onClick={onClose}
            className="tap-target flex min-h-11 min-w-11 shrink-0 items-center justify-center text-tea-text-sec hover:text-tea-text transition-colors"
            aria-label="Close detail panel"
          >
            <X size={16} />
          </button>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="badge-status badge-status-default">{typeLabel}</span>

          </div>
        </div>
        <h2 className={`${T.h3} mt-3 text-tea-text`}>
          {entry.name || <span className="text-tea-text-sec">{entryDisplayTitle(entry)}</span>}
        </h2>
        <p role="status" className="mt-1 text-ui-11 text-tea-text-dim">{syncError ? "Saved on this device. Waiting to sync." : "Shared tea record · Changes save as you edit"}</p>
        {entry.chineseName && (
          <p
            className="mt-0.5 text-ui-12 text-tea-text-dim"
            style={{ fontFamily: 'var(--font-chinese)' }}
          >
            {entry.chineseName}
          </p>
        )}
      </div>

      {/* ── Scrollable content ── */}
      <div
        className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-6 py-4 space-y-5"
        style={{ scrollbarGutter: 'stable' }}
      >

        <DecisionControl value={entry.decision} onChange={(decision) => updateEntry(entry.id, { decision })} />

        <section aria-label="Tea photos" className="space-y-2">
          <PhotoCapture photos={validPhotos}
            onPhotoTaken={url => { const current = useTeaCompassStore.getState().getEntry(entry.id); if (current) updateEntry(entry.id, { photos: [...current.photos, url] }); }}
            onPhotoReplaced={(oldUrl, newUrl) => { const current = useTeaCompassStore.getState().getEntry(entry.id); if (current) updateEntry(entry.id, { photos: current.photos.map(url => url === oldUrl ? newUrl : url) }); }}
            onRemovePhoto={index => updateEntry(entry.id, { photos: validPhotos.filter((_, i) => i !== index) })}
            onExtracted={data => { const current = useTeaCompassStore.getState().getEntry(entry.id); if (!current) return; updateEntry(entry.id, {
              ...(data.name ? { name: data.name } : {}), ...(data.chineseName ? { chineseName: data.chineseName } : {}),
              ...(data.region ? { originRegion: data.region } : {}), ...(data.year ? { year: data.year } : {}),
              ...(data.extraNotes ? { notes: [current.notes, data.extraNotes].filter(Boolean).join('\n\n') } : {}),
            }); }} />
        </section>
        <TeaRecordFields key={entry.id} entry={entry} onChange={patch => updateEntry(entry.id, patch)} />
        {entry.category === 'tea' && <StructuredTeaFields entry={entry} onChange={patch => updateEntry(entry.id, patch)} />}
        <section aria-label="Purchase facts" className="border-t border-tea-border pt-3 space-y-2">
          <h3 className={T.label}>Purchase facts</h3>
          {purchaseLabel && <p className="text-ui-12 text-tea-text-sec">{purchaseLabel}</p>}
          {purchases.isError && <p className="text-ui-12 text-tea-text-dim">Purchase history could not refresh. Try again shortly.</p>}
          {transactions.filter(transaction => transaction.direction === 'purchase' && transaction.items.some(item => item.compassEntryId === entry.id)).map(transaction => <div key={transaction.id} className="text-ui-12 text-tea-text-sec">
            <p>{transaction.counterpartyName} · {transaction.status === 'confirmed' ? 'Confirmed purchase' : 'Buying draft'}</p>
            {transaction.items.filter(item => item.compassEntryId === entry.id).map(item => <p key={item.id}>
              {item.quantityGrams != null ? `${item.quantityGrams} g` : item.quantityUnits != null ? `${item.quantityUnits} pieces` : 'Quantity not recorded'} · {item.unpriced ? 'Price not recorded' : `${item.pricePerUnit} ${item.currency} / ${item.priceIsPerGram ? 'g' : 'piece'}`}
            </p>)}
          </div>)}
          {!isInLedger && purchase.status === 'none' && <p className="text-ui-12 text-tea-text-dim">No purchase recorded.</p>}
          {purchase.quantities.map(q => <p key={q.unit} className="text-ui-12 text-tea-text-dim">{q.ordered > 0 ? `${q.ordered} ${q.unit} ordered` : ''}{q.received !== null ? ` · ${q.received} ${q.unit} received` : ''}{q.due !== null ? ` · ${q.due} ${q.unit} due` : ''}</p>)}
          {isInLedger && <button type="button" onClick={openLedger} className="tap-target min-h-11 text-ui-12 text-tea-gold">Open in Ledger</button>}
          {entry.draftProductId && <p className="text-ui-12 text-tea-text-dim">Linked to Inventory. Stock and listing publication are managed there.</p>}
        </section>
        {/* Tasting profile */}
        {hasTasting && (
          <div>
            <p className={SECTION_LABEL}>Tasting Profile</p>
            <TastingProfileStrip value={entry.tasting!} />
          </div>
        )}

        {/* Tasting history */}
        {hasTastingHistory && (
          <div>
            <p className={SECTION_LABEL}>
              {entry.tastingHistory!.length === 1 ? '1 Tasting' : `${entry.tastingHistory!.length} Tastings`}
            </p>
            <div className="space-y-2">
              {entry.tastingHistory!.slice().reverse().map((h, i) => {
                const q = h.data.quality ?? h.data.rating;
                const flavorSnippet = h.data.flavor?.slice(0, 3).join(', ');
                return (
                  <div key={i} className="flex items-start gap-2">
                    <span className="text-ui-12 text-tea-text-dim shrink-0 tabular-nums mt-px">
                      {getDateGroup(h.date)}
                    </span>
                    <div className="flex-1 min-w-0">
                      {q != null && (
                        <span className="text-ui-12 text-tea-text-sec font-medium tabular-nums">
                          {q}/10
                          {flavorSnippet ? ' · ' : ''}
                        </span>
                      )}
                      {flavorSnippet && (
                        <span className="text-ui-12 text-tea-text-sec truncate">{flavorSnippet}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-x-1 border-t border-tea-border pt-3" aria-label="Record actions">
        {onEdit && <button
          type="button"
          onClick={() => onEdit(entryId)}
          className="tap-target min-h-11 rounded-md px-3 text-ui-12 font-medium text-tea-text-sec hover:bg-tea-accent-sub hover:text-tea-text"
          aria-label="Edit entry"
        >
          Full capture editor
        </button>}

        <button
          type="button"
          onClick={() => updateEntry(entry.id, { tasteOrder: entry.tasteOrder ? undefined : Date.now() })}
          className="tap-target min-h-11 rounded-md px-3 text-ui-12 font-medium text-tea-text-sec hover:bg-tea-accent-sub hover:text-tea-text"
          aria-label={entry.tasteOrder ? 'Remove from queue' : 'Queue'}
        >
          <Star size={14} className="inline mr-1.5" fill={entry.tasteOrder ? 'currentColor' : 'none'} />{entry.tasteOrder ? 'Queued' : 'Queue'}
        </button>

        {entry.category !== 'teaware' && (
          <AddToSampleButton
            item={{
              id: entry.id,
              name: entry.name,
              chineseName: entry.chineseName,
              type: entry.type,
              vendorName: entry.vendorName,
              compassEntryId: entry.id,
            }}
            variant="labeled"
            className="tap-target min-h-11 rounded-md bg-transparent px-3 text-ui-12 text-tea-text-sec hover:bg-tea-accent-sub hover:text-tea-text"
          />
        )}

        {onShare && <button type="button" onClick={() => onShare(entryId)} className="tap-target min-h-11 rounded-md px-3 text-ui-12 font-medium text-tea-text-sec hover:bg-tea-accent-sub hover:text-tea-text" aria-label="Share"><Share2 size={14} className="inline mr-1.5" />Share</button>}
        {confirmDelete ? (
          <button
            type="button"
            onClick={() => { removeEntry(entry.id); onClose(); }}
            className="tap-target min-h-11 rounded-md px-3 text-ui-12 font-medium text-tea-error hover:bg-tea-accent-sub"
            aria-label="Confirm delete entry"
          >
            <Trash2 size={14} className="inline mr-1.5" />Confirm delete
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="tap-target min-h-11 rounded-md px-3 text-ui-12 font-medium text-tea-text-sec hover:bg-tea-accent-sub hover:text-tea-error"
            aria-label="Delete entry"
          >
            <Trash2 size={14} className="inline mr-1.5" />Delete
          </button>
        )}
        </div>
        <CurateRecordTools entityType="tea" entityId={entry.id} onChanged={() => { const account = useTeaCompassStore.getState().accountScopeId; if (account) void hydrateCompassEntries(account); }} />
      </div>

      {/* ── Footer action bar ── */}
      <div className="shrink-0 border-t border-tea-border px-4 py-2 pb-nav-gap">
        <div className="flex flex-wrap items-center gap-x-1">
        <button type="button" onClick={() => purchase.draftTransactionId ? openLedger() : onAcquire?.(entry.id)}
          disabled={!purchase.draftTransactionId && !onAcquire}
          className="tap-target min-h-11 rounded-md px-3 text-ui-12 font-medium text-tea-text-sec hover:bg-tea-accent-sub hover:text-tea-text disabled:text-tea-text-dim">
          <ShoppingBag size={14} className="inline mr-1.5" />{purchase.draftTransactionId ? 'Edit draft in Ledger' : purchase.quantities.some(q => q.ordered > 0) ? 'Reorder' : 'Order'}
        </button>

        <button type="button" onClick={() => setTastingOpen(true)}
          className="tap-target min-h-11 rounded-md px-3 text-ui-12 font-medium text-tea-text-sec hover:bg-tea-accent-sub hover:text-tea-text"
          aria-label="Taste">
          <Droplets size={14} className="inline mr-1.5" />Taste
        </button>

        <CreateInventoryRecordAction
          entryId={entry.id}
          compact
          productId={entry.draftProductId}
          onOpenInventory={onOpenInventory ?? ((productId) => navigate(`/admin/inventory?panel=${encodeURIComponent(productId)}`))}
        />

        </div>
      </div>

      {tastingOpen && (
        <TastingSession
          item={{ id: entry.id, name: entry.name, type: entry.type, image: validPhotos[0], sourceType: 'compass', compassEntryId: entry.id }}
          onClose={() => setTastingOpen(false)}
          onAfterSave={(data: TastingData, verdict?: CompassVerdict) => updateEntry(entry.id, {
            tasting: data,
            tastingHistory: [...(entry.tastingHistory ?? []), { data, date: new Date().toISOString() }],
            ...(verdict ? { verdict } : {}),
          })}
        />
      )}

    </div>
  );
};

export default CompassEntryDetailPanel;

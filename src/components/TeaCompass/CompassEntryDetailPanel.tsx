import { CurateRecordTools } from '../curate/CurateRecordTools';
import { syncCompassEntries, hydrateCompassEntries } from '../../lib/teaCompassSync';
import { LibraryInlineValue } from './LibraryInlineValue';
import { LibraryGivenName } from './LibraryGivenName';
import { LibrarySupplierActions } from './LibrarySupplierActions';
import { libraryIdentity, libraryInlinePatch, libraryCardAmounts, type LibraryInlineField } from './libraryCardWorkflow';
import { BottomSheet } from '../shared/BottomSheet';
import { StructuredTeaFields } from './StructuredTeaFields';
import React, { useEffect, useRef, useState } from 'react';
import { TeaRecordFields, RecordVoice } from './TeaRecordFields';
import { TeaRecordAssistant } from './TeaRecordAssistant';
import { PhotoCapture } from './PhotoCapture';
import { TYPOGRAPHY_CLASSES as T } from '../../designTokens';
import { useNavigate } from 'react-router-dom';
import { Droplets, Share2, Star, Trash2, X } from 'lucide-react';
import { useTeaCompassStore } from '../../lib/teaCompassStore';
import { useAppStore } from '../../lib/store';
import { useNotesStore } from '../../lib/notesStore';
import { syncNotes } from '../../lib/notesSync';
import { AddToSampleButton } from '../samples/AddToSampleButton';
import { DecisionControl } from './DecisionControl';
import { CreateInventoryRecordAction } from './CreateInventoryRecordAction';
import { useLedgerStore } from '../../lib/ledgerStore';
import { useLibraryPurchases, purchaseStateLabel } from '../../lib/libraryPurchaseState';
import { LibraryReceiptActions } from './LibraryReceiptActions';
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
const actionClass = 'tap-target min-h-11 px-2 text-ui-12 text-tea-text-sec hover:text-tea-text';
function RecordGroup({ title, children, active }: { title: string; children: React.ReactNode; active: boolean }) {
  if (!active) return null;
  return <section className="space-y-3 py-3" aria-label={title}>{children}</section>;
}
export const CompassEntryDetailPanel: React.FC<CompassEntryDetailPanelProps> = ({ entryId, onEdit, onOpenInventory, onClose, onShare, onAcquire }) => {
  const navigate = useNavigate();
  const entry = useTeaCompassStore(s => s.pendingEntries.find(e => e.id === entryId) ?? s.entries.find(e => e.id === entryId));
  const syncError = useTeaCompassStore(s => s.syncError);
  const accountScopeId = useTeaCompassStore(s => s.accountScopeId);
  const accountScopeRevision = useTeaCompassStore(s => s.accountScopeRevision);
  const userId = useAppStore(s => s.activeUserId);
  const updateEntry = (id: string, patch: Parameters<ReturnType<typeof useTeaCompassStore.getState>['updateEntry']>[1]) => {
    const store = useTeaCompassStore.getState();
    if (store.accountScopeId !== accountScopeId || store.accountScopeRevision !== accountScopeRevision) return;
    store.updateEntry(id, patch);
  };
  const removeEntry = useTeaCompassStore(s => s.removeEntry);
  const allNotes = useNotesStore(s => s.notes);
  const ledgerTransactions = useLedgerStore(s => s.transactions);
  const ledgerAccountId = useLedgerStore(s => s.accountScopeId);
  const transactions = ledgerAccountId === accountScopeId ? ledgerTransactions : [];
  const purchases = useLibraryPurchases();
  const [tastingOpen, setTastingOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [activeSection, setActiveSection] = useState('tea');
  const [moreFieldsOpen, setMoreFieldsOpen] = useState(false);
  const materialRef = useRef<HTMLElement>(null);
  const [newNote, setNewNote] = useState('');
  const [noteMessage, setNoteMessage] = useState('');
  useEffect(() => { setConfirmDelete(false); setNewNote(''); setNoteMessage(''); setActiveSection('tea'); setMoreFieldsOpen(false); }, [entryId, accountScopeRevision]);
  if (!entry) return null;
  const validPhotos = (entry.photos || []).filter(Boolean);
  const notes = allNotes.filter(note => !note.deleted && note.accountId === accountScopeId && (note.compassEntryId === entry.id || (!!entry.teaKey && note.teaKey === entry.teaKey)));
  const purchase = purchases.stateFor({ entryId: entry.id, productId: entry.draftProductId, chosen: entry.decision === 'selected' });
  const purchaseLabel = purchaseStateLabel(purchase);
  const openLedger = () => {
    if (purchase.draftTransactionId) useLedgerStore.getState().setActiveTransaction(purchase.draftTransactionId);
    navigate('/admin/compass?tab=ledger');
  };
  const addNote = () => {
    const text = newNote.trim();
    if (!text || !accountScopeId || !userId || (useAppStore.getState().activeAccountId !== accountScopeId || useAppStore.getState().activeUserId !== userId)) return;
    useNotesStore.getState().addNote({ accountId: accountScopeId, compassEntryId: entry.id, teaKey: entry.teaKey, text, sourceType: 'manual', authorId: userId, authorName: 'You', visibility: 'private' });
    void syncNotes().catch(() => {});
    setNewNote(''); setNoteMessage('Note added to this tea.');
  };
  const editNote = (id: string, text: string) => {
    if ((useAppStore.getState().activeAccountId !== accountScopeId || useAppStore.getState().activeUserId !== userId)) return;
    useNotesStore.getState().updateNote(id, text);
    void syncNotes().catch(() => {});
  };
  const openMaterial = () => { setActiveSection('notes'); requestAnimationFrame(() => materialRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' })); };
  const identity = libraryIdentity(entry);
  const amounts = libraryCardAmounts(entry, 'source');
  const savePatch = async (patch: Partial<typeof entry>) => {
    if (!accountScopeId) throw new Error('Sign in to save changes.');
    updateEntry(entry.id, patch);
    await syncCompassEntries(accountScopeId);
    const current = useTeaCompassStore.getState();
    if (current.accountScopeId !== accountScopeId || current.accountScopeRevision !== accountScopeRevision || !current.getEntry(entry.id)?.synced) throw new Error('Saved on this device; sync is pending. Retry.');
  };
  const saveField = (field: LibraryInlineField) => (value: string) => savePatch(libraryInlinePatch(entry, field, value));
  return <div className="tea-record-panel flex h-full min-w-0 flex-col" data-testid="library-entry-detail">
    <header className="shrink-0 flex min-h-14 items-center gap-2 border-b border-tea-border px-3 py-1" data-testid="tea-record-header">
      <button type="button" onClick={onClose} aria-label="Close detail panel" className="tap-target min-h-11 min-w-11 flex items-center justify-center text-tea-text-sec"><X size={18} /></button>
      <h2 className={`${T.h3} min-w-0 flex-1 truncate text-tea-text`}>Tea record</h2>
      <span role="status" className="shrink-0 text-ui-11 text-tea-text-dim">{syncError ? 'Saved locally' : entry.synced ? 'Saved' : 'Saving…'}</span>
    </header>
    <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-nav-gap" data-testid="tea-record-scroll">
      <div className="library-tea-card my-2">
        <div className="library-tea-identity">
          <div className="library-card-title-row">
            <LibraryInlineValue value={identity.name} display={identity.name || 'Name this tea'} label="Tea name" onSave={saveField('name')} className={`${T.h3} library-card-name`} />
          </div>
          <div className="library-card-subrow">
          <LibraryGivenName entry={entry} onSave={value => savePatch({ givenName: value.trim() || null })} />
            <LibraryInlineValue value={identity.year} display={identity.year || 'Add year'} label="Year" onSave={saveField('year')} className="library-card-year text-ui-13" />
          </div>
          <div className="flex items-center justify-between gap-2 text-ui-12 text-tea-text-sec"><span>{entry.vendorName || 'Supplier not recorded'}</span><LibrarySupplierActions supplierId={entry.vendorId} supplierName={entry.vendorName || 'Supplier'} onRenamed={() => { if (accountScopeId) void hydrateCompassEntries(accountScopeId); }} /></div>
        </div>
        <div className="library-ribbon-prices" aria-label={`Original quote in ${amounts.currency}`}>
          <div className="library-ribbon-metric"><span className="text-ui-10 text-tea-text-dim">{entry.category === 'tea' ? 'Price / g' : 'Price / piece'}</span><strong className="text-ui-16">{amounts.perGram}</strong></div>
          <div className="library-ribbon-metric"><span className="text-ui-10 text-tea-text-dim">Quote · {amounts.currency}</span><LibraryInlineValue numeric value={String(entry.priceAmount ?? '')} display={amounts.quote} label="Quote" onSave={saveField('priceAmount')} className="text-ui-16 font-semibold" /></div>
          <div className="library-ribbon-metric"><span className="text-ui-10 text-tea-text-dim">{entry.category === 'tea' ? 'Quoted grams' : 'Quantity'}</span>{entry.category === 'tea' ? <LibraryInlineValue numeric value={String(entry.pricePerUnitGrams ?? '')} display={entry.pricePerUnitGrams ? `${entry.pricePerUnitGrams}g` : 'Set grams'} label="Quoted grams" onSave={saveField('pricePerUnitGrams')} className="text-ui-16 font-semibold" /> : <strong>1 piece</strong>}</div>
        </div>
      </div>
      <div className="tea-record-decision"><DecisionControl value={entry.decision} onChange={decision => updateEntry(entry.id, { decision })} compact /></div>
      <div className="flex items-center justify-between gap-2 py-1">
        <span className="text-ui-12 text-tea-text-dim">{entry.tasting ? 'Tasting recorded' : 'No tasting yet'}</span>
        <button type="button" onClick={() => setTastingOpen(true)} className="tea-record-taste tap-target inline-flex min-h-11 items-center gap-1.5 rounded-md px-3 text-ui-13 font-medium" aria-label="Taste"><Droplets size={14} />Taste</button>
      </div>
      <div role="tablist" aria-label="Tea workspace" className="tea-record-tabs">
        {([['tea', 'Tea'], ['notes', 'Notes'], ['orders', 'Orders'], ['files', 'Files']] as const).map(([key, label]) => <button key={key} role="tab" type="button" aria-selected={activeSection === key} aria-controls={`record-panel-${entry.id}`} className="tap-target min-h-11 text-ui-13" onClick={() => setActiveSection(key)}>{label}</button>)}
      </div>
      <div role="tabpanel" id={`record-panel-${entry.id}`} aria-label={activeSection}>
      {activeSection === 'notes' && <>
      <section aria-label="Add to this tea" className="py-2 space-y-1">
        <label className="block"><span className="sr-only">What did you learn?</span>
          <textarea aria-label="Add a note" rows={1} value={newNote} onChange={event => { setNewNote(event.target.value); setNoteMessage(''); }} placeholder="Add a note about this tea…" className="input-field w-full min-w-0 resize-y px-3 py-2 text-ui-16" />
        </label>
        <div className="flex flex-wrap items-center gap-x-2">
          {newNote.trim() && <button type="button" onClick={addNote} className={actionClass}>Add note</button>}
          <RecordVoice key={entry.id} entryId={entry.id} compact />
          <button type="button" onClick={openMaterial} className={actionClass}>Photo / scan</button>
        </div>
        {noteMessage && <p role="status" className="text-ui-12 text-tea-text-sec">{noteMessage}</p>}
      </section>
      <TeaRecordAssistant entry={entry} compact />
      </>}
      <RecordGroup title="About this tea" active={activeSection === 'tea'}>
        <TeaRecordFields key={`${entry.id}:identity`} entry={entry} section="attributes" flat onChange={patch => updateEntry(entry.id, patch)} />
        {entry.category === 'tea' && <button type="button" className={actionClass} onClick={() => setMoreFieldsOpen(true)}>Grade, packaging & sourcing ↗</button>}
      </RecordGroup>
      <RecordGroup title="Story & description" active={activeSection === 'notes'}>
        <p className="text-ui-12 text-tea-text-sec">Your working description stays separate from source notes.</p>
        <TeaRecordFields key={`${entry.id}:description`} entry={entry} section="description" onChange={patch => updateEntry(entry.id, patch)} />
      </RecordGroup>
      {activeSection === 'notes' && <section ref={materialRef} aria-label="Source material" className="py-2">
        <h3 className="text-ui-14 font-medium mb-2">Source material · {validPhotos.length} photos</h3>
        <div className="space-y-4 pb-4 pt-1">
          <section aria-label="Tea photos"><PhotoCapture photos={validPhotos}
            onPhotoTaken={url => { const current = useTeaCompassStore.getState().getEntry(entry.id); if (current) updateEntry(entry.id, { photos: [...current.photos, url] }); }}
            onPhotoReplaced={(oldUrl, newUrl) => { const current = useTeaCompassStore.getState().getEntry(entry.id); if (current) updateEntry(entry.id, { photos: current.photos.map(url => url === oldUrl ? newUrl : url) }); }}
            onRemovePhoto={index => updateEntry(entry.id, { photos: validPhotos.filter((_, i) => i !== index) })}
            onExtracted={data => { const current = useTeaCompassStore.getState().getEntry(entry.id); if (current) updateEntry(entry.id, {
              ...(!current.name && data.name ? { name: data.name } : {}), ...(!current.chineseName && data.chineseName ? { chineseName: data.chineseName } : {}),
              ...(!current.originRegion && data.region ? { originRegion: data.region } : {}), ...(!current.year && data.year ? { year: data.year } : {}),
              ...(data.extraNotes ? { notes: [current.notes, data.extraNotes].filter(Boolean).join('\n\n') } : {}),
            }); }} />
          </section>
          <TeaRecordFields key={`${entry.id}:notes`} entry={entry} section="notes" onChange={patch => updateEntry(entry.id, patch)} />
          {notes.map(note => <label key={note.id} className="block space-y-1"><span className="text-ui-12 text-tea-text-sec">{note.sourceType === 'voice' ? 'Voice note' : note.sourceType === 'tasting' ? 'Tasting note' : note.sourceType === 'vendor' ? 'Supplier note' : 'Note'} · {note.authorName} · {new Date(note.createdAt).toLocaleDateString()}</span><textarea aria-label={`${note.sourceType === 'voice' ? 'Voice note' : 'Note'} from ${note.authorName}`} rows={3} className="input-field w-full text-ui-16 px-3 py-2" defaultValue={note.text} onBlur={event => { if (event.target.value !== note.text) editNote(note.id, event.target.value); }} /></label>)}
          <TeaRecordFields key={`${entry.id}:provenance`} entry={entry} section="provenance" flat onChange={patch => updateEntry(entry.id, patch)} />
        </div>
      </section>}
      <RecordGroup title="Purchasing" active={activeSection === 'orders'}>
        {purchaseLabel && <p className="text-ui-13 text-tea-text-sec">{purchaseLabel}</p>}
        <section aria-label="Purchase facts" className="space-y-2 text-ui-12 text-tea-text-sec">
          {purchases.isError && <p>Purchase history could not refresh. Try again shortly.</p>}
          {purchase.quantities.map(q => <div key={q.unit} className="library-order-metrics">{([['Ordered', q.ordered], ['Received', q.received], ['Incoming', q.due]] as const).map(([label, value]) => <div key={label}><span className="text-ui-12 text-tea-text-dim">{label}</span><strong className="text-ui-16 text-tea-text">{value == null ? 'Unknown' : `${value.toLocaleString()} ${q.unit}`}</strong></div>)}</div>)}
          {!purchases.isError && !purchase.quantities.length && <p>No order quantities recorded.</p>}
          <LibraryReceiptActions key={`${entry.id}:${accountScopeRevision}`} productId={entry.draftProductId} receipts={purchases.receipts ?? []} />
          <button type="button" onClick={() => purchase.draftTransactionId ? openLedger() : onAcquire?.(entry.id)} disabled={!purchase.draftTransactionId && !onAcquire} className={actionClass}>{purchase.draftTransactionId ? 'Edit draft in Ledger' : purchase.quantities.some(q => q.ordered > 0) ? 'Reorder' : 'Order'}</button>
          {transactions.some(tx => tx.items.some(item => item.compassEntryId === entry.id)) && <button type="button" onClick={openLedger} className={actionClass}>Open in Ledger</button>}
        </section>
        <TeaRecordFields key={`${entry.id}:quote`} entry={entry} section="quote" flat onChange={patch => updateEntry(entry.id, patch)} />
      </RecordGroup>
      <RecordGroup title="Files & history" active={activeSection === 'files'}>
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
        <CurateRecordTools flat entityType="tea" entityId={entry.id} onChanged={() => { const account = useTeaCompassStore.getState().accountScopeId; if (account) void hydrateCompassEntries(account); }} />
      </RecordGroup>
      </div>
      <section aria-label="Inventory handoff" className="border-t border-tea-border py-2 flex flex-wrap items-center justify-between gap-2">
        <span className="text-ui-12 text-tea-text-sec">{entry.draftProductId ? 'Stock & listing' : 'Create a private inventory listing'}</span>
        <CreateInventoryRecordAction entryId={entry.id} compact productId={entry.draftProductId} onOpenInventory={onOpenInventory ?? (productId => navigate(`/admin/stock?panel=${encodeURIComponent(productId)}`))} />
      </section>
    </div>
    <BottomSheet open={moreFieldsOpen} onOpenChange={setMoreFieldsOpen} title="Tea details & sourcing"><StructuredTeaFields flat entry={entry} onChange={patch => updateEntry(entry.id, patch)} /></BottomSheet>
    {tastingOpen && <TastingSession initialData={entry.tasting ?? entry.tastingHistory?.at(-1)?.data} item={{ id: entry.id, name: entry.name, type: entry.type, image: validPhotos[0], sourceType: 'compass', compassEntryId: entry.id }} onClose={() => setTastingOpen(false)} onAfterSave={(data: TastingData, verdict?: CompassVerdict) => updateEntry(entry.id, { tasting: data, ...(verdict ? { verdict } : {}) })} />}
  </div>;
};

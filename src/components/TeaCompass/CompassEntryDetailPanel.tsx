import { CurateRecordTools } from '../curate/CurateRecordTools';
import { hydrateCompassEntries } from '../../lib/teaCompassSync';
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
const actionClass = 'tap-target min-h-11 px-2 text-ui-12 text-tea-text-sec hover:text-tea-text';
function RecordGroup({ title, summary, children }: { title: string; summary?: string; children: React.ReactNode }) {
  return <details className="border-t border-tea-border" data-record-section={title}>
    <summary className="cursor-pointer py-3 min-h-11">
      <span className="text-ui-14 font-medium text-tea-text">{title}</span>
      {summary && <span className="block mt-1 pl-4 text-ui-12 text-tea-text-sec line-clamp-2">{summary}</span>}
    </summary>
    <div className="space-y-4 pb-4 pt-1">{children}</div>
  </details>;
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
  const [materialOpen, setMaterialOpen] = useState(false);
  const [newNote, setNewNote] = useState('');
  const [noteMessage, setNoteMessage] = useState('');
  const materialRef = useRef<HTMLDetailsElement>(null);
  useEffect(() => { setConfirmDelete(false); setNewNote(''); setNoteMessage(''); setMaterialOpen(false); }, [entryId, accountScopeRevision]);
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
  const openMaterial = () => { setMaterialOpen(true); requestAnimationFrame(() => materialRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' })); };
  const identity = [entry.year, entry.type, entry.originRegion || entry.originCountry, entry.vendorName].filter(Boolean).join(' · ');
  const tastingCount = entry.tastingHistory?.length || (entry.tasting && Object.values(entry.tasting).some(value => Array.isArray(value) ? value.length > 0 : value != null) ? 1 : 0);
  return <div className="flex h-full min-w-0 flex-col" data-testid="library-entry-detail">
    <header className="shrink-0 flex min-h-14 items-center gap-2 border-b border-tea-border px-3 py-1" data-testid="tea-record-header">
      <button type="button" onClick={onClose} aria-label="Close detail panel" className="tap-target min-h-11 min-w-11 flex items-center justify-center text-tea-text-sec"><X size={18} /></button>
      <h2 className={`${T.h3} min-w-0 flex-1 truncate text-tea-text`}>{entryDisplayTitle(entry)}</h2>
      <span role="status" className="shrink-0 text-ui-11 text-tea-text-dim">{syncError ? 'Saved locally' : entry.synced ? 'Saved' : 'Saving…'}</span>
    </header>
    <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-nav-gap" data-testid="tea-record-scroll">
      <p className="pt-3 text-ui-12 text-tea-text-sec">{[entry.chineseName, identity].filter(Boolean).join(' · ') || 'Start with a note, photo or conversation.'}</p>
      <section aria-label="Add to this tea" className="py-4 space-y-2">
        <label className="block space-y-2"><span className={T.h3}>What did you learn?</span>
          <textarea aria-label="Add a note" rows={2} value={newNote} onChange={event => { setNewNote(event.target.value); setNoteMessage(''); }} placeholder="A detail from the farmer, something you noticed, a story…" className="input-field w-full min-w-0 resize-y px-3 py-2 text-ui-16" />
        </label>
        <div className="flex flex-wrap items-center gap-x-2">
          {newNote.trim() && <button type="button" onClick={addNote} className={actionClass}>Add note</button>}
          <RecordVoice key={entry.id} entryId={entry.id} compact />
          <button type="button" onClick={openMaterial} className={actionClass}>Photo / scan</button>
          <button type="button" onClick={() => setTastingOpen(true)} className={`${actionClass} inline-flex items-center gap-1.5`} aria-label="Taste"><Droplets size={14} />Taste{tastingCount ? ` · ${tastingCount}` : ''}</button>
        </div>
        {noteMessage && <p role="status" className="text-ui-12 text-tea-text-sec">{noteMessage}</p>}
      </section>
      <TeaRecordAssistant entry={entry} />
      <RecordGroup title="About this tea" summary={identity || 'Name, origin, harvest and supplier'}>
        <TeaRecordFields key={`${entry.id}:identity`} entry={entry} section="identity" onChange={patch => updateEntry(entry.id, patch)} />
        {entry.category === 'tea' && <StructuredTeaFields entry={entry} onChange={patch => updateEntry(entry.id, patch)} />}
      </RecordGroup>
      <RecordGroup title="Story & description" summary={entry.description || 'Build the words that will introduce this tea.'}>
        <p className="text-ui-12 text-tea-text-sec">Your working description stays separate from source notes.</p>
        <TeaRecordFields key={`${entry.id}:description`} entry={entry} section="description" onChange={patch => updateEntry(entry.id, patch)} />
      </RecordGroup>
      <details ref={materialRef} open={materialOpen} onToggle={event => setMaterialOpen(event.currentTarget.open)} className="border-t border-tea-border" data-record-section="Source material">
        <summary className="cursor-pointer py-3 min-h-11"><span className="text-ui-14 font-medium text-tea-text">Source material</span><span className="block mt-1 pl-4 text-ui-12 text-tea-text-sec">{validPhotos.length} {validPhotos.length === 1 ? 'photo' : 'photos'} · {notes.length + (entry.notes?.trim() ? 1 : 0)} {notes.length + (entry.notes?.trim() ? 1 : 0) === 1 ? 'note' : 'notes'} · {entry.audioClips.length} {entry.audioClips.length === 1 ? 'recording' : 'recordings'}</span></summary>
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
          <TeaRecordFields key={`${entry.id}:provenance`} entry={entry} section="provenance" onChange={patch => updateEntry(entry.id, patch)} />
        </div>
      </details>
      <RecordGroup title="Purchasing" summary={purchaseLabel || 'Choose this tea, then manage quantities through Ledger.'}>
        <DecisionControl value={entry.decision} onChange={decision => updateEntry(entry.id, { decision })} />
        <section aria-label="Purchase facts" className="space-y-2 text-ui-12 text-tea-text-sec">
          {purchases.isError && <p>Purchase history could not refresh. Try again shortly.</p>}
          {purchase.quantities.map(q => <p key={q.unit}>{q.ordered > 0 ? `${q.ordered} ${q.unit} ordered` : ''}{q.received !== null ? ` · ${q.received} ${q.unit} received` : ''}{q.due !== null ? ` · ${q.due} ${q.unit} due` : ''}</p>)}
          <button type="button" onClick={() => purchase.draftTransactionId ? openLedger() : onAcquire?.(entry.id)} disabled={!purchase.draftTransactionId && !onAcquire} className={actionClass}>{purchase.draftTransactionId ? 'Edit draft in Ledger' : purchase.quantities.some(q => q.ordered > 0) ? 'Reorder' : 'Order'}</button>
          {transactions.some(tx => tx.items.some(item => item.compassEntryId === entry.id)) && <button type="button" onClick={openLedger} className={actionClass}>Open in Ledger</button>}
        </section>
        <TeaRecordFields key={`${entry.id}:quote`} entry={entry} section="quote" onChange={patch => updateEntry(entry.id, patch)} />
      </RecordGroup>
      <RecordGroup title="Files & history" summary="Source documents, corrections and other record actions">
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
      </RecordGroup>
      <section aria-label="Inventory handoff" className="border-t border-tea-border py-4 space-y-2">
        <h3 className="text-ui-14 font-medium text-tea-text">{entry.draftProductId ? 'Continue in Inventory' : 'Ready for Inventory?'}</h3>
        <p className="text-ui-12 text-tea-text-sec">{entry.draftProductId ? 'This is the same tea record. Manage stock and the listing in Inventory.' : 'Keep the same record and its source material. The new listing stays private.'}</p>
        <CreateInventoryRecordAction entryId={entry.id} compact productId={entry.draftProductId} onOpenInventory={onOpenInventory ?? (productId => navigate(`/admin/stock?panel=${encodeURIComponent(productId)}`))} />
      </section>
    </div>
    {tastingOpen && <TastingSession item={{ id: entry.id, name: entry.name, type: entry.type, image: validPhotos[0], sourceType: 'compass', compassEntryId: entry.id }} onClose={() => setTastingOpen(false)} onAfterSave={(data: TastingData, verdict?: CompassVerdict) => updateEntry(entry.id, { tasting: data, tastingHistory: [...(useTeaCompassStore.getState().getEntry(entry.id)?.tastingHistory ?? []), { data, date: new Date().toISOString() }], ...(verdict ? { verdict } : {}) })} />}
  </div>;
};

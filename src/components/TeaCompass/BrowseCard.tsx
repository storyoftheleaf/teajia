import React, { useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { LoaderCircle } from 'lucide-react';
import { useToast } from '../../admin/components/Toast';
import { useTheme } from '../../context/ThemeContext';
import { getTeaLedgerTones, TYPOGRAPHY_CLASSES } from '../../designTokens';
import { useTeaCompassStore } from '../../lib/teaCompassStore';
import { syncCompassEntries } from '../../lib/teaCompassSync';
import { BottomSheet } from '../shared/BottomSheet';
import { LibraryGivenName } from './LibraryGivenName';
import { LibraryInlineValue } from './LibraryInlineValue';
import { libraryCardAmounts, libraryChosen, libraryIdentity, libraryInlinePatch, type LibraryInlineField } from './libraryCardWorkflow';
import { TastingSession } from '../tasting/TastingSession';
import type { TastingData } from '../../types';
import type { CompassVerdict, TeaCompassEntry } from './types';
import { entryHasBeenTasted } from './types';
import { DEFAULT_LIBRARY_PRICE, type LibraryPricePreference } from './libraryPriceDisplay';
import type { RateRow } from '../../lib/currency';
import { type LibraryPurchaseState } from '../../lib/libraryPurchaseState';

export interface BrowseCardProps {
  entry: TeaCompassEntry;
  readOnly?: boolean;
  tastingRecorded?: boolean;
  onEdit: (id: string) => void;
  tasteQueueActive?: boolean;
  onSelect?: (id: string) => void;
  onOpenDetail?: (id: string) => void;
  isSelected?: boolean;
  onAcquire?: (id: string) => void;
  pricePreference?: LibraryPricePreference;
  rates?: readonly RateRow[];
  purchaseState?: LibraryPurchaseState;
  purchaseStatusUnknown?: string;
}

export function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  if (diffHours < 1) return 'Just now';
  if (diffHours < 24) return `${Math.floor(diffHours)}h ago`;
  if (diffDays < 2) return 'Yesterday';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function getDateGroup(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const entryDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = (today.getTime() - entryDate.getTime()) / (1000 * 60 * 60 * 24);
  if (diffDays < 1) return 'Today';
  if (diffDays < 2) return 'Yesterday';
  return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

export const BrowseCard: React.FC<BrowseCardProps> = ({ entry, readOnly = false, tastingRecorded, onEdit, onSelect, onOpenDetail, isSelected, onAcquire, pricePreference = DEFAULT_LIBRARY_PRICE, rates, purchaseState, purchaseStatusUnknown }) => {
  const { theme } = useTheme();
  const { showToast } = useToast();
  const updateEntry = useTeaCompassStore((state) => state.updateEntry);
  const [tastingOpen, setTastingOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [actionError, setActionError] = useState('');
  const [actionBusy, setActionBusy] = useState(false);
  const validPhotos = (entry.photos || []).filter(Boolean);
  const tones = getTeaLedgerTones(entry.type || (entry.category === 'teaware' ? 'Teaware' : 'Misc'), theme, 2);
  const identity = libraryIdentity(entry);
  const title = identity.name || entry.chineseName || 'Name this tea';
  const openDetail = () => (onOpenDetail || onSelect || onEdit)(entry.id);
  const amounts = libraryCardAmounts(entry, pricePreference.currency, rates);
  const knownWeight = entry.pricePerUnitGrams != null && entry.pricePerUnitGrams > 0;
  const savePatch = async (patch: Partial<TeaCompassEntry>) => {
    if (readOnly) throw new Error('This preview is read-only.');
    const before = useTeaCompassStore.getState();
    const account = before.accountScopeId;
    const revision = before.accountScopeRevision;
    if (!account) throw new Error('Sign in to save changes.');
    updateEntry(entry.id, patch);
    await syncCompassEntries(account);
    const current = useTeaCompassStore.getState();
    if (current.accountScopeId !== account || current.accountScopeRevision !== revision || !current.getEntry(entry.id)?.synced) {
      throw new Error('Change kept on this device; not yet synced. Retry.');
    }
  };
  const saveField = (field: LibraryInlineField) => async (value: string) => savePatch(libraryInlinePatch(useTeaCompassStore.getState().getEntry(entry.id) || entry, field, value));
  const rejected = entry.decision === 'passed_on' || entry.status === 'pass';
  const chosen = libraryChosen(entry, purchaseState);
  const acquired = libraryChosen({ ...entry, decision: 'considering' }, purchaseState);
  const rating = entry.tasting?.quality ?? entry.tasting?.rating;
  const runAction = async (patch: Partial<TeaCompassEntry>, message = 'Updated', allowUndo = false) => {
    const before = useTeaCompassStore.getState();
    const account = before.accountScopeId, revision = before.accountScopeRevision;
    const previous = before.getEntry(entry.id) || entry;
    const undo = async () => {
      const current = useTeaCompassStore.getState();
      if (current.accountScopeId !== account || current.accountScopeRevision !== revision) {
        showToast('Return to the original shop to restore this tea.', 'error'); return;
      }
      try { await savePatch({ decision: previous.decision || 'considering', status: previous.status }); showToast('Restored', 'success'); }
      catch (error) { showToast(error instanceof Error ? error.message : 'Restore not yet synced.', 'error'); }
    };
    setActionBusy(true); setActionError('');
    try {
      await savePatch(patch); setRejectOpen(false);
      showToast(message, 'success', allowUndo ? { duration: 9000, action: { label: 'Undo', onClick: () => void undo() } } : undefined);
    } catch (error) {
      const text = error instanceof Error ? error.message : 'Could not save.';
      setActionError(text);
      showToast(text, 'error', allowUndo ? { duration: 12000, action: { label: 'Undo', onClick: () => void undo() } } : { duration: 12000 });
    } finally { setActionBusy(false); }
  };
  const openOrder = () => openDetail();
  const tasted = tastingRecorded ?? entryHasBeenTasted(entry);
  const sampleStatus = entry.sampleState === 'requested' ? 'Sample requested'
    : entry.sampleState === 'received' ? 'Sample ready' : entry.isSample ? 'Sample' : null;
  const description = [entry.originRegion || entry.originCountry, entry.type || (entry.category === 'teaware' ? 'Teaware' : null)].filter(Boolean).join(' · ');

  return (
    <>
      <article data-testid={`library-entry-${entry.id}`} className={`library-tea-card ${isSelected ? 'library-tea-card-selected' : ''}`}
        style={{ '--library-accent': tones.markFg, '--library-tea-tint': tones.markBg } as React.CSSProperties}>
        <div className="library-tea-identity">
          <div className="library-card-title-row">
            <LibraryInlineValue className={`${TYPOGRAPHY_CLASSES.h3} library-card-name text-tea-text`} value={identity.name} display={title} label={`Edit tea name: ${title}`} readOnly={readOnly} onSave={saveField('name')} />
          </div>
          <div className="library-card-subrow">
            <LibraryGivenName entry={entry} readOnly={readOnly} onSave={value => savePatch({ givenName: value.trim() || null })} />
            {rating != null && Number.isFinite(rating) && <span className="text-ui-11 text-tea-text-dim whitespace-nowrap" aria-label={`Rating ${rating} out of 10`}>{rating}/10</span>}
            <LibraryInlineValue className="library-card-year text-ui-13 text-tea-text-sec" value={identity.year} display={identity.year || 'Add year'} label={`Edit year for ${title}`} readOnly={readOnly} onSave={saveField('year')} />
          </div>
        </div>
        <div className="library-ribbon-prices" aria-label={`Prices in ${amounts.currency}`}>
          <div className="library-ribbon-metric" title={`Calculated in ${amounts.currency}`}>
            <span className="text-ui-10 text-tea-text-dim">{entry.category === 'teaware' ? 'Price / piece' : 'Per gram'}</span>
            <strong className="text-ui-16 text-tea-text" aria-label={entry.category === 'tea' && !knownWeight ? 'Per gram unknown, add weight' : undefined}>{entry.category === 'tea' && !knownWeight ? '0.0' : amounts.perGram}</strong>
          </div>
          <div className="library-ribbon-metric">
            <span className="text-ui-10 text-tea-text-dim">Quote{pricePreference.currency === 'source' ? ` · ${amounts.currency}` : ''}</span>
            <LibraryInlineValue className="text-ui-16 font-semibold text-tea-text" value={entry.priceAmount == null ? '' : String(entry.priceAmount)} display={amounts.quote} label={`Edit quote in ${amounts.sourceCurrency} for ${title}`} hint={`Original ${amounts.sourceCurrency}`} numeric readOnly={readOnly} onSave={saveField('priceAmount')} />
          </div>
          <div className="library-ribbon-metric">
            <span className="text-ui-10 text-tea-text-dim">{entry.category === 'teaware' ? 'Quoted quantity' : 'Weight (g)'}</span>
            {entry.category === 'teaware' ? <strong className="text-ui-16 text-tea-text">1 piece</strong> : <LibraryInlineValue className={`text-ui-16 font-semibold text-tea-text ${!knownWeight ? 'library-unset' : ''}`} value={entry.pricePerUnitGrams == null ? '' : String(entry.pricePerUnitGrams)} display={knownWeight ? entry.pricePerUnitGrams!.toLocaleString() : 'Add weight'} label={`Edit quoted grams for ${title}`} numeric readOnly={readOnly} onSave={saveField('pricePerUnitGrams')} />}
          </div>
        </div>
        {purchaseStatusUnknown && <p role="status" className="text-ui-11 text-tea-text-dim py-1">{purchaseStatusUnknown}</p>}
        <div className="library-tea-actions">
          {readOnly || rejected ? <span className="library-ribbon-sample text-ui-11 text-tea-text-sec" title={sampleStatus || undefined}>
            {rejected ? 'Rejected' : chosen ? 'Chosen' : sampleStatus || 'Considering'}
          </span> : <button type="button" className={`tap-target library-choose library-ribbon-sample inline-flex items-center gap-1.5 text-ui-12 transition-colors ${chosen ? 'text-tea-text font-semibold' : 'text-tea-text-sec'}`} disabled={actionBusy} aria-pressed={chosen} aria-busy={actionBusy}
            title={[sampleStatus, acquired ? 'Already ordered. Open order details to change acquisition.' : chosen ? 'Remove from chosen' : 'Choose this tea'].filter(Boolean).join(' · ')}
            onClick={() => acquired ? openOrder() : void runAction({ decision: chosen ? 'considering' : 'selected' }, chosen ? 'Removed from chosen' : 'Chosen')}>
            {actionBusy && <LoaderCircle size={14} className="shrink-0 animate-spin text-tea-gold" aria-hidden="true" />}
            {actionBusy ? 'Saving…' : chosen ? 'Chosen' : 'Choose'}
          </button>}
          {!readOnly && <button type="button" disabled={actionBusy} className="tap-target library-tea-reject text-ui-12 text-tea-text-sec" onClick={() => rejected ? void runAction({ decision: 'considering', ...(entry.status === 'pass' ? { status: 'noted' as const } : {}) }, 'Restored') : setRejectOpen(true)}>{rejected ? 'Restore' : 'Reject'}</button>}
          {entry.category !== 'teaware' && <button type="button" onClick={() => readOnly ? openDetail() : setTastingOpen(true)} className={`tap-target library-tea-primary text-ui-12 ${tasted ? 'is-tasted' : ''}`} aria-label={`Taste ${title}`} title={readOnly ? 'View tasting status (read-only)' : tasted ? 'Edit tasting' : 'Begin tasting'}>Taste</button>}
            <button type="button" className="tap-target library-detail-link text-ui-13 text-tea-text-dim" onClick={openDetail} aria-label={`Open ${title} details and Orders`} title={description || 'Details & Orders'}>Details</button>
        </div>
        {actionError && <p role="alert" className="text-ui-11 text-tea-text-sec">{actionError}</p>}
      </article>
      {!readOnly && <BottomSheet open={rejectOpen} onOpenChange={setRejectOpen} title="Reject tea" description="Keep this tea in Rejected, where you can find and restore it.">
        <label className="block text-ui-13 text-tea-text">Reason (optional)
          <textarea className="w-full rounded border border-tea-border bg-tea-surface text-tea-text p-3" rows={3} value={rejectReason} onChange={event => setRejectReason(event.target.value)} />
        </label>
        {actionError && <p role="alert" className="text-ui-12 text-tea-text-sec">{actionError}</p>}
        <button type="button" className="tap-target library-tea-primary text-ui-13" disabled={actionBusy} onClick={() => {
          const notes = useTeaCompassStore.getState().getEntry(entry.id)?.notes || '';
          void runAction({ decision: 'passed_on', ...(rejectReason.trim() ? { notes: `${notes}${notes ? '\n\n' : ''}Rejected (${new Date().toISOString().slice(0, 10)}): ${rejectReason.trim()}` } : {}) }, 'Moved to Rejected', true);
        }}>{actionBusy ? 'Saving…' : 'Reject'}</button>
      </BottomSheet>}
      {/* ── Tasting session ── */}
      <AnimatePresence>
        {tastingOpen && !readOnly && (
          <TastingSession
            item={{
              id: entry.id,
              name: entry.name,
              type: entry.type,
              image: validPhotos[0],
              sourceType: 'compass',
              compassEntryId: entry.id,
            }}
            initialData={entry.tasting ?? entry.tastingHistory?.at(-1)?.data}
            onClose={() => setTastingOpen(false)}
            onAfterSave={(data: TastingData, sessionVerdict?: CompassVerdict) => {
              updateEntry(entry.id, {
                tasting: data,
                // Only overwrite verdict if the session captured one, otherwise
                // leave it for later triage in the batch review.
                ...(sessionVerdict ? { verdict: sessionVerdict } : {}),
              });
            }}
          />
        )}
      </AnimatePresence>

    </>
  );
};

export default BrowseCard;

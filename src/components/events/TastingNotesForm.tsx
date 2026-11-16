import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { TYPOGRAPHY_CLASSES } from '../../designTokens';
import { useSubmitTastingNotes } from '../../hooks/useEventPolling';
import { useAppStore } from '../../lib/store';
import { matchesEventTastingEntry } from '../../lib/tastingAccessors';
import { syncTastingJournal } from '../../lib/tastingJournalSync';
import type { TeaMenuItem } from '../../types/events';
import type { TastingData, TastingRecord } from '../../types';
import { TastingSession } from '../tasting/TastingSession';
import { ImpressionControls, ImpressionNoteField } from '../tasting/YourImpression';
import { tastingNoteText } from '../tasting/tastingNoteText';

interface TastingNotesFormProps {
  teaMenu: TeaMenuItem[];
  token: string;
  eventId?: string;
  eventSlug?: string;
  eventTitle?: string;
  onClose: () => void;
}

interface TastingDraft {
  tasting: TastingData;
  sharedNote: string;
  isFavorite: boolean;
}

type SavedDraft = Partial<TastingDraft> & { rating?: number; impression?: string };

function restoreDraft(draft: SavedDraft | undefined, record: TastingRecord | undefined): TastingDraft {
  let tasting = draft?.tasting ?? record?.tasting ?? {};
  let sharedNote = draft?.sharedNote ?? record?.sessionSharedNote ?? draft?.impression;
  // Older quick tastings stored their shared note as a single plain string.
  if (sharedNote == null && Array.isArray(tasting.notes) && tasting.notes.length === 1 && typeof tasting.notes[0] === 'string') {
    sharedNote = tasting.notes[0];
    tasting = { ...tasting, notes: undefined };
  }
  if (draft?.rating) tasting = { ...tasting, rating: draft.rating };
  return { tasting, sharedNote: sharedNote ?? '', isFavorite: draft?.isFavorite ?? record?.sessionFavorite ?? false };
}

function hasImpression({ tasting, sharedNote, isFavorite }: TastingDraft) {
  return tasting.rating != null || tasting.quality != null || tasting.impression != null ||
    tasting.wantToPurchase === true || tasting.inCollection != null || Boolean(sharedNote.trim()) || isFavorite;
}

const TastingNotesForm = ({ teaMenu, token, eventId, eventSlug, eventTitle, onClose }: TastingNotesFormProps) => {
  const sortedMenu = [...teaMenu].sort((a, b) => (a.brewOrder ?? 0) - (b.brewOrder ?? 0));
  const legacyDraftKey = `tasting-draft-${token}-no-event`;
  const draftKey = eventId ? `tasting-draft-${token}-${eventId}` : legacyDraftKey;
  const submitMutation = useSubmitTastingNotes(token);
  const browsingJournal = useAppStore(state => state.tastingJournal);
  const activeAccountId = useAppStore(state => state.activeAccountId);
  const favoriteTeas = useAppStore(state => state.favoriteTeas);
  const upsertTasting = useAppStore(state => state.upsertTastingByProductId);

  const recordId = (item: TeaMenuItem) => `event-tasting:${eventId ?? item.eventId}:${item.id}`;
  const savedRecord = (item: TeaMenuItem) => {
    const productId = item.productId || item.id;
    const sameTea = browsingJournal.filter(entry => matchesEventTastingEntry(entry, productId, activeAccountId));
    const records = sameTea.flatMap(entry => entry.tastings);
    const current = records.find(tasting => tasting.id === recordId(item));
    if (current) return current;
    // Old post-session notes had random IDs. Reuse the saved record when
    // there is one unambiguous menu entry for this tea in the event.
    const sameMenuTea = sortedMenu.filter(tea => (tea.productId || tea.id) === productId);
    if (sameMenuTea.length !== 1) return undefined;
    return records.find(tasting => tasting.sourceType === 'event' && tasting.eventId === (eventId ?? item.eventId));
  };

  const [draftOverrides, setDraftOverrides] = useState<Record<string, SavedDraft>>(() => {
    let saved: Record<string, SavedDraft> = {};
    try {
      const raw = localStorage.getItem(draftKey) ?? localStorage.getItem(legacyDraftKey);
      if (raw) saved = JSON.parse(raw) ?? {};
    } catch { /* local storage may be unavailable */ }
    return saved;
  });

  const [currentStep, setCurrentStep] = useState(0);
  const [fullTasting, setFullTasting] = useState<TastingRecord | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [hasEdits, setHasEdits] = useState(false);

  useEffect(() => {
    if (submitted || !hasEdits) return;
    try { localStorage.setItem(draftKey, JSON.stringify(draftOverrides)); } catch { /* local storage may be unavailable */ }
  }, [draftOverrides, submitted, draftKey, hasEdits]);

  const currentItem = sortedMenu[currentStep];
  if (!currentItem) return null;

  const drafts = Object.fromEntries(sortedMenu.map(item => [item.id, restoreDraft(draftOverrides[item.id], savedRecord(item))]));
  const currentDraft = drafts[currentItem.id];
  const saveableTeas = sortedMenu.filter(item => hasImpression(drafts[item.id]) ||
    (draftOverrides[item.id] != null && savedRecord(item) != null));
  const productId = currentItem.productId || currentItem.id;
  const inCollection = !!currentItem.productId && (currentDraft.tasting.inCollection ?? favoriteTeas.includes(productId));
  const name = currentItem.customName || currentItem.productName || 'Unknown tea';
  const recordFor = (item: TeaMenuItem, tasting: TastingData): TastingRecord => ({
    id: savedRecord(item)?.id ?? recordId(item),
    createdAt: savedRecord(item)?.createdAt ?? new Date().toISOString(),
    tasting,
    sourceType: 'event',
    eventId: eventId ?? item.eventId,
    eventSlug,
    eventTitle,
    sessionFavorite: drafts[item.id].isFavorite,
    sessionSharedNote: drafts[item.id].sharedNote,
  });

  const updateDraft = (changes: Partial<TastingDraft>) => {
    setHasEdits(true);
    setDraftOverrides(previous => ({ ...previous, [currentItem.id]: { ...currentDraft, ...changes } }));
  };

  const handleSave = async () => {
    try {
      // The recap gets the host note and any legacy shared rating or favorite.
      // Impression controls, the 1–10 rating and wheel notes stay in the journal.
      const shared = saveableTeas.flatMap(item => {
        const draft = drafts[item.id];
        const impression = draft.sharedNote.trim();
        const legacyRating = draft.tasting.rating;
        const rating = legacyRating != null && legacyRating >= 1 && legacyRating <= 5 ? legacyRating : undefined;
        const saved = savedRecord(item);
        const previouslyShared = saved?.sessionFavorite || Boolean(saved && restoreDraft(undefined, saved).sharedNote.trim());
        return impression || draft.isFavorite || rating || previouslyShared
          ? [{ teaMenuId: item.id, rating, impression: impression || undefined, isFavorite: draft.isFavorite }]
          : [];
      });
      if (shared.length > 0) await submitMutation.mutateAsync(shared);

      for (const item of saveableTeas) {
        const { tasting, sharedNote } = drafts[item.id];
        const collection = useAppStore.getState();
        if (item.productId && tasting.inCollection != null && collection.favoriteTeas.includes(item.productId) !== tasting.inCollection) {
          collection.toggleFavoriteTea(item.productId);
        }
        upsertTasting(item.productId || item.id, item.customName || item.productName || 'Unknown tea',
          item.productType || '', item.productImageUrl || undefined, recordFor(item, tasting), {
            personalNote: tastingNoteText(tasting).trim() || sharedNote.trim() || undefined,
            rating: tasting.quality ?? tasting.rating,
            verdict: tasting.impression,
            wouldBuy: tasting.wantToPurchase,
          }, activeAccountId ?? undefined);
      }
      void syncTastingJournal();
      try {
        localStorage.removeItem(draftKey);
        localStorage.removeItem(legacyDraftKey);
      } catch { /* local storage may be unavailable */ }
      setSubmitted(true);
    } catch { /* mutation error shown beside the save controls */ }
  };

  if (fullTasting) {
    return (
      <TastingSession
        item={{
          id: productId,
          name,
          type: currentItem.productType || undefined,
          image: currentItem.productImageUrl || undefined,
          sourceType: 'event',
          eventTitle,
          journalRecord: fullTasting,
          collectionUnavailable: !currentItem.productId,
        }}
        startOnWheel
        onClose={() => setFullTasting(null)}
        onAfterSave={tasting => updateDraft({ tasting })}
      />
    );
  }

  if (submitted) {
    return (
      <div className="text-center py-8">
        <h2 className={TYPOGRAPHY_CLASSES.h2}>Tasting saved</h2>
        <button type="button" onClick={onClose} className="tap-target cta-solid mt-5 rounded-md px-5">Done</button>
      </div>
    );
  }

  return (
    <section className="tasting-impression tasting-session-quick" aria-label="Post-session tasting">
      {sortedMenu.length > 1 && (
        <div className="flex items-center justify-between">
          <button type="button" aria-label="Previous tea" disabled={currentStep === 0}
            className="grid h-11 w-11 place-items-center disabled:invisible" onClick={() => setCurrentStep(step => step - 1)}>
            <ChevronLeft size={18} aria-hidden="true" />
          </button>
          <span className={TYPOGRAPHY_CLASSES.accountMeta}>Tea {currentStep + 1} of {sortedMenu.length}</span>
          <button type="button" aria-label="Next tea" disabled={currentStep === sortedMenu.length - 1}
            className="grid h-11 w-11 place-items-center disabled:invisible" onClick={() => setCurrentStep(step => step + 1)}>
            <ChevronRight size={18} aria-hidden="true" />
          </button>
        </div>
      )}
      <p className={TYPOGRAPHY_CLASSES.accountMeta}>
        Quick tasting{currentItem.productType ? ` · ${currentItem.productType}` : ''}
      </p>
      <h2 className={TYPOGRAPHY_CLASSES.h2}>{name}</h2>
      {currentItem.customDescription && <p className={TYPOGRAPHY_CLASSES.bodyLight}>{currentItem.customDescription}</p>}
      <fieldset className="min-w-0" disabled={submitMutation.isPending}>
        <ImpressionControls value={currentDraft.tasting} ratingLabel="Overall"
          onChange={tasting => updateDraft({ tasting })}
          verdict={currentDraft.tasting.impression ?? null}
          onVerdict={verdict => updateDraft({ tasting: { ...currentDraft.tasting, impression: verdict ?? undefined } })}
          wouldBuy={currentDraft.tasting.wantToPurchase ?? false}
          onWouldBuy={wantToPurchase => updateDraft({ tasting: { ...currentDraft.tasting, wantToPurchase } })}
          inCollection={inCollection} collectionUnavailable={!currentItem.productId}
          onCollection={() => updateDraft({ tasting: { ...currentDraft.tasting, inCollection: !inCollection } })} />
        <ImpressionNoteField label="Note to share with host (optional)" rows={2}
          value={currentDraft.sharedNote} onChange={sharedNote => updateDraft({ sharedNote })} />
      </fieldset>
      <div className="tasting-quick-actions">
        <button type="button" className="cta-solid" onClick={() => void handleSave()}
          disabled={saveableTeas.length === 0 || submitMutation.isPending}>
          {submitMutation.isPending ? 'Saving…' : 'Save tasting'}
        </button>
        <button type="button" onClick={() => setFullTasting(recordFor(currentItem, currentDraft.tasting))} disabled={submitMutation.isPending}>
          Taste wheel
        </button>
      </div>
      {submitMutation.isError && <p role="alert" className="mt-3 text-sm text-tea-error">{submitMutation.error.message}</p>}
      <button type="button" onClick={onClose} disabled={submitMutation.isPending}
        className="tap-target mt-1 w-full text-xs font-semibold">Skip</button>
    </section>
  );
};

export default TastingNotesForm;

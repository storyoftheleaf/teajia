import { useEffect, useState } from 'react';
import { TYPOGRAPHY_CLASSES } from '../../designTokens';
import { useAppStore } from '../../lib/store';
import { matchesEventTastingEntry } from '../../lib/tastingAccessors';
import { syncTastingJournal } from '../../lib/tastingJournalSync';
import type { TeaMenuItem } from '../../types/events';
import type { TastingData, TastingRecord } from '../../types';
import { TastingSequenceNav } from '../tasting/TastingSequenceNav';
import { TastingSession } from '../tasting/TastingSession';
import { QuickTastingNote, QuickTastingNoteSaved } from '../tasting/QuickTastingNote';
import { ImpressionControls, TastingExperienceField, impressionNoteText, updateImpressionNote } from '../tasting/YourImpression';
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
  let sharedNote = record?.sessionSharedNote;
  // Older quick tastings stored their shared note as a single plain string.
  if (sharedNote == null && Array.isArray(tasting.notes) && tasting.notes.length === 1 && typeof tasting.notes[0] === 'string') {
    sharedNote = tasting.notes[0];
    tasting = { ...tasting, notes: undefined };
  }
  const unsentNote = (draft?.sharedNote ?? draft?.impression)?.trim();
  const experience = impressionNoteText(tasting);
  if (unsentNote && unsentNote !== sharedNote?.trim() && unsentNote !== experience.trim()) {
    tasting = updateImpressionNote(tasting, [experience.trim(), unsentNote].filter(Boolean).join('\n\n'));
  }
  if (draft?.rating) tasting = { ...tasting, rating: draft.rating };
  return { tasting, sharedNote: sharedNote ?? '', isFavorite: draft?.isFavorite ?? record?.sessionFavorite ?? false };
}

function hasImpression({ tasting, sharedNote, isFavorite }: TastingDraft) {
  return tasting.rating != null || tasting.quality != null || tasting.impression != null ||
    tasting.wantToPurchase === true || tasting.inCollection != null ||
    Boolean(impressionNoteText(tasting).trim() || sharedNote.trim()) || isFavorite;
}

const TastingNotesForm = ({ teaMenu, token, eventId, eventSlug, eventTitle, onClose }: TastingNotesFormProps) => {
  const sortedMenu = [...teaMenu].sort((a, b) => (a.brewOrder ?? 0) - (b.brewOrder ?? 0));
  const legacyDraftKey = `tasting-draft-${token}-no-event`;
  const draftKey = eventId ? `tasting-draft-${token}-${eventId}` : legacyDraftKey;
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
  const [showDetails, setShowDetails] = useState(false);
  const [fullTasting, setFullTasting] = useState(false);
  const [quickSave, setQuickSave] = useState<{ entryId: string; productId: string } | null>(null);
  const [saveFailed, setSaveFailed] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [hasEdits, setHasEdits] = useState(false);

  useEffect(() => {
    if (submitted || quickSave || !hasEdits) return;
    try { localStorage.setItem(draftKey, JSON.stringify(draftOverrides)); } catch { /* local storage may be unavailable */ }
  }, [draftOverrides, submitted, quickSave, draftKey, hasEdits]);

  const currentItem = sortedMenu[currentStep];
  if (!currentItem) return null;

  const drafts = Object.fromEntries(sortedMenu.map(item => [item.id, restoreDraft(draftOverrides[item.id], savedRecord(item))]));
  const currentDraft = drafts[currentItem.id];
  const saveableTeas = sortedMenu.filter(item => hasImpression(drafts[item.id]) ||
    (draftOverrides[item.id] != null && savedRecord(item) != null));
  const productId = currentItem.productId || currentItem.id;
  const inCollection = !!currentItem.productId && (currentDraft.tasting.inCollection ?? favoriteTeas.includes(productId));
  const name = currentItem.customName || currentItem.productName || 'Unknown tea';
  const recordFor = (item: TeaMenuItem, draft: TastingDraft): TastingRecord => ({
    id: savedRecord(item)?.id ?? recordId(item),
    createdAt: savedRecord(item)?.createdAt ?? new Date().toISOString(),
    tasting: draft.tasting,
    sourceType: 'event',
    eventId: eventId ?? item.eventId,
    eventSlug,
    eventTitle,
    sessionFavorite: draft.isFavorite,
    sessionSharedNote: draft.sharedNote,
  });

  const updateDraft = (changes: Partial<TastingDraft>) => {
    setHasEdits(true);
    setDraftOverrides(previous => ({ ...previous, [currentItem.id]: { ...currentDraft, ...changes } }));
  };

  const saveToJournal = (item: TeaMenuItem, draft: TastingDraft) => {
    const { tasting, sharedNote } = draft;
    const collection = useAppStore.getState();
    if (item.productId && tasting.inCollection != null && collection.favoriteTeas.includes(item.productId) !== tasting.inCollection) {
      collection.toggleFavoriteTea(item.productId);
    }
    return upsertTasting(item.productId || item.id, item.customName || item.productName || 'Unknown tea',
      item.productType || '', item.productImageUrl || undefined, recordFor(item, draft), {
        personalNote: tastingNoteText(tasting).trim() || sharedNote.trim() || undefined,
        rating: tasting.quality ?? tasting.rating,
        verdict: tasting.impression,
        wouldBuy: tasting.wantToPurchase,
      }, activeAccountId ?? undefined);
  };

  const quickNote = impressionNoteText(currentDraft.tasting);
  const verdict = currentDraft.tasting.impression;
  const wouldBuy = currentDraft.tasting.wantToPurchase ?? false;
  const previous = restoreDraft(undefined, savedRecord(currentItem));
  const canSaveQuickNote = quickNote.trim() !== impressionNoteText(previous.tasting).trim();
  const updateExperienceNote = (text: string) => {
    setSaveFailed(false);
    updateDraft({ tasting: updateImpressionNote(currentDraft.tasting, text) });
  };
  const handleSaveForMe = () => {
    if (!canSaveQuickNote) return;
    setSaveFailed(false);
    try {
      const entryId = saveToJournal(currentItem, {
        ...previous,
        tasting: updateImpressionNote(currentDraft.tasting, quickNote.trim()),
      });
      const remainingDrafts = { ...draftOverrides };
      delete remainingDrafts[currentItem.id];
      setDraftOverrides(remainingDrafts);
      try {
        localStorage.setItem(draftKey, JSON.stringify(remainingDrafts));
        if (legacyDraftKey !== draftKey) localStorage.removeItem(legacyDraftKey);
      } catch { /* the journal write already succeeded */ }
      setQuickSave({ entryId, productId });
      void syncTastingJournal();
    } catch {
      setSaveFailed(true);
    }
  };

  const handleSave = () => {
    setSaveFailed(false);
    try {
      for (const item of saveableTeas) saveToJournal(item, drafts[item.id]);
      void syncTastingJournal();
      try {
        localStorage.removeItem(draftKey);
        localStorage.removeItem(legacyDraftKey);
      } catch { /* local storage may be unavailable */ }
      setDraftOverrides({});
      setHasEdits(false);
      setSubmitted(true);
    } catch {
      setSaveFailed(true);
    }
  };

  const sequence = {
    index: currentStep,
    count: sortedMenu.length,
    onSelect: (index: number) => {
      setCurrentStep(index);
      setQuickSave(null);
      setSubmitted(false);
      setSaveFailed(false);
    },
  };
  const teaNavigation = <TastingSequenceNav sequence={sequence} />;

  if (fullTasting) {
    return (
      <TastingSession
        key={currentItem.id}
        sequence={sequence}
        item={{
          id: productId,
          name,
          type: currentItem.productType || undefined,
          image: currentItem.productImageUrl || undefined,
          sourceType: 'event',
          eventTitle,
          journalRecord: recordFor(currentItem, currentDraft),
          collectionUnavailable: !currentItem.productId,
        }}
        startOnWheel
        onClose={() => setFullTasting(false)}
        onAfterSave={tasting => updateDraft({ tasting })}
      />
    );
  }

  if (quickSave) {
    const synced = browsingJournal.some(entry => entry.id === quickSave.entryId && entry.synced);
    return <>{teaNavigation}<QuickTastingNoteSaved name={name} synced={synced} onDone={onClose} journal={quickSave} /></>;
  }

  if (submitted) {
    return (
      <div className="text-center py-8">
        {teaNavigation}
        <h2 className={TYPOGRAPHY_CLASSES.h2}>Tasting saved</h2>
        <button type="button" onClick={onClose} className="btn-primary tap-target mt-5">Done</button>
      </div>
    );
  }

  return (
    <section className="tasting-impression tasting-session-quick" aria-label="Post-session tasting">
      {teaNavigation}
      <h2 className={TYPOGRAPHY_CLASSES.h2}>{name}</h2>
      {!showDetails ? (
        <QuickTastingNote note={quickNote} verdict={verdict} wouldBuy={wouldBuy}
          onChange={updateExperienceNote} onFullTasting={() => setShowDetails(true)} onSave={handleSaveForMe}
          canSave={canSaveQuickNote} saveFailed={saveFailed} />
      ) : (
        <>
          {currentItem.customDescription && <p className={TYPOGRAPHY_CLASSES.bodyLight}>{currentItem.customDescription}</p>}
          <fieldset className="min-w-0">
            <ImpressionControls value={currentDraft.tasting} ratingLabel="Overall"
              onChange={tasting => updateDraft({ tasting })}
              verdict={verdict ?? null}
              onVerdict={verdict => updateDraft({ tasting: { ...currentDraft.tasting, impression: verdict ?? undefined } })}
              wouldBuy={wouldBuy}
              onWouldBuy={wantToPurchase => updateDraft({ tasting: { ...currentDraft.tasting, wantToPurchase } })}
              inCollection={inCollection} collectionUnavailable={!currentItem.productId}
              onCollection={() => updateDraft({ tasting: { ...currentDraft.tasting, inCollection: !inCollection } })} />
            <TastingExperienceField verdict={verdict} wouldBuy={wouldBuy} value={quickNote} onChange={updateExperienceNote} />
          </fieldset>
          <div className="mt-[var(--space-3)] flex flex-wrap justify-between gap-[var(--space-2)]">
            <button type="button" className="btn-quiet" onClick={() => setShowDetails(false)}>Back to note</button>
            <button type="button" className="btn-secondary" onClick={() => setFullTasting(true)}>
              Taste wheel
            </button>
            <button type="button" className="btn-primary" onClick={handleSave}
              disabled={saveableTeas.length === 0}>
              Save tasting
            </button>
          </div>
          {saveFailed && <p role="alert" className={TYPOGRAPHY_CLASSES.bodyLight}>Could not save your tasting. Try again.</p>}
        </>
      )}
      <button type="button" onClick={onClose}
        className="btn-quiet mt-[var(--space-1)] w-full">Skip</button>
    </section>
  );
};

export default TastingNotesForm;

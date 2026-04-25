import React, { useState, useEffect } from 'react';
import { Send, Leaf, ChevronLeft, ChevronRight } from 'lucide-react';
import { TeaLeafIcon } from '../Icons';
import { useSubmitTastingNotes } from '../../hooks/useEventPolling';
import { useAppStore } from '../../lib/store';
import type { TeaMenuItem } from '../../types/events';
import type { CustomerTasting } from '../../types';

interface TastingNotesFormProps {
  teaMenu: TeaMenuItem[];
  token: string;
  className?: string;
  /** Event ID to cross-link tastings into the personal journal */
  eventId?: string;
  /** URL slug for the event — used for journal navigation */
  eventSlug?: string;
  /** Event title shown as context in the journal */
  eventTitle?: string;
  /** Called when the user dismisses the thank-you screen */
  onClose?: () => void;
}

interface NoteState {
  rating: number;
  impression: string;
  isFavorite: boolean;
}

const TastingNotesForm: React.FC<TastingNotesFormProps> = ({ teaMenu, token, className = '', eventId, eventSlug, eventTitle, onClose }) => {
  const sortedMenu = [...teaMenu].sort((a, b) => (a.brewOrder ?? 0) - (b.brewOrder ?? 0));
  const { addTasting } = useAppStore();

  const DRAFT_KEY = `tasting-draft-${token}-${eventId || 'no-event'}`;

  const [notes, setNotes] = useState<Record<string, NoteState>>(() => {
    // Hydrate from localStorage draft if available
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) return JSON.parse(raw) as Record<string, NoteState>;
    } catch { /* ignore */ }
    const initial: Record<string, NoteState> = {};
    sortedMenu.forEach((item) => {
      initial[item.id] = { rating: 0, impression: '', isFavorite: false };
    });
    return initial;
  });

  const [currentStep, setCurrentStep] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const submitMutation = useSubmitTastingNotes(token);

  // Persist draft to localStorage on every change
  useEffect(() => {
    if (submitted) return;
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify(notes)); } catch { /* ignore */ }
  }, [notes, submitted, DRAFT_KEY]);

  const currentItem = sortedMenu[currentStep];

  const updateNote = (itemId: string, field: keyof NoteState, value: NoteState[keyof NoteState]) => {
    setNotes((prev) => {
      const updated = { ...prev };

      if (field === 'isFavorite' && value === true) {
        // Only one favorite allowed
        Object.keys(updated).forEach((key) => {
          updated[key] = { ...updated[key], isFavorite: false };
        });
      }

      updated[itemId] = { ...updated[itemId], [field]: value };
      return updated;
    });
  };

  const handleSubmit = () => {
    const tastingNotes = sortedMenu
      .filter((item) => notes[item.id].rating > 0)
      .map((item) => ({
        teaMenuId: item.id,
        rating: notes[item.id].rating,
        impression: notes[item.id].impression || undefined,
        isFavorite: notes[item.id].isFavorite,
      }));

    if (tastingNotes.length === 0) return;

    submitMutation.mutate(tastingNotes, {
      onSuccess: () => {
        // Cross-link: also write each rated tea into the personal tasting journal
        if (eventId) {
          sortedMenu
            .filter((item) => notes[item.id].rating > 0)
            .forEach((item) => {
              const note = notes[item.id];
              const productId = item.productId || item.id;
              const recordId = crypto.randomUUID();
              const now = new Date().toISOString();
              const tastingPayload = {
                rating: note.rating,
                notes: note.impression ? [note.impression] : undefined,
              };
              const journalEntry: CustomerTasting = {
                id: crypto.randomUUID(),
                productId,
                productName: item.customName || item.productName || 'Unknown Tea',
                productType: item.productType || '',
                productImage: item.productImageUrl || undefined,
                note: {
                  tasting: tastingPayload,
                  personalNote: note.impression || undefined,
                  rating: note.rating,
                  updatedAt: now,
                },
                tastings: [{
                  id: recordId,
                  createdAt: now,
                  tasting: tastingPayload,
                  sourceType: 'event',
                  eventId,
                  eventSlug,
                  eventTitle,
                }],
                createdAt: now,
              };
              addTasting(journalEntry);
            });
        }
        // Clear draft after successful submit
        try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
        setSubmitted(true);
      },
    });
  };

  const isLastStep = currentStep === sortedMenu.length - 1;
  const hasAnyRating = Object.values(notes).some((n) => n.rating > 0);
  const currentNote = notes[currentItem?.id] ?? { rating: 0, impression: '', isFavorite: false };

  if (submitted) {
    return (
      <div className={`text-center py-12 animate-[fadeIn_0.5s_ease-out] ${className}`}>
        <div className="w-14 h-14 rounded-full bg-tea-gold/10 flex items-center justify-center mx-auto mb-4">
          <TeaLeafIcon className="w-7 h-7 text-tea-gold" filled />
        </div>
        <h3 className="text-xl text-tea-text mb-2" style={{ fontFamily: 'var(--font-display)' }}>Thank You</h3>
        <p className="text-sm text-tea-text-sec max-w-xs mx-auto mb-8">
          Your impressions have been shared. They help us curate even better sessions.
        </p>
        {onClose && (
          <button
            onClick={onClose}
            className="px-8 py-3 bg-tea-gold text-white text-xs uppercase tracking-[0.2em] font-semibold hover:bg-tea-gold/90 transition-colors"
          >
            Done
          </button>
        )}
      </div>
    );
  }

  if (!currentItem) return null;

  return (
    <div className={`${className}`}>
      <h3 className="text-xl text-tea-text mb-2" style={{ fontFamily: 'var(--font-display)' }}>Share Your Impressions</h3>
      <p className="text-xs text-tea-text-sec uppercase tracking-[0.2em] mb-6" style={{ fontFamily: 'var(--font-body)' }}>
        Rate the teas you tasted today
      </p>

      {/* Step progress */}
      <div className="flex items-center gap-2 mb-6">
        <div className="flex gap-1.5">
          {sortedMenu.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setCurrentStep(i)}
              className={`transition-all duration-200 rounded-full ${
                i === currentStep
                  ? 'w-5 h-2 bg-tea-gold'
                  : notes[sortedMenu[i].id]?.rating > 0
                    ? 'w-2 h-2 bg-tea-gold/40'
                    : 'w-2 h-2 bg-tea-border'
              }`}
              aria-label={`Go to tea ${i + 1}`}
            />
          ))}
        </div>
        <span className="text-[11px] text-tea-text-dim ml-1" style={{ fontFamily: 'var(--font-mono)' }}>
          {currentStep + 1} / {sortedMenu.length}
        </span>
      </div>

      {/* Current tea card */}
      <div className="p-5 bg-tea-surface border border-tea-border rounded-md mb-4">
        {/* Tea info */}
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-1">
            {currentItem.productType && (
              <span className="text-[10px] uppercase tracking-[0.2em] text-tea-gold">
                {currentItem.productType}
              </span>
            )}
          </div>
          <h4 className="text-base text-tea-text" style={{ fontFamily: 'var(--font-display)' }}>
            {currentItem.customName || currentItem.productName}
          </h4>
          {currentItem.customDescription && (
            <p className="text-xs text-tea-text-sec mt-1 line-clamp-2">{currentItem.customDescription}</p>
          )}
        </div>

        {/* Rating: 5 tea leaves */}
        <div className="mb-4">
          <p className="text-[10px] uppercase tracking-[0.2em] text-tea-text-sec mb-2" style={{ fontFamily: 'var(--font-display)' }}>
            Rating
          </p>
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map((level) => (
              <button
                key={level}
                type="button"
                onClick={() => updateNote(currentItem.id, 'rating', currentNote.rating === level ? 0 : level)}
                className="flex-1 min-h-[44px] flex items-center justify-center transition-all duration-200 hover:scale-110"
                aria-label={`Rate ${level} out of 5`}
              >
                <Leaf
                  size={26}
                  className={`transition-colors duration-200 ${
                    level <= currentNote.rating
                      ? 'text-tea-gold fill-tea-gold'
                      : 'text-tea-text-dim/20'
                  }`}
                />
              </button>
            ))}
          </div>
        </div>

        {/* Impression */}
        <div className="mb-3">
          <input
            type="text"
            value={currentNote.impression}
            onChange={(e) => updateNote(currentItem.id, 'impression', e.target.value)}
            placeholder="One-line impression..."
            className="w-full px-3 py-2.5 min-h-[44px] bg-tea-bg border border-tea-border rounded-sm text-tea-text text-sm placeholder:text-tea-text-dim/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus-visible:ring-offset-1 focus-visible:ring-offset-tea-bg focus:border-tea-gold/50 transition-colors"
            style={{ fontFamily: 'var(--font-body)' }}
          />
        </div>

        {/* Favorite toggle */}
        <button
          type="button"
          onClick={() => updateNote(currentItem.id, 'isFavorite', !currentNote.isFavorite)}
          className={`inline-flex items-center gap-2 min-h-[44px] px-3 py-1.5 rounded-full text-xs transition-all duration-200 ${
            currentNote.isFavorite
              ? 'bg-tea-gold/15 text-tea-gold'
              : 'bg-tea-elevated/50 text-tea-text-sec hover:bg-tea-elevated'
          }`}
        >
          <Leaf size={14} className={currentNote.isFavorite ? 'fill-tea-gold' : ''} />
          This was my favorite
        </button>
      </div>

      {/* Navigation */}
      <div className="flex gap-3">
        {currentStep > 0 && (
          <button
            type="button"
            onClick={() => setCurrentStep(s => s - 1)}
            className="flex items-center gap-1.5 px-4 py-3 border border-tea-border rounded-sm text-sm text-tea-text-sec hover:text-tea-text transition-colors"
          >
            <ChevronLeft size={16} />
            Back
          </button>
        )}

        {!isLastStep ? (
          <button
            type="button"
            onClick={() => setCurrentStep(s => s + 1)}
            className="flex-1 flex items-center justify-center gap-1.5 py-3 bg-tea-surface border border-tea-border rounded-sm text-sm text-tea-text hover:bg-tea-elevated transition-colors"
          >
            Next tea
            <ChevronRight size={16} />
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={!hasAnyRating || submitMutation.isPending}
            className="flex-1 py-3 bg-tea-gold text-white text-xs uppercase tracking-[0.25em] font-semibold rounded-sm hover:bg-tea-gold/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 flex items-center justify-center gap-2"
          >
            {submitMutation.isPending ? (
              <span className="inline-block w-4 h-4 border-2 border-tea-border border-t-tea-gold rounded-full animate-spin" />
            ) : (
              <>
                <Send className="w-4 h-4" />
                Share My Impressions
              </>
            )}
          </button>
        )}
      </div>

      {submitMutation.isError && (
        <p className="text-sm text-red-400 text-center mt-3">
          {submitMutation.error?.message || 'Failed to submit. Please try again.'}
        </p>
      )}
    </div>
  );
};

export default TastingNotesForm;

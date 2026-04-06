import React, { useState } from 'react';
import { Send, Leaf } from 'lucide-react';
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

const TastingNotesForm: React.FC<TastingNotesFormProps> = ({ teaMenu, token, className = '', eventId, eventTitle, onClose }) => {
  const sortedMenu = [...teaMenu].sort((a, b) => (a.brewOrder ?? 0) - (b.brewOrder ?? 0));
  const { addTasting } = useAppStore();

  const [notes, setNotes] = useState<Record<string, NoteState>>(() => {
    const initial: Record<string, NoteState> = {};
    sortedMenu.forEach((item) => {
      initial[item.id] = { rating: 0, impression: '', isFavorite: false };
    });
    return initial;
  });

  const [submitted, setSubmitted] = useState(false);
  const submitMutation = useSubmitTastingNotes(token);

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
              const journalEntry: CustomerTasting = {
                id: crypto.randomUUID(),
                teaId: item.productId || item.id,
                teaName: item.customName || item.productName || 'Unknown Tea',
                teaType: item.productType || '',
                teaImage: item.productImageUrl || undefined,
                tasting: {
                  rating: note.rating,
                  overallImpression: note.impression || undefined,
                },
                personalNote: note.impression || undefined,
                rating: note.rating,
                createdAt: new Date().toISOString(),
                eventId,
                eventTitle,
              };
              addTasting(journalEntry);
            });
        }
        setSubmitted(true);
      },
    });
  };

  const hasAnyRating = Object.values(notes).some((n) => n.rating > 0);

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

  return (
    <div className={`${className}`}>
      <h3 className="text-xl text-tea-text mb-2" style={{ fontFamily: 'var(--font-display)' }}>Share Your Impressions</h3>
      <p className="text-xs text-tea-text-sec uppercase tracking-[0.2em] mb-6" style={{ fontFamily: 'var(--font-body)' }}>
        Rate the teas you tasted today
      </p>

      <div className="space-y-6">
        {sortedMenu.map((item) => {
          const note = notes[item.id];

          return (
            <div
              key={item.id}
              className="p-5 bg-tea-surface border border-tea-border rounded-md"
            >
              {/* Tea info */}
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-1">
                  {item.productType && (
                    <span className="text-[10px] uppercase tracking-[0.2em] text-tea-gold">
                      {item.productType}
                    </span>
                  )}
                </div>
                <h4 className="text-base text-tea-text" style={{ fontFamily: 'var(--font-display)' }}>{item.customName || item.productName}</h4>
                {item.customDescription && (
                  <p className="text-xs text-tea-text-sec mt-1 line-clamp-2">{item.customDescription}</p>
                )}
              </div>

              {/* Rating: tea leaves */}
              <div className="mb-4">
                <p className="text-[10px] uppercase tracking-[0.2em] text-tea-text-sec mb-2" style={{ fontFamily: 'var(--font-display)' }}>
                  Rating
                </p>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((level) => (
                    <button
                      key={level}
                      type="button"
                      onClick={() => updateNote(item.id, 'rating', note.rating === level ? 0 : level)}
                      className="min-h-[44px] min-w-[44px] flex items-center justify-center transition-all duration-200 hover:scale-110"
                      aria-label={`Rate ${level} out of 10`}
                    >
                      <Leaf
                        size={22}
                        className={`transition-colors duration-200 ${
                          level <= note.rating
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
                  value={note.impression}
                  onChange={(e) => updateNote(item.id, 'impression', e.target.value)}
                  placeholder="One-line impression..."
                  className="w-full px-3 py-2.5 min-h-[44px] bg-tea-bg border border-tea-border rounded-sm text-tea-text text-sm placeholder:text-tea-text-dim/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus-visible:ring-offset-1 focus-visible:ring-offset-tea-bg focus:border-tea-gold/50 transition-colors"
                  style={{ fontFamily: 'var(--font-body)' }}
                />
              </div>

              {/* Favorite toggle */}
              <button
                type="button"
                onClick={() => updateNote(item.id, 'isFavorite', !note.isFavorite)}
                className={`inline-flex items-center gap-2 min-h-[44px] px-3 py-1.5 rounded-full text-xs transition-all duration-200 ${
                  note.isFavorite
                    ? 'bg-tea-gold/15 text-tea-gold'
                    : 'bg-tea-elevated/50 text-tea-text-sec hover:bg-tea-elevated'
                }`}
              >
                <Leaf size={14} className={note.isFavorite ? 'fill-tea-gold' : ''} />
                This was my favorite
              </button>
            </div>
          );
        })}
      </div>

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={!hasAnyRating || submitMutation.isPending}
        className="w-full mt-6 py-4 bg-tea-gold text-white text-xs uppercase tracking-[0.25em] font-semibold rounded-sm hover:bg-tea-gold/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 flex items-center justify-center gap-2"
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

      {submitMutation.isError && (
        <p className="text-sm text-red-400 text-center mt-3">
          {submitMutation.error?.message || 'Failed to submit. Please try again.'}
        </p>
      )}
    </div>
  );
};

export default TastingNotesForm;

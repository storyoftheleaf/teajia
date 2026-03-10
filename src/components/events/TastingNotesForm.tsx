import React, { useState } from 'react';
import { Send } from 'lucide-react';
import { TeaLeafIcon } from '../Icons';
import { useSubmitTastingNotes } from '../../hooks/useEventPolling';
import type { TeaMenuItem } from '../../types/events';

interface TastingNotesFormProps {
  teaMenu: TeaMenuItem[];
  token: string;
  className?: string;
}

interface NoteState {
  rating: number;
  impression: string;
  isFavorite: boolean;
}

const TastingNotesForm: React.FC<TastingNotesFormProps> = ({ teaMenu, token, className = '' }) => {
  const sortedMenu = [...teaMenu].sort((a, b) => (a.brewOrder ?? 0) - (b.brewOrder ?? 0));

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
      onSuccess: () => setSubmitted(true),
    });
  };

  const hasAnyRating = Object.values(notes).some((n) => n.rating > 0);

  if (submitted) {
    return (
      <div className={`text-center py-12 animate-[fadeIn_0.5s_ease-out] ${className}`}>
        <div className="w-14 h-14 rounded-full bg-tea-gold/10 flex items-center justify-center mx-auto mb-4">
          <TeaLeafIcon className="w-7 h-7 text-tea-gold" filled />
        </div>
        <h3 className="font-serif text-xl text-tea-text mb-2">Thank You</h3>
        <p className="text-sm text-tea-text-sec max-w-xs mx-auto">
          Your impressions have been shared. They help us curate even better sessions.
        </p>
      </div>
    );
  }

  return (
    <div className={`${className}`}>
      <h3 className="font-serif text-xl text-tea-text mb-2">Share Your Impressions</h3>
      <p className="text-xs text-tea-text-dim uppercase tracking-[0.2em] mb-6">
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
                <h4 className="font-serif text-base text-tea-text">{item.customName || item.productName}</h4>
                {item.customDescription && (
                  <p className="text-xs text-tea-text-dim mt-1 line-clamp-2">{item.customDescription}</p>
                )}
              </div>

              {/* Rating: tea leaves */}
              <div className="mb-4">
                <p className="text-[10px] uppercase tracking-[0.2em] text-tea-text-dim mb-2">
                  Rating
                </p>
                <div className="flex gap-1.5">
                  {[1, 2, 3, 4, 5].map((level) => (
                    <button
                      key={level}
                      type="button"
                      onClick={() => updateNote(item.id, 'rating', note.rating === level ? 0 : level)}
                      className="p-1 transition-all duration-200 hover:scale-110"
                      aria-label={`Rate ${level} out of 5`}
                    >
                      <TeaLeafIcon
                        className={`w-6 h-6 transition-colors duration-200 ${
                          level <= note.rating
                            ? 'text-tea-gold'
                            : 'text-tea-text-dim/20 hover:text-tea-text-dim/40'
                        }`}
                        filled={level <= note.rating}
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
                  className="w-full px-3 py-2.5 bg-tea-bg border border-tea-border rounded-sm text-tea-text text-sm placeholder:text-tea-text-dim/40 focus:outline-none focus:border-tea-gold/50 transition-colors"
                />
              </div>

              {/* Favorite toggle */}
              <button
                type="button"
                onClick={() => updateNote(item.id, 'isFavorite', !note.isFavorite)}
                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-sm text-xs transition-all duration-200 border ${
                  note.isFavorite
                    ? 'bg-tea-gold/10 border-tea-gold/40 text-tea-gold'
                    : 'bg-transparent border-tea-border text-tea-text-dim hover:border-tea-gold/20 hover:text-tea-text-sec'
                }`}
              >
                <TeaLeafIcon className="w-3.5 h-3.5" filled={note.isFavorite} />
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
          <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
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

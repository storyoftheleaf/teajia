import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Leaf, Flame, Sparkles, Waves } from 'lucide-react';
import type { TastingData } from '../../types';

/**
 * Extended TastingData with impression fields.
 * These fields will be added to the base TastingData type in a future update.
 * For now, ImpressionZone works with the extended shape.
 */
interface ImpressionTastingData extends TastingData {
  rating?: number;
  overallImpression?: string;
}

interface ImpressionZoneProps {
  value: ImpressionTastingData;
  onChange: (data: ImpressionTastingData) => void;
}

const MOOD_OPTIONS = [
  { id: 'Delicate', icon: Leaf, description: 'Light and subtle' },
  { id: 'Bold', icon: Flame, description: 'Strong and intense' },
  { id: 'Complex', icon: Sparkles, description: 'Layered and nuanced' },
  { id: 'Smooth', icon: Waves, description: 'Even and rounded' },
] as const;

const MAX_RATING = 5;

export const ImpressionZone: React.FC<ImpressionZoneProps> = ({ value, onChange }) => {
  // Parse current mood selections from comma-joined string
  const selectedMoods = useMemo(() => {
    if (!value.overallImpression) return new Set<string>();
    return new Set(
      value.overallImpression.split(',').map(s => s.trim()).filter(Boolean)
    );
  }, [value.overallImpression]);

  const currentRating = value.rating ?? 0;

  const hasAnySelection = selectedMoods.size > 0 || currentRating > 0;

  const toggleMood = (moodId: string) => {
    const next = new Set(selectedMoods);
    if (next.has(moodId)) {
      next.delete(moodId);
    } else {
      next.add(moodId);
    }
    const impressionStr = Array.from(next).join(', ') || undefined;
    onChange({ ...value, overallImpression: impressionStr });
  };

  const setRating = (r: number) => {
    // Tap same rating to deselect
    const nextRating = r === currentRating ? undefined : r;
    onChange({ ...value, rating: nextRating });
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Section header */}
      <div>
        <h3
          className="text-[13px] uppercase tracking-[0.12em] text-tea-text font-medium"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          First Impression
        </h3>
        <p
          className="text-[11px] text-tea-text-dim mt-0.5"
          style={{ fontFamily: 'var(--font-body)' }}
        >
          Your gut feeling before diving into details
        </p>
      </div>

      {/* Empty state prompt */}
      <AnimatePresence>
        {!hasAnySelection && (
          <motion.p
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="text-[12px] text-tea-text-sec italic text-center py-2"
            style={{ fontFamily: 'var(--font-body)' }}
          >
            How does this tea strike you?
          </motion.p>
        )}
      </AnimatePresence>

      {/* Mood cards — 2x2 grid */}
      <div className="grid grid-cols-2 gap-2">
        {MOOD_OPTIONS.map(({ id, icon: Icon }) => {
          const isSelected = selectedMoods.has(id);

          return (
            <motion.button
              key={id}
              type="button"
              whileTap={{ scale: 0.95 }}
              onClick={() => toggleMood(id)}
              className={`tag-selectable flex flex-col items-center gap-1.5 py-3 px-2 rounded-lg transition-all duration-150 ${
                isSelected ? 'tag-selectable-active' : ''
              }`}
              style={{ fontFamily: 'var(--font-body)' }}
            >
              <Icon size={20} strokeWidth={isSelected ? 2 : 1.5} />
              <span className="text-[12px]">{id}</span>
            </motion.button>
          );
        })}
      </div>

      {/* Tea-leaf rating */}
      <div className="flex flex-col items-center gap-2 pt-1">
        <span
          className="text-[10px] uppercase tracking-[0.15em] text-tea-text-dim"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          Rating
        </span>
        <div className="flex gap-1.5" role="radiogroup" aria-label="Tea rating">
          {Array.from({ length: MAX_RATING }, (_, i) => {
            const leafIndex = i + 1;
            const isFilled = leafIndex <= currentRating;

            return (
              <motion.button
                key={leafIndex}
                type="button"
                whileTap={{ scale: 0.85 }}
                whileHover={{ scale: 1.1 }}
                onClick={() => setRating(leafIndex)}
                role="radio"
                aria-checked={leafIndex === currentRating}
                aria-label={`${leafIndex} of ${MAX_RATING} leaves`}
                className={`p-1 transition-colors duration-200 ${
                  isFilled
                    ? 'text-tea-gold'
                    : 'text-tea-text-dim/40 hover:text-tea-text-dim'
                }`}
              >
                <Leaf
                  size={22}
                  fill={isFilled ? 'currentColor' : 'none'}
                  strokeWidth={1.5}
                />
              </motion.button>
            );
          })}
        </div>
        {currentRating > 0 && (
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-[11px] text-tea-gold"
            style={{ fontFamily: 'var(--font-body)' }}
          >
            {currentRating} / {MAX_RATING}
          </motion.span>
        )}
      </div>
    </div>
  );
};

import React from 'react';
import { BottomSheet } from './CurateSheet';
import { useTeaCompassStore } from '../../lib/teaCompassStore';
import { FAST_TASTING, applyFast, readFast, type FastQuestion } from './curateV2Model';

interface FastTastingSheetProps {
  entryId: string | null;
  onOpenChange: (open: boolean) => void;
  /** Opens the full tasting for the same tea. */
  onFullTasting: (entryId: string) => void;
}

/**
 * The fast tasting: six questions, one tap per answer, saved as you tap.
 * Every answer is a word from the full tasting, so this is the first layer of
 * a full tasting rather than a second list beside it.
 */
export const FastTastingSheet: React.FC<FastTastingSheetProps> = ({ entryId, onOpenChange, onFullTasting }) => {
  const entry = useTeaCompassStore((s) => (entryId ? s.getEntry(entryId) : undefined));
  const updateEntry = useTeaCompassStore((s) => s.updateEntry);
  const answers = readFast(entry?.tasting);

  const tap = (q: FastQuestion, id: string) => {
    if (!entryId) return;
    const current = useTeaCompassStore.getState().getEntry(entryId);
    updateEntry(entryId, { tasting: applyFast(current?.tasting, q, id) });
  };

  return (
    <BottomSheet open={!!entryId} onOpenChange={onOpenChange} title={entry?.name || 'Fast tasting'} description="Fast tasting · saved as you tap" large>
      <div className="curate-v2 pb-nav-gap">
        <div className="border-b border-tea-border" />
        {FAST_TASTING.map((question) => {
          const chosen = answers[question.q];
          const cols = question.options.length === 10 ? 'grid-cols-5'
            : question.q === 'flavour' ? 'grid-cols-4'
            : question.options.length >= 8 ? 'grid-cols-4'
            : question.options.length === 4 ? 'grid-cols-4' : 'grid-cols-3';
          return (
            <div key={question.q} className="border-b border-tea-border px-4 py-2.5">
              <div className="mb-1.5 flex items-baseline justify-between">
                <span className="curate-v2-label">{question.label}</span>
                <span className="font-body text-ui-12 italic text-tea-text-dim">{question.from}</span>
              </div>
              <div className={`grid ${cols} gap-1`} role="group" aria-label={question.label}>
                {question.options.map((option) => {
                  const on = chosen.includes(option.id);
                  return (
                    <button
                      key={option.id}
                      type="button"
                      aria-pressed={on}
                      onClick={() => tap(question.q, option.id)}
                      className={`min-h-11 whitespace-nowrap rounded-[3px] border px-0 font-mono text-ui-13 transition-colors ${
                        on ? 'border-tea-gold text-tea-gold' : 'border-tea-border text-tea-text-sec hover:text-tea-text'
                      }`}
                    >
                      {option.label}
                    </button>
                  );
                })}
                {question.q === 'flavour' && entryId && (
                  <button type="button" onClick={() => onFullTasting(entryId)} className="min-h-11 whitespace-nowrap rounded-[3px] border border-tea-border font-mono text-ui-13 text-tea-gold hover:border-tea-gold">
                    More ›
                  </button>
                )}
              </div>
            </div>
          );
        })}
        <div className="flex items-baseline justify-between px-4 pt-3 text-ui-13">
          <span className="text-tea-text-sec">Saved as you tap</span>
          {entryId && (
            <button type="button" onClick={() => onFullTasting(entryId)} className="tap-target font-medium text-tea-gold">
              Full tasting ›
            </button>
          )}
        </div>
      </div>
    </BottomSheet>
  );
};

import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, ThumbsUp, Minus, ThumbsDown, X, BookmarkPlus, Check } from 'lucide-react';
import { getTeaColor } from '../../designTokens';
import { useTeaCompassStore } from '../../lib/teaCompassStore';
import { LIQUOR_COLORS } from '../../data/tastingTaxonomy';
import { resolveVerdict } from './types';
import type { TeaCompassEntry, CompassVerdict } from './types';

interface SessionReviewProps {
  /** The teas to sort through — typically "tasted but not yet given a verdict". */
  entries: TeaCompassEntry[];
  onClose: () => void;
}

// Verdict order for sorting keepers to the top; love → like → neutral → pass → unset.
const VERDICT_RANK: Record<CompassVerdict, number> = { love: 0, like: 1, neutral: 2, pass: 3 };

const VERDICT_OPTIONS: { value: CompassVerdict; label: string; icon: React.ReactNode; activeCls: string }[] = [
  { value: 'love',    label: 'Love',    icon: <Heart size={15} />,      activeCls: 'bg-tea-error/15 text-tea-error border-tea-error/40' },
  { value: 'like',    label: 'Like',    icon: <ThumbsUp size={15} />,   activeCls: 'bg-tea-gold/15 text-tea-gold border-tea-gold/40' },
  { value: 'neutral', label: 'Meh',     icon: <Minus size={15} />,      activeCls: 'bg-tea-elevated text-tea-text-sec border-tea-border' },
  { value: 'pass',    label: 'Pass',    icon: <ThumbsDown size={15} />, activeCls: 'bg-tea-elevated text-tea-text-dim border-tea-border' },
];

function scoreOf(e: TeaCompassEntry): number {
  return e.tasting?.quality ?? e.tasting?.rating ?? -1;
}

export const SessionReview: React.FC<SessionReviewProps> = ({ entries, onClose }) => {
  const updateEntry = useTeaCompassStore((s) => s.updateEntry);
  // Freeze the working set on open so rows don't vanish mid-triage as verdicts
  // are assigned — the user keeps full control until they close the screen.
  const [workingIds] = useState(() => entries.map((e) => e.id));
  const allEntries = useTeaCompassStore((s) => s.entries);

  const rows = useMemo(() => {
    const byId = new Map(allEntries.map((e) => [e.id, e]));
    const list = workingIds.map((id) => byId.get(id)).filter((e): e is TeaCompassEntry => !!e);
    // Highest score first, but pull anything already verdicted into its bucket.
    return [...list].sort((a, b) => {
      const va = a.verdict ? VERDICT_RANK[a.verdict] : 1.5;
      const vb = b.verdict ? VERDICT_RANK[b.verdict] : 1.5;
      if (va !== vb) return va - vb;
      return scoreOf(b) - scoreOf(a);
    });
  }, [allEntries, workingIds]);

  const setVerdict = (id: string, v: CompassVerdict) => {
    const current = allEntries.find((e) => e.id === id)?.verdict;
    updateEntry(id, { verdict: current === v ? undefined : v });
  };

  // Keepers = anything you loved or liked. The footer turns them into Want.
  const keepers = rows.filter((e) => e.verdict === 'love' || e.verdict === 'like');
  const keepersToAdd = keepers.filter((e) => e.status !== 'want' && e.status !== 'in_stock' && e.status !== 'incoming');
  const verdictedCount = rows.filter((e) => !!e.verdict).length;

  const addKeepersToWant = () => {
    keepersToAdd.forEach((e) => updateEntry(e.id, { status: 'want' }));
  };

  return createPortal(
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 40 }}
        transition={{ duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
        className="fixed inset-0 sidebar-inset z-modal bg-tea-bg flex flex-col"
        style={{
          paddingTop: 'env(safe-area-inset-top, 0px)',
        }}
      >
        {/* Header — close X on the left per panel rule, title + progress on the right */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-tea-border shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="tap-target -ml-1 text-tea-text-sec hover:text-tea-text transition-colors"
            aria-label="Close review"
          >
            <X size={20} strokeWidth={1.75} />
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-ui-13 font-serif text-tea-text leading-tight">Sort your tasting</p>
            <p className="text-ui-11 text-tea-text-dim leading-tight">
              {verdictedCount}/{rows.length} sorted · keepers become your want list
            </p>
          </div>
        </div>

        {/* Scrollable list — pb clears the sticky footer + bottom nav */}
        <div className="flex-1 min-h-0 overflow-y-auto px-3 pt-3 pb-nav-gap">
          <div className="space-y-2">
            <AnimatePresence initial={false}>
              {rows.map((entry) => {
                const typeColor = entry.type ? getTeaColor(entry.type) : null;
                const score = entry.tasting?.quality ?? entry.tasting?.rating;
                const inferred = resolveVerdict(entry);
                const flavors = (entry.tasting?.flavor || []).slice(0, 3);
                const photo = (entry.photos || []).filter(Boolean)[0];
                const liquorKey = entry.tasting?.['liquor-color']?.[0];
                const liquorHex = liquorKey ? LIQUOR_COLORS[liquorKey] : null;
                const passed = entry.verdict === 'pass';
                return (
                  <motion.div
                    key={entry.id}
                    layout
                    initial={{ opacity: 0 }}
                    animate={{ opacity: passed ? 0.5 : 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.18 }}
                    className="rounded-xl border border-tea-border bg-tea-surface overflow-hidden"
                  >
                    <div className="flex gap-3 px-3 pt-2.5 pb-2">
                      {photo ? (
                        <img src={photo} alt="" className="w-12 h-12 rounded-md object-cover shrink-0" />
                      ) : typeColor ? (
                        <div
                          className="w-12 h-12 rounded-md shrink-0 flex items-center justify-center text-ui-9 font-semibold uppercase tracking-[0.1em]"
                          style={{ background: `${typeColor}18`, color: typeColor }}
                        >
                          {(entry.type || 'TEA').slice(0, 3)}
                        </div>
                      ) : null}

                      <div className="flex-1 min-w-0 space-y-0.5">
                        <div className="flex items-baseline gap-2 min-w-0">
                          <span className={`min-w-0 truncate text-sm font-serif ${entry.name.trim() ? 'text-tea-text' : 'text-tea-text-dim italic'}`}>
                            {entry.name.trim() || 'Untitled'}
                          </span>
                          {liquorHex && (
                            <span
                              className="shrink-0 rounded-full self-center"
                              style={{ width: 8, height: 8, backgroundColor: liquorHex, display: 'inline-block' }}
                            />
                          )}
                        </div>
                        {entry.vendorName && (
                          <p className="text-ui-10 text-tea-text-dim truncate">{entry.vendorName}</p>
                        )}
                        <div className="flex items-center gap-2 flex-wrap">
                          {score != null && (
                            <span className="text-ui-11 font-semibold tabular-nums" style={typeColor ? { color: typeColor } : undefined}>
                              {score}/10
                            </span>
                          )}
                          {flavors.map((f) => (
                            <span key={f} className="tag text-ui-10">{f}</span>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Verdict row */}
                    <div className="flex items-center gap-1 px-2 pb-2">
                      {VERDICT_OPTIONS.map((opt) => {
                        const active = entry.verdict === opt.value;
                        // Show an unselected suggestion ring on the score-inferred verdict.
                        const suggested = !entry.verdict && inferred === opt.value;
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => setVerdict(entry.id, opt.value)}
                            className={`flex-1 min-h-[40px] inline-flex items-center justify-center gap-1.5 rounded-md border text-ui-11 font-medium transition-colors ${
                              active
                                ? opt.activeCls
                                : suggested
                                  ? 'border-tea-gold/25 bg-tea-gold/[0.04] text-tea-text-sec hover:text-tea-text'
                                  : 'border-tea-border bg-tea-bg text-tea-text-dim hover:text-tea-text-sec hover:bg-tea-elevated'
                            }`}
                            aria-pressed={active}
                          >
                            {opt.icon}
                            <span>{opt.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>

            {rows.length === 0 && (
              <div className="py-16 text-center space-y-1">
                <p className="text-ui-13 text-tea-text font-serif">Nothing to sort</p>
                <p className="text-ui-12 text-tea-text-dim">Tasted teas waiting for a verdict show up here.</p>
              </div>
            )}
          </div>
        </div>

        {/* Sticky footer — keepers → want. pb-nav-gap resets to pb-4 on desktop. */}
        {rows.length > 0 && (
          <div className="shrink-0 border-t border-tea-border bg-tea-bg px-4 pt-3 pb-nav-gap">
            <div className="flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-ui-12 text-tea-text-sec">
                  {keepers.length === 0
                    ? 'Mark the ones worth keeping'
                    : `${keepers.length} keeper${keepers.length !== 1 ? 's' : ''} · ${rows.length - keepers.length} set aside`}
                </p>
              </div>
              {keepersToAdd.length > 0 ? (
                <button
                  type="button"
                  onClick={addKeepersToWant}
                  className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2.5 rounded-md bg-tea-gold text-tea-bg text-ui-12 font-semibold hover:bg-tea-gold/90 transition-colors"
                >
                  <BookmarkPlus size={14} />
                  Want {keepersToAdd.length}
                </button>
              ) : keepers.length > 0 ? (
                <span className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2.5 rounded-md bg-tea-gold/10 text-tea-gold text-ui-12 font-semibold">
                  <Check size={14} />
                  On want list
                </span>
              ) : (
                <button
                  type="button"
                  onClick={onClose}
                  className="shrink-0 px-4 py-2.5 rounded-md border border-tea-border text-tea-text-sec text-ui-12 font-medium hover:text-tea-text hover:bg-tea-elevated transition-colors"
                >
                  Done
                </button>
              )}
            </div>
          </div>
        )}
      </motion.div>
    </AnimatePresence>,
    document.body
  );
};

export default SessionReview;

import { useCallback, useEffect, useRef } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import type { TastingData } from '../../types';
import { mount, type WheelHandle } from './approvedWheel/TeaWheel';
import { tastingWordFamily, tastingWordLabel, toggleWheelObservation, wheelNotes, type WheelSense } from './approvedWheel/observations';
import './approvedWheel/approved-wheel.css';

export { tastingWordLabel, tastingWordId, tastingWordFamily } from './approvedWheel/observations';
interface ApprovedTasteWheelProps {
  value: TastingData;
  onChange(value: TastingData): void;
  reveal?: { word: string; sense: WheelSense; stamp: number };
}

/** The approved wheel, controlled entirely by the existing tasting session. */
export function ApprovedTasteWheel({ value, onChange, reveal }: ApprovedTasteWheelProps) {
  const host = useRef<HTMLDivElement>(null);
  const wheel = useRef<WheelHandle | null>(null);
  const current = useRef({ value, onChange });
  current.current = { value, onChange };
  const reducedMotion = useReducedMotion();
  const tastes = [...new Set((value.flavor || []).map(tastingWordLabel))];
  const aromas = [...new Set((value.aroma || []).map(tastingWordLabel))];
  const hasBoth = tastes.length > 0 && aromas.length > 0;
  const previousBoth = useRef(hasBoth);
  const closing = previousBoth.current && !hasBoth;
  const transition = { duration: reducedMotion ? 0 : .44, ease: [.25, .1, .25, 1] as [number, number, number, number], delay: !reducedMotion && closing ? .14 : 0 };
  useEffect(() => { previousBoth.current = hasBoth; }, [hasBoth]);
  useEffect(() => {
    if (!host.current) return;
    wheel.current = mount(host.current, {
      notes: wheelNotes(current.current.value), splitSenses: true, study: 5, innerGlow: false, compactSummary: true,
      onToggleSense(word, _group, sense) {
        const next = toggleWheelObservation(current.current.value, word, sense);
        current.current = { ...current.current, value: next };
        wheel.current?.updateNotes(wheelNotes(next));
        current.current.onChange(next);
      },
    });
    return () => { wheel.current?.destroy(); wheel.current = null; };
  }, []);
  useEffect(() => { wheel.current?.updateNotes(wheelNotes(value)); }, [value]);
  const showWord = useCallback((input: string, sense: WheelSense) => {
    const word = tastingWordLabel(input);
    const family = tastingWordFamily(word);
    if (family) { wheel.current?.navigate(family); wheel.current?.locate(word, sense); }
    host.current?.scrollIntoView({ behavior: reducedMotion ? 'instant' : 'smooth', block: 'nearest' });
  }, [reducedMotion]);
  useEffect(() => { if (reveal) showWord(reveal.word, reveal.sense); }, [reveal, showWord]);

  return <div className="approved-taste-wheel study-phone" aria-label="Taste and aroma tasting">
    <section className="approved-wheel-journey" aria-label="Taste and aroma wheel"><div ref={host} /></section>
    <section className="category-observations" aria-label="Your complete tasting">
      <motion.div layout transition={transition} className={`study-observations ${hasBoth ? 'has-both' : 'single-sense'}`} aria-label="All selected tastes and aromas">
        <motion.span className="summary-divider" aria-hidden="true" initial={false} animate={{ opacity: hasBoth ? 1 : 0 }} transition={{ duration: reducedMotion ? 0 : .2, delay: !reducedMotion && hasBoth ? .44 : 0, ease: 'easeInOut' }} />
        <AnimatePresence initial={false} mode="popLayout">
          {(['taste', 'aroma'] as const).filter(sense => (sense === 'taste' ? tastes : aromas).length > 0).map(sense => <motion.div key={sense} className={`sense-column sense-${sense}`} layout transition={{ ...transition, opacity: { duration: reducedMotion ? 0 : .14, delay: 0, ease: 'easeInOut' } }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, pointerEvents: 'none' }}>
            <motion.span layout="position" transition={transition}>{sense === 'taste' ? 'Taste' : 'Aroma'}</motion.span>
            <motion.div layout transition={transition} className={`selected-words ${sense}`}>
              {(sense === 'taste' ? tastes : aromas).map(word => <motion.span layout="position" transition={transition} className="selected-word-item" key={word}>
                <button className="word-jump tap-target" type="button" onClick={() => showWord(word, sense)} aria-label={`Show ${word} ${sense === 'taste' ? 'Taste' : 'Aroma'} on wheel`}>{word}</button>
              </motion.span>)}
            </motion.div>
          </motion.div>)}
        </AnimatePresence>
      </motion.div>
    </section>
  </div>;
}

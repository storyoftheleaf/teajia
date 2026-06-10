import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft } from 'lucide-react';
import { TYPOGRAPHY_CLASSES } from '../../designTokens';
import { QUESTIONS } from './questions';
import { OptionCard } from './OptionCard';
import type { DiscoveryQuestion, TeaDiscoveryAnswers } from './types';

interface TeaDiscoveryFlowProps {
  /** Called with the full answer map when the final screen is confirmed. */
  onComplete: (answers: TeaDiscoveryAnswers) => void;
  /** Called when Back is pressed on the first screen (leave the flow). */
  onExit: () => void;
  /** Optional seed (e.g. retake from an existing profile). */
  initialAnswers?: TeaDiscoveryAnswers;
}

const variants = {
  enter: (dir: number) => ({ x: dir > 0 ? 40 : -40, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir > 0 ? -40 : 40, opacity: 0 }),
};

const transition = {
  x: { type: 'spring' as const, stiffness: 260, damping: 30, mass: 0.8 },
  opacity: { duration: 0.12 },
};

function isAnswered(q: DiscoveryQuestion, answers: TeaDiscoveryAnswers): boolean {
  const a = answers[q.id];
  return q.multiSelect ? Array.isArray(a) && a.length > 0 : a != null;
}

export const TeaDiscoveryFlow: React.FC<TeaDiscoveryFlowProps> = ({
  onComplete,
  onExit,
  initialAnswers,
}) => {
  const [stepIndex, setStepIndex] = useState(0);
  const [direction, setDirection] = useState(1);
  const [answers, setAnswers] = useState<TeaDiscoveryAnswers>(initialAnswers ?? {});
  const advanceTimer = useRef<number | null>(null);

  useEffect(() => () => {
    if (advanceTimer.current) window.clearTimeout(advanceTimer.current);
  }, []);

  const q = QUESTIONS[stepIndex];
  const isLast = stepIndex === QUESTIONS.length - 1;
  const answered = isAnswered(q, answers);
  // Single-select, non-final screens advance on tap (Typeform-style); multi-select
  // and the final screen use an explicit Continue button.
  const showContinue = q.multiSelect || isLast;

  const goNext = () => {
    if (advanceTimer.current) window.clearTimeout(advanceTimer.current);
    setDirection(1);
    setStepIndex((i) => Math.min(i + 1, QUESTIONS.length - 1));
  };

  const goBack = () => {
    if (advanceTimer.current) window.clearTimeout(advanceTimer.current);
    if (stepIndex === 0) {
      onExit();
      return;
    }
    setDirection(-1);
    setStepIndex((i) => i - 1);
  };

  const handleSelect = (optId: string) => {
    if (q.multiSelect) {
      setAnswers((prev) => {
        const cur = Array.isArray(prev[q.id]) ? [...(prev[q.id] as string[])] : [];
        const idx = cur.indexOf(optId);
        if (idx >= 0) cur.splice(idx, 1);
        else cur.push(optId);
        return { ...prev, [q.id]: cur };
      });
      return;
    }
    setAnswers((prev) => ({ ...prev, [q.id]: optId }));
    if (!isLast) {
      advanceTimer.current = window.setTimeout(goNext, 240);
    }
  };

  const isOptionSelected = (optId: string): boolean => {
    const a = answers[q.id];
    return Array.isArray(a) ? a.includes(optId) : a === optId;
  };

  const handleContinue = () => {
    if (isLast) onComplete(answers);
    else goNext();
  };

  const progress = ((stepIndex + 1) / QUESTIONS.length) * 100;

  return (
    <div className="mx-auto flex min-h-[72vh] w-full max-w-xl flex-col">
      {/* Top bar — Back (left) + step counter */}
      <div className="flex items-center justify-between pt-2 pb-4">
        <button
          type="button"
          onClick={goBack}
          className="tap-target inline-flex items-center gap-1 font-sans text-ui-13 text-tea-text-sec transition-colors hover:text-tea-text"
        >
          <ChevronLeft className="h-4 w-4" />
          Back
        </button>
        <span className="font-sans text-ui-12 tracking-[0.08em] text-tea-text-sec">
          {stepIndex + 1} / {QUESTIONS.length}
        </span>
      </div>

      {/* Progress */}
      <div className="mb-7 h-1 w-full overflow-hidden rounded-full bg-tea-border">
        <div
          className="h-full rounded-full bg-tea-gold transition-all duration-300 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Question */}
      <div className="relative flex-1">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={q.id}
            custom={direction}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={transition}
          >
            <h2 className={`${TYPOGRAPHY_CLASSES.h2} text-tea-text`}>{q.prompt}</h2>
            {q.helper && (
              <p className="mt-2 font-body text-ui-14 italic leading-relaxed text-tea-text-sec">
                {q.helper}
              </p>
            )}

            <div className="mt-6 flex flex-col gap-2.5">
              {q.options.map((opt) => (
                <OptionCard
                  key={opt.id}
                  option={opt}
                  display={q.display}
                  selected={isOptionSelected(opt.id)}
                  onSelect={() => handleSelect(opt.id)}
                />
              ))}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Continue (multi-select + final screen only) */}
      {showContinue && (
        <div className="mt-8 pt-2">
          <button
            type="button"
            onClick={handleContinue}
            disabled={!answered}
            className="w-full rounded-xl bg-tea-gold py-3 font-sans text-ui-15 font-medium text-tea-bg transition-all hover:bg-tea-gold/90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isLast ? 'See my profile' : 'Continue'}
          </button>
        </div>
      )}
    </div>
  );
};

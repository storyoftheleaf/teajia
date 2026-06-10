import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, ArrowLeft, X, CheckCircle, Warning, Eye, CaretUp, CaretDown } from '@phosphor-icons/react';
import { useWalkthrough, type StepVerdict } from '../../lib/walkthroughStore';

/**
 * WalkthroughDock — the "walk with me" companion. Mounted at the app root so it
 * survives navigation: when the owner starts a walk-through and clicks "try it"
 * to a real admin page, this dock stays pinned at the bottom, showing the
 * current step, a button to go to it, and three verdict buttons (works / broken
 * / looks wrong) plus a one-line note. So the owner runs the actual flow and
 * logs what breaks at the exact step, without losing their place.
 *
 * Renders nothing unless a walk-through is active. Owner-only by construction —
 * it's only ever started from the owner-gated guide.
 */

const VERDICTS: { v: StepVerdict; label: string; icon: React.ReactNode; cls: string }[] = [
  { v: 'ok', label: 'Works', icon: <CheckCircle className="w-4 h-4" weight="fill" />, cls: 'text-tea-gold-lt' },
  { v: 'looks_wrong', label: 'Looks off', icon: <Eye className="w-4 h-4" weight="regular" />, cls: 'text-tea-text-sec' },
  { v: 'broken', label: 'Broken', icon: <Warning className="w-4 h-4" weight="fill" />, cls: 'text-tea-gold' },
];

export const WalkthroughDock: React.FC = () => {
  const navigate = useNavigate();
  const { activeId, activeTitle, steps, current, log, collapsed, stop, setCurrent, setVerdict, setNote, setCollapsed } = useWalkthrough();

  if (!activeId || steps.length === 0) return null;

  const step = steps[current];
  const entry = log[current] ?? { verdict: 'unset' as StepVerdict, note: '' };
  const problemCount = Object.values(log).filter((e) => e.verdict === 'broken' || e.verdict === 'looks_wrong').length;
  const atFirst = current === 0;
  const atLast = current === steps.length - 1;

  // Collapsed pill — out of the way but one tap to reopen.
  if (collapsed) {
    return (
      <div className="fixed left-1/2 -translate-x-1/2 bottom-nav-gap lg:bottom-6 z-toast">
        <button
          onClick={() => setCollapsed(false)}
          className="flex items-center gap-2 bg-tea-elevated border border-tea-gold/40 rounded-full pl-4 pr-3 py-2 shadow-2xl tap-target"
        >
          <span className="font-sans text-ui-12 text-tea-text">{activeTitle}</span>
          <span className="font-sans text-ui-11 text-tea-text-dim">{current + 1}/{steps.length}</span>
          {problemCount > 0 && <span className="font-sans text-ui-10 text-tea-gold">{problemCount} flagged</span>}
          <CaretUp className="w-3.5 h-3.5 text-tea-text-sec" weight="bold" />
        </button>
      </div>
    );
  }

  return (
    <div className="fixed left-1/2 -translate-x-1/2 bottom-nav-gap lg:bottom-6 z-toast w-[min(560px,calc(100vw-24px))]">
      <div className="bg-tea-elevated border border-tea-gold/40 rounded-xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-tea-border">
          <span className="font-display text-ui-15 text-tea-text tracking-[0.01em] flex-1 min-w-0 truncate">{activeTitle}</span>
          <span className="font-sans text-ui-11 text-tea-text-dim shrink-0">Step {current + 1} of {steps.length}</span>
          {problemCount > 0 && <span className="font-sans text-ui-11 text-tea-gold shrink-0">{problemCount} flagged</span>}
          <button onClick={() => setCollapsed(true)} className="shrink-0 text-tea-text-sec hover:text-tea-text tap-target" aria-label="Collapse"><CaretDown className="w-4 h-4" weight="bold" /></button>
          <button onClick={stop} className="shrink-0 text-tea-text-sec hover:text-tea-text tap-target" aria-label="End walk-through"><X className="w-4 h-4" weight="bold" /></button>
        </div>

        {/* Current step */}
        <div className="px-4 py-3">
          <p className="font-serif text-ui-15 text-tea-text leading-[1.55]">{step.text}</p>

          <div className="flex items-center gap-2 mt-3 flex-wrap">
            {step.to && (
              <button onClick={() => navigate(step.to!)} className="inline-flex items-center gap-1.5 font-sans text-ui-13 font-medium text-tea-bg bg-tea-gold rounded-full px-3.5 py-1.5 hover:bg-tea-gold-lt tap-target">
                {step.goLabel || 'Go there'} <ArrowRight className="w-3.5 h-3.5" weight="bold" />
              </button>
            )}
            {/* Verdict buttons */}
            <div className="inline-flex rounded-full bg-tea-surface p-0.5 gap-0.5">
              {VERDICTS.map((vd) => {
                const on = entry.verdict === vd.v;
                return (
                  <button
                    key={vd.v}
                    onClick={() => setVerdict(current, on ? 'unset' : vd.v)}
                    className={`inline-flex items-center gap-1 font-sans text-ui-12 px-2.5 py-1 rounded-full transition-colors tap-target ${on ? `bg-tea-gold/15 ${vd.cls}` : 'text-tea-text-dim hover:text-tea-text-sec'}`}
                  >
                    {vd.icon} {vd.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Note — always available so a problem can be written and saved on any
              step without first picking a verdict. Saves to D1 as you type (debounced),
              so a note logged on step 1 of 3 is recorded server-side immediately. */}
          <div className="mt-2.5">
            <input
              value={entry.note}
              onChange={(e) => setNote(current, e.target.value)}
              placeholder="Note a problem here — it saves as you type"
              className="w-full bg-tea-surface rounded-xl px-3 py-2 font-serif text-ui-14 text-tea-text placeholder:text-tea-text-dim border border-transparent focus:border-tea-gold/30 focus:outline-none"
            />
            {entry.note.trim() !== '' && (
              <p className="font-sans text-ui-11 text-tea-text-dim mt-1.5 px-1">
                Saved to this step. Flagged problems land in your todo list when you finish.
              </p>
            )}
          </div>
        </div>

        {/* Step nav */}
        <div className="flex items-center justify-between px-4 py-2.5 border-t border-tea-border">
          <button
            onClick={() => setCurrent(Math.max(0, current - 1))}
            disabled={atFirst}
            className={`inline-flex items-center gap-1 font-sans text-ui-13 tap-target ${atFirst ? 'text-tea-text-dim/40' : 'text-tea-text-sec hover:text-tea-text'}`}
          >
            <ArrowLeft className="w-3.5 h-3.5" weight="bold" /> Back
          </button>
          {/* Step dots */}
          <div className="flex items-center gap-1.5">
            {steps.map((_s, i) => {
              const e = log[i];
              const color = e?.verdict === 'broken' ? 'bg-tea-gold'
                : e?.verdict === 'looks_wrong' ? 'bg-tea-gold/50'
                : e?.verdict === 'ok' ? 'bg-tea-gold-lt'
                : i === current ? 'bg-tea-text-sec' : 'bg-tea-text-dim/40';
              return <button key={i} onClick={() => setCurrent(i)} className={`w-1.5 h-1.5 rounded-full ${color}`} aria-label={`Step ${i + 1}`} />;
            })}
          </div>
          {atLast ? (
            <button onClick={stop} className="font-sans text-ui-13 font-medium text-tea-gold-lt hover:text-tea-gold tap-target">Finish</button>
          ) : (
            <button onClick={() => setCurrent(Math.min(steps.length - 1, current + 1))} className="inline-flex items-center gap-1 font-sans text-ui-13 text-tea-gold-lt hover:text-tea-gold tap-target">
              Next <ArrowRight className="w-3.5 h-3.5" weight="bold" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default WalkthroughDock;

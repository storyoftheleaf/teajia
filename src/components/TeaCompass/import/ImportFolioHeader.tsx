import React from 'react';
import { X } from 'lucide-react';
import { TYPOGRAPHY_CLASSES } from '../../../designTokens';
import type { ImportFolioPhase, ImportFolioPhaseContext } from './importFolioPresentation';

interface ImportFolioHeaderProps {
  phase: ImportFolioPhase;
  context: ImportFolioPhaseContext;
  busy: boolean;
  closeRef: React.RefObject<HTMLButtonElement | null>;
  onClose: () => void;
}

const phases: Array<{ id: ImportFolioPhase; label: string }> = [
  { id: 'evidence', label: 'Evidence' },
  { id: 'review', label: 'Review' },
  { id: 'added', label: 'Added' },
];

export const ImportFolioHeader: React.FC<ImportFolioHeaderProps> = ({ phase, context, busy, closeRef, onClose }) => (
  <header className="shrink-0 border-b border-tea-border px-4 pb-0 pt-3 sm:px-6 sm:pt-4">
    <div className="grid min-h-11 grid-cols-[1fr_auto_1fr] items-center gap-3">
      <button
        ref={closeRef}
        type="button"
        disabled={busy}
        onClick={onClose}
        aria-label="Close Import"
        className="tap-target flex h-8 w-8 items-center justify-center text-tea-text-sec hover:text-tea-text disabled:opacity-50"
      >
        <X size={18} />
      </button>
      <h2 id="curate-import-title" className={`${TYPOGRAPHY_CLASSES.h2} text-center text-tea-text`}>
        Import<span className="sr-only"> into Curate</span>
      </h2>
      <p className="justify-self-end text-right text-ui-11 text-tea-text-sec">{context.status}</p>
    </div>

    <p className={`${TYPOGRAPHY_CLASSES.h3} mx-auto mt-1 max-w-3xl text-center text-tea-text`}>{context.title}</p>

    <nav
      aria-label="Import progress"
      data-current-phase={phase}
      className="mx-auto mt-3 flex max-w-sm items-end justify-center gap-7 sm:gap-10"
    >
      {phases.map(item => {
        const current = item.id === phase;
        return (
          <span
            key={item.id}
            aria-current={current ? 'step' : undefined}
            className={`${TYPOGRAPHY_CLASSES.label} border-b pb-2 ${current ? 'border-tea-gold text-tea-text' : 'border-transparent text-tea-text-dim'}`}
          >
            {item.label}
          </span>
        );
      })}
    </nav>
  </header>
);

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

export const ImportFolioHeader: React.FC<ImportFolioHeaderProps> = ({ phase, context, busy, closeRef, onClose }) => (
  <header data-current-phase={phase} className="sticky top-0 z-10 grid h-16 max-h-16 shrink-0 grid-cols-[minmax(44px,1fr)_minmax(0,auto)_minmax(44px,1fr)] items-center gap-2 border-b border-tea-border bg-tea-bg px-3 sm:px-5">
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
    <h2 id="curate-import-title" className={`${TYPOGRAPHY_CLASSES.h3} truncate whitespace-nowrap text-center text-tea-text`}>
      {context.title}
    </h2>
    <p title={context.status} className="min-w-0 truncate whitespace-nowrap text-right text-ui-10 text-tea-text-sec sm:text-ui-11">{context.status}</p>
  </header>
);

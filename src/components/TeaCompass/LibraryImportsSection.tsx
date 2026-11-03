import React, { useEffect, useId, useRef, useState, type RefObject } from 'react';
import type { CurateImportDetail } from '../../lib/api';
import { TYPOGRAPHY_CLASSES } from '../../designTokens';
import { ImportBatchChip } from './ImportBatchChip';

export interface LibraryImportFocusRequest {
  requestId: number;
  targetImportId: string | null;
}

export const nextLibraryImportFocusId = (imports: CurateImportDetail[], deletedImportId: string): string | null => {
  const activeImports = imports.filter(detail => detail.batch.review_state !== 'completed' && detail.batch.review_state !== 'abandoned');
  const deletedIndex = activeImports.findIndex(detail => detail.batch.id === deletedImportId);
  if (deletedIndex < 0) return null;
  return activeImports[deletedIndex + 1]?.batch.id ?? activeImports[deletedIndex - 1]?.batch.id ?? null;
};

interface LibraryImportsSectionProps {
  imports: CurateImportDetail[];
  busyImportId: string | null;
  errorByImportId: Record<string, string>;
  focusRequest?: LibraryImportFocusRequest | null;
  fallbackFocusRef?: RefObject<HTMLElement | null>;
  onOpen: (detail: CurateImportDetail, trigger: HTMLButtonElement) => void;
  onDelete: (detail: CurateImportDetail) => Promise<void>;
}

export const LibraryImportsSection: React.FC<LibraryImportsSectionProps> = ({ imports, busyImportId, errorByImportId, focusRequest, fallbackFocusRef, onOpen, onDelete }) => {
  const activeImports = imports.filter(detail => detail.batch.review_state !== 'completed' && detail.batch.review_state !== 'abandoned');
  const panelId = useId();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const rowRefs = useRef(new Map<string, HTMLDivElement>());

  useEffect(() => {
    if (!focusRequest) return;
    const targetRow = focusRequest.targetImportId ? rowRefs.current.get(focusRequest.targetImportId) : null;
    const targetButton = targetRow?.querySelector<HTMLButtonElement>('button[aria-label^="Open "]');
    if (targetButton?.getClientRects().length) {
      targetButton.focus();
      return;
    }
    if (headingRef.current?.getClientRects().length) {
      headingRef.current.focus();
      return;
    }
    if (fallbackFocusRef?.current?.getClientRects().length) fallbackFocusRef.current.focus();
  }, [activeImports.length, fallbackFocusRef, focusRequest]);

  if (!activeImports.length) return null;

  return (
    <div className="shrink-0">
      <button
        ref={triggerRef}
        type="button"
        popoverTarget={panelId}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => {
          const trigger = triggerRef.current;
          const panel = panelRef.current;
          if (!trigger || !panel) return;
          const rect = trigger.getBoundingClientRect();
          panel.style.top = `${rect.bottom + 8}px`;
          panel.style.left = `${Math.max(12, Math.min(rect.right - 352, window.innerWidth - 364))}px`;
          panel.style.maxHeight = `${Math.max(100, Math.min(360, window.innerHeight - rect.bottom - 88))}px`;
        }}
        className="flex min-h-11 items-center gap-1 rounded-md border border-tea-border px-2 text-ui-12 text-tea-text-sec hover:bg-tea-surface hover:text-tea-text"
      >
        Imports <span className="tabular-nums">({activeImports.length})</span>
      </button>
      <section
        ref={panelRef}
        id={panelId}
        popover="auto"
        onToggle={event => setOpen(event.newState === 'open')}
        aria-label="Imports"
        className="curate-library-imports m-0 w-[min(22rem,calc(100vw-24px))] overflow-y-auto rounded-xl border border-tea-border bg-tea-bg p-3 text-tea-text"
      >
        <h2 ref={headingRef} tabIndex={-1} className={`${TYPOGRAPHY_CLASSES.label} px-0.5 text-tea-text-sec`}>Unfinished imports</h2>
        <p className={`${TYPOGRAPHY_CLASSES.accountMeta} mb-3 text-tea-text-sec`}>Lists and files waiting for review before they join your library.</p>
        <div className="space-y-2">
          {activeImports.map(detail => (
            <div key={detail.batch.id} ref={node => { if (node) rowRefs.current.set(detail.batch.id, node); else rowRefs.current.delete(detail.batch.id); }}>
              <ImportBatchChip
                detail={detail}
                busy={busyImportId === detail.batch.id}
                error={errorByImportId[detail.batch.id]}
                onOpen={() => { panelRef.current?.hidePopover(); if (triggerRef.current) onOpen(detail, triggerRef.current); }}
                onDelete={() => onDelete(detail)}
              />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

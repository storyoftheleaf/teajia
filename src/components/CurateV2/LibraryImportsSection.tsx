import React, { useEffect, useRef, type RefObject } from 'react';
import type { CurateImportDetail } from '../../lib/api';
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
    <section aria-label="Imports" className="curate-v2 mb-5">
      {/* A section as the shop draws one, like Today's and the date groups
          below: the word large, a two-digit count, a gold hairline. */}
      <div className="pt-3">
        <div className="flex items-baseline justify-between pb-2.5">
          <h2 ref={headingRef} tabIndex={-1} className="font-display text-ui-26 font-normal tracking-[0.02em] text-tea-text">Imports</h2>
          <span className="text-ui-11 text-tea-text-sec tabular-nums">{String(activeImports.length).padStart(2, '0')}</span>
        </div>
        <div className="h-px bg-tea-gold/20" aria-hidden="true" />
      </div>
      <div>
        {activeImports.map(detail => (
          <div key={detail.batch.id} ref={node => { if (node) rowRefs.current.set(detail.batch.id, node); else rowRefs.current.delete(detail.batch.id); }}>
            <ImportBatchChip
              detail={detail}
              busy={busyImportId === detail.batch.id}
              error={errorByImportId[detail.batch.id]}
              onOpen={trigger => onOpen(detail, trigger)}
              onDelete={() => onDelete(detail)}
            />
          </div>
        ))}
      </div>
    </section>
  );
};

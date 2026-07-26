import React from 'react';
import type { CurateImportDetail } from '../../lib/api';
import { TYPOGRAPHY_CLASSES } from '../../designTokens';
import { ImportBatchChip } from './ImportBatchChip';

interface LibraryImportsSectionProps {
  imports: CurateImportDetail[];
  busyImportId: string | null;
  errorByImportId: Record<string, string>;
  onOpen: (detail: CurateImportDetail) => void;
  onDelete: (detail: CurateImportDetail) => Promise<void>;
}

export const LibraryImportsSection: React.FC<LibraryImportsSectionProps> = ({ imports, busyImportId, errorByImportId, onOpen, onDelete }) => {
  const activeImports = imports.filter(detail => detail.batch.review_state !== 'completed' && detail.batch.review_state !== 'abandoned');
  if (!activeImports.length) return null;

  return (
    <section aria-label="Imports" className="mb-5 space-y-2">
      <h2 className={`${TYPOGRAPHY_CLASSES.label} px-0.5 text-tea-text-sec`}>Imports</h2>
      <div className="space-y-2">
        {activeImports.map(detail => (
          <ImportBatchChip
            key={detail.batch.id}
            detail={detail}
            busy={busyImportId === detail.batch.id}
            error={errorByImportId[detail.batch.id]}
            onOpen={() => onOpen(detail)}
            onDelete={() => onDelete(detail)}
          />
        ))}
      </div>
    </section>
  );
};

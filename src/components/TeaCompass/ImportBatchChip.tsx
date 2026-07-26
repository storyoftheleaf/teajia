import React, { useEffect, useRef, useState } from 'react';
import type { CurateImportDetail } from '../../lib/api';
import { CurateRecordRow } from './CuratePrimitives';

interface ImportBatchChipProps {
  detail: CurateImportDetail;
  onOpen: () => void;
  onDelete: () => Promise<void>;
  busy?: boolean;
  error?: string;
}

export const ImportBatchChip: React.FC<ImportBatchChipProps> = ({ detail, onOpen, onDelete, busy = false, error }) => {
  const [confirming, setConfirming] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const title = detail.batch.title || 'Untitled import';
  const reviewed = detail.items.filter(item => item.review_state === 'accepted' || item.review_state === 'merged').length;
  const attention = detail.items.filter(item =>
    (item.blocking_fields?.length ?? 0) > 0
    || (item.blocking_fields == null && Object.keys(item.uncertainty || {}).length > 0)
  ).length;

  useEffect(() => {
    if (confirming) cancelRef.current?.focus();
  }, [confirming]);

  const closeConfirmation = () => {
    setConfirming(false);
    requestAnimationFrame(() => wrapperRef.current?.querySelector<HTMLButtonElement>(`[aria-label="Delete ${CSS.escape(title)}"]`)?.focus());
  };

  return (
    <div ref={wrapperRef} className="space-y-2">
      <CurateRecordRow
        title={title}
        metadata={`${reviewed}/${detail.items.length} reviewed`}
        status={`${attention} ${attention === 1 ? 'needs' : 'need'} attention`}
        openLabel={`Open ${title}`}
        onOpen={onOpen}
        deleteLabel={`Delete ${title}`}
        onDelete={() => setConfirming(true)}
        busy={busy}
      />

      {confirming && (
        <div role="group" aria-label={`Delete ${title} confirmation`} className="space-y-2 border-t border-tea-border px-2 pt-2">
          <p className="text-ui-12 text-tea-text-sec">
            Delete this incomplete import? Its source record and evidence are retained for audit and recovery.
          </p>
          {error && <p role="alert" className="text-ui-12 text-tea-text">{error}</p>}
          <div className="flex flex-wrap justify-between gap-3">
            <button ref={cancelRef} type="button" disabled={busy} onClick={closeConfirmation} className="tap-target min-h-11 text-ui-12 text-tea-text-sec hover:text-tea-text disabled:opacity-50">
              Cancel
            </button>
            <button
              type="button"
              disabled={busy}
              aria-label={error ? `Retry delete ${title}` : undefined}
              onClick={() => void onDelete()}
              className="tap-target min-h-11 text-ui-12 text-tea-gold hover:text-tea-gold-lt disabled:opacity-50"
            >
              {busy ? 'Deleting…' : error ? 'Retry delete' : 'Delete import'}
            </button>
          </div>
        </div>
      )}

      {error && !confirming && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-2 px-2 text-ui-12 text-tea-text">
          <span>{error}</span>
          <button type="button" disabled={busy} aria-label={`Retry delete ${title}`} onClick={() => void onDelete()} className="tap-target min-h-11 text-tea-gold hover:text-tea-gold-lt disabled:opacity-50">
            {busy ? 'Deleting…' : 'Retry delete'}
          </button>
        </div>
      )}
    </div>
  );
};

import React from 'react';
import { motion } from 'framer-motion';

interface DuplicateNudgeProps {
  matchedEntry: {
    id: string;
    name: string;
    vendorName?: string;
    createdAt: string;
    type?: string;
  };
  onSameTea: () => void;
  /** Fill this capture's empty fields from the earlier one. */
  onCopyDetails?: () => void;
  onDifferentTea: () => void;
  onDismiss: () => void;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'today';
  if (diffDays === 1) return 'yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export const DuplicateNudge: React.FC<DuplicateNudgeProps> = ({
  matchedEntry,
  onSameTea,
  onCopyDetails,
  onDifferentTea,
  onDismiss,
}) => {
  const vendor = matchedEntry.vendorName ? ` from ${matchedEntry.vendorName}` : '';
  const date = formatDate(matchedEntry.createdAt);

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.2, ease: [0.32, 0.72, 0, 1] }}
      className="overflow-hidden"
    >
      <div className="curate-v2 border-b border-tea-border px-4 py-3">
        <p className="min-w-0 font-mono text-ui-13 text-tea-text-sec" title={`Logged "${matchedEntry.name}"${vendor} ${date}`}>
          Logged <span className="font-display text-ui-17 text-tea-text">"{matchedEntry.name}"</span>{vendor} &middot; {date}
        </p>
        <div className="flex flex-wrap items-center gap-2 pt-2">
          <button type="button" onClick={onSameTea} className="curate-v2-frame is-tall">Same</button>
          {onCopyDetails && (
            <button type="button" onClick={onCopyDetails} className="curate-v2-frame is-tall">Copy details</button>
          )}
          <button type="button" onClick={onDifferentTea} className="curate-v2-frame is-tall">Different</button>
          <button
            type="button"
            onClick={onDismiss}
            className="curate-v2-word tap-target ml-auto min-h-11 px-1 text-tea-text-sec"
            aria-label="Dismiss duplicate warning"
          >
            dismiss
          </button>
        </div>
      </div>
    </motion.div>
  );
};

export default DuplicateNudge;

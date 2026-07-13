import React from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';

interface DuplicateNudgeProps {
  matchedEntry: {
    id: string;
    name: string;
    vendorName?: string;
    createdAt: string;
    type?: string;
  };
  onSameTea: () => void;
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
      <div className="bg-tea-surface border border-tea-border rounded px-2.5 py-1.5 flex flex-wrap items-center gap-2 min-w-0">
        <p className="text-ui-12 text-tea-text-sec flex-1 min-w-0 truncate whitespace-nowrap" title={`Logged "${matchedEntry.name}"${vendor} ${date}`}>
          Logged <span className="text-tea-text">"{matchedEntry.name}"</span>{vendor} &middot; {date}
        </p>
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={onSameTea}
            className="pill curate-duplicate-action tap-target min-h-11 text-tea-gold px-2"
          >
            Same
          </button>
          <button
            type="button"
            onClick={onDifferentTea}
            className="pill curate-duplicate-action tap-target min-h-11 text-tea-gold px-2"
          >
            Different
          </button>
          <button
            type="button"
            onClick={onDismiss}
            className="tap-target ml-0.5 min-h-11 min-w-11 text-ui-12 text-tea-text-dim hover:text-tea-text-sec transition-colors"
            aria-label="Dismiss duplicate warning"
          >
            <X size={12} />
          </button>
        </div>
      </div>
    </motion.div>
  );
};

export default DuplicateNudge;

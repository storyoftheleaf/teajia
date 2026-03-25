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
      <div className="bg-tea-surface border border-tea-border rounded px-2.5 py-1.5 flex items-center gap-2">
        <p className="text-[11px] text-tea-text-sec leading-snug flex-1 min-w-0">
          You logged <span className="text-tea-text">"{matchedEntry.name}"</span>{vendor} {date}
        </p>
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={onSameTea}
            className="pill text-[11px] text-tea-gold px-2 py-0.5"
          >
            Same tea
          </button>
          <span className="text-tea-text-dim text-[11px]">&middot;</span>
          <button
            type="button"
            onClick={onDifferentTea}
            className="pill text-[11px] text-tea-gold px-2 py-0.5"
          >
            Different tea
          </button>
          <button
            type="button"
            onClick={onDismiss}
            className="ml-0.5 text-tea-text-dim hover:text-tea-text-sec transition-colors"
          >
            <X size={12} strokeWidth={2} />
          </button>
        </div>
      </div>
    </motion.div>
  );
};

export default DuplicateNudge;

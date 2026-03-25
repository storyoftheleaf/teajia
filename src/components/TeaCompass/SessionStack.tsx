import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { TeaCompassEntry } from './types';

interface SessionStackProps {
  sessionEntries: TeaCompassEntry[];
  activeEntryId: string | null;
  onSelectEntry: (id: string) => void;
}

const STATUS_DOT: Record<string, string> = {
  logged: 'bg-tea-text-dim',
  want: 'bg-tea-gold',
  buying: 'bg-tea-gold',
  bought: 'bg-tea-gold-lt',
};

export const SessionStack: React.FC<SessionStackProps> = ({
  sessionEntries,
  activeEntryId,
  onSelectEntry,
}) => {
  // Filter out the active entry — it's shown as the full CaptureCard below
  const stackEntries = sessionEntries.filter((e) => e.id !== activeEntryId);

  if (stackEntries.length === 0) return null;

  return (
    <div className="flex flex-col gap-1 mb-3">
      <AnimatePresence initial={false}>
        {stackEntries.map((entry) => (
          <motion.button
            key={entry.id}
            type="button"
            layout
            initial={{ opacity: 0, y: -8, scaleY: 0.9 }}
            animate={{ opacity: 1, y: 0, scaleY: 1 }}
            exit={{ opacity: 0, y: -8, scaleY: 0.9 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            onClick={() => onSelectEntry(entry.id)}
            className="flex items-center gap-2 px-3 py-2 rounded bg-tea-surface/60
                       text-left text-sm transition-colors hover:bg-tea-surface"
          >
            {/* Status dot */}
            <span
              className={`w-1.5 h-1.5 rounded-full shrink-0 ${STATUS_DOT[entry.status] || STATUS_DOT.logged}`}
            />

            {/* Name */}
            <span className="text-tea-text truncate flex-1 min-w-0">
              {entry.name || 'Untitled'}
            </span>

            {/* Type badge */}
            {entry.type && (
              <span className="pill text-[10px] px-1.5 py-0 leading-4 shrink-0">
                {entry.type}
              </span>
            )}

            {/* Teaware indicator */}
            {entry.category === 'teaware' && !entry.type && (
              <span className="pill text-[10px] px-1.5 py-0 leading-4 shrink-0">
                Teaware
              </span>
            )}
          </motion.button>
        ))}
      </AnimatePresence>
    </div>
  );
};

export default SessionStack;

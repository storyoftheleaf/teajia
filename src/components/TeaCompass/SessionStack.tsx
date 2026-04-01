import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getTeaColor } from '../../designTokens';
import type { TeaCompassEntry } from './types';

interface SessionStackProps {
  sessionEntries: TeaCompassEntry[];
  activeEntryId: string | null;
  onSelectEntry: (id: string) => void;
}

export const SessionStack: React.FC<SessionStackProps> = ({
  sessionEntries,
  activeEntryId,
  onSelectEntry,
}) => {
  // Filter out the active entry and empty/untouched entries
  const stackEntries = sessionEntries.filter(
    (e) =>
      e.id !== activeEntryId &&
      (e.name || e.notes || e.type || e.photos.length > 0 || e.status !== 'logged')
  );

  if (stackEntries.length === 0) return null;

  return (
    <div className="flex flex-col gap-1 mb-3">
      <AnimatePresence initial={false}>
        {stackEntries.map((entry) => {
          const typeColor = entry.type ? getTeaColor(entry.type) : null;
          return (
            <motion.button
              key={entry.id}
              type="button"
              layout
              initial={{ opacity: 0, y: -8, scaleY: 0.9 }}
              animate={{ opacity: 1, y: 0, scaleY: 1 }}
              exit={{ opacity: 0, y: -8, scaleY: 0.9 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              onClick={() => onSelectEntry(entry.id)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-tea-surface/50
                         text-left text-sm transition-colors hover:bg-tea-surface"
              style={typeColor ? { borderLeft: `2px solid ${typeColor}50` } : undefined}
            >
              {/* Name */}
              <span className="text-tea-text truncate flex-1 min-w-0 text-[13px]">
                {entry.name || 'Untitled'}
              </span>

              {/* Type badge with type color */}
              {entry.type && (
                <span
                  className="text-[9px] font-medium px-1.5 py-0.5 rounded-full uppercase tracking-wider shrink-0"
                  style={{
                    backgroundColor: `color-mix(in srgb, ${typeColor} 12%, transparent)`,
                    color: typeColor || undefined,
                  }}
                >
                  {entry.type}
                </span>
              )}

              {/* Teaware indicator */}
              {entry.category === 'teaware' && !entry.type && (
                <span className="badge-status badge-status-muted text-[9px] shrink-0">
                  Teaware
                </span>
              )}
            </motion.button>
          );
        })}
      </AnimatePresence>
    </div>
  );
};

export default SessionStack;

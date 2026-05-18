import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Leaf, X } from 'lucide-react';
import { getTeaColor } from '../../designTokens';
import type { TeaCompassEntry } from './types';

interface SessionStackProps {
  sessionEntries: TeaCompassEntry[];
  activeEntryId: string | null;
  onSelectEntry: (id: string) => void;
  onDiscardEntry: (id: string) => void;
}

function entryHasContent(e: TeaCompassEntry): boolean {
  return (
    e.name.trim().length > 0 ||
    e.photos.length > 0 ||
    e.notes.trim().length > 0 ||
    (e.tasting != null &&
      Object.values(e.tasting).some((v) => Array.isArray(v) ? v.length > 0 : v != null))
  );
}

export const SessionStack: React.FC<SessionStackProps> = ({
  sessionEntries,
  activeEntryId,
  onSelectEntry,
  onDiscardEntry,
}) => {
  const stackEntries = sessionEntries.filter(
    (e) => e.id !== activeEntryId && entryHasContent(e)
  );

  if (stackEntries.length === 0) return null;

  return (
    <div className="flex flex-col gap-1 mb-3">
      <AnimatePresence initial={false}>
        {stackEntries.map((entry) => {
          const isTeaware = entry.category === 'teaware';
          const typeColor = entry.type ? getTeaColor(entry.type) : null;

          return (
            <motion.div
              key={entry.id}
              layout
              initial={{ opacity: 0, y: -8, scaleY: 0.9 }}
              animate={{ opacity: 1, y: 0, scaleY: 1 }}
              exit={{ opacity: 0, y: -8, scaleY: 0.9 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="flex items-center gap-1.5 rounded-md bg-tea-surface/50 overflow-hidden"
              style={typeColor ? { borderLeft: `2px solid ${typeColor}50` } : { borderLeft: '2px solid transparent' }}
            >
              {/* Tap area — switches active entry */}
              <button
                type="button"
                onClick={() => onSelectEntry(entry.id)}
                className="flex-1 min-w-0 flex items-center gap-2 px-2.5 py-1.5 text-left hover:bg-tea-surface transition-colors"
              >
                {/* Tea / teaware icon */}
                {isTeaware ? (
                  <span className="text-ui-9 text-tea-text-dim font-medium shrink-0 border border-tea-border rounded px-1 py-px">
                    TWR
                  </span>
                ) : (
                  <Leaf
                    size={11}
                    className="shrink-0"
                    style={{ color: typeColor || 'var(--tea-text-dim)' }}
                  />
                )}

                {/* Name */}
                <span className="text-ui-13 text-tea-text truncate flex-1 min-w-0">
                  {entry.name || 'Untitled'}
                </span>

                {/* Type badge */}
                {entry.type && (
                  <span
                    className="text-ui-9 font-medium px-1.5 py-0.5 rounded-full uppercase tracking-wider shrink-0"
                    style={{
                      backgroundColor: `color-mix(in srgb, ${typeColor} 12%, transparent)`,
                      color: typeColor || undefined,
                    }}
                  >
                    {entry.type}
                  </span>
                )}
              </button>

              {/* Discard × */}
              <button
                type="button"
                onClick={() => onDiscardEntry(entry.id)}
                className="p-2 text-tea-text-dim hover:text-tea-error transition-colors shrink-0"
                title="Discard"
              >
                <X size={11} />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
};

export default SessionStack;

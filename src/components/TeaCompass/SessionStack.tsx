import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Leaf, X } from 'lucide-react';
import { getTeaColor } from '../../designTokens';
import { entryHasDeliberateInput } from '../../lib/teaCompassStore';
import type { TeaCompassEntry } from './types';

interface SessionStackProps {
  sessionEntries: TeaCompassEntry[];
  activeEntryId: string | null;
  onSelectEntry: (id: string) => void;
  onDiscardEntry: (id: string) => void;
}

export const SessionStack: React.FC<SessionStackProps> = ({
  sessionEntries,
  activeEntryId,
  onSelectEntry,
  onDiscardEntry,
}) => {
  const stackEntries = sessionEntries.filter(
    (e) => e.id !== activeEntryId && entryHasDeliberateInput(e)
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
                className="flex min-h-11 min-w-0 flex-1 items-center gap-2 px-2.5 py-1.5 text-left transition-colors hover:bg-tea-surface"
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
                className="tap-target flex min-h-11 min-w-11 shrink-0 items-center justify-center text-tea-text-sec transition-colors hover:text-tea-error"
                aria-label={`Discard ${entry.name || 'untitled draft'}`}
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

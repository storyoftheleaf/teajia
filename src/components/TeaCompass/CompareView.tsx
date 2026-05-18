import React from 'react';
import { X } from 'lucide-react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { getTeaColor } from '../../designTokens';
import type { TeaCompassEntry } from './types';

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$', NT: 'NT$', Yuan: '¥', IDR: 'Rp', JPY: '¥', MYR: 'RM', HKD: 'HK$', UNK: '',
};

function pricePerGram(entry: TeaCompassEntry): number | null {
  if (!entry.priceAmount || !entry.pricePerUnitGrams) return null;
  return entry.priceAmount / entry.pricePerUnitGrams;
}

function formatPPG(entry: TeaCompassEntry): string {
  const ppg = pricePerGram(entry);
  if (ppg == null) return '—';
  const sym = CURRENCY_SYMBOLS[entry.priceCurrency] || '';
  return ['IDR', 'JPY', 'NT'].includes(entry.priceCurrency)
    ? `${sym}${Math.round(ppg)}/g`
    : `${sym}${ppg.toFixed(2)}/g`;
}

const TASTING_LABELS: Record<string, string> = {
  quality: 'Score',
  body: 'Body',
  finish: 'Finish',
  feeling: 'Feeling',
  flavor: 'Flavor',
  'liquor-color': 'Color',
  cleanliness: 'Cleanliness',
};

interface CompareViewProps {
  entries: TeaCompassEntry[];
  onClose: () => void;
  onRemove: (id: string) => void;
}

function TastingCell({ entry }: { entry: TeaCompassEntry }) {
  const t = entry.tasting;
  if (!t) return <span className="text-ui-11 text-tea-text-dim italic">No tasting</span>;

  const quality = t.quality ?? t.rating;
  const color = entry.type ? getTeaColor(entry.type) : null;

  return (
    <div className="space-y-1.5">
      {quality != null && (
        <div className="flex items-baseline gap-1">
          <span
            className="text-lg font-semibold tabular-nums"
            style={color ? { color } : undefined}
          >
            {quality}
          </span>
          <span className="text-ui-10 text-tea-text-dim">/10</span>
        </div>
      )}
      {t.flavor && t.flavor.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {t.flavor.slice(0, 4).map((f) => (
            <span key={f} className="text-ui-10 text-tea-text-sec bg-tea-surface/60 px-1.5 py-0.5 rounded">
              {f}
            </span>
          ))}
        </div>
      )}
      {t.body && t.body.length > 0 && (
        <p className="text-ui-10 text-tea-text-dim">{t.body.slice(0, 2).join(', ')}</p>
      )}
      {t.feeling && t.feeling.length > 0 && (
        <p className="text-ui-10 text-tea-text-dim italic">{t.feeling.slice(0, 2).join(', ')}</p>
      )}
    </div>
  );
}

export const CompareView: React.FC<CompareViewProps> = ({ entries, onClose, onRemove }) => {
  const currentYear = new Date().getFullYear();

  return createPortal(
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 40 }}
        transition={{ duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
        className="fixed inset-0 sidebar-inset z-modal bg-tea-bg flex flex-col"
        style={{
          paddingTop: 'env(safe-area-inset-top, 0px)',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-tea-border shrink-0">
          <span
            className="text-ui-11 uppercase tracking-[0.15em] text-tea-text-sec font-medium"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Compare — {entries.length} teas
          </span>
          <button
            type="button"
            onClick={onClose}
            className="pill text-xs text-tea-text-sec"
          >
            Done
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-x-auto overflow-y-auto">
          <table className="w-full text-left border-collapse" style={{ minWidth: `${entries.length * 160}px` }}>
            <thead>
              <tr>
                {entries.map((entry) => {
                  const typeColor = entry.type ? getTeaColor(entry.type) : null;
                  const age = entry.year && currentYear > entry.year ? currentYear - entry.year : null;
                  return (
                    <th
                      key={entry.id}
                      className="px-3 pt-3 pb-2 align-top font-normal"
                      style={{ width: `${100 / entries.length}%`, borderBottom: typeColor ? `2px solid ${typeColor}40` : '2px solid var(--tea-border)' }}
                    >
                      {/* Remove button */}
                      <button
                        type="button"
                        onClick={() => onRemove(entry.id)}
                        className="float-right -mt-0.5 text-tea-text-dim hover:text-tea-error transition-colors"
                      >
                        <X size={12} />
                      </button>

                      {/* Photo */}
                      {entry.photos[0] && (
                        <img
                          src={entry.photos[0]}
                          alt=""
                          className="w-full h-20 object-cover rounded-xl mb-2"
                        />
                      )}

                      {/* Name */}
                      <p
                        className="text-sm font-medium text-tea-text leading-tight mb-0.5 pr-4"
                        style={{ fontFamily: 'var(--font-display)' }}
                      >
                        {entry.name || 'Untitled'}
                      </p>
                      {entry.chineseName && (
                        <p className="text-ui-11 text-tea-text-sec font-chinese mb-0.5">{entry.chineseName}</p>
                      )}

                      {/* Type · Year · Age */}
                      <p className="text-ui-10 text-tea-text-dim">
                        {[
                          entry.type,
                          entry.year,
                          age != null && age > 0 ? `${age}y` : null,
                        ].filter(Boolean).join(' · ')}
                      </p>
                    </th>
                  );
                })}
              </tr>
            </thead>

            <tbody>
              {/* Price/g row */}
              <tr className="border-b border-tea-border">
                {entries.map((entry) => (
                  <td key={entry.id} className="px-3 py-2 align-top">
                    <span className="text-ui-12 font-medium text-tea-text-sec tabular-nums">{formatPPG(entry)}</span>
                  </td>
                ))}
              </tr>

              {/* Vendor */}
              <tr className="border-b border-tea-border">
                {entries.map((entry) => (
                  <td key={entry.id} className="px-3 py-2 align-top">
                    <span className="text-ui-11 text-tea-text-dim">{entry.vendorName || '—'}</span>
                  </td>
                ))}
              </tr>

              {/* Origin */}
              <tr className="border-b border-tea-border">
                {entries.map((entry) => (
                  <td key={entry.id} className="px-3 py-2 align-top">
                    <span className="text-ui-11 text-tea-text-dim">{entry.originRegion || '—'}</span>
                  </td>
                ))}
              </tr>

              {/* Tasting */}
              <tr>
                {entries.map((entry) => (
                  <td key={entry.id} className="px-3 py-2 align-top">
                    <TastingCell entry={entry} />
                  </td>
                ))}
              </tr>

              {/* Notes */}
              <tr className="border-t border-tea-border">
                {entries.map((entry) => (
                  <td key={entry.id} className="px-3 py-2 align-top">
                    {entry.notes.trim() ? (
                      <p className="text-ui-11 text-tea-text-sec leading-relaxed line-clamp-4">
                        {entry.notes.trim()}
                      </p>
                    ) : (
                      <span className="text-ui-11 text-tea-text-dim italic">No notes</span>
                    )}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
};

export default CompareView;

import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import {
  SEASONS,
  STORAGE_OPTIONS,
  COMMON_REGIONS,
  type Season,
  type Storage,
  type TeaType,
} from './types';

interface DetailsRowProps {
  year?: number;
  season?: Season;
  storage?: Storage;
  originRegion?: string;
  teaType?: TeaType;
  onYearChange: (year: number | undefined) => void;
  onSeasonChange: (season: Season | undefined) => void;
  onStorageChange: (storage: Storage | undefined) => void;
  onRegionChange: (region: string | undefined) => void;
}

const showStorage = (type?: TeaType) =>
  type === 'Sheng' || type === 'Shou' || type === 'Dark';

export const DetailsRow: React.FC<DetailsRowProps> = ({
  year,
  season,
  storage,
  originRegion,
  teaType,
  onYearChange,
  onSeasonChange,
  onStorageChange,
  onRegionChange,
}) => {
  const [expanded, setExpanded] = useState(false);
  const [customRegion, setCustomRegion] = useState('');

  const handleYearInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      onYearChange(val === '' ? undefined : Number(val));
    },
    [onYearChange]
  );

  const handleCustomRegionSubmit = useCallback(() => {
    const trimmed = customRegion.trim();
    if (trimmed) {
      onRegionChange(trimmed);
      setCustomRegion('');
    }
  }, [customRegion, onRegionChange]);

  const handleCustomRegionKey = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleCustomRegionSubmit();
      }
    },
    [handleCustomRegionSubmit]
  );

  const hasValues = year || season || storage || originRegion;

  return (
    <div>
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 text-xs text-tea-text-sec hover:text-tea-gold transition-colors w-full py-1"
      >
        <motion.span
          animate={{ rotate: expanded ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="inline-flex"
        >
          <ChevronDown size={14} />
        </motion.span>
        <span>Details</span>
        {!expanded && hasValues && (
          <span className="text-tea-text-dim ml-1">
            {[
              year,
              season,
              storage,
              originRegion,
            ]
              .filter(Boolean)
              .join(' / ')}
          </span>
        )}
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
            className="overflow-hidden"
          >
            <div className="space-y-3 pt-2">
              {/* Year */}
              <div className="space-y-1">
                <label className="text-xs text-tea-text-dim uppercase tracking-wider">
                  Year
                </label>
                <input
                  type="number"
                  inputMode="numeric"
                  placeholder="e.g. 2024"
                  value={year ?? ''}
                  onChange={handleYearInput}
                  maxLength={4}
                  className="w-24 bg-tea-surface text-tea-text border border-tea-border rounded px-3 py-2 text-sm num focus:outline-none focus:border-tea-gold transition-colors"
                />
              </div>

              {/* Season */}
              <div className="space-y-1">
                <label className="text-xs text-tea-text-dim uppercase tracking-wider">
                  Season
                </label>
                <div className="flex gap-1.5">
                  {SEASONS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => onSeasonChange(season === s ? undefined : s)}
                      className={season === s ? 'pill-active' : 'pill'}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              {/* Storage (conditional) */}
              {showStorage(teaType) && (
                <div className="space-y-1">
                  <label className="text-xs text-tea-text-dim uppercase tracking-wider">
                    Storage
                  </label>
                  <div className="flex gap-1.5 flex-wrap">
                    {STORAGE_OPTIONS.map((st) => (
                      <button
                        key={st}
                        type="button"
                        onClick={() => onStorageChange(storage === st ? undefined : st)}
                        className={storage === st ? 'pill-active' : 'pill'}
                      >
                        {st}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Region */}
              <div className="space-y-1.5">
                <label className="text-xs text-tea-text-dim uppercase tracking-wider">
                  Region
                </label>
                <div className="flex gap-1 flex-wrap">
                  {COMMON_REGIONS.map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => onRegionChange(originRegion === r ? undefined : r)}
                      className={originRegion === r ? 'tag-selectable tag-selectable-active' : 'tag-selectable'}
                    >
                      {r}
                    </button>
                  ))}
                </div>
                <div className="flex gap-1.5 items-center mt-1">
                  <input
                    type="text"
                    placeholder="Other region..."
                    value={customRegion}
                    onChange={(e) => setCustomRegion(e.target.value)}
                    onKeyDown={handleCustomRegionKey}
                    onBlur={handleCustomRegionSubmit}
                    className="flex-1 bg-tea-surface text-tea-text border border-tea-border rounded px-3 py-1.5 text-xs focus:outline-none focus:border-tea-gold transition-colors"
                  />
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default DetailsRow;

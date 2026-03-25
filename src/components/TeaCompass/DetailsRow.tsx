import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Droplets } from 'lucide-react';
import {
  SEASONS,
  STORAGE_OPTIONS,
  COMMON_REGIONS,
  type Season,
  type Storage,
  type TeaType,
} from './types';
import type { TastingData } from '../../types';
import type { TastingCategoryId } from '../../data/tastingTaxonomy';
import { TastingProfileStrip } from '../tasting/TastingProfileStrip';
import { AutocompleteInput } from './AutocompleteInput';

interface DetailsRowProps {
  year?: number;
  season?: Season;
  storage?: Storage;
  originRegion?: string;
  teaType?: TeaType;
  chineseName?: string;
  tasting?: TastingData;
  hasTasting: boolean;
  availableRegions?: string[];
  onYearChange: (year: number | undefined) => void;
  onSeasonChange: (season: Season | undefined) => void;
  onStorageChange: (storage: Storage | undefined) => void;
  onRegionChange: (region: string | undefined) => void;
  onChineseNameChange: (name: string) => void;
  onOpenTasting: () => void;
  onTastingStripRemove: (categoryId: TastingCategoryId, termId: string) => void;
}

const showStorage = (type?: TeaType) =>
  type === 'Sheng' || type === 'Shou' || type === 'Dark';

export const DetailsRow: React.FC<DetailsRowProps> = ({
  year,
  season,
  storage,
  originRegion,
  teaType,
  chineseName,
  tasting,
  hasTasting,
  availableRegions = COMMON_REGIONS,
  onYearChange,
  onSeasonChange,
  onStorageChange,
  onRegionChange,
  onChineseNameChange,
  onOpenTasting,
  onTastingStripRemove,
}) => {
  const [expanded, setExpanded] = useState(false);

  const handleYearInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      onYearChange(val === '' ? undefined : Number(val));
    },
    [onYearChange]
  );

  const hasValues = year || season || storage || originRegion || chineseName;

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
              chineseName,
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
                <label className="text-[11px] text-tea-text-dim uppercase tracking-wider">
                  Year
                </label>
                <input
                  type="number"
                  inputMode="numeric"
                  placeholder="e.g. 2024"
                  value={year ?? ''}
                  onChange={handleYearInput}
                  maxLength={4}
                  className="w-24 bg-tea-surface/60 text-tea-text rounded-md px-3 py-2 border border-tea-border/30 focus:border-tea-gold/50 outline-none transition-colors text-sm tabular-nums"
                />
              </div>

              {/* Season */}
              <div className="space-y-1">
                <label className="text-[11px] text-tea-text-dim uppercase tracking-wider">
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
                  <label className="text-[11px] text-tea-text-dim uppercase tracking-wider">
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
              <div className="space-y-1">
                <label className="text-[11px] text-tea-text-dim uppercase tracking-wider">
                  Region
                </label>
                <AutocompleteInput
                  value={originRegion || ''}
                  onChange={(val) => onRegionChange(val || undefined)}
                  suggestions={availableRegions}
                  placeholder="e.g. Alishan, Yiwu..."
                  className="w-full bg-tea-surface/60 text-tea-text rounded-md px-3 py-2 border border-tea-border/30 focus:border-tea-gold/50 outline-none transition-colors text-sm"
                />
              </div>

              {/* Chinese name — optional, at the bottom of details */}
              <div className="space-y-1">
                <label className="text-[11px] text-tea-text-dim uppercase tracking-wider">
                  Chinese name (optional)
                </label>
                <input
                  type="text"
                  value={chineseName || ''}
                  onChange={(e) => onChineseNameChange(e.target.value)}
                  placeholder="e.g. \u5927\u7D05\u888D"
                  className="w-full bg-tea-surface/60 text-tea-text rounded-md px-3 py-2 border border-tea-border/30 focus:border-tea-gold/50 outline-none transition-colors text-sm placeholder:text-tea-text-dim/50"
                />
              </div>

              {/* Tasting button + TastingProfileStrip */}
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={onOpenTasting}
                  className="pill flex items-center gap-1.5 text-xs text-tea-text-sec"
                >
                  <Droplets size={13} strokeWidth={1.5} />
                  {hasTasting ? 'Edit tasting' : 'Record tasting'}
                </button>

                {hasTasting && tasting && (
                  <TastingProfileStrip
                    value={tasting}
                    onRemove={onTastingStripRemove}
                  />
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default DetailsRow;

import React, { useId, useState } from 'react';
import { Droplets } from 'lucide-react';
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
import { CurateDisclosure } from './CuratePrimitives';

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
  season,
  storage,
  originRegion,
  teaType,
  chineseName,
  tasting,
  hasTasting,
  availableRegions = COMMON_REGIONS,
  onSeasonChange,
  onStorageChange,
  onRegionChange,
  onChineseNameChange,
  onOpenTasting,
  onTastingStripRemove,
}) => {
  const [expanded, setExpanded] = useState(false);
  const detailsId = `capture-details-${useId().replace(/:/g, '')}`;

  const hasValues = storage || originRegion;
  const detailSummary = [storage, originRegion].filter(Boolean).join(' / ');

  return (
    <CurateDisclosure
      id={detailsId}
      label={!expanded && hasValues ? `Details · ${detailSummary}` : 'Details'}
      open={expanded}
      onToggle={() => setExpanded((current) => !current)}
    >
      <div className="space-y-3 pt-2">
        {/* Storage (conditional) */}
        {showStorage(teaType) && (
          <div className="space-y-1">
            <label className="text-xs text-tea-text-sec uppercase tracking-[0.08em]">
              Storage
            </label>
            <div className="flex gap-1.5 flex-wrap">
              {STORAGE_OPTIONS.map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => onStorageChange(storage === st ? undefined : st)}
                  className={storage === st ? 'tag-selectable-active' : 'tag-selectable'}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Region */}
        <div className="space-y-1">
          <label className="text-xs text-tea-text-sec uppercase tracking-[0.08em]">
            Region
          </label>
          <AutocompleteInput
            value={originRegion || ''}
            onChange={(val) => onRegionChange(val || undefined)}
            suggestions={availableRegions}
            placeholder="e.g. Alishan, Yiwu..."
            className="w-full bg-tea-gold/[0.06] text-tea-text rounded-md px-3 py-2 border border-tea-border focus:border-tea-gold/40 outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus-visible:ring-offset-1 focus-visible:ring-offset-tea-bg transition-colors text-base"
          />
        </div>

        {/* Tasting button + TastingProfileStrip */}
        <div className="space-y-2">
          <button
            type="button"
            onClick={onOpenTasting}
            className={`flex items-center gap-1.5 text-xs px-3 py-2 rounded-md transition-colors ${
              hasTasting
                ? 'pill text-tea-text-sec'
                : 'bg-tea-gold/8 text-tea-gold hover:bg-tea-gold/12'
            }`}
          >
            <Droplets size={14} strokeWidth={1.5} />
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
    </CurateDisclosure>
  );
};

export default DetailsRow;

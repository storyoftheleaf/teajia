import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { TastingData } from '../../types';
import type { TastingCategoryId } from '../../data/tastingTaxonomy';
import { useTastingFlow } from './useTastingFlow';
import { FlavorZone } from './FlavorZone';
import { BodySelector } from './BodySelector';
import { FeelingCards } from './FeelingCards';
import { ColorSwatches } from './ColorSwatches';
import { FinishZone } from './FinishZone';
import { BrewingZone } from './BrewingZone';
import { TastingProfileStrip } from './TastingProfileStrip';

interface TastingFlowProps {
  mode: 'admin' | 'customer';
  value: TastingData;
  onChange: (data: TastingData) => void;
}

export const TastingFlow: React.FC<TastingFlowProps> = ({ mode, value, onChange }) => {
  const flow = useTastingFlow(value, onChange);
  const [showMore, setShowMore] = useState(false);

  // On desktop, always show Finish/Brewing for admin
  const isDesktop = typeof window !== 'undefined' && window.innerWidth >= 768;
  const showFinish = mode === 'admin' ? (isDesktop || showMore) : showMore;
  const showBrewing = mode === 'admin' ? (isDesktop || showMore) : false;

  const handleRemoveTerm = (categoryId: TastingCategoryId, termId: string) => {
    flow.toggleTerm(categoryId, termId);
  };

  // Count for "More" section
  const finishCount = (value.finish?.length || 0);
  const brewingCount = (value.brewing?.length || 0);
  const moreCount = finishCount + brewingCount;

  return (
    <div className="flex flex-col gap-1">
      {/* Profile strip — shows all selected terms */}
      {flow.hasAnySelection && (
        <div className="mb-3">
          <TastingProfileStrip value={value} onRemove={handleRemoveTerm} />
        </div>
      )}

      {/* Desktop: two-column layout */}
      <div className="md:grid md:grid-cols-[1fr_260px] md:gap-6">
        {/* Left / Main column: Flavor */}
        <div>
          <FlavorZone flow={flow} />
        </div>

        {/* Right / Secondary column: Body, Feel, Color */}
        <div className="flex flex-col gap-5 mt-5 md:mt-0">
          <BodySelector flow={flow} />
          <FeelingCards flow={flow} />
          <ColorSwatches flow={flow} />
        </div>
      </div>

      {/* More section (Finish + Brewing) — collapsed on mobile */}
      {!isDesktop && !showMore && (
        <button
          type="button"
          onClick={() => setShowMore(true)}
          className="flex items-center justify-center gap-2 py-3 mt-3 text-xs text-tea-text-dim hover:text-tea-text-sec transition-colors border-t border-tea-border"
          style={{ fontFamily: 'var(--font-body)' }}
        >
          <span>More details</span>
          {moreCount > 0 && <span className="text-tea-gold text-[10px]">({moreCount})</span>}
          <ChevronDown size={12} />
        </button>
      )}

      {(showFinish || showBrewing) && (
        <div className={`flex flex-col gap-5 ${isDesktop ? 'mt-5 md:grid md:grid-cols-2 md:gap-6' : 'mt-2'}`}>
          {showFinish && <FinishZone flow={flow} />}
          {showBrewing && <BrewingZone flow={flow} />}
        </div>
      )}

      {/* Collapse "More" on mobile */}
      {!isDesktop && showMore && (
        <button
          type="button"
          onClick={() => setShowMore(false)}
          className="flex items-center justify-center gap-2 py-2 mt-1 text-xs text-tea-text-dim hover:text-tea-text-sec transition-colors"
          style={{ fontFamily: 'var(--font-body)' }}
        >
          <span>Less</span>
          <ChevronDown size={12} className="rotate-180" />
        </button>
      )}
    </div>
  );
};

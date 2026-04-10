import React from 'react';
import { X } from 'lucide-react';
import type { TastingFlowState } from './useTastingFlow';
import type { TastingData } from '../../types';
import { FlavorSplit } from './FlavorSplit';

interface FlavorSectionProps {
  flow: TastingFlowState;
  value: TastingData;
  onChange: (data: TastingData) => void;
}

const FlavorSectionInner: React.FC<FlavorSectionProps> = ({
  flow,
  value: _value,
}) => {
  const flavorCount = flow.getCategoryCount('flavor');

  const handleClearFlavor = () => flow.clearCategory('flavor');

  return (
    <div role="group" aria-label="Flavor and taste">
      <div className="flex justify-end mb-1 -mt-1">
        <button
          type="button"
          onClick={handleClearFlavor}
          className={`text-[11px] text-tea-text-dim hover:text-tea-text-sec transition-colors flex items-center gap-1 px-2 py-1 ${flavorCount > 0 ? 'visible' : 'invisible'}`}
          aria-label="Clear flavor selections"
          tabIndex={flavorCount > 0 ? 0 : -1}
        >
          <X size={10} />
          Clear
        </button>
      </div>

      {/* ── Split: family list left, sub-terms right ── */}
      <FlavorSplit
        selected={_value.flavor || []}
        onToggle={(termId) => flow.toggleTerm('flavor', termId)}
      />
    </div>
  );
};

export const FlavorSection = React.memo(FlavorSectionInner);
FlavorSection.displayName = 'FlavorSection';

import React from 'react';
import { ColorSwatches } from './ColorSwatches';
import type { TastingFlowState } from './useTastingFlow';

interface ColorZoneProps {
  flow: TastingFlowState;
}

const ColorZoneInner: React.FC<ColorZoneProps> = ({ flow }) => {
  return (
    <div role="group" aria-label="Liquor color">
      <ColorSwatches flow={flow} compact />
    </div>
  );
};

export const ColorZone = React.memo(ColorZoneInner);
ColorZone.displayName = 'ColorZone';

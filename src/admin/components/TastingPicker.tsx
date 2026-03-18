/**
 * @deprecated Use TastingFlow with mode="admin" instead.
 * Kept for backwards compatibility. Will be removed in a future update.
 */
import React from 'react';
import type { TastingData } from '../../types';
import { TastingFlow } from '../../components/tasting/TastingFlow';

interface TastingPickerProps {
  value: TastingData;
  onChange: (data: TastingData) => void;
}

export const TastingPicker: React.FC<TastingPickerProps> = ({ value, onChange }) => {
  return <TastingFlow mode="admin" value={value} onChange={onChange} />;
};

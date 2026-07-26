import React from 'react';
import { CurateActionBand, type CurateActionSpec } from './CuratePrimitives';

interface CaptureActionFooterProps {
  onBuy: () => void;
  onDone: () => void;
  onSample?: () => void;
  doneEnabled: boolean;
  buyExpanded: boolean;
  purchasePickerId: string;
  doneTestId?: string;
  className?: string;
}

export const CaptureActionFooter: React.FC<CaptureActionFooterProps> = ({
  onBuy,
  onDone,
  onSample,
  doneEnabled,
  buyExpanded,
  purchasePickerId,
  doneTestId,
  className = '',
}) => {
  const neutral: CurateActionSpec[] = [
    {
      label: 'Buy',
      onClick: onBuy,
      ariaLabel: 'Buy',
      buttonProps: {
        'aria-expanded': buyExpanded,
        'aria-controls': purchasePickerId,
      },
    },
  ];

  if (onSample) neutral.push({ label: 'Sample', onClick: onSample, ariaLabel: 'Sample' });

  return (
    <div data-testid="capture-action-footer" className={className}>
      <CurateActionBand
        neutral={neutral}
        primary={{
          label: 'Done',
          onClick: onDone,
          disabled: !doneEnabled,
          ariaLabel: 'Done, commit this entry',
          buttonProps: {
            'data-testid': doneTestId,
            'data-visual-state': doneEnabled ? 'primary' : 'disabled-neutral',
          },
        }}
      />
    </div>
  );
};

export default CaptureActionFooter;

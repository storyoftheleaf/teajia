import React from 'react';
import { ClipboardList, FlaskConical } from 'lucide-react';
import { CurateActionBand, type CurateActionSpec } from './CuratePrimitives';

interface CaptureActionFooterProps {
  onBuy: () => void;
  onDone: () => void;
  onSample?: () => void;
  doneEnabled: boolean;
  buyExpanded: boolean;
  purchasePickerId: string;
  doneTestId?: string;
  saveLabel?: string;
  className?: string;
  /** Put the save action at the right end (the 'flow' form). */
  primaryLast?: boolean;
}

export const CaptureActionFooter: React.FC<CaptureActionFooterProps> = ({
  onBuy,
  onDone,
  onSample,
  doneEnabled,
  buyExpanded,
  purchasePickerId,
  doneTestId,
  saveLabel = 'Save tea',
  className = '',
  primaryLast = false,
}) => {
  const neutral: CurateActionSpec[] = [
    {
      label: primaryLast ? 'Draft supplier order' : 'Buy',
      icon: primaryLast && <ClipboardList size={14} className="hidden shrink-0 lg:block" aria-hidden />,
      onClick: onBuy,
      buttonProps: {
        'aria-expanded': buyExpanded,
        'aria-controls': purchasePickerId,
      },
    },
  ];

  if (onSample) neutral.push(primaryLast
    ? { label: 'Record received sample', icon: <FlaskConical size={14} className="hidden shrink-0 lg:block" aria-hidden />, onClick: onSample }
    : { label: 'Sample', onClick: onSample, ariaLabel: 'Sample' });

  return (
    <CurateActionBand
      testId="capture-action-footer"
      className={className}
      neutral={neutral}
      primaryIndex={primaryLast ? undefined : 1}
      withBandChrome={false}
      primary={{
        label: primaryLast ? saveLabel : 'Done',
        onClick: onDone,
        disabled: !doneEnabled,
        ariaLabel: primaryLast ? saveLabel : 'Done, commit this entry',
        buttonProps: {
          'data-testid': doneTestId,
          'data-visual-state': doneEnabled ? 'primary' : 'disabled-neutral',
        },
      }}
    />
  );
};

export default CaptureActionFooter;

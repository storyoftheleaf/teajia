import React from 'react';

interface CaptureActionFooterProps {
  onBuy: () => void;
  onDone: () => void;
  onSample: () => void;
  doneEnabled: boolean;
  buyExpanded: boolean;
  purchasePickerId: string;
  doneTestId?: string;
  className?: string;
}

const targetClass = 'curate-action curate-compact-target font-medium';
const quietChromeClass = 'curate-compact-chrome w-full border border-tea-border bg-tea-bg text-tea-text-sec hover:bg-tea-accent-sub hover:text-tea-text';

export const CaptureActionFooter: React.FC<CaptureActionFooterProps> = ({
  onBuy,
  onDone,
  onSample,
  doneEnabled,
  buyExpanded,
  purchasePickerId,
  doneTestId,
  className = '',
}) => (
  <div data-testid="capture-action-footer" className={`grid grid-cols-3 gap-2 ${className}`}>
    <button
      type="button"
      onClick={onBuy}
      className={targetClass}
      aria-label="Buy"
      aria-expanded={buyExpanded}
      aria-controls={purchasePickerId}
      data-curate-action
      data-curate-compact-target
    >
      <span className={quietChromeClass} data-curate-compact-chrome>Buy</span>
    </button>
    <button
      type="button"
      onClick={onDone}
      disabled={!doneEnabled}
      data-testid={doneTestId}
      className={`${targetClass} disabled:cursor-not-allowed disabled:opacity-40`}
      aria-label="Done"
      data-curate-action
      data-curate-compact-target
    >
      <span className="curate-compact-chrome w-full bg-tea-gold text-tea-bg hover:bg-tea-gold-lt" data-curate-compact-chrome>Done</span>
    </button>
    <button type="button" onClick={onSample} className={targetClass} aria-label="Sample" data-curate-action data-curate-compact-target>
      <span className={quietChromeClass} data-curate-compact-chrome>Sample</span>
    </button>
  </div>
);

export default CaptureActionFooter;

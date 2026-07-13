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

const quietActionClass = 'curate-action tap-target min-h-11 rounded-md border border-tea-border bg-transparent font-medium text-tea-text-sec hover:bg-tea-accent-sub hover:text-tea-text';

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
      className={quietActionClass}
      aria-label="Buy"
      aria-expanded={buyExpanded}
      aria-controls={purchasePickerId}
      data-curate-action
    >
      Buy
    </button>
    <button
      type="button"
      onClick={onDone}
      disabled={!doneEnabled}
      data-testid={doneTestId}
      className="curate-action tap-target min-h-11 rounded-md bg-tea-gold font-medium tracking-[0.04em] text-tea-bg hover:bg-tea-gold-lt disabled:cursor-not-allowed disabled:opacity-40"
      aria-label="Done"
      data-curate-action
    >
      Done
    </button>
    <button type="button" onClick={onSample} className={quietActionClass} aria-label="Sample" data-curate-action>
      Sample
    </button>
  </div>
);

export default CaptureActionFooter;

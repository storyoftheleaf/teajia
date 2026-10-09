import React from 'react';

interface CaptureActionFooterProps {
  onBuy: () => void;
  onDone: () => void;
  onSample?: () => void;
  /** Marks the tea as passed on. */
  onPass?: () => void;
  passed?: boolean;
  doneEnabled: boolean;
  buyExpanded: boolean;
  purchasePickerId: string;
  doneTestId?: string;
  className?: string;
}

/**
 * Pass · Sample · Buy in one thin frame of Lora capitals, as TeaFace draws
 * them, and Done as a plain gold word under it. Nothing is filled.
 */
export const CaptureActionFooter: React.FC<CaptureActionFooterProps> = ({
  onBuy,
  onDone,
  onSample,
  onPass,
  passed = false,
  doneEnabled,
  buyExpanded,
  purchasePickerId,
  doneTestId,
  className = '',
}) => {
  const cells: Array<{ key: string; label: string; onClick: () => void; on?: boolean; extra?: Record<string, unknown> }> = [];
  if (onPass) cells.push({ key: 'pass', label: 'Pass', onClick: onPass, on: passed });
  if (onSample) cells.push({ key: 'sample', label: 'Sample', onClick: onSample });
  cells.push({ key: 'buy', label: 'Buy', onClick: onBuy, on: buyExpanded, extra: { 'aria-expanded': buyExpanded, 'aria-controls': purchasePickerId } });

  return (
    <div className={`curate-v2 px-4 pt-3 ${className}`} data-testid="capture-action-footer">
      <div className="grid overflow-hidden rounded border border-tea-border" style={{ gridTemplateColumns: `repeat(${cells.length}, minmax(0, 1fr))` }}>
        {cells.map((cell, i) => (
          <button
            key={cell.key}
            type="button"
            onClick={cell.onClick}
            aria-label={cell.label}
            data-curate-action
            {...(cell.extra ?? {})}
            className={`min-h-11 font-mono text-ui-11 uppercase tracking-[0.16em] transition-colors ${i ? 'border-l border-tea-border' : ''} ${
              cell.on ? 'bg-tea-gold/15 text-tea-gold' : 'text-tea-text-sec hover:text-tea-text'
            }`}
          >
            {cell.label}
          </button>
        ))}
      </div>
      <div className="flex justify-end pt-1">
        <button
          type="button"
          onClick={onDone}
          disabled={!doneEnabled}
          aria-label="Done, commit this entry"
          data-testid={doneTestId}
          data-visual-state={doneEnabled ? 'primary' : 'disabled-neutral'}
          className="curate-v2-word tap-target min-h-11 px-1 text-ui-14"
        >
          Done
        </button>
      </div>
    </div>
  );
};

export default CaptureActionFooter;

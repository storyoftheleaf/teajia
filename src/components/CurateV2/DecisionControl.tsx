import React from 'react';
import type { CompassDecision } from './types';

const OPTIONS: Array<{ value: CompassDecision; label: string }> = [
  { value: 'considering', label: 'Considering' },
  { value: 'selected', label: 'Selected' },
  { value: 'passed_on', label: 'Passed on' },
];

/**
 * Where the tea stands: three words in one thin frame, the same frame TeaFace
 * uses for Pass · Sample · Buy. The chosen word is gold.
 */
export const DecisionControl: React.FC<{
  value?: CompassDecision | null;
  onChange: (value: CompassDecision | null) => void;
  compact?: boolean;
}> = ({ value, onChange }) => (
  <div
    className="mx-4 grid grid-cols-3 overflow-hidden rounded border border-tea-border"
    role="radiogroup"
    aria-label="Sourcing decision"
    data-testid="curate-decision-control"
    data-visual-control="segmented"
  >
    {OPTIONS.map((option, i) => (
      <button
        type="button"
        role="radio"
        aria-checked={value === option.value}
        key={option.value}
        onClick={() => onChange(value === option.value ? null : option.value)}
        className={`min-h-11 min-w-0 px-1 font-mono text-ui-11 uppercase tracking-[0.12em] transition-colors ${i ? 'border-l border-tea-border' : ''} ${
          value === option.value ? 'bg-tea-gold/15 text-tea-gold' : 'text-tea-text-sec hover:text-tea-text'
        }`}
        data-curate-action
      >
        <span data-decision-rail className="block truncate">{option.label}</span>
      </button>
    ))}
  </div>
);

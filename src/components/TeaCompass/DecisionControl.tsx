import React from 'react';
import type { CompassDecision } from './types';

const OPTIONS: Array<{ value: CompassDecision; label: string }> = [
  { value: 'considering', label: 'Considering' },
  { value: 'selected', label: 'Selected' },
  { value: 'passed_on', label: 'Passed on' },
];

export const DecisionControl: React.FC<{
  value?: CompassDecision | null;
  onChange: (value: CompassDecision | null) => void;
  compact?: boolean;
}> = ({ value, onChange, compact = false }) => (
  <fieldset>
    <legend className="curate-support mb-2 text-tea-text-dim">
      Sourcing decision
    </legend>
    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Sourcing decision">
      {OPTIONS.map((option) => (
        <button
          type="button"
          role="radio"
          aria-checked={value === option.value}
          key={option.value}
          onClick={() => onChange(value === option.value ? null : option.value)}
          className={`curate-support tap-target inline-flex min-h-11 items-center rounded-md border px-3 transition-colors ${
            value === option.value
              ? 'border-tea-gold bg-tea-accent-sub text-tea-text'
              : 'border-tea-border bg-tea-bg text-tea-text-sec hover:bg-tea-accent-sub'
          } ${compact ? 'flex-1 justify-center' : ''}`}
          data-curate-action
        >
          {option.label}
        </button>
      ))}
    </div>
  </fieldset>
);

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
  <div className="flex min-w-0 items-center gap-1.5" role="group" aria-label="Decision">
    <span className="curate-inline-label shrink-0">
      Decision
    </span>
    <div className="flex min-w-0 flex-1 items-center" role="radiogroup" aria-label="Sourcing decision">
      {OPTIONS.map((option) => (
        <button
          type="button"
          role="radio"
          aria-checked={value === option.value}
          key={option.value}
          onClick={() => onChange(value === option.value ? null : option.value)}
          className={`curate-compact-target min-w-0 flex-1 ${compact ? 'justify-center' : ''}`}
          data-curate-action
          data-curate-compact-target
        >
          <span
            className={`curate-compact-chrome curate-support w-full whitespace-nowrap border-b transition-colors ${
              value === option.value
                ? 'border-tea-gold bg-tea-accent-sub text-tea-text'
                : 'border-transparent text-tea-text-sec hover:text-tea-text'
            }`}
            data-curate-compact-chrome
          >
            {option.label}
          </span>
        </button>
      ))}
    </div>
  </div>
);

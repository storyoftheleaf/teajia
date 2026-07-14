import React from 'react';
import { Check } from 'lucide-react';
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
  <div
    className="curate-decision-control flex min-w-0 items-center"
    role="radiogroup"
    aria-label="Sourcing decision"
    data-testid="curate-decision-control"
    data-visual-control="segmented"
  >
      {OPTIONS.map((option) => (
        <button
          type="button"
          role="radio"
          aria-checked={value === option.value}
          key={option.value}
          onClick={() => onChange(value === option.value ? null : option.value)}
          className={`curate-decision-option curate-compact-target min-w-0 flex-1 ${compact ? 'justify-center' : ''}`}
          data-curate-action
          data-curate-compact-target
        >
          <span
            className={`curate-compact-chrome curate-support w-full whitespace-nowrap transition-colors ${
              value === option.value
                ? 'bg-tea-accent-sub text-tea-text'
                : 'text-tea-text-sec hover:text-tea-text'
            }`}
            data-curate-compact-chrome
            data-decision-rail
          >
            {value === option.value && (
              <span data-selected-marker className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border border-tea-gold" aria-hidden>
                <Check size={9} strokeWidth={2.5} />
              </span>
            )}
            {option.label}
          </span>
        </button>
      ))}
  </div>
);

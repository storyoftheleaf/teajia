import React, { useState } from 'react';
import { Check } from 'lucide-react';
import type { DiscoveryDisplay, DiscoveryOption } from './types';

interface OptionCardProps {
  option: DiscoveryOption;
  display: DiscoveryDisplay;
  selected: boolean;
  onSelect: () => void;
}

/**
 * One option in the discovery flow. Handles all three visual modes
 * (text / icon / swatch), the selected state, and a non-blocking
 * "What's this?" expander that teaches without forcing a tap.
 *
 * The card itself is the select button; the learn-more toggle is a sibling
 * (never nested inside the button) so the markup stays valid.
 */
export const OptionCard: React.FC<OptionCardProps> = ({ option, display, selected, onSelect }) => {
  const [showLearnMore, setShowLearnMore] = useState(false);
  const Icon = option.icon;

  return (
    <div
      className={`rounded-xl border transition-colors duration-200 ${
        selected
          ? 'border-tea-gold bg-tea-gold/8'
          : 'border-tea-border bg-tea-surface hover:border-tea-gold/40 hover:bg-tea-elevated'
      }`}
    >
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={selected}
        className="flex w-full items-center gap-3.5 rounded-xl p-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus-visible:ring-offset-1"
      >
        {display === 'icon' && Icon && (
          <span className={`shrink-0 ${selected ? 'text-tea-gold' : 'text-tea-text-sec'}`}>
            <Icon className="h-9 w-9" />
          </span>
        )}
        {display === 'swatch' && (
          <span
            className="h-9 w-9 shrink-0 rounded-full border border-tea-border"
            style={{ backgroundColor: option.swatch }}
            aria-hidden="true"
          />
        )}
        <span className="min-w-0 flex-1 font-body text-ui-15 leading-snug text-tea-text">
          {option.label}
        </span>
        <span
          className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border transition-colors ${
            selected ? 'border-tea-gold bg-tea-gold text-tea-bg' : 'border-tea-border text-transparent'
          }`}
          aria-hidden="true"
        >
          <Check className="h-3 w-3" strokeWidth={3} />
        </span>
      </button>

      {option.learnMore && (
        <div className="px-4 pb-3">
          <button
            type="button"
            onClick={() => setShowLearnMore((v) => !v)}
            aria-expanded={showLearnMore}
            className="tap-target font-sans text-ui-12 tracking-[0.04em] text-tea-text-sec underline decoration-tea-border underline-offset-[3px] transition-colors hover:text-tea-text hover:decoration-tea-gold/40"
          >
            {showLearnMore ? 'Hide' : "What’s this?"}
          </button>
          {showLearnMore && (
            <p className="mt-2 font-body text-ui-13 leading-relaxed text-tea-text-sec">
              {option.learnMore}
            </p>
          )}
        </div>
      )}
    </div>
  );
};

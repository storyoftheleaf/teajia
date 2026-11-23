import { ChevronLeft, ChevronRight } from 'lucide-react';
import { TYPOGRAPHY_CLASSES } from '../../designTokens';

export interface TastingSequence {
  index: number;
  count: number;
  onSelect: (index: number) => void;
  itemLabel?: 'Tea' | 'Tasting';
}

export function TastingSequenceNav({ sequence, disabled }: {
  sequence?: TastingSequence;
  disabled?: boolean;
}) {
  if (!sequence || sequence.count < 2) return null;
  const label = sequence.itemLabel ?? 'Tea';
  return (
    <nav aria-label="Browse tastings" className="flex items-center justify-between">
      <button type="button" className="btn-icon" aria-label={`Previous ${label.toLowerCase()}`}
        disabled={disabled || sequence.index === 0} onClick={() => sequence.onSelect(sequence.index - 1)}>
        <ChevronLeft aria-hidden="true" />
      </button>
      <span className={TYPOGRAPHY_CLASSES.accountMeta}>{label} {sequence.index + 1} of {sequence.count}</span>
      <button type="button" className="btn-icon" aria-label={`Next ${label.toLowerCase()}`}
        disabled={disabled || sequence.index === sequence.count - 1} onClick={() => sequence.onSelect(sequence.index + 1)}>
        <ChevronRight aria-hidden="true" />
      </button>
    </nav>
  );
}

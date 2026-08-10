import { ArrowRight } from 'lucide-react';
import { BODY } from '../shared/typeRoles';
import type { TeaFinderIntent } from './teaShopView';

interface TeaFinderProps {
  onChoose: (intent: TeaFinderIntent) => void;
}

const FINDER_CHOICES: ReadonlyArray<{ intent: TeaFinderIntent; label: string }> = [
  { intent: 'light-fragrant', label: 'Light and fragrant' },
  { intent: 'grounding-deep', label: 'Grounding and deep' },
  { intent: 'clear-focused', label: 'Clear and focused' },
  { intent: 'all', label: 'Open all teas' },
];

export function TeaFinder({ onChoose }: TeaFinderProps) {
  return (
    <div className="w-full border-t border-tea-border">
      {FINDER_CHOICES.map(choice => (
        <button
          key={choice.intent}
          type="button"
          onClick={() => onChoose(choice.intent)}
          className={`${BODY} group flex min-h-[56px] w-full items-center justify-between gap-4 border-b border-tea-border py-4 text-left text-tea-text transition-colors hover:text-tea-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50`}
        >
          <span>{choice.label}</span>
          <ArrowRight
            aria-hidden="true"
            className="h-4 w-4 shrink-0 text-tea-text-sec transition-colors group-hover:text-tea-gold"
            strokeWidth={1.5}
          />
        </button>
      ))}
    </div>
  );
}

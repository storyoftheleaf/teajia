import React from 'react';
import { Icons } from '../Icons';

interface PreviewTerm {
  id: string;
  term: string;
  definition: string;
  categoryLabel: string;
}

interface TermPreviewListProps {
  terms: PreviewTerm[];
  onViewAll: () => void;
  viewAllLabel?: string;
  className?: string;
}

export const TermPreviewList: React.FC<TermPreviewListProps> = ({
  terms,
  onViewAll,
  viewAllLabel = 'View Full Glossary',
  className = '',
}) => {
  return (
    <div className={className}>
      <div className="divide-y divide-tea-border">
        {terms.map((term) => (
          <div key={term.id} className="py-4 md:py-5">
            <div className="flex items-center justify-between gap-3 mb-1.5">
              <h4 className="font-serif text-base text-tea-text leading-snug font-medium">
                {term.term}
              </h4>
              <span className="flex-shrink-0 text-[10px] tracking-wider text-tea-gold-dark/70 font-sans border border-tea-border px-2 py-0.5 rounded-sm">
                {term.categoryLabel}
              </span>
            </div>
            <p className="text-sm text-tea-text/50 leading-relaxed line-clamp-2">
              &ldquo;{term.definition}&rdquo;
            </p>
          </div>
        ))}
      </div>
      <button
        onClick={onViewAll}
        className="mt-4 text-tea-gold-dark text-sm font-sans flex items-center gap-1 hover:opacity-80 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 rounded-sm"
      >
        {viewAllLabel}
        <Icons.ChevronRight className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};

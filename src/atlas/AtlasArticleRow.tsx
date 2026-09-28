import React from 'react';
import { Link } from 'react-router-dom';
import { ATLAS_ROOT } from './AtlasFrame';

/**
 * One article in a list, set like a contents page: the title, the quiet facts
 * under it, and the printed pages at the right edge where the eye can run down
 * them. Rows are ruled with a hairline, not boxed, and nothing washes on hover.
 */
export const AtlasArticleRow: React.FC<{
  id: string;
  title: string;
  author?: string;
  pages?: string;
  issueLabel?: string;
  current?: boolean;
  compact?: boolean;
}> = ({ id, title, author, pages, issueLabel, current = false, compact = false }) => {
  const facts = [author, issueLabel].filter(Boolean).join(' · ');
  const page = pages && pages !== '0' ? pages : '';
  return (
    <li className="border-b border-tea-border last:border-b-0">
      <Link
        to={`${ATLAS_ROOT}/read/${id}`}
        aria-current={current ? 'page' : undefined}
        className={`group grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-6 ${compact ? 'py-2.5' : 'py-3.5 md:py-4'}`}
      >
        <span className="min-w-0">
          <span
            className={`block font-display leading-[1.3] transition-colors ${
              compact ? 'text-ui-16' : 'text-ui-17 md:text-[19px]'
            } ${current ? 'text-tea-gold' : 'text-tea-text group-hover:text-tea-gold-lt'}`}
          >
            {title}
          </span>
          {facts && !compact && (
            <span className="block font-body text-ui-13 text-tea-text-sec mt-1">{facts}</span>
          )}
        </span>
        {page && (
          <span className="font-body text-ui-13 text-tea-text-dim tabular-nums whitespace-nowrap">
            <span className="sr-only">Pages </span>{page}
          </span>
        )}
      </Link>
    </li>
  );
};

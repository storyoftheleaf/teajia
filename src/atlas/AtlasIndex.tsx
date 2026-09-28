import React from 'react';
import { Link } from 'react-router-dom';
import { ATLAS_ROOT } from './atlasPaths';
import type { AtlasTopic } from './types';

// Topics are the way into the Atlas: every one, grouped by category, set to be
// taken in at a glance, because someone opening the library usually knows what
// they want and should reach it in one click, not a scroll.

function byCategory(topics: AtlasTopic[]): Array<[string, AtlasTopic[]]> {
  const groups = new Map<string, AtlasTopic[]>();
  for (const t of topics) {
    if (!groups.has(t.category)) groups.set(t.category, []);
    groups.get(t.category)!.push(t);
  }
  return [...groups];
}

/** Every topic, grouped by category, packed into columns. `large` is the home page's setting. */
export const TopicIndex: React.FC<{
  topics: AtlasTopic[];
  currentId?: string;
  onPick?: () => void;
  large?: boolean;
  className?: string;
}> = ({ topics, currentId, onPick, large = false, className = 'columns-2 lg:columns-3 gap-x-8' }) => (
  // Columns rather than a grid, so short and long categories pack without
  // leaving holes under the short ones.
  <div className={className}>
    {byCategory(topics).map(([category, list]) => (
      <div key={category} className={`break-inside-avoid ${large ? 'mb-7' : 'mb-5'}`}>
        <h3 className={`font-display text-tea-text pb-1 mb-1 border-b border-tea-border ${large ? 'text-ui-20' : 'text-ui-17'}`}>{category}</h3>
        <ul>
          {list.map(t => (
            <li key={t.id}>
              <Link
                to={`${ATLAS_ROOT}/topic/${t.id}`}
                onClick={onPick}
                aria-current={t.id === currentId ? 'page' : undefined}
                className={`group flex items-baseline justify-between gap-3 font-body leading-[1.45] transition-colors ${
                  large ? 'py-1 text-ui-16' : 'py-[3px] text-ui-14'
                } ${t.id === currentId ? 'text-tea-gold' : 'text-tea-text-sec hover:text-tea-text'}`}
              >
                <span className="min-w-0">{t.name}</span>
                <span className="text-ui-12 text-tea-text-dim tabular-nums">
                  <span className="sr-only">, </span>{t.count}<span className="sr-only"> articles</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    ))}
  </div>
);

import React from 'react';
import { Link } from 'react-router-dom';
import { ATLAS_ROOT } from './atlasPaths';
import { useAtlasJson } from './useAtlas';
import type { AtlasSource, AtlasTopic } from './types';

// The two ways into the library besides search: every topic, and every issue.
// Both are set to be taken in at a glance, because someone opening the Atlas
// usually knows what they want and should reach it in one click, not a scroll.

function byCategory(topics: AtlasTopic[]): Array<[string, AtlasTopic[]]> {
  const groups = new Map<string, AtlasTopic[]>();
  for (const t of topics) {
    if (!groups.has(t.category)) groups.set(t.category, []);
    groups.get(t.category)!.push(t);
  }
  return [...groups];
}

/** Every topic, grouped by category, packed into columns. */
export const TopicIndex: React.FC<{ topics: AtlasTopic[]; currentId?: string; onPick?: () => void; className?: string }> = ({
  topics, currentId, onPick, className = 'columns-2 lg:columns-3 gap-x-8',
}) => (
  // Columns rather than a grid, so short and long categories pack without
  // leaving holes under the short ones.
  <div className={className}>
    {byCategory(topics).map(([category, list]) => (
      <div key={category} className="break-inside-avoid mb-5">
        <h3 className="font-display text-ui-17 text-tea-text pb-1 mb-1 border-b border-tea-border">{category}</h3>
        <ul>
          {list.map(t => (
            <li key={t.id}>
              <Link
                to={`${ATLAS_ROOT}/topic/${t.id}`}
                onClick={onPick}
                aria-current={t.id === currentId ? 'page' : undefined}
                className={`group flex items-baseline justify-between gap-3 py-[3px] font-body text-ui-14 leading-[1.45] transition-colors ${
                  t.id === currentId ? 'text-tea-gold' : 'text-tea-text-sec hover:text-tea-text'
                }`}
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

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** "February 2012" → 1. Anything that is not a plain month name → -1. */
function monthIndex(label: string): number {
  const word = label.trim().split(/\s+/)[0]?.toLowerCase() ?? '';
  return MONTHS.findIndex(m => m.toLowerCase() === word);
}

/**
 * Every issue of a source on one calendar: a row per year, the months across,
 * so the same month stacks in one column and any issue is one click away.
 * An issue that is not a plain month (a special edition) is listed after its
 * year's months instead of being forced into a column.
 */
export const IssueCalendar: React.FC<{ sourceId: string; currentIssue?: string; onPick?: () => void }> = ({ sourceId, currentIssue, onPick }) => {
  const load = useAtlasJson<AtlasSource>(`sources/${sourceId}.json`);
  if (load.state !== 'ready') {
    return load.state === 'loading'
      ? <p className="font-body text-ui-14 italic text-tea-text-dim">Opening…</p>
      : null;
  }
  const cell = (issue: { id: string; label: string; count: number }, month: number, abbr: string) => (
    <Link
      to={`${ATLAS_ROOT}/issue/${issue.id}`}
      onClick={onPick}
      title={`${issue.label}, ${issue.count} articles`}
      aria-label={`${issue.label}, ${issue.count} articles`}
      aria-current={issue.id === currentIssue ? 'page' : undefined}
      className={`flex h-8 items-center justify-center font-body text-ui-13 transition-colors ${
        issue.id === currentIssue
          ? 'text-tea-gold'
          : 'text-tea-text-sec hover:text-tea-text hover:bg-tea-elevated/60'
      }`}
    >
      <span className="sm:hidden tabular-nums">{month}</span>
      <span className="hidden sm:inline">{abbr}</span>
    </Link>
  );
  return (
    <div role="group" aria-label={`${load.data.source.name}, every issue by year and month`}>
      {/* Month letters head the columns on a phone, where each cell is only
          a number; wider screens spell the month in the cell itself. */}
      <div aria-hidden className="grid grid-cols-[2.75rem_repeat(12,minmax(0,1fr))] pb-1 mb-1 border-b border-tea-border sm:hidden">
        <span />
        {MONTHS.map(m => (
          <span key={m} className="text-center font-body text-ui-12 text-tea-text-dim">{m.charAt(0)}</span>
        ))}
      </div>
      {load.data.years.map(({ year, issues }) => {
        const byMonth = new Map<number, (typeof issues)[number]>();
        const extras: typeof issues = [];
        for (const issue of issues) {
          const m = monthIndex(issue.label);
          if (m >= 0 && !byMonth.has(m)) byMonth.set(m, issue);
          else extras.push(issue);
        }
        return (
          <div key={year}>
            <div className="grid grid-cols-[2.75rem_repeat(12,minmax(0,1fr))] items-center sm:pt-0">
              <span className="font-display text-ui-16 text-tea-text tabular-nums">{year}</span>
              {MONTHS.map((m, i) => {
                const issue = byMonth.get(i);
                return issue
                  ? <React.Fragment key={m}>{cell(issue, i + 1, m.slice(0, 3))}</React.Fragment>
                  : <span key={m} aria-hidden />;
              })}
            </div>
            {extras.length > 0 && (
              <div className="flex flex-wrap gap-x-4 pl-[2.75rem]">
                {extras.map(issue => (
                  <Link
                    key={issue.id}
                    to={`${ATLAS_ROOT}/issue/${issue.id}`}
                    onClick={onPick}
                    className="py-1 font-body text-ui-13 text-tea-text-sec hover:text-tea-text transition-colors"
                  >
                    {issue.label}
                  </Link>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

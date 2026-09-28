import React, { useState } from 'react';
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

type IssueSummary = AtlasSource['years'][number]['issues'][number];

/**
 * Every issue of a source.
 *
 * On a wider screen it is a calendar: a row per year, the months spelled
 * across, so the same month stacks in one column and any issue is one click
 * away. On a phone there is no room for twelve words in a row, and a grid of
 * marks or numbers reads as a spreadsheet, so the years are a line of words
 * and the chosen year's months are listed under it by name.
 *
 * An issue that is not a plain month (a special edition) is listed after its
 * year's months instead of being forced into a column.
 */
export const IssueCalendar: React.FC<{ sourceId: string; currentIssue?: string; onPick?: () => void }> = ({ sourceId, currentIssue, onPick }) => {
  const load = useAtlasJson<AtlasSource>(`sources/${sourceId}.json`);
  const [picked, setPicked] = useState<string | null>(null);
  if (load.state !== 'ready') {
    return load.state === 'loading'
      ? <p className="font-body text-ui-14 italic text-tea-text-dim">Opening…</p>
      : null;
  }
  const years = load.data.years;
  const hereYear = years.find(y => y.issues.some(i => i.id === currentIssue))?.year;
  const openYear = picked ?? hereYear ?? years[years.length - 1]?.year;
  const open = years.find(y => y.year === openYear);

  const issueLink = (issue: IssueSummary, text: string, className: string) => (
    <Link
      key={issue.id}
      to={`${ATLAS_ROOT}/issue/${issue.id}`}
      onClick={onPick}
      title={`${issue.label}, ${issue.count} articles`}
      aria-label={`${issue.label}, ${issue.count} articles`}
      aria-current={issue.id === currentIssue ? 'page' : undefined}
      className={`${className} font-body transition-colors ${
        issue.id === currentIssue ? 'text-tea-gold' : 'text-tea-text-sec hover:text-tea-text'
      }`}
    >
      {text}
    </Link>
  );

  return (
    <div role="group" aria-label={`${load.data.source.name}, every issue by year and month`}>
      {/* Phone: the years, then the chosen year's months by name. */}
      <div className="sm:hidden">
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {years.map(({ year }) => (
            <button
              key={year}
              type="button"
              aria-expanded={year === openYear}
              onClick={() => setPicked(year)}
              className={`tap-target py-1 font-display text-ui-17 tabular-nums underline-offset-[6px] transition-colors ${
                year === openYear ? 'text-tea-text underline decoration-tea-gold' : 'text-tea-text-sec hover:text-tea-text'
              }`}
            >
              {year}
            </button>
          ))}
        </div>
        {open && (
          <div className="flex flex-wrap gap-x-5 gap-y-1 mt-3 pt-3 border-t border-tea-border">
            {open.issues.map(issue => issueLink(
              issue,
              issue.label.replace(new RegExp(`\\s*${open.year}$`), '') || issue.label,
              'py-1.5 text-ui-15',
            ))}
          </div>
        )}
      </div>

      {/* Wider screens: the calendar. */}
      <div className="hidden sm:block">
        {years.map(({ year, issues }) => {
          const byMonth = new Map<number, IssueSummary>();
          const extras: IssueSummary[] = [];
          for (const issue of issues) {
            const m = monthIndex(issue.label);
            if (m >= 0 && !byMonth.has(m)) byMonth.set(m, issue);
            else extras.push(issue);
          }
          return (
            <div key={year}>
              <div className="grid grid-cols-[2.75rem_repeat(12,minmax(0,1fr))] items-center">
                <span className="font-display text-ui-16 text-tea-text tabular-nums">{year}</span>
                {MONTHS.map((m, i) => {
                  const issue = byMonth.get(i);
                  return issue
                    ? issueLink(issue, m.slice(0, 3), 'flex h-8 items-center justify-center text-ui-13 hover:bg-tea-elevated/60')
                    : <span key={m} aria-hidden />;
                })}
              </div>
              {extras.length > 0 && (
                <div className="flex flex-wrap gap-x-4 pl-[2.75rem]">
                  {extras.map(issue => issueLink(issue, issue.label, 'py-1 text-ui-13'))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

import React from 'react';
import { getAuthorship, type AuthorshipRung } from '../../../wisdom/authorship';

/**
 * Authorship rung, shown in a row ONLY when it differs from the default.
 *
 * Every entry in the base is drafted today. A word repeated on all 79 rows
 * carries no information and costs a whole column, so the row stays silent at
 * the default and the count line says the shape of it once ("All 79 drafted,
 * none reviewed"). The moment a record is actually reviewed or authored, the
 * row starts speaking. Detail panels always say it in full, where it matters.
 */

const RUNG_LABEL: Record<AuthorshipRung, string> = {
  drafted: 'Drafted',
  reviewed: 'Reviewed',
  authored: 'Authored',
};

// Background tint only, never a border. Reviewed is quiet; authored, the rare
// top rung in Adrian's own words, is the only one that earns gold.
const RUNG_CLASS: Record<AuthorshipRung, string> = {
  drafted: '',
  reviewed: 'bg-tea-accent-sub text-tea-text-sec',
  authored: 'bg-tea-gold/10 text-tea-gold font-semibold',
};

/** Renders nothing for the default rung. That silence is the point. */
export const RungTag: React.FC<{ id: string | null | undefined }> = ({ id }) => {
  const { rung } = getAuthorship(id);
  if (rung === 'drafted') return null;
  return (
    <span
      className={`shrink-0 rounded-full px-1.5 py-px text-ui-9 uppercase tracking-[0.08em] whitespace-nowrap ${RUNG_CLASS[rung]}`}
    >
      {RUNG_LABEL[rung]}
    </span>
  );
};

/**
 * The one line that replaces the repeated column. Plain sentence case: a count
 * is not a label, so it never wears micro-caps.
 */
export function rungSummary(ids: readonly string[]): string {
  const counts: Record<AuthorshipRung, number> = { drafted: 0, reviewed: 0, authored: 0 };
  for (const id of ids) counts[getAuthorship(id).rung] += 1;
  if (counts.reviewed === 0 && counts.authored === 0) {
    return `all ${counts.drafted} drafted, none reviewed`;
  }
  return (['drafted', 'reviewed', 'authored'] as const)
    .filter(rung => counts[rung] > 0)
    .map(rung => `${counts[rung]} ${rung}`)
    .join(', ');
}

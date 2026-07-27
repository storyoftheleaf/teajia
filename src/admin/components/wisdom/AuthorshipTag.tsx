import React from 'react';
import { getAuthorship, type AuthorshipRung } from '../../../wisdom/authorship';

// Compact rung label shown in list rows. The full sentence (authorshipLine)
// belongs in detail panels; this is the scannable badge for a row.

const RUNG_LABEL: Record<AuthorshipRung, string> = {
  drafted: 'Drafted',
  reviewed: 'Reviewed',
  authored: 'Authored',
};

// Drafted (almost everything today) reads understated. Authored, the rare
// top rung in Adrian's own words, is the only one that earns gold.
const RUNG_CLASS: Record<AuthorshipRung, string> = {
  drafted: 'text-tea-text-dim',
  reviewed: 'text-tea-text-sec',
  authored: 'text-tea-gold font-semibold',
};

interface Props {
  id: string | null | undefined;
  className?: string;
}

export const AuthorshipTag: React.FC<Props> = ({ id, className = '' }) => {
  const { rung } = getAuthorship(id);
  return (
    <span className={`text-ui-10 uppercase tracking-[0.08em] whitespace-nowrap ${RUNG_CLASS[rung]} ${className}`}>
      {RUNG_LABEL[rung]}
    </span>
  );
};

import React from 'react';
import { Link } from 'react-router-dom';
import { ATLAS_ROOT } from './AtlasFrame';

/** One article in a list: title, then the quiet facts underneath. */
export const AtlasArticleRow: React.FC<{
  id: string;
  title: string;
  author?: string;
  pages?: string;
  issueLabel?: string;
  current?: boolean;
}> = ({ id, title, author, pages, issueLabel, current = false }) => {
  const facts = [
    author,
    issueLabel,
    pages && pages !== '0' ? `p. ${pages}` : '',
  ].filter(Boolean).join(' · ');
  return (
    <li>
      <Link
        to={`${ATLAS_ROOT}/read/${id}`}
        aria-current={current ? 'page' : undefined}
        className="block py-3 -mx-3 px-3 rounded-[2px] hover:bg-tea-elevated/40 transition-colors"
      >
        <div className={`font-display text-ui-17 leading-[1.35] ${current ? 'text-tea-gold' : 'text-tea-text'}`}>{title}</div>
        {facts && <div className="text-ui-13 text-tea-text-sec mt-0.5">{facts}</div>}
      </Link>
    </li>
  );
};

/**
 * The Wisdom pages a published article draws on, at the foot of the reader.
 * Read from the article's own `wisdom_claim_uses` (the public article response
 * carries them), so it costs no extra request. Public pages only: the reader
 * is public, and a draft Wisdom page would answer not found.
 */
import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { wisdomDestinations } from './articleClaimUses';
import { useWisdomPilotData } from './wisdomPilotData';

export const ArticleWisdomLinks: React.FC<{ uses?: readonly { claim_id: string }[] | null }> = ({ uses }) => {
  const data = useWisdomPilotData();
  const destinations = useMemo(
    () => (data && uses?.length ? wisdomDestinations(uses.map(use => use.claim_id), data.pages, false) : []),
    [data, uses],
  );
  if (destinations.length === 0) return null;
  return (
    <nav aria-labelledby="article-wisdom-links" className="mx-auto max-w-[66ch] px-4 py-10 border-t border-tea-border" data-article-wisdom-links>
      <h2 id="article-wisdom-links" className="text-ui-11 uppercase tracking-[0.2em] text-tea-text-sec">In the Wisdom pages</h2>
      <ul className="mt-3 flex flex-wrap gap-x-6 gap-y-2 list-none m-0 p-0">
        {destinations.map(destination => (
          <li key={destination.pageId}>
            <Link to={destination.href} className="tap-target inline-flex items-center text-ui-15 text-tea-gold-lt underline underline-offset-4">
              {destination.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
};

export default ArticleWisdomLinks;

import React from 'react';
import type { Story } from '../../../types';
import { useNavigate } from 'react-router-dom';
import type { InventoryItem } from '../../../types';
import { BODY, LABEL } from '../../shared/typeRoles';

interface AlcoveJournalSectionProps {
  relatedArticles: Story[];
  item: InventoryItem;
}

/**
 * Editorial links related to the product. A single section avoids competing
 * "From the journal" affordances with different click behavior.
 *
 * The hover colour used to be applied by reaching into the DOM on mouseenter
 * and writing `style.color` on a child span, which is a colour the lint cannot
 * see, cannot be reached by a keyboard, and does not exist on a phone. It is a
 * `group-hover` now, so hover and focus say the same thing.
 */
export const AlcoveJournalSection: React.FC<AlcoveJournalSectionProps> = ({
  relatedArticles,
  item,
}) => {
  const navigate = useNavigate();

  if (relatedArticles.length === 0 && item.category !== 'tea') return null;

  return (
    <div className="alcove-body-section mt-7 pb-5">
      <div className="border-t border-tea-border pt-3">
        {relatedArticles.length > 0 && (
          <>
            <p className={`${LABEL} mb-1.5 mt-0 text-tea-text-dim`}>From the journal</p>
            {relatedArticles.map(article => (
              <button
                key={article.id}
                type="button"
                onClick={() => {
                  window.dispatchEvent(new CustomEvent('openArticle', { detail: { story: article } }));
                }}
                className="group flex w-full min-h-[44px] items-start justify-between gap-2 border-none bg-transparent py-1.5 text-left"
              >
                <span className={`${BODY} text-tea-text transition-colors group-hover:text-tea-gold group-focus-visible:text-tea-gold`}>
                  {article.title}
                </span>
                <span className={`${BODY} shrink-0 text-tea-text-dim`}>&rarr;</span>
              </button>
            ))}
          </>
        )}

        {item.category === 'tea' && (
          <button
            type="button"
            onClick={() => navigate('/craft')}
            className={`alcove-learn-link group flex w-full items-center gap-1.5 border-none bg-transparent text-left ${relatedArticles.length > 0 ? 'pt-2' : 'pt-1'}`}
          >
            <span className={`${BODY} text-tea-text-sec transition-colors group-hover:text-tea-gold group-focus-visible:text-tea-gold`}>
              Learn about {item.type ? item.type.toLowerCase() : ''} tea &rarr;
            </span>
          </button>
        )}
      </div>
    </div>
  );
};

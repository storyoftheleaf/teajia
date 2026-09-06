import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { ProductEvent } from '../../../hooks/useProductEvents';
import { AlcoveSectionHeading } from './AlcoveSectionHeading';

interface AlcoveTableSectionProps {
  events: ProductEvent[];
  relatedArticles: Array<{ id: string; slug: string; title: string; subtitle?: string | null; author_name?: string | null }>;
  tastingCount: number;
}

const RowText: React.FC<{ title: string; meta: string }> = ({ title, meta }) => (
  <span className="min-w-0 flex-1">
    <span className="alcove-row-title block font-body text-[13.5px] leading-[1.4] text-tea-text">
      {title}
    </span>
    <span className="mt-0.5 block font-sans text-ui-10 uppercase tracking-[0.1em] text-tea-text-dim">
      {meta}
    </span>
  </span>
);

/**
 * "From the table" gathers what has already happened around this tea: event
 * rows, journal rows, and the personal tasting-count line. Renders only when
 * any of that exists. No thumbnails, text rows only.
 *
 * The promoted customer quote used to lead this section. It reads as a curated
 * review, so it belongs on the tea's record beside the shop's own note, under
 * the one rule that separates terms from sentences, rather than half a page
 * lower among the events it was never part of.
 */
export const AlcoveTableSection: React.FC<AlcoveTableSectionProps> = ({
  events,
  relatedArticles,
  tastingCount,
}) => {
  const navigate = useNavigate();

  const hasRows = events.length > 0 || relatedArticles.length > 0;

  if (!hasRows && tastingCount === 0) return null;

  return (
    <section aria-label="From the table">
      <AlcoveSectionHeading label="From the table" className="mx-5 mb-3 mt-[22px]" />

      {hasRows && (
        <div className="mx-5">
          {events.map(evt => {
            const eventDate = new Date(evt.event_date);
            const formattedDate = eventDate.toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            });
            const meta = `${formattedDate}${evt.location_name ? ` · ${evt.location_name}` : ''}`;
            return (
              <button
                key={evt.id}
                type="button"
                className="alcove-row-btn"
                onClick={() => navigate(`/event/${evt.slug}`)}
              >
                <RowText title={evt.title} meta={meta} />
                <span aria-hidden="true" className="alcove-row-go">→</span>
              </button>
            );
          })}
          {relatedArticles.map(article => (
            <Link
              key={article.id}
              to={`/article/${encodeURIComponent(article.slug)}`}
              className="alcove-row-btn"
            >
              <RowText title={article.title} meta={article.author_name ? `From the journal · ${article.author_name}` : 'From the journal'} />
              <span aria-hidden="true" className="alcove-row-go">→</span>
            </Link>
          ))}
        </div>
      )}

      {/* Personal tasting count: quiet centered line linking to the journal */}
      {tastingCount > 0 && (
        <div className={`flex justify-center ${hasRows ? 'mt-2' : ''}`}>
          <button
            type="button"
            onClick={() => navigate('/account?tab=journal')}
            className="tap-target group flex items-center gap-2 px-3"
          >
            <span
              aria-hidden="true"
              className="inline-block h-[5px] w-[5px] shrink-0 rounded-full"
              style={{ background: 'var(--tea-leaf)' }}
            />
            <span className="font-sans text-ui-9 uppercase tracking-[0.16em] text-tea-text-dim transition-colors group-hover:text-tea-text-sec">
              Tasted {tastingCount} {tastingCount === 1 ? 'time' : 'times'} · Your journal
            </span>
          </button>
        </div>
      )}
    </section>
  );
};

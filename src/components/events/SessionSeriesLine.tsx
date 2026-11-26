// Launch 5, M4: a session's circle or series, on its public page. The name,
// and for a series, its other sessions anyone may find, each by name and day.
// Never an address, never how many times it has met, never who came.
import { Link } from 'react-router-dom';
import { TYPOGRAPHY_CLASSES } from '../../designTokens';
import { circlesOpen, type PublicSeries } from '../../lib/circles';

function isPublicSeries(value: unknown): value is PublicSeries {
  const series = value as PublicSeries | null;
  return Boolean(series && typeof series.name === 'string' && (series.kind === 'circle' || series.kind === 'series')
    && Array.isArray(series.others));
}

function sessionDay(eventDate: string): string {
  const at = new Date(eventDate);
  return Number.isNaN(at.getTime()) ? eventDate : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(at);
}

export function SessionSeriesLine({ series }: { series: unknown }) {
  if (!circlesOpen() || !isPublicSeries(series)) return null;
  return (
    <div className={`${TYPOGRAPHY_CLASSES.body} mb-6 flex flex-col items-center gap-1 text-tea-text-sec`} data-testid="session-series">
      <p className="break-words">{series.kind === 'series' ? 'Part of the series' : 'A table of'} {series.name}</p>
      {series.kind === 'series' && series.others.length > 0 && (
        <ul className="flex flex-col items-center gap-1">
          {series.others.map(other => (
            <li key={other.slug} className="break-words">
              <Link className="tap-target inline-flex items-center text-tea-gold hover:text-tea-gold-lt" to={`/event/${encodeURIComponent(other.slug)}`}>
                {other.title}, {sessionDay(other.event_date)}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

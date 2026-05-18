import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight } from 'lucide-react';
import { api } from '../lib/api';
import type { TeaEvent } from '../types/events';
import { PageHeader } from '../components/shared/PageHeader';

// ── Date helpers ─────────────────────────────────────────────────────────────
function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return {
    day:   d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase(),
    num:   d.getDate(),
    month: d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase(),
    full:  d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
    time:  d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }),
  };
}

// ── List row card (§8 — divide-y list rows) ──────────────────────────────────
interface EventRowProps {
  event: TeaEvent & { seatsRemaining?: number; confirmedCount?: number };
  isPast: boolean;
}

const EventRow: React.FC<EventRowProps> = React.memo(({ event, isPast }) => {
  const navigate = useNavigate();
  const { num, month, time } = formatDate(event.eventDate);
  const seats = event.seatsRemaining ?? (event.totalCapacity - (event.confirmedCount ?? 0));
  const isFull = !isPast && seats <= 0;

  const detail =
    event.areaHint ?? event.locationName ?? (event.moodHints && event.moodHints.length > 0 ? event.moodHints.join(' · ') : null);

  return (
    <button
      onClick={() => navigate(`/event/${event.slug}`)}
      className="group w-full flex items-center gap-4 py-5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/40 rounded-md transition-colors"
    >
      {/* Date column */}
      <div className="shrink-0 w-14 flex flex-col items-center justify-center">
        <span className="label-caps text-tea-text-dim">{month}</span>
        <span
          className="text-ui-26 leading-none text-tea-text mt-0.5"
          style={{ fontFamily: 'var(--font-display)', fontWeight: 300 }}
        >
          {num}
        </span>
        <span className="text-ui-10 text-tea-text-dim mt-1">{time}</span>
      </div>

      {/* Body column */}
      <div className="flex-1 min-w-0">
        <span
          className="block text-ui-17 text-tea-text leading-snug truncate"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          {event.title}
        </span>
        {detail && (
          <p className="text-ui-13 text-tea-text-sec truncate mt-0.5">
            {detail}
          </p>
        )}
      </div>

      {/* Status pill */}
      <div className="shrink-0">
        {isPast ? (
          <span className="inline-flex px-2 py-0.5 rounded-full text-ui-10 uppercase tracking-[0.15em] bg-tea-elevated text-tea-text-dim">
            Past
          </span>
        ) : isFull ? (
          <span className="inline-flex px-2 py-0.5 rounded-full text-ui-10 uppercase tracking-[0.15em] bg-tea-elevated text-tea-text-dim">
            Full
          </span>
        ) : (
          <span className="inline-flex px-2 py-0.5 rounded-full text-ui-10 uppercase tracking-[0.15em] bg-tea-gold/10 text-tea-readgold">
            Upcoming
          </span>
        )}
      </div>

      <ChevronRight className="shrink-0 w-4 h-4 text-tea-text-dim group-hover:text-tea-text-sec transition-colors" />
    </button>
  );
});
EventRow.displayName = 'EventRow';

// ── Skeleton row ─────────────────────────────────────────────────────────────
const EventRowSkeleton: React.FC = () => (
  <div className="flex items-center gap-4 py-5 animate-pulse">
    <div className="shrink-0 w-14 flex flex-col items-center gap-1.5">
      <div className="h-2 w-8 bg-tea-elevated rounded-md" />
      <div className="h-6 w-8 bg-tea-elevated rounded-md" />
      <div className="h-2 w-10 bg-tea-elevated rounded-md" />
    </div>
    <div className="flex-1 space-y-2">
      <div className="h-4 w-2/3 bg-tea-elevated rounded-md" />
      <div className="h-3 w-1/2 bg-tea-elevated rounded-md" />
    </div>
    <div className="h-5 w-16 bg-tea-elevated rounded-full" />
  </div>
);

// ── Filter tabs (§6 — bottom-border underline) ──────────────────────────────
type Filter = 'upcoming' | 'past';

interface FilterTabsProps {
  active: Filter;
  onChange: (f: Filter) => void;
  counts: { upcoming: number; past: number };
}

const FilterTabs: React.FC<FilterTabsProps> = ({ active, onChange, counts }) => {
  const tabs: { id: Filter; label: string; count: number }[] = [
    { id: 'upcoming', label: 'Upcoming', count: counts.upcoming },
    { id: 'past', label: 'Past', count: counts.past },
  ];
  return (
    <div className="flex gap-6 border-b border-tea-border">
      {tabs.map((t) => {
        const isActive = active === t.id;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onChange(t.id)}
            className={`tap-target relative -mb-px pb-3 pt-1 transition-colors ${
              isActive ? 'text-tea-text' : 'text-tea-text-sec hover:text-tea-text'
            }`}
          >
            <span
              className="text-ui-13"
              style={{ fontFamily: 'var(--font-display)', fontWeight: isActive ? 500 : 400 }}
            >
              {t.label}
            </span>
            {t.count > 0 && (
              <span className="ml-2 text-ui-10 text-tea-text-dim">{t.count}</span>
            )}
            <span
              className={`absolute left-0 right-0 -bottom-px h-px transition-colors ${
                isActive ? 'bg-tea-gold' : 'bg-transparent'
              }`}
            />
          </button>
        );
      })}
    </div>
  );
};

// ── Page ─────────────────────────────────────────────────────────────────────
const EventsPage: React.FC = () => {
  const { data: rawEvents = [], isLoading } = useQuery<(TeaEvent & { seats_remaining?: number; confirmed_count?: number })[]>({
    queryKey: ['events-public-list'],
    queryFn: () => api.events.listPublic(),
    staleTime: 5 * 60_000,
    placeholderData: (prev) => prev,
  });

  const events: TeaEvent[] = useMemo(() => {
    return rawEvents.map((ev) => {
      // Worker may return snake_case keys — cast to index signature for the shim
      const raw = ev as unknown as Record<string, unknown>;
      return {
        ...ev,
        flyerImageUrl:  ev.flyerImageUrl  ?? (raw['flyer_image_url']  as string | undefined),
        eventDate:      ev.eventDate      ?? (raw['event_date']       as string),
        locationName:   ev.locationName   ?? (raw['location_name']    as string | undefined),
        areaHint:       ev.areaHint       ?? (raw['area_hint']        as string | undefined),
        moodHints:      Array.isArray(ev.moodHints) ? ev.moodHints : (raw['mood_hints'] ? (typeof raw['mood_hints'] === 'string' ? JSON.parse(raw['mood_hints']) : raw['mood_hints'] as string[]) : undefined),
        totalCapacity:  ev.totalCapacity  ?? (raw['total_capacity']   as number),
        seatsRemaining: ev.seatsRemaining ?? (raw['seats_remaining']  as number | undefined),
        confirmedCount: ev.confirmedCount ?? (raw['confirmed_count']  as number | undefined),
      } as TeaEvent;
    });
  }, [rawEvents]);

  const [filter, setFilter] = useState<Filter>('upcoming');

  const { upcoming, past } = useMemo(() => {
    const now = Date.now();
    const up: TeaEvent[] = [];
    const pa: TeaEvent[] = [];
    for (const ev of events) {
      const t = new Date(ev.eventDate).getTime();
      if (Number.isFinite(t) && t < now) pa.push(ev);
      else up.push(ev);
    }
    up.sort((a, b) => new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime());
    pa.sort((a, b) => new Date(b.eventDate).getTime() - new Date(a.eventDate).getTime());
    return { upcoming: up, past: pa };
  }, [events]);

  const visible = filter === 'upcoming' ? upcoming : past;
  const isPastView = filter === 'past';

  return (
    <div
      className="min-h-screen bg-tea-bg pb-nav-gap-lg"
      style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
    >
      <PageHeader title="Sessions" />

      <div className="px-4 md:px-6 lg:px-10 max-w-3xl mx-auto">
        {/* Filter tabs */}
        <div className="mb-2">
          <FilterTabs
            active={filter}
            onChange={setFilter}
            counts={{ upcoming: upcoming.length, past: past.length }}
          />
        </div>

        {/* List */}
        <div className="divide-y divide-tea-border">
          {isLoading ? (
            <>
              <EventRowSkeleton />
              <EventRowSkeleton />
              <EventRowSkeleton />
            </>
          ) : visible.length === 0 ? (
            <div className="flex flex-col items-center text-center max-w-sm mx-auto py-20 px-6">
              <p
                className="text-ui-17 text-tea-text mb-2"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                {isPastView ? 'No past sessions yet' : 'No upcoming sessions'}
              </p>
              <p className="text-ui-12 text-tea-text-dim leading-relaxed">
                {isPastView
                  ? 'Past sessions will appear here once they have wrapped.'
                  : 'New events are announced through the Teajia community. Check back soon.'}
              </p>
            </div>
          ) : (
            visible.map((ev) => (
              <EventRow key={ev.id} event={ev} isPast={isPastView} />
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default EventsPage;

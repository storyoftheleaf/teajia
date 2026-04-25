import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { TeaEvent } from '../types/events';
import { PageHeader } from '../components/shared/PageHeader';

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

const teaGradients: Record<string, string[]> = {
  'aged-liu-bao-may-2026':    ['#3d2817', '#1a0e08', '#5a3a20'],
  'yancha-workshop-may-2026': ['#4a2818', '#1f0d05', '#6b3a1e'],
  'quiet-sitting-may-2026':   ['#1f1a14', '#0c0a08', '#2e2820'],
  'wild-puerh-may-2026':      ['#3a2a15', '#1a1108', '#544020'],
};

function gradientFor(slug: string) {
  const c = teaGradients[slug] ?? ['#3d2817', '#1a0e08', '#5a3a20'];
  return `radial-gradient(ellipse at 30% 40%, ${c[2]} 0%, ${c[0]} 50%, ${c[1]} 100%)`;
}

interface EventCardProps {
  event: TeaEvent & { seatsRemaining?: number; confirmedCount?: number };
}

const EventCard: React.FC<EventCardProps> = ({ event }) => {
  const navigate = useNavigate();
  const { day, num, month, time } = formatDate(event.eventDate);
  const seats = event.seatsRemaining ?? (event.totalCapacity - (event.confirmedCount ?? 0));
  const isFull = seats <= 0;

  return (
    <button
      onClick={() => navigate(`/event/${event.slug}`)}
      className="w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 rounded-sm"
    >
      <div className="relative overflow-hidden rounded-sm" style={{ background: 'var(--color-tea-surface, #1e1710)' }}>
        {/* Flyer image or gradient hero */}
        {event.flyerImageUrl ? (
          <div className="w-full aspect-[16/9] overflow-hidden">
            <img
              src={event.flyerImageUrl}
              alt={event.title}
              className="w-full h-full object-cover"
              loading="lazy"
            />
            <div className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-black/40 to-transparent pointer-events-none" />
            <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-tea-bg to-transparent pointer-events-none" />
          </div>
        ) : (
          <div
            className="w-full aspect-[16/9]"
            style={{ background: gradientFor(event.slug) }}
          >
            <div
              className="absolute inset-0"
              style={{ background: 'radial-gradient(circle at 70% 30%, rgba(184,146,78,0.12) 0%, transparent 40%)' }}
            />
            <div
              className="absolute bottom-0 left-0 right-0"
              style={{ height: '50%', background: 'linear-gradient(to top, var(--color-tea-bg, #18130e), transparent)' }}
            />
          </div>
        )}

        {/* Availability badge */}
        <div className="absolute top-3 right-3">
          {isFull ? (
            <span className="px-2.5 py-1 text-[10px] uppercase tracking-[0.2em] bg-tea-bg/80 text-tea-text-dim backdrop-blur-sm rounded-full border border-tea-border">
              Full
            </span>
          ) : (
            <span className="px-2.5 py-1 text-[10px] uppercase tracking-[0.2em] bg-tea-bg/80 text-tea-gold backdrop-blur-sm rounded-full border border-tea-gold/20">
              {seats} {seats === 1 ? 'seat' : 'seats'} open
            </span>
          )}
        </div>

        {/* Content overlay */}
        <div className="px-4 pb-4 pt-2 relative">
          {/* Date row */}
          <div className="flex items-baseline gap-2 mb-2">
            <span className="text-[10px] uppercase tracking-[0.25em] text-tea-text-dim">{day}</span>
            <span className="font-serif text-[13px] text-tea-text-sec">{num} {month}</span>
            <span className="text-[10px] text-tea-text-dim ml-auto">{time}</span>
          </div>

          {/* Title */}
          <h2 className="font-serif text-xl text-tea-text leading-snug mb-0.5">{event.title}</h2>
          {event.subtitle && (
            <p className="font-serif italic text-sm text-tea-text-sec">{event.subtitle}</p>
          )}

          {/* Location hint */}
          {(event.areaHint || event.locationName) && (
            <p className="text-[11px] text-tea-text-dim mt-2 flex items-center gap-1.5">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 opacity-60">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 1 1 18 0z"/><circle cx="12" cy="10" r="3"/>
              </svg>
              {event.areaHint ?? event.locationName}
            </p>
          )}

          {/* Mood hints */}
          {event.moodHints && event.moodHints.length > 0 && (
            <p className="text-[11px] text-tea-text-dim mt-2.5">
              {event.moodHints.join(' · ')}
            </p>
          )}
        </div>
      </div>
    </button>
  );
};

// ── Skeleton card ──────────────────────────────────────────────────────────────
const EventCardSkeleton: React.FC = () => (
  <div className="rounded-sm overflow-hidden animate-pulse bg-tea-surface">
    <div className="aspect-[16/9] bg-tea-elevated" />
    <div className="px-4 py-4 space-y-2">
      <div className="h-3 w-24 bg-tea-elevated rounded-sm" />
      <div className="h-5 w-48 bg-tea-elevated rounded-sm" />
      <div className="h-3 w-32 bg-tea-elevated rounded-sm" />
    </div>
  </div>
);

// ── Page ───────────────────────────────────────────────────────────────────────
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
        // snake_case → camelCase shim (worker returns snake_case)
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

  return (
    <div
      className="min-h-screen bg-tea-bg pb-[calc(44px+env(safe-area-inset-bottom,0px)+24px)]"
      style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
    >
      <PageHeader title="Sessions" />

      {/* Event list */}
      <div className="px-4 space-y-5">
        {isLoading ? (
          <>
            <EventCardSkeleton />
            <EventCardSkeleton />
          </>
        ) : events.length === 0 ? (
          <div className="text-center py-20 px-6">
            <p className="font-serif text-2xl text-tea-text mb-3">No upcoming sessions</p>
            <p className="text-sm text-tea-text-sec leading-relaxed max-w-xs mx-auto">
              New events are announced through the Teajia community. Check back soon.
            </p>
          </div>
        ) : (
          events.map((ev) => <EventCard key={ev.id} event={ev} />)
        )}
      </div>
    </div>
  );
};

export default EventsPage;

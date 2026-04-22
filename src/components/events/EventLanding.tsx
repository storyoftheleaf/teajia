import React, { useState, lazy, Suspense, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { MapPin, ChevronDown, Users, BookOpen, Edit3, UserCheck } from 'lucide-react';
import { api, hasToken } from '../../lib/api';
import { useAppStore } from '../../lib/store';
import { useParallax } from '../../hooks/useParallax';
import type { TeaEvent, TeaMenuItem } from '../../types/events';
import AvailabilityBadge from './AvailabilityBadge';
import EventCountdown from './EventCountdown';

// ── Public Tea Menu Preview ───────────────────────────────────────────────
interface PublicTeaMenuProps {
  items: TeaMenuItem[];
}

const PublicTeaMenuSection: React.FC<PublicTeaMenuProps> = ({ items }) => {
  if (items.length === 0) return null;
  const sorted = [...items].sort((a, b) => (a.brewOrder ?? 0) - (b.brewOrder ?? 0));
  return (
    <div className="mb-10">
      <h3 className="font-serif text-xl text-tea-text mb-1">What we'll be tasting</h3>
      <p className="text-xs text-tea-text-sec uppercase tracking-[0.2em] mb-6">
        {sorted.length} {sorted.length === 1 ? 'selection' : 'selections'} curated for this session
      </p>
      <div className="space-y-3">
        {sorted.map((item, idx) => (
          <div key={item.id} className="flex items-start gap-4 p-4 bg-tea-surface border border-tea-border rounded-sm">
            <span className="font-serif text-xl text-tea-gold/30 leading-none shrink-0 mt-0.5">{idx + 1}</span>
            <div className="flex-1 min-w-0">
              {item.productType && (
                <p className="text-[10px] uppercase tracking-[0.2em] text-tea-gold mb-0.5">{item.productType}</p>
              )}
              <p className="font-serif text-base text-tea-text">{item.customName || item.productName}</p>
              {item.customDescription && (
                <p className="text-sm text-tea-text-sec leading-relaxed mt-1">{item.customDescription}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ── Venue Photos ──────────────────────────────────────────────────────────
interface VenuePhotosProps {
  photos: string[];
}

const VenuePhotosSection: React.FC<VenuePhotosProps> = ({ photos }) => {
  const visible = photos.slice(0, 2);
  if (visible.length === 0) return null;
  return (
    <div className="mb-10">
      <p className="text-[10px] uppercase tracking-[0.3em] text-tea-text-sec mb-4">The Space</p>
      <div className={`grid gap-2 ${visible.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
        {visible.map((url, idx) => (
          <div key={idx} className="rounded-sm overflow-hidden border border-tea-border aspect-[4/3]">
            <img
              src={url}
              alt={`Venue photo ${idx + 1}`}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          </div>
        ))}
      </div>
    </div>
  );
};

const RSVPFormSheet = lazy(() => import('./RSVPFormSheet'));
const FindRSVPSheet = lazy(() => import('./FindRSVPSheet'));
const VenueGuide = lazy(() => import('./VenueGuide'));
const InterestCapture = lazy(() => import('./InterestCapture'));

const EVENT_FORMAT_LABELS: Record<string, string> = {
  private_tasting: 'Private Tasting',
  public_tasting: 'Tasting',
  workshop: 'Workshop',
  pop_up: 'Pop-up',
  wholesale_showing: 'Wholesale Showing',
  other: 'Session',
};

const GATHERING_TYPE_LABELS: Record<string, string> = {
  private: 'Private',
  'semi-private': 'Semi-private',
  open: 'Open',
  bespoke: 'Bespoke',
};

function formatEventDate(dateStr: string): { date: string; time: string; day: string } {
  const d = new Date(dateStr);
  const day = d.toLocaleDateString('en-US', { weekday: 'long' });
  const date = d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  return { date, time, day };
}

const EventLanding: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();

  const { data: event, isLoading, isError, error } = useQuery<TeaEvent>({
    queryKey: ['event-public', slug],
    queryFn: () => api.events.getPublic(slug!),
    enabled: !!slug,
  });

  // Attempt to fetch public tea menu — may return empty if not exposed publicly.
  const { data: publicTeaMenu = [] } = useQuery<TeaMenuItem[]>({
    queryKey: ['event-public-tea-menu', slug],
    queryFn: async () => {
      try {
        const data = await api.events.getPublicTeaMenu(slug!);
        if (!Array.isArray(data)) return [];
        return data.map((m: Record<string, unknown>) => ({
          id: m.id as string,
          eventId: m.event_id as string,
          productId: (m.product_id as string) || undefined,
          customName: (m.custom_name as string) || undefined,
          customDescription: (m.custom_description as string) || undefined,
          revealDate: (m.reveal_date as string) || undefined,
          brewOrder: m.brew_order != null ? Number(m.brew_order) : undefined,
          productName: (m.product_name as string) || undefined,
          productType: (m.product_type as string) || undefined,
          productImageUrl: (m.product_image_url as string) || undefined,
        })) as TeaMenuItem[];
      } catch {
        return [];
      }
    },
    enabled: !!slug && !!event,
    staleTime: 60_000,
  });

  const platformRole = useAppStore(s => s.platformRole);
  const isAdmin = !!platformRole;

  const [showRSVP, setShowRSVP] = useState(false);
  const [showFindRSVP, setShowFindRSVP] = useState(false);
  const [guidelinesExpanded, setGuidelinesExpanded] = useState(false);
  const [myAttendee, setMyAttendee] = useState<any>(null);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelFeedback, setCancelFeedback] = useState('');

  // Parallax for flyer image
  const { ref: heroRef, offset: parallaxOffset } = useParallax(0.3);

  // OG meta tags for social sharing previews
  useEffect(() => {
    if (!event) return;

    const evRaw = event as TeaEvent & Record<string, any>;
    const evDate: string = evRaw.eventDate ?? evRaw.event_date;
    const { date } = formatEventDate(evDate);
    document.title = `${event.title} — Teajia`;

    const setMeta = (name: string, content: string, prop = false) => {
      const sel = prop
        ? `meta[property="${name}"]`
        : `meta[name="${name}"]`;
      let el = document.querySelector<HTMLMetaElement>(sel);
      if (!el) {
        el = document.createElement('meta');
        prop ? el.setAttribute('property', name) : el.setAttribute('name', name);
        document.head.appendChild(el);
      }
      el.setAttribute('content', content);
    };

    const description = event.description
      ? event.description.slice(0, 140)
      : `${date} · ${event.areaHint ?? event.locationName ?? 'Taipei'}`;

    setMeta('description', description);
    setMeta('og:title', event.title, true);
    setMeta('og:description', description, true);
    setMeta('og:type', 'event', true);
    setMeta('og:url', window.location.href, true);
    if (event.flyerImageUrl) {
      setMeta('og:image', event.flyerImageUrl, true);
    }
    setMeta('twitter:card', 'summary_large_image');
    setMeta('twitter:title', event.title);
    setMeta('twitter:description', description);
    if (event.flyerImageUrl) {
      setMeta('twitter:image', event.flyerImageUrl);
    }

    return () => {
      document.title = 'Teajia | Tea Journal';
    };
  }, [event]);

  useEffect(() => {
    if (!slug || !event || !hasToken()) return;
    api.rsvp.findByAccount(slug).then((data: any) => {
      const token = data?.magic_token || data?.magicToken;
      const status = data?.status;
      if (token && status && status !== 'cancelled' && status !== 'denied') {
        setMyAttendee(data);
      }
    }).catch(() => {});
  }, [slug, event]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-tea-bg flex items-center justify-center">
        <div className="text-center animate-pulse">
          <div className="w-12 h-12 rounded-full bg-tea-gold/10 mx-auto mb-4" />
          <div className="h-3 w-32 bg-tea-text-sec/10 rounded-sm mx-auto" />
        </div>
      </div>
    );
  }

  if (isError || !event) {
    return (
      <div className="min-h-screen bg-tea-bg flex items-center justify-center px-6">
        <div className="text-center max-w-md">
          <h1 className="font-serif text-4xl text-tea-text mb-4">Event Not Found</h1>
          <p className="text-sm text-tea-text-sec mb-8">
            {(error as Error)?.message || 'This event may have been removed or the link is incorrect.'}
          </p>
          <button
            onClick={() => navigate('/')}
            className="px-8 py-3 bg-tea-gold text-white text-xs uppercase tracking-[0.2em] hover:bg-tea-gold/90 transition-colors"
          >
            Return Home
          </button>
        </div>
      </div>
    );
  }

  // The public endpoint returns raw snake_case JSON. Access camelCase with snake_case fallback
  // throughout this component. Fields added to the SELECT in handleGetEventBySlug are returned
  // as snake_case; fields that have gone through mapEvent() arrive as camelCase.
  const ev = event as TeaEvent & Record<string, any>;
  const eventDate: string = ev.eventDate ?? ev.event_date;
  const flyerImageUrl: string | undefined = ev.flyerImageUrl ?? ev.flyer_image_url;
  const locationName: string | undefined = ev.locationName ?? ev.location_name;
  const areaHint: string | undefined = ev.areaHint ?? ev.area_hint;
  const confirmedCount: number = (ev.confirmedCount ?? ev.confirmed_count) as number ?? 0;
  const seatsRemaining: number = (ev.seatsRemaining ?? ev.seats_remaining) as number ?? 0;
  const guidelinesText: string | undefined = ev.guidelinesText ?? ev.guidelines_text;
  const venueGuide: any = ev.venueGuide ?? (ev.venue_guide ? (typeof ev.venue_guide === 'string' ? JSON.parse(ev.venue_guide) : ev.venue_guide) : undefined);
  const moodHints: string[] | undefined = ev.moodHints ?? (ev.mood_hints ? (typeof ev.mood_hints === 'string' ? JSON.parse(ev.mood_hints) : ev.mood_hints) : undefined);
  const eventFormat: import('../../types/events').EventFormat | undefined = ev.format ?? ev.event_format ?? undefined;
  const gatheringType: import('../../types/events').GatheringType | undefined = ev.gatheringType ?? ev.gathering_type ?? undefined;

  const { date: formattedDate, time: formattedTime, day: formattedDay } = formatEventDate(eventDate);
  const isCompleted = event.status === 'closed';
  const isCancelled = event.status === 'archived';
  const isFull = seatsRemaining === 0;
  const canRSVP = !isCompleted && !isCancelled && !isFull;
  const showWaitlist = !isCompleted && !isCancelled && isFull;
  const showInterestOnly = isCompleted || isCancelled;

  const teaGradients: Record<string, string[]> = {
    'aged-liu-bao-may-2026': ['#3d2817', '#1a0e08', '#5a3a20'],
    'yancha-workshop-may-2026': ['#4a2818', '#1f0d05', '#6b3a1e'],
    'quiet-sitting-may-2026': ['#1f1a14', '#0c0a08', '#2e2820'],
    'wild-puerh-may-2026': ['#3a2a15', '#1a1108', '#544020'],
  };
  const gradientColors = (slug && teaGradients[slug]) || ['#3d2817', '#1a0e08', '#5a3a20'];

  return (
    <div className="min-h-screen bg-tea-bg animate-[fadeIn_0.5s_ease-out]">
      {/* Hero — flyer image or gradient fallback */}
      <div ref={heroRef} className="relative w-full pb-6">
        {flyerImageUrl ? (
          <div className="w-full overflow-hidden" style={{ maxHeight: '70vh' }}>
            <div style={{ transform: `translateY(${parallaxOffset}px)`, transition: 'transform 0.1s linear' }}>
              <img
                src={flyerImageUrl}
                alt={event.title}
                className="w-full h-auto object-cover"
                style={{ minHeight: '50vh', maxHeight: '75vh', objectFit: 'cover' }}
              />
            </div>
            <div className="absolute inset-x-0 top-0 bottom-6 bg-gradient-to-t from-tea-bg via-tea-bg/20 to-transparent pointer-events-none" />
          </div>
        ) : (
          <div
            className="w-full relative overflow-hidden"
            style={{
              height: '280px',
              background: `radial-gradient(ellipse at 30% 40%, ${gradientColors[2]} 0%, ${gradientColors[0]} 50%, ${gradientColors[1]} 100%)`,
            }}
          >
            <div
              className="absolute inset-0"
              style={{ background: `radial-gradient(circle at 70% 30%, rgba(184,146,78,0.13) 0%, transparent 40%)` }}
            />
            <div
              className="absolute bottom-0 left-0 right-0"
              style={{ height: '50%', background: `linear-gradient(to top, var(--color-tea-bg, #18130e), transparent)` }}
            />
          </div>
        )}

        {/* Back button */}
        <button
          onClick={() => navigate('/events')}
          className="absolute top-3 left-4 z-10 flex items-center justify-center w-9 h-9 rounded-full"
          style={{ background: 'rgba(24,19,14,0.6)', backdropFilter: 'blur(8px)', border: 'none' }}
          aria-label="Back"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
            <path d="M19 12H5m7-7l-7 7 7 7"/>
          </svg>
        </button>

        {/* Admin edit shortcut */}
        {isAdmin && (
          <button
            onClick={() => navigate(`/admin/events/${event.id}`)}
            className="absolute top-3 right-4 z-10 flex items-center gap-1.5 px-3 h-9 rounded-full text-[11px] font-medium text-white"
            style={{ background: 'rgba(24,19,14,0.6)', backdropFilter: 'blur(8px)' }}
          >
            <Edit3 size={12} /> Edit
          </button>
        )}

        {/* Availability badge hanging below hero */}
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2">
          <AvailabilityBadge slug={slug!} />
        </div>
      </div>

      {/* Content */}
      <div className="max-w-xl mx-auto px-6 py-10">
        {/* Title block */}
        <div className="text-center mb-10">
          {isCancelled && (
            <p className="text-xs uppercase tracking-[0.3em] text-red-400 mb-4">Event Cancelled</p>
          )}
          {isCompleted && (
            <p className="text-xs uppercase tracking-[0.3em] text-tea-text-sec mb-4">Session Complete</p>
          )}

          <h1 className="font-serif text-[28px] md:text-4xl text-tea-text leading-[1.1] tracking-[-0.3px] mb-2">
            {event.title}
          </h1>

          {event.subtitle && (
            <p className="font-serif italic text-[14px] text-tea-text-sec mb-6 leading-snug">
              {event.subtitle}
            </p>
          )}

          {/* Gathering type label */}
          {(eventFormat || gatheringType) && (
            <div className="flex items-center justify-center gap-2 mb-4">
              {eventFormat && (
                <span className="text-[9px] uppercase tracking-[0.3em] text-tea-text-sec">
                  {EVENT_FORMAT_LABELS[eventFormat] ?? eventFormat}
                </span>
              )}
              {eventFormat && gatheringType && (
                <span className="text-[9px] text-tea-text-dim">·</span>
              )}
              {gatheringType && (
                <span className="text-[9px] uppercase tracking-[0.3em] text-tea-text-sec">
                  {GATHERING_TYPE_LABELS[gatheringType] ?? gatheringType}
                </span>
              )}
            </div>
          )}

          {/* Date & Time */}
          <div className="mt-5 mb-4">
            <p className="text-[9px] uppercase tracking-[0.3em] text-tea-text-dim mb-1.5">{formattedDay}</p>
            <p className="font-serif text-[17px] text-tea-text">{formattedDate}</p>
            <p className="font-serif text-[15px] text-tea-gold mt-1">{formattedTime}</p>
          </div>

          {/* Area hint (not full address) or location name */}
          {(areaHint || locationName) && (
            <div className="flex items-center justify-center gap-1.5 text-tea-text-sec mt-3.5 mb-5">
              <MapPin className="w-[11px] h-[11px] shrink-0" />
              <span className="text-xs">{areaHint ?? locationName}</span>
            </div>
          )}

          {/* Social proof — confirmed seat count.
              TODO: The public endpoint (/api/events/:slug/public) returns only a count (confirmed_count),
              not individual attendee names. To show first names here, the endpoint would need a JOIN on
              event_attendees with status='confirmed', returning first-name-only strings (never full names
              or contact info). Until that is added, we show the count only. */}
          {confirmedCount > 0 && !isCompleted && (
            <div className="flex items-center justify-center gap-2 text-tea-text-sec mb-6">
              <Users className="w-3.5 h-3.5" />
              <span className="text-xs">
                {confirmedCount} {confirmedCount === 1 ? 'seat' : 'seats'} confirmed
              </span>
            </div>
          )}

          {/* Countdown */}
          {!isCompleted && !isCancelled && (
            <EventCountdown eventDate={eventDate} className="mb-8" />
          )}

          {/* CTA block */}
          {canRSVP && (
            myAttendee ? (
              // Already registered — show attendee actions
              <div className="space-y-3">
                <div className="flex items-center justify-center gap-2 mb-1">
                  <UserCheck size={14} className="text-tea-gold" />
                  <p className="text-xs text-tea-text-sec">
                    You're {myAttendee.status === 'confirmed' ? 'confirmed' : myAttendee.status === 'waitlist' ? 'on the waitlist' : 'registered'} for this session
                  </p>
                </div>
                <div className={`grid gap-2 ${myAttendee.status === 'confirmed' ? 'grid-cols-2' : 'grid-cols-1'}`}>
                  {myAttendee.status === 'confirmed' && (
                    <button
                      onClick={() => navigate(`/m/${myAttendee.magic_token || myAttendee.magicToken}`)}
                      className="py-[13px] bg-tea-surface border border-tea-border text-tea-text text-[11px] uppercase tracking-[0.2em] rounded-sm hover:border-tea-gold/40 transition-colors"
                    >
                      Invite a Friend
                    </button>
                  )}
                  <button
                    onClick={() => setShowCancelConfirm(true)}
                    className="py-[13px] bg-tea-surface border border-tea-border text-tea-text-sec text-[11px] uppercase tracking-[0.2em] rounded-sm hover:border-red-400/30 hover:text-red-400 transition-colors"
                  >
                    Cancel {myAttendee.status === 'confirmed' ? 'My Seat' : 'Registration'}
                  </button>
                </div>
                {showCancelConfirm && (
                  <div className="bg-tea-surface border border-tea-border rounded-sm p-4 space-y-3">
                    <p className="text-sm font-serif text-tea-text text-center">Cancel your spot?</p>
                    <p className="text-[11px] text-tea-text-sec text-center">This can't be undone. We'll let the host know.</p>
                    {cancelFeedback && <p className="text-[11px] text-red-400 text-center">{cancelFeedback}</p>}
                    <div className="flex gap-2">
                      <button
                        onClick={() => { setShowCancelConfirm(false); setCancelFeedback(''); }}
                        disabled={cancelling}
                        className="flex-1 py-2.5 text-[11px] text-tea-text-sec hover:text-tea-text transition-colors"
                      >
                        Keep my seat
                      </button>
                      <button
                        onClick={async () => {
                          const token = myAttendee.magic_token || myAttendee.magicToken;
                          setCancelling(true);
                          try {
                            await api.rsvp.cancel(token);
                            setMyAttendee(null);
                            setShowCancelConfirm(false);
                          } catch {
                            setCancelFeedback('Could not cancel — please contact us directly.');
                          } finally {
                            setCancelling(false);
                          }
                        }}
                        disabled={cancelling}
                        className="flex-1 py-2.5 text-[11px] uppercase tracking-[0.15em] text-red-400 hover:text-red-300 border border-red-400/30 rounded-sm hover:border-red-400/50 transition-colors disabled:opacity-50"
                      >
                        {cancelling ? 'Cancelling…' : 'Yes, cancel'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              // Default CTA
              <div className="space-y-2.5">
                <button
                  onClick={() => setShowRSVP(true)}
                  className="w-full py-[15px] bg-tea-gold text-white text-[11px] uppercase tracking-[0.25em] font-semibold rounded-sm hover:bg-tea-gold/90 transition-all duration-300 shadow-[0_6px_20px_rgba(184,146,78,0.3)]"
                >
                  Request Your Seat
                </button>
                <p className="text-center text-[11px] text-tea-text-dim">
                  Already registered?{' '}
                  <button
                    onClick={() => setShowFindRSVP(true)}
                    className="text-tea-gold hover:text-tea-gold-lt transition-colors"
                  >
                    Find my RSVP
                  </button>
                </p>
              </div>
            )
          )}

          {/* Full / waitlist state */}
          {showWaitlist && (
            <div className="space-y-4">
              <p className="font-serif text-base text-tea-text-sec">
                This session is fully gathered.
              </p>
              <button
                onClick={() => setShowRSVP(true)}
                className="w-full py-[15px] bg-tea-surface border border-tea-border text-tea-text text-[11px] uppercase tracking-[0.25em] rounded-sm hover:border-tea-gold/40 transition-colors"
              >
                Join the Waitlist
              </button>
              <div className="pt-2">
                <p className="text-xs text-tea-text-sec mb-3">Or notify me of the next session:</p>
                <Suspense fallback={null}>
                  <InterestCapture slug={slug!} />
                </Suspense>
              </div>
            </div>
          )}

          {/* Closed / archived — recap link + interest capture */}
          {showInterestOnly && (
            <div className="max-w-xs mx-auto space-y-5">
              {/* Recap link — shown for completed events */}
              {isCompleted && slug && (
                <button
                  onClick={() => navigate(`/event/${slug}/recap`)}
                  className="w-full flex items-center justify-center gap-2.5 py-[13px] bg-tea-surface border border-tea-border text-tea-text text-[11px] uppercase tracking-[0.2em] rounded-sm hover:border-tea-gold/40 hover:text-tea-gold transition-all duration-300 group"
                >
                  <BookOpen className="w-3.5 h-3.5 text-tea-text-sec group-hover:text-tea-gold transition-colors" />
                  View session recap
                </button>
              )}
              <p className="text-xs text-tea-text-sec">Notify me of the next one:</p>
              <Suspense fallback={null}>
                <InterestCapture slug={slug!} />
              </Suspense>
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="w-8 h-px bg-tea-border mx-auto mb-8" />

        {/* Description */}
        {event.description && (
          <div className="mb-8">
            <p className="font-serif text-[14px] text-tea-text-sec leading-[1.7] whitespace-pre-line">
              {event.description}
            </p>
          </div>
        )}

        {/* Mood hints — serif italic dots */}
        {moodHints && moodHints.length > 0 && (
          <div className="mb-10 flex flex-wrap gap-0 justify-center">
            {moodHints.map((hint, i) => (
              <span key={i} className="font-serif italic text-[13px] text-tea-text-sec">
                {i > 0 && <span className="mx-2 opacity-40">·</span>}
                {hint}
              </span>
            ))}
          </div>
        )}

        {/* Venue Photos — from the linked venue record */}
        {(() => {
          const raw = ev.venue_photos ?? (ev as any).venuePhotos;
          const photos: string[] = Array.isArray(raw) ? raw : [];
          return photos.length > 0 ? <VenuePhotosSection photos={photos} /> : null;
        })()}

        {/* Tea Menu Preview */}
        {publicTeaMenu.length > 0 && (
          <PublicTeaMenuSection items={publicTeaMenu} />
        )}

        {/* Guidelines (expandable) */}
        {guidelinesText && (
          <div className="mb-10">
            <button
              onClick={() => setGuidelinesExpanded(!guidelinesExpanded)}
              className="flex items-center justify-between w-full py-3 text-left group"
            >
              <h3 className="font-serif text-lg text-tea-text group-hover:text-tea-gold transition-colors">
                Session Guidelines
              </h3>
              <ChevronDown
                className={`w-5 h-5 text-tea-text-sec transition-transform duration-300 ${
                  guidelinesExpanded ? 'rotate-180' : ''
                }`}
              />
            </button>
            {guidelinesExpanded && (
              <div className="animate-[fadeIn_0.3s_ease-out] pt-2">
                <ul className="space-y-3">
                  {guidelinesText.split('\n').filter(Boolean).map((guideline, idx) => (
                    <li key={idx} className="flex items-start gap-3 text-sm text-tea-text-sec">
                      <span className="w-1.5 h-1.5 rounded-full bg-tea-gold/40 mt-1.5 shrink-0" />
                      {guideline}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Venue guide — only show for confirmed guests, not on public page */}
        {/* (Venue guide hidden here; full address shown after approval in GuestManagement) */}

        {/* Footer */}
        <div className="text-center pt-6 pb-12">
          <p className="text-[10px] uppercase tracking-[0.3em] text-tea-text-sec/50">
            Hosted by Teajia
          </p>
        </div>
      </div>

      {/* RSVP Form Sheet */}
      {showRSVP && slug && (
        <Suspense fallback={null}>
          <RSVPFormSheet slug={slug} onClose={() => setShowRSVP(false)} accountLocationCountry={(event as any).account_location_country} />
        </Suspense>
      )}

      {/* Find RSVP Sheet */}
      {showFindRSVP && slug && (
        <Suspense fallback={null}>
          <FindRSVPSheet slug={slug} onClose={() => setShowFindRSVP(false)} />
        </Suspense>
      )}
    </div>
  );
};

export default EventLanding;

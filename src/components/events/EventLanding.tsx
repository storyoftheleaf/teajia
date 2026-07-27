import React, { useState, lazy, Suspense, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { MapPin, ChevronDown, Users, BookOpen, Edit3, UserCheck } from 'lucide-react';
import { api, hasToken } from '../../lib/api';
import { useAppStore } from '../../lib/store';
import { useParallax } from '../../hooks/useParallax';
import { useReducedMotion } from '../../hooks/useReducedMotion';
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
      <h3 className="h3 mb-1">What we'll be tasting</h3>
      <p className="label-caps text-tea-text-dim mb-6">
        {sorted.length} {sorted.length === 1 ? 'selection' : 'selections'} curated for this session
      </p>
      <div className="space-y-3">
        {sorted.map((item, idx) => (
          <div key={item.id} className="flex items-start gap-4 p-4 bg-tea-surface border border-tea-border rounded-xl">
            <span className="text-ui-20 text-tea-gold/30 leading-none shrink-0 mt-0.5" style={{ fontFamily: 'var(--font-display)' }}>{idx + 1}</span>
            <div className="flex-1 min-w-0">
              {item.productType && (
                <p className="text-ui-10 uppercase tracking-[1.2px] text-tea-readgold mb-0.5">{item.productType}</p>
              )}
              <p className="text-ui-16 text-tea-text" style={{ fontFamily: 'var(--font-display)' }}>{item.customName || item.productName}</p>
              {item.customDescription && (
                <p className="body-light mt-1">{item.customDescription}</p>
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
      <p className="label-caps text-tea-text-dim mb-4">The Space</p>
      <div className={`grid gap-2 ${visible.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
        {visible.map((url, idx) => (
          <div key={idx} className="rounded-xl overflow-hidden border border-tea-border aspect-[4/3]">
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
  const [loadingTooLong, setLoadingTooLong] = useState(false);

  // 10s loading timeout — gives the user something to do if the worker is
  // cold-starting and React Query's silent retries haven't completed yet.
  useEffect(() => {
    if (!isLoading) { setLoadingTooLong(false); return; }
    const t = setTimeout(() => setLoadingTooLong(true), 10000);
    return () => clearTimeout(t);
  }, [isLoading]);
  const [myAttendee, setMyAttendee] = useState<any>(null);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelFeedback, setCancelFeedback] = useState('');

  // Parallax for flyer image
  const { ref: heroRef, offset: parallaxOffset } = useParallax(0.3);
  const reducedMotion = useReducedMotion();

  // OG meta tags for social sharing previews
  useEffect(() => {
    if (!event) return;

    const evRaw = event as TeaEvent & Record<string, any>;
    const evDate: string = evRaw.eventDate ?? evRaw.event_date;
    const { date } = formatEventDate(evDate);
    document.title = `${event.title} · Teajia`;

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
    if (!slug || !event) return;
    if (hasToken()) {
      api.rsvp.findByAccount(slug).then((data: any) => {
        const token = data?.magic_token || data?.magicToken;
        const status = data?.status;
        if (token && status && status !== 'cancelled' && status !== 'denied') {
          setMyAttendee(data);
        }
      }).catch(() => {});
      return;
    }
    // Unauthenticated returning visitor: check localStorage for a magic token
    // saved from a prior RSVP on this device.
    let storedToken: string | null = null;
    try { storedToken = localStorage.getItem(`teajia_rsvp_${slug}`); } catch { /* private mode */ }
    if (!storedToken) return;
    api.rsvp.get(storedToken).then((data: any) => {
      const status = data?.status;
      if (status && status !== 'cancelled' && status !== 'denied') {
        setMyAttendee(data);
      } else {
        try { localStorage.removeItem(`teajia_rsvp_${slug}`); } catch { /* ignore */ }
      }
    }).catch(() => {
      try { localStorage.removeItem(`teajia_rsvp_${slug}`); } catch { /* ignore */ }
    });
  }, [slug, event]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-tea-bg flex items-center justify-center px-6" role="status">
        <div className="text-center max-w-xs">
          <span className="sr-only">Loading event</span>
          <div className="animate-pulse">
            <div className="w-12 h-12 rounded-full bg-tea-gold/10 mx-auto mb-4" />
            <div className="h-3 w-32 bg-tea-text-sec/10 rounded-md mx-auto" />
          </div>
          {loadingTooLong && (
            <p className="text-ui-12 text-tea-text-dim mt-8 leading-relaxed">
              Taking a moment. If this stays stuck, try refreshing the page.
            </p>
          )}
        </div>
      </div>
    );
  }

  if (isError || !event) {
    return (
      <div className="min-h-screen bg-tea-bg flex items-center justify-center px-6">
        <div className="flex flex-col items-center text-center max-w-sm mx-auto py-20 px-6">
          <h1 className="h2 mb-3">Event not found</h1>
          <p className="text-ui-12 text-tea-text-dim leading-relaxed mb-6">
            {(error as Error)?.message || 'This event may have been removed or the link is incorrect.'}
          </p>
          <button
            onClick={() => navigate('/')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md cta-solid text-xs font-semibold transition-colors"
          >
            Return home
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
  // requires_approval: raw integer from worker (0 or 1); default true for old events without the column
  const rawRequiresApproval = ev.requires_approval ?? ev.requiresApproval;
  const isInstantConfirm = rawRequiresApproval === false || rawRequiresApproval === 0;

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
    <div className={`min-h-screen bg-tea-bg ${reducedMotion ? '' : 'animate-[fadeIn_0.5s_ease-out]'}`}>
      {/* Hero — flyer image or gradient fallback */}
      <div ref={heroRef} className="relative w-full pb-6">
        {flyerImageUrl ? (
          <div className="w-full overflow-hidden" style={{ maxHeight: '70vh' }}>
            <div style={{ transform: `translateY(${reducedMotion ? 0 : parallaxOffset}px)` }}>
              <div style={{ minHeight: '50vh', maxHeight: '75vh' }}>
                <img
                  src={flyerImageUrl}
                  alt={event.title}
                  fetchPriority="high"
                  className="w-full h-full object-cover"
                  style={{ minHeight: '50vh', maxHeight: '75vh', objectFit: 'cover' }}
                />
              </div>
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
              style={{ height: '50%', background: `linear-gradient(to top, var(--tea-bg), transparent)` }}
            />
          </div>
        )}

        {/* Back button — top-left, text-tea-text-sec hover floor (§15) */}
        <button
          onClick={() => {
            if (window.history.length > 1) navigate(-1);
            else navigate('/');
          }}
          className="tap-target absolute top-3 left-4 z-dropdown flex items-center justify-center w-9 h-9 rounded-full bg-tea-bg/60 text-tea-text-sec hover:text-tea-text transition-colors backdrop-blur-md"
          aria-label="Back"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M19 12H5m7-7l-7 7 7 7"/>
          </svg>
        </button>

        {/* Admin edit shortcut */}
        {isAdmin && (
          <button
            onClick={() => navigate(`/admin/events/${event.id}`)}
            className="absolute top-3 right-4 z-dropdown inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold cta-solid transition-colors backdrop-blur-md"
          >
            <Edit3 size={13} /> Edit
          </button>
        )}

        {/* Availability badge hanging below hero */}
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2">
          <AvailabilityBadge slug={slug!} />
        </div>
      </div>

      {/* Content — editorial reader chrome */}
      <div className="max-w-2xl mx-auto px-4 md:px-6 pt-12 pb-nav-gap">
        {/* Title block */}
        <div className="text-center mb-10">
          {isCancelled && (
            <p className="label-caps text-tea-error mb-4">Event Cancelled</p>
          )}
          {isCompleted && (
            <p className="label-caps text-tea-text-dim mb-4">Session Complete</p>
          )}

          {/* Date eyebrow */}
          <p className="label-caps text-tea-text-dim mb-4">
            {formattedDay} · {formattedDate}
          </p>

          {/* Title — .h1 hero */}
          <h1 className="h1 mb-3">
            {event.title}
          </h1>

          {/* Descriptor — italic subtitle */}
          {event.subtitle && (
            <p className="subtitle mb-5">
              {event.subtitle}
            </p>
          )}

          {/* Gathering type / format — .label-caps */}
          {(eventFormat || gatheringType) && (
            <div className="flex items-center justify-center gap-2 mb-4">
              {eventFormat && (
                <span className="label-caps text-tea-text-sec">
                  {EVENT_FORMAT_LABELS[eventFormat] ?? eventFormat}
                </span>
              )}
              {eventFormat && gatheringType && (
                <span className="text-ui-10 text-tea-text-dim">·</span>
              )}
              {gatheringType && (
                <span className="label-caps text-tea-text-sec">
                  {GATHERING_TYPE_LABELS[gatheringType] ?? gatheringType}
                </span>
              )}
            </div>
          )}

          {/* Time */}
          <p
            className="text-ui-15 text-tea-readgold mb-4"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            {formattedTime}
          </p>

          {/* Area hint (not full address) or location name — .label-caps */}
          <div className="flex items-center justify-center gap-1.5 mb-5">
            <MapPin className="w-[11px] h-[11px] shrink-0 text-tea-text-dim" />
            <span className="label-caps text-tea-text-sec">
              {areaHint ?? locationName ?? 'Location shared after RSVP'}
            </span>
          </div>

          {/* Confirmed seat count + opt-in guest names */}
          {confirmedCount > 0 && !isCompleted && (() => {
            const confirmedNames: string[] = ev.confirmed_names ?? ev.confirmedNames ?? [];
            const extra = confirmedCount - confirmedNames.length;
            return (
              <div className="flex flex-col items-center gap-1 mb-6">
                <div className="flex items-center gap-2 text-tea-text-sec">
                  <Users className="w-3.5 h-3.5" />
                  <span className="text-ui-12">
                    {confirmedCount} {confirmedCount === 1 ? 'seat' : 'seats'} confirmed
                    {seatsRemaining > 0 && seatsRemaining <= 3 && !isFull && !isCompleted && !isCancelled && (
                      <span className="text-tea-readgold"> · only {seatsRemaining} {seatsRemaining === 1 ? 'seat' : 'seats'} left</span>
                    )}
                  </span>
                </div>
                {confirmedNames.length > 0 && (
                  <p className="text-ui-11 text-tea-text-dim text-center">
                    {confirmedNames.join(', ')}{extra > 0 ? ` +${extra} more` : ''}
                  </p>
                )}
              </div>
            );
          })()}

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
                  <p className="text-ui-12 text-tea-text-sec">
                    You're {myAttendee.status === 'confirmed' ? 'confirmed' : myAttendee.status === 'waitlist' ? 'on the waitlist' : 'registered'} for this session
                  </p>
                </div>
                <div className={`grid gap-2 ${myAttendee.status === 'confirmed' ? 'grid-cols-2' : 'grid-cols-1'}`}>
                  {myAttendee.status === 'confirmed' && (
                    <button
                      onClick={() => navigate(`/m/${myAttendee.magic_token || myAttendee.magicToken}`)}
                      className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-md border border-tea-border text-tea-text-sec text-xs font-semibold hover:text-tea-text hover:bg-tea-accent-sub transition-colors"
                    >
                      Invite a Friend
                    </button>
                  )}
                  <button
                    onClick={() => setShowCancelConfirm(true)}
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-md border border-tea-border text-tea-text-sec text-xs font-semibold hover:text-tea-error hover:bg-tea-error/10 transition-colors"
                  >
                    Cancel {myAttendee.status === 'confirmed' ? 'My Seat' : 'Registration'}
                  </button>
                </div>
                {showCancelConfirm && (
                  <div className="bg-tea-surface border border-tea-border rounded-xl p-5 space-y-3">
                    <p className="text-ui-15 text-tea-text text-center" style={{ fontFamily: 'var(--font-display)' }}>Cancel your spot?</p>
                    <p className="text-ui-12 text-tea-text-sec text-center">This can't be undone. We'll let the host know.</p>
                    {cancelFeedback && <p role="alert" className="text-ui-12 text-tea-error text-center">{cancelFeedback}</p>}
                    <div className="flex justify-between items-center gap-2 pt-1">
                      <button
                        onClick={() => { setShowCancelConfirm(false); setCancelFeedback(''); }}
                        disabled={cancelling}
                        className="px-3 py-2 text-xs font-semibold text-tea-text-sec hover:text-tea-text transition-colors"
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
                            setCancelFeedback('Could not cancel. Please contact us directly.');
                          } finally {
                            setCancelling(false);
                          }
                        }}
                        disabled={cancelling}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md bg-tea-error text-tea-bg text-xs font-semibold hover:bg-tea-error/90 transition-colors disabled:opacity-40"
                      >
                        {cancelling ? 'Cancelling…' : 'Yes, cancel'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              // Default CTA — canonical primary button
              <div className="space-y-2.5">
                <button
                  onClick={() => setShowRSVP(true)}
                  className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-3 rounded-md cta-solid text-xs font-semibold transition-colors"
                >
                  {isInstantConfirm ? 'Reserve my seat' : 'Request your seat'}
                </button>
                {isInstantConfirm && (
                  <p className="text-center text-ui-11 text-tea-text-dim">
                    Confirmed instantly · subject to capacity
                  </p>
                )}
                <p className="text-center text-ui-12 text-tea-text-sec py-2">
                  Already registered?{' '}
                  <button
                    onClick={() => setShowFindRSVP(true)}
                    className="tap-target text-tea-readgold hover:text-tea-gold-lt transition-colors font-semibold"
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
              <p className="subtitle">
                This session is fully gathered.
              </p>
              <button
                onClick={() => setShowRSVP(true)}
                className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-3 rounded-md border border-tea-border text-tea-text-sec text-xs font-semibold hover:text-tea-text hover:bg-tea-accent-sub transition-colors"
              >
                Join the waitlist
              </button>
              <div className="pt-2">
                <p className="text-ui-12 text-tea-text-sec mb-3">Or notify me of the next session:</p>
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
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-md border border-tea-border text-tea-text-sec text-xs font-semibold hover:text-tea-text hover:bg-tea-accent-sub transition-colors group"
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  View session recap
                </button>
              )}
              <p className="text-ui-12 text-tea-text-sec">Notify me of the next one:</p>
              <Suspense fallback={null}>
                <InterestCapture slug={slug!} />
              </Suspense>
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="w-8 h-px bg-tea-border mx-auto mb-8" />

        {/* Description — body-prose */}
        {event.description && (
          <div className="mb-10">
            <p className="body-prose whitespace-pre-line">
              {event.description}
            </p>
          </div>
        )}

        {/* Mood hints — serif italic dots */}
        {moodHints && moodHints.length > 0 && (
          <div className="mb-10 flex flex-wrap gap-0 justify-center">
            {moodHints.map((hint, i) => (
              <span key={i} className="subtitle text-ui-13">
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
              aria-expanded={guidelinesExpanded}
              aria-controls="session-guidelines-panel"
            >
              <h3 className="h3 group-hover:text-tea-readgold transition-colors">
                Session Guidelines
              </h3>
              <ChevronDown
                className={`w-5 h-5 text-tea-text-sec transition-transform duration-300 ${
                  guidelinesExpanded ? 'rotate-180' : ''
                }`}
              />
            </button>
            {guidelinesExpanded && (
              <div id="session-guidelines-panel" className={`pt-2 ${reducedMotion ? '' : 'animate-[fadeIn_0.3s_ease-out]'}`}>
                <ul className="space-y-3">
                  {guidelinesText.split('\n').filter(Boolean).map((guideline, idx) => (
                    <li key={idx} className="flex items-start gap-3 body-light">
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
          <p className="label-caps text-tea-text-dim">
            Hosted by {ev.account_name ?? ev.accountName ?? 'Teajia'}
          </p>
        </div>
      </div>

      {/* RSVP Form Sheet */}
      {showRSVP && slug && (
        <Suspense fallback={null}>
          <RSVPFormSheet slug={slug} onClose={() => setShowRSVP(false)} accountLocationCountry={(event as any).account_location_country} requiresApproval={!isInstantConfirm} />
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

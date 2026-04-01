import React, { useState, lazy, Suspense, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { MapPin, ChevronDown, Users, Search } from 'lucide-react';
import { api } from '../../lib/api';
import { useParallax } from '../../hooks/useParallax';
import type { TeaEvent } from '../../types/events';
import AvailabilityBadge from './AvailabilityBadge';
import EventCountdown from './EventCountdown';

const RSVPFormSheet = lazy(() => import('./RSVPFormSheet'));
const FindRSVPSheet = lazy(() => import('./FindRSVPSheet'));
const VenueGuide = lazy(() => import('./VenueGuide'));
const InterestCapture = lazy(() => import('./InterestCapture'));

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

  const [showRSVP, setShowRSVP] = useState(false);
  const [showFindRSVP, setShowFindRSVP] = useState(false);
  const [guidelinesExpanded, setGuidelinesExpanded] = useState(false);

  // Parallax for flyer image
  const { ref: heroRef, offset: parallaxOffset } = useParallax(0.3);

  // OG meta tags for social sharing previews
  useEffect(() => {
    if (!event) return;

    const { date } = formatEventDate(event.eventDate);
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

  const { date: formattedDate, time: formattedTime, day: formattedDay } = formatEventDate(event.eventDate);
  const isCompleted = event.status === 'closed';
  const isCancelled = event.status === 'archived';
  const isFull = event.seatsRemaining === 0;
  const canRSVP = !isCompleted && !isCancelled && !isFull;
  const showWaitlist = !isCompleted && !isCancelled && isFull;
  const showInterestOnly = isCompleted || isCancelled;

  return (
    <div className="min-h-screen bg-tea-bg animate-[fadeIn_0.5s_ease-out]">
      {/* Hero / Flyer Image */}
      {event.flyerImageUrl && (
        <div ref={heroRef} className="relative w-full overflow-hidden" style={{ maxHeight: '70vh' }}>
          <div
            className="w-full"
            style={{
              transform: `translateY(${parallaxOffset}px)`,
              transition: 'transform 0.1s linear',
            }}
          >
            <img
              src={event.flyerImageUrl}
              alt={event.title}
              className="w-full h-auto object-cover"
              style={{ minHeight: '50vh', maxHeight: '75vh', objectFit: 'cover' }}
            />
          </div>
          <div className="absolute inset-0 bg-gradient-to-t from-tea-bg via-tea-bg/20 to-transparent" />

          {/* Availability badge floating on image */}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2">
            <AvailabilityBadge slug={slug!} />
          </div>
        </div>
      )}

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

          <h1 className="font-serif text-3xl md:text-4xl text-tea-text leading-tight mb-3">
            {event.title}
          </h1>

          {event.subtitle && (
            <p className="text-base text-tea-text-sec font-serif italic mb-6">
              {event.subtitle}
            </p>
          )}

          {/* Date & Time */}
          <div className="mb-5">
            <p className="text-[10px] uppercase tracking-[0.3em] text-tea-text-sec mb-2">{formattedDay}</p>
            <p className="font-serif text-xl text-tea-text">{formattedDate}</p>
            <p className="font-serif text-lg text-tea-gold mt-1">{formattedTime}</p>
          </div>

          {/* Area hint (not full address) or location name */}
          {(event.areaHint || event.locationName) && (
            <div className="flex items-center justify-center gap-2 text-tea-text-sec mb-6">
              <MapPin className="w-4 h-4 text-tea-gold/60" />
              <span className="text-sm">{event.areaHint ?? event.locationName}</span>
            </div>
          )}

          {/* No flyer — badge here */}
          {!event.flyerImageUrl && <AvailabilityBadge slug={slug!} className="mb-6" />}

          {/* Social proof */}
          {(event.confirmedCount ?? 0) > 0 && !isCompleted && (
            <div className="flex items-center justify-center gap-2 text-tea-text-sec mb-6">
              <Users className="w-3.5 h-3.5" />
              <span className="text-xs">
                {event.confirmedCount} {event.confirmedCount === 1 ? 'seat' : 'seats'} confirmed
              </span>
            </div>
          )}

          {/* Countdown */}
          {!isCompleted && !isCancelled && (
            <EventCountdown eventDate={event.eventDate} className="mb-8" />
          )}

          {/* CTA block */}
          {canRSVP && (
            <div className="space-y-3">
              <button
                onClick={() => setShowRSVP(true)}
                className="w-full max-w-xs mx-auto py-4 bg-tea-gold text-white text-xs uppercase tracking-[0.25em] font-semibold rounded-sm hover:bg-tea-gold/90 transition-all duration-300 flex items-center justify-center gap-2 shadow-lg shadow-tea-gold/20"
              >
                Request Your Seat
              </button>
              <button
                onClick={() => setShowFindRSVP(true)}
                className="flex items-center justify-center gap-2 mx-auto text-xs text-tea-text-sec hover:text-tea-gold transition-colors py-2"
              >
                <Search className="w-3.5 h-3.5" />
                Already registered? Find my RSVP
              </button>
            </div>
          )}

          {/* Full / waitlist state */}
          {showWaitlist && (
            <div className="space-y-4 max-w-xs mx-auto">
              <p className="font-serif text-base text-tea-text-sec">
                This session is fully gathered.
              </p>
              <button
                onClick={() => setShowRSVP(true)}
                className="w-full py-3.5 bg-tea-surface border border-tea-border text-tea-text text-xs uppercase tracking-[0.2em] rounded-sm hover:border-tea-gold/40 transition-colors"
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

          {/* Closed / archived — just interest capture */}
          {showInterestOnly && (
            <div className="max-w-xs mx-auto space-y-3">
              <p className="text-xs text-tea-text-sec mb-3">Notify me of the next one:</p>
              <Suspense fallback={null}>
                <InterestCapture slug={slug!} />
              </Suspense>
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="w-12 h-px bg-tea-border mx-auto mb-10" />

        {/* Description */}
        {event.description && (
          <div className="mb-10">
            <p className="text-sm text-tea-text-sec leading-relaxed whitespace-pre-line">
              {event.description}
            </p>
          </div>
        )}

        {/* Mood hints — serif italic, below description */}
        {event.moodHints && event.moodHints.length > 0 && (
          <div className="mb-10 flex flex-wrap gap-2 justify-center">
            {event.moodHints.map((hint, i) => (
              <p
                key={i}
                className="font-serif italic text-sm text-tea-text-sec"
              >
                {i > 0 && <span className="mx-1 opacity-40">·</span>}
                {hint}
              </p>
            ))}
          </div>
        )}

        {/* Guidelines (expandable) */}
        {event.guidelinesText && (
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
                  {event.guidelinesText.split('\n').filter(Boolean).map((guideline, idx) => (
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
          <RSVPFormSheet slug={slug} onClose={() => setShowRSVP(false)} />
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

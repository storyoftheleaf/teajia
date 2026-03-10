import React, { useState, lazy, Suspense } from 'react';
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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-tea-bg flex items-center justify-center">
        <div className="text-center animate-pulse">
          <div className="w-12 h-12 rounded-full bg-tea-gold/10 mx-auto mb-4" />
          <div className="h-3 w-32 bg-tea-text-dim/10 rounded-sm mx-auto" />
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

  const { date: formattedDate, time: formattedTime, day: formattedDay } = formatEventDate(event.event_date);
  const isCompleted = event.status === 'completed';
  const isCancelled = event.status === 'cancelled';
  const canRSVP = !isCompleted && !isCancelled && !event.registration_closed;

  return (
    <div className="min-h-screen bg-tea-bg animate-[fadeIn_0.5s_ease-out]">
      {/* Hero / Flyer Image */}
      {event.flyer_image_url && (
        <div ref={heroRef} className="relative w-full overflow-hidden" style={{ maxHeight: '70vh' }}>
          <div
            className="w-full"
            style={{
              transform: `translateY(${parallaxOffset}px)`,
              transition: 'transform 0.1s linear',
            }}
          >
            <img
              src={event.flyer_image_url}
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
            <p className="text-[10px] uppercase tracking-[0.3em] text-tea-text-dim mb-2">{formattedDay}</p>
            <p className="font-serif text-xl text-tea-text">{formattedDate}</p>
            <p className="font-serif text-lg text-tea-gold mt-1">{formattedTime}</p>
          </div>

          {/* Location */}
          {event.location_name && (
            <div className="flex items-center justify-center gap-2 text-tea-text-sec mb-6">
              <MapPin className="w-4 h-4 text-tea-gold/60" />
              <span className="text-sm">{event.location_name}</span>
            </div>
          )}

          {/* No flyer - show badge here */}
          {!event.flyer_image_url && <AvailabilityBadge slug={slug!} className="mb-6" />}

          {/* Social proof */}
          {event.confirmed_count > 0 && !isCompleted && (
            <div className="flex items-center justify-center gap-2 text-tea-text-dim mb-6">
              <Users className="w-3.5 h-3.5" />
              <span className="text-xs">
                {event.confirmed_count} {event.confirmed_count === 1 ? 'seat' : 'seats'} confirmed
              </span>
            </div>
          )}

          {/* Countdown */}
          {!isCompleted && !isCancelled && (
            <EventCountdown eventDate={event.event_date} className="mb-8" />
          )}

          {/* RSVP Button */}
          {canRSVP && (
            <div className="space-y-3">
              <button
                onClick={() => setShowRSVP(true)}
                className="w-full max-w-xs mx-auto py-4 bg-tea-gold text-white text-xs uppercase tracking-[0.25em] font-semibold rounded-sm hover:bg-tea-gold/90 transition-all duration-300 flex items-center justify-center gap-2 shadow-lg shadow-tea-gold/20"
              >
                RSVP
              </button>
              <button
                onClick={() => setShowFindRSVP(true)}
                className="flex items-center justify-center gap-2 mx-auto text-xs text-tea-text-dim hover:text-tea-gold transition-colors py-2"
              >
                <Search className="w-3.5 h-3.5" />
                Already registered? Find my RSVP
              </button>
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

        {/* Guidelines (expandable) */}
        {event.guidelines && event.guidelines.length > 0 && (
          <div className="mb-10">
            <button
              onClick={() => setGuidelinesExpanded(!guidelinesExpanded)}
              className="flex items-center justify-between w-full py-3 text-left group"
            >
              <h3 className="font-serif text-lg text-tea-text group-hover:text-tea-gold transition-colors">
                Session Guidelines
              </h3>
              <ChevronDown
                className={`w-5 h-5 text-tea-text-dim transition-transform duration-300 ${
                  guidelinesExpanded ? 'rotate-180' : ''
                }`}
              />
            </button>
            {guidelinesExpanded && (
              <div className="animate-[fadeIn_0.3s_ease-out] pt-2">
                <ul className="space-y-3">
                  {event.guidelines.map((guideline, idx) => (
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

        {/* Logistics */}
        {event.logistics_notes && (
          <div className="mb-10">
            <h3 className="font-serif text-lg text-tea-text mb-4">Logistics</h3>
            <div className="p-5 bg-tea-surface border border-tea-border rounded-md">
              <p className="text-sm text-tea-text-sec leading-relaxed whitespace-pre-line">
                {event.logistics_notes}
              </p>
            </div>
          </div>
        )}

        {/* Venue Guide */}
        {event.venue_guide && (
          <Suspense fallback={null}>
            <VenueGuide
              venueGuide={event.venue_guide}
              mapLink={event.map_link}
              className="mb-10"
            />
          </Suspense>
        )}

        {/* Location address + map link */}
        {event.location_address && (
          <div className="mb-10">
            <div className="p-5 bg-tea-surface border border-tea-border rounded-md">
              <div className="flex items-start gap-3">
                <MapPin className="w-4 h-4 text-tea-gold mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm text-tea-text">{event.location_name}</p>
                  <p className="text-xs text-tea-text-dim mt-1">{event.location_address}</p>
                  {event.map_link && (
                    <a
                      href={event.map_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block text-xs text-tea-gold hover:text-tea-gold/80 mt-2 transition-colors"
                    >
                      Open in Maps
                    </a>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="text-center pt-6 pb-12">
          <p className="text-[10px] uppercase tracking-[0.3em] text-tea-text-dim/50">
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

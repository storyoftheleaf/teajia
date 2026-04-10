import React, { useState, lazy, Suspense } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, Clock, AlertCircle, Copy, Check, Bookmark } from 'lucide-react';
import {
  useGuestManagement,
  useCancelRSVP,
  useClaimSeat,
  useMarkBriefed,
} from '../../hooks/useEventPolling';
import { api } from '../../lib/api';
import EventCountdown from './EventCountdown';
import CalendarDownload from './CalendarDownload';
import StoryCardsBriefing from './StoryCardsBriefing';

const VenueGuide = lazy(() => import('./VenueGuide'));
const TeaMenuPreview = lazy(() => import('./TeaMenuPreview'));
const TastingNotesForm = lazy(() => import('./TastingNotesForm'));
const PostSessionArchive = lazy(() => import('./PostSessionArchive'));
const InterestCapture = lazy(() => import('./InterestCapture'));

// ----------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------

function formatEventDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatDay(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', { weekday: 'long' });
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function getClaimTimeRemaining(deadline: string): string {
  const diff = new Date(deadline).getTime() - Date.now();
  if (diff <= 0) return 'Expired';
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  if (hours > 0) return `${hours}h ${mins}m remaining`;
  return `${mins}m remaining`;
}

function isPast(dateStr: string): boolean {
  return new Date(dateStr).getTime() < Date.now();
}

// ----------------------------------------------------------------
// Copy-invite-link button
// ----------------------------------------------------------------
const CopyInviteLink: React.FC<{ inviteToken: string; nameHint?: string; claimedByName?: string }> = ({
  inviteToken,
  nameHint,
  claimedByName,
}) => {
  const [copied, setCopied] = useState(false);

  const inviteUrl = `${window.location.origin}/invite/${inviteToken}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(inviteUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  if (claimedByName) {
    return (
      <div className="flex items-center gap-2 text-sm text-tea-text-sec">
        <Check className="w-3.5 h-3.5 text-tea-gold shrink-0" />
        <span className="font-medium text-tea-text">{claimedByName}</span>
        {nameHint && <span className="text-tea-text-sec">({nameHint})</span>}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      {nameHint && (
        <span className="text-sm text-tea-text-sec italic">{nameHint}</span>
      )}
      <button
        onClick={handleCopy}
        className="flex items-center gap-1.5 text-xs text-tea-gold hover:text-tea-gold/80 transition-colors"
      >
        {copied ? (
          <>
            <Check className="w-3.5 h-3.5" />
            Copied
          </>
        ) : (
          <>
            <Copy className="w-3.5 h-3.5" />
            Copy invite link
          </>
        )}
      </button>
      <span className="text-xs text-tea-text-sec/50">unclaimed</span>
    </div>
  );
};

// ----------------------------------------------------------------
// Main component
// ----------------------------------------------------------------
const GuestManagement: React.FC = () => {
  const { magicToken } = useParams<{ magicToken: string }>();
  const navigate = useNavigate();

  const { data, isLoading, isError, error } = useGuestManagement(magicToken);
  const cancelRSVP = useCancelRSVP(magicToken || '');
  const claimSeat = useClaimSeat(magicToken || '');
  const markBriefed = useMarkBriefed(magicToken || '');

  // Post-session archive data (gallery, session notes, aggregated tasting
  // impressions). Fetched lazily for the post-event recap view. Returns
  // null silently if the host hasn't published post-session data yet.
  const { data: postSession } = useQuery({
    queryKey: ['guest-post-session', magicToken],
    queryFn: async () => {
      try {
        return await api.rsvp.getPostSession(magicToken!);
      } catch {
        return null;
      }
    },
    enabled: !!magicToken && !!data && new Date(data.event.eventDate).getTime() < Date.now(),
    staleTime: 60_000,
  });

  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [guidelinesExpanded, setGuidelinesExpanded] = useState(false);
  const [showBriefing, setShowBriefing] = useState(false);
  const [showTasting, setShowTasting] = useState(true);

  // ---- Loading ----
  if (isLoading) {
    return (
      <div className="min-h-screen bg-tea-bg flex items-center justify-center">
        <div className="text-center animate-pulse">
          <div className="w-12 h-12 rounded-full bg-tea-gold/10 mx-auto mb-4" />
          <div className="h-3 w-40 bg-tea-text-sec/10 rounded-sm mx-auto" />
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="min-h-screen bg-tea-bg flex items-center justify-center px-6">
        <div className="text-center max-w-md">
          <h1 className="font-serif text-3xl text-tea-text mb-4">Reservation Not Found</h1>
          <p className="text-sm text-tea-text-sec mb-8">
            {(error as Error)?.message || 'This link may be invalid or expired.'}
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

  const { attendee, event, guestInvites, briefingCards } = data;
  const eventPast = isPast(event.eventDate);
  const isCompleted = event.status === 'closed' || eventPast;
  const status = attendee.status;

  const handleCancel = () => {
    cancelRSVP.mutate(undefined, {
      onSuccess: () => setShowCancelConfirm(false),
    });
  };

  const handleBriefingComplete = () => {
    setShowBriefing(false);
    markBriefed.mutate();
  };

  // ---- STORY CARDS BRIEFING ----
  // Show on first visit after confirmation if briefing cards exist
  const hasBriefing = Array.isArray(briefingCards) && briefingCards.length > 0;
  const shouldShowBriefing =
    status === 'confirmed' &&
    !attendee.firstVisitBriefed &&
    hasBriefing &&
    !showBriefing; // hasn't been shown yet this session

  // Trigger briefing on mount (once) if needed
  React.useEffect(() => {
    if (shouldShowBriefing) {
      setShowBriefing(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (showBriefing && briefingCards) {
    return (
      <StoryCardsBriefing
        cards={briefingCards}
        onComplete={handleBriefingComplete}
        eventTitle={event.title}
        eventDay={formatDay(event.eventDate)}
        flyerUrl={event.flyerImageUrl}
      />
    );
  }

  // ---- POST-EVENT ----
  if (isCompleted) {
    // Full-screen tasting form — shown first before the post-event summary
    if (showTasting && data.teaMenu && data.teaMenu.length > 0 && magicToken) {
      return (
        <div className="fixed inset-0 z-50 bg-tea-bg overflow-y-auto animate-[fadeIn_0.4s_ease-out]">
          <div className="max-w-xl mx-auto px-6 py-10 pb-[calc(44px+env(safe-area-inset-bottom,0px)+2.5rem)]">
            <div className="text-center mb-8">
              <p className="text-[10px] uppercase tracking-[0.3em] text-tea-text-sec mb-2">
                {formatEventDate(event.eventDate)}
              </p>
              <h1 className="font-serif text-2xl text-tea-text">{event.title}</h1>
            </div>
            <Suspense fallback={null}>
              <TastingNotesForm
                teaMenu={data.teaMenu}
                token={magicToken}
                eventId={event.id}
                eventTitle={event.title}
                onClose={() => setShowTasting(false)}
              />
            </Suspense>
            <button
              onClick={() => setShowTasting(false)}
              className="w-full mt-4 py-3 text-xs uppercase tracking-[0.2em] text-tea-text-dim hover:text-tea-text-sec transition-colors"
            >
              Skip
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-tea-bg animate-[fadeIn_0.5s_ease-out]">
        <div className="max-w-xl mx-auto px-6 py-10">
          <div className="text-center mb-10">
            <p className="text-[10px] uppercase tracking-[0.3em] text-tea-text-sec mb-4">
              {formatEventDate(event.eventDate)}
            </p>
            <h1 className="font-serif text-3xl text-tea-text mb-2">{event.title}</h1>
            <p className="text-sm text-tea-text-sec">Session Complete</p>
          </div>

          <Suspense fallback={null}>
            <PostSessionArchive
              teaMenu={data.teaMenu}
              playlistUrl={postSession?.playlist_url || event.playlistUrl}
              galleryImages={Array.isArray(postSession?.gallery_images) ? postSession.gallery_images : undefined}
              aggregatedNotes={
                Array.isArray(postSession?.tasting_notes)
                  ? (postSession.tasting_notes as Array<{ impression?: string | null }>)
                      .map(n => n.impression)
                      .filter((imp): imp is string => typeof imp === 'string' && imp.trim().length > 0)
                  : undefined
              }
              className="mb-10"
            />
          </Suspense>

          {data.teaMenu && data.teaMenu.length > 0 && magicToken && (
            <Suspense fallback={null}>
              <div className="border-t border-tea-border pt-10">
                <button
                  onClick={() => setShowTasting(true)}
                  className="text-xs uppercase tracking-[0.2em] text-tea-text-sec hover:text-tea-gold transition-colors"
                >
                  Rate the session
                </button>
              </div>
            </Suspense>
          )}

          {/* Notify me of next session */}
          <div className="border-t border-tea-border pt-10 mt-10">
            <p className="font-serif text-base text-tea-text mb-1">Next session</p>
            <p className="text-sm text-tea-text-sec mb-5">
              We'll let you know when the next gathering is announced.
            </p>
            <Suspense fallback={null}>
              <InterestCapture slug={event.slug} />
            </Suspense>
          </div>

          <div className="text-center pt-10 pb-12">
            <p className="text-[10px] uppercase tracking-[0.3em] text-tea-text-sec/50">
              Thank you for attending
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ---- REQUESTED (pending approval) ----
  if (status === 'requested') {
    return (
      <div className="min-h-screen bg-tea-bg animate-[fadeIn_0.5s_ease-out]">
        <div className="max-w-xl mx-auto px-6 py-10">
          {event.flyerImageUrl && (
            <div className="mb-8 rounded-md overflow-hidden border border-tea-border">
              <img
                src={event.flyerImageUrl}
                alt={event.title}
                className="w-full h-auto"
              />
            </div>
          )}
          <div className="text-center mb-8">
            <p className="text-[10px] uppercase tracking-[0.3em] text-tea-text-sec mb-3">
              {formatEventDate(event.eventDate)}
            </p>
            <h1 className="font-serif text-2xl text-tea-text mb-2">{event.title}</h1>
            {event.areaHint && (
              <p className="text-sm text-tea-text-sec mt-1">{event.areaHint}</p>
            )}
          </div>

          <div className="p-7 bg-tea-surface border border-tea-border rounded-md text-center">
            <div className="w-10 h-10 rounded-full bg-tea-gold/10 flex items-center justify-center mx-auto mb-5">
              <span className="text-xl font-serif text-tea-gold">茶</span>
            </div>
            <p className="font-serif text-lg text-tea-text mb-3 leading-snug">
              Your request has been received.
            </p>
            <p className="text-sm text-tea-text-sec leading-relaxed max-w-xs mx-auto">
              We typically confirm within 24 hours.
            </p>
          </div>

          {/* Submission summary */}
          <div className="mt-6 p-5 bg-tea-surface border border-tea-border rounded-md space-y-3">
            <p className="text-[10px] uppercase tracking-[0.2em] text-tea-text-sec">What you submitted</p>
            <div className="flex items-center gap-2 text-sm text-tea-text">
              <span className="text-tea-text-sec text-xs w-16 shrink-0">Name</span>
              <span>{attendee.fullName}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-tea-text">
              <span className="text-tea-text-sec text-xs w-16 shrink-0">Contact</span>
              <span>{attendee.phoneNumber || attendee.email || '—'}</span>
            </div>
            {attendee.guestRequests && attendee.guestRequests.length > 0 && (
              <div>
                <p className="text-[10px] uppercase tracking-[0.2em] text-tea-text-sec mb-2 mt-1">
                  Guest request{attendee.guestRequests.length > 1 ? 's' : ''}
                </p>
                <ul className="space-y-1.5">
                  {attendee.guestRequests.map((g, i) => (
                    <li key={i} className="text-sm text-tea-text-sec flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-tea-border shrink-0" />
                      {g.nameHint}
                      {g.approved === null && (
                        <span className="text-xs text-tea-text-dim">(pending)</span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Bookmark hint */}
          <div className="mt-5 flex items-center gap-2 text-xs text-tea-text-sec justify-center">
            <Bookmark className="w-3.5 h-3.5 shrink-0" />
            <span>Bookmark this page to check your status.</span>
          </div>

          <div className="text-center pt-8 pb-12">
            <p className="text-[10px] uppercase tracking-[0.3em] text-tea-text-sec/50">
              Hosted by Teajia
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ---- DENIED ----
  if (status === 'denied') {
    return (
      <div className="min-h-screen bg-tea-bg flex flex-col items-center justify-center px-6 py-16 animate-[fadeIn_0.5s_ease-out]">
        <div className="max-w-md w-full text-center">
          <h1 className="font-serif text-2xl text-tea-text mb-4">
            This session is at capacity.
          </h1>
          <p className="text-sm text-tea-text-sec leading-relaxed mb-4">
            {attendee.denialMessage ||
              "We weren't able to secure a seat for you this time."}
          </p>
          <p className="text-sm text-tea-text-sec leading-relaxed mb-8">
            We'll reach out when the next session is announced.
          </p>

          <div className="border-t border-tea-border pt-8">
            <p className="text-xs text-tea-text-sec mb-4">
              Want to be notified of the next one?
            </p>
            <Suspense fallback={null}>
              <InterestCapture slug={event.slug} />
            </Suspense>
          </div>
        </div>
      </div>
    );
  }

  // ---- WAITLISTED ----
  if (status === 'waitlist') {
    const hasClaimOffer =
      !!attendee.claimExpiresAt &&
      new Date(attendee.claimExpiresAt).getTime() > Date.now();

    if (hasClaimOffer) {
      return (
        <div className="min-h-screen bg-tea-bg animate-[fadeIn_0.5s_ease-out]">
          <div className="max-w-xl mx-auto px-6 py-10">
            <div className="text-center mb-8">
              <p className="text-[10px] uppercase tracking-[0.3em] text-tea-gold mb-4 animate-pulse">
                A seat has opened
              </p>
              <h1 className="font-serif text-3xl text-tea-text mb-3">{event.title}</h1>
            </div>

            <div className="p-6 bg-tea-surface border-2 border-tea-border rounded-md mb-8">
              <div className="text-center">
                <h2 className="font-serif text-xl text-tea-text mb-2">
                  A seat just became available!
                </h2>
                <p className="text-sm text-tea-text-sec mb-4">
                  Claim it before it goes to the next person on the waitlist.
                </p>

                {attendee.claimExpiresAt && (
                  <div className="flex items-center justify-center gap-2 mb-6 text-tea-gold">
                    <Clock className="w-4 h-4" />
                    <span className="text-xs uppercase tracking-[0.15em] font-medium">
                      {getClaimTimeRemaining(attendee.claimExpiresAt)}
                    </span>
                  </div>
                )}

                <button
                  onClick={() => claimSeat.mutate()}
                  disabled={claimSeat.isPending}
                  className="w-full py-4 bg-tea-gold text-white text-xs uppercase tracking-[0.25em] font-semibold rounded-sm hover:bg-tea-gold/90 disabled:opacity-50 transition-all duration-300 flex items-center justify-center gap-2 shadow-lg shadow-tea-gold/20"
                >
                  {claimSeat.isPending ? (
                    <span className="inline-block w-4 h-4 border-2 border-tea-border border-t-tea-gold rounded-full animate-spin" />
                  ) : (
                    'Claim My Seat'
                  )}
                </button>

                {claimSeat.isError && (
                  <p className="text-sm text-red-400 mt-3">
                    {(claimSeat.error as Error)?.message || 'Failed to claim seat. Please try again.'}
                  </p>
                )}
              </div>
            </div>

            <div className="text-center text-sm text-tea-text-sec">
              <p>{formatEventDate(event.eventDate)}</p>
              <p className="text-tea-gold mt-1">{formatTime(event.eventDate)}</p>
              {event.locationName && <p className="mt-1">{event.locationName}</p>}
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-tea-bg animate-[fadeIn_0.5s_ease-out]">
        <div className="max-w-xl mx-auto px-6 py-10">
          <div className="text-center mb-8">
            <h1 className="font-serif text-2xl text-tea-text mb-3">{event.title}</h1>
            {event.areaHint && (
              <p className="text-sm text-tea-text-sec">{event.areaHint}</p>
            )}
          </div>

          <div className="p-6 bg-tea-surface border border-tea-border rounded-md mb-8 text-center">
            <p className="text-[10px] uppercase tracking-[0.3em] text-tea-text-sec mb-3">
              Your Status
            </p>
            <h2 className="font-serif text-xl text-tea-text-sec mb-2">
              You're on the list.
            </h2>
            <p className="text-sm text-tea-text-sec leading-relaxed">
              {attendee.waitlistPosition
                ? `You're ${attendee.waitlistPosition === 1 ? 'first' : `#${attendee.waitlistPosition}`} in line.`
                : "We'll let you know the moment a seat opens."}
            </p>
          </div>

          <div className="text-center mb-8">
            <p className="text-sm text-tea-text-sec">{formatEventDate(event.eventDate)}</p>
            <p className="text-sm text-tea-gold mt-1">{formatTime(event.eventDate)}</p>
          </div>

          <div className="text-center">
            <button
              onClick={() => setShowCancelConfirm(true)}
              className="text-xs text-tea-text-sec hover:text-red-400 transition-colors uppercase tracking-[0.15em]"
            >
              Cancel my waitlist spot
            </button>
          </div>

          {showCancelConfirm && (
            <CancelConfirmModal
              attendeeName={attendee.fullName}
              onConfirm={handleCancel}
              onClose={() => setShowCancelConfirm(false)}
              isPending={cancelRSVP.isPending}
            />
          )}
        </div>
      </div>
    );
  }

  // ---- CANCELLED ----
  if (status === 'cancelled') {
    return (
      <div className="min-h-screen bg-tea-bg flex items-center justify-center px-6 animate-[fadeIn_0.5s_ease-out]">
        <div className="text-center max-w-md">
          <h1 className="font-serif text-3xl text-tea-text mb-4">Reservation Cancelled</h1>
          <p className="text-sm text-tea-text-sec mb-8">
            Your reservation for <span className="text-tea-text">{event.title}</span> has been cancelled.
            {attendee.cancellationNote && (
              <span className="block mt-2">{attendee.cancellationNote}</span>
            )}
          </p>
          <button
            onClick={() => navigate(`/event/${event.slug}`)}
            className="px-8 py-3 bg-tea-gold text-white text-xs uppercase tracking-[0.2em] hover:bg-tea-gold/90 transition-colors"
          >
            View Event
          </button>
        </div>
      </div>
    );
  }

  // ---- CONFIRMED ----
  // Show approved guest invite links
  const approvedGuests = guestInvites?.filter((_) => true) ?? []; // all invites shown

  return (
    <div className="min-h-screen bg-tea-bg animate-[fadeIn_0.5s_ease-out]">
      <div className="max-w-xl mx-auto px-6 py-10">
        {/* Ticket card */}
        <div className="border-2 border-tea-border rounded-md overflow-hidden mb-8">
          {event.flyerImageUrl && (
            <img
              src={event.flyerImageUrl}
              alt={event.title}
              className="w-full h-auto"
            />
          )}
          <div className="p-6 text-center bg-tea-surface">
            <p className="text-[10px] uppercase tracking-[0.3em] text-tea-gold mb-3">
              Your seat is confirmed
            </p>
            <h1 className="font-serif text-2xl md:text-3xl text-tea-text mb-2">
              {event.title}
            </h1>
            <p className="text-sm text-tea-text-sec mt-3">{attendee.fullName}</p>

            <div className="w-8 h-px bg-tea-gold/30 mx-auto my-5" />

            <p className="font-serif text-base text-tea-text">{formatEventDate(event.eventDate)}</p>
            <p className="font-serif text-base text-tea-gold mt-1">{formatTime(event.eventDate)}</p>
            {event.locationName && (
              <p className="text-sm text-tea-text-sec mt-2">{event.locationName}</p>
            )}
          </div>
        </div>

        {/* Countdown */}
        <EventCountdown eventDate={event.eventDate} className="mb-8" />

        {/* Calendar download */}
        <div className="flex justify-center mb-10">
          <CalendarDownload event={event} />
        </div>

        {/* Guest invite links */}
        {approvedGuests.length > 0 && (
          <div className="mb-10 p-5 bg-tea-surface border border-tea-border rounded-md">
            <p className="text-[10px] uppercase tracking-[0.2em] text-tea-text-sec mb-4">
              Your guests
            </p>
            <div className="space-y-3">
              {approvedGuests.map((invite, idx) => (
                <div key={invite.id} className="flex items-start gap-3">
                  <span className="text-xs text-tea-text-sec w-12 shrink-0 pt-0.5">
                    Slot {idx + 1}
                  </span>
                  <CopyInviteLink
                    inviteToken={invite.inviteToken}
                    nameHint={invite.nameHint}
                    claimedByName={invite.claimedByName}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="w-12 h-px bg-tea-border mx-auto mb-10" />

        {/* Full address (only for confirmed) */}
        {event.addressText && (
          <div className="mb-10 p-5 bg-tea-surface border border-tea-border rounded-md">
            <p className="text-sm font-medium text-tea-text mb-1">{event.locationName}</p>
            <p className="text-sm text-tea-text-sec">{event.addressText}</p>
            {event.mapLink && (
              <a
                href={event.mapLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block text-xs text-tea-gold hover:text-tea-gold/80 mt-2 transition-colors"
              >
                Open in Maps
              </a>
            )}
          </div>
        )}

        {/* Venue guide */}
        {event.venueGuide && (
          <Suspense fallback={null}>
            <VenueGuide
              venueGuide={event.venueGuide}
              mapLink={event.mapLink}
              className="mb-10"
            />
          </Suspense>
        )}

        {/* Tea menu preview */}
        {data.teaMenu && data.teaMenu.length > 0 && (
          <Suspense fallback={null}>
            <TeaMenuPreview
              teaMenu={data.teaMenu}
              eventDate={event.eventDate}
              className="mb-10"
            />
          </Suspense>
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
                  {event.guidelinesText.split('\n').filter(Boolean).map((line, idx) => (
                    <li key={idx} className="flex items-start gap-3 text-sm text-tea-text-sec">
                      <span className="w-1.5 h-1.5 rounded-full bg-tea-gold/40 mt-1.5 shrink-0" />
                      {line}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Journey link */}
        <div className="flex justify-center mb-8">
          <a href="/journey" className="text-sm text-tea-text-sec hover:text-tea-gold transition-colors">
            View your tea journey →
          </a>
        </div>

        {/* Cancel reservation */}
        <div className="text-center pt-6 pb-12 border-t border-tea-border">
          <button
            onClick={() => setShowCancelConfirm(true)}
            className="text-xs text-tea-text-sec hover:text-red-400 transition-colors uppercase tracking-[0.15em] py-3"
          >
            Cancel my reservation
          </button>
        </div>

        {showCancelConfirm && (
          <CancelConfirmModal
            attendeeName={attendee.fullName}
            onConfirm={handleCancel}
            onClose={() => setShowCancelConfirm(false)}
            isPending={cancelRSVP.isPending}
          />
        )}
      </div>
    </div>
  );
};

// ----------------------------------------------------------------
// Cancel Confirmation Modal
// ----------------------------------------------------------------
interface CancelConfirmModalProps {
  attendeeName: string;
  onConfirm: () => void;
  onClose: () => void;
  isPending: boolean;
}

const CancelConfirmModal: React.FC<CancelConfirmModalProps> = ({
  attendeeName,
  onConfirm,
  onClose,
  isPending,
}) => {
  return (
    <div
      className="fixed inset-0 z-modal bg-tea-text/80 backdrop-blur-sm flex items-center justify-center p-6 animate-[fadeIn_0.2s_ease-out]"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="bg-tea-bg border border-tea-border rounded-md p-6 max-w-sm w-full shadow-2xl animate-[scaleIn_0.25s_ease-out]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3 mb-5">
          <AlertCircle className="w-5 h-5 text-red-400 mt-0.5 shrink-0" />
          <div>
            <h3 className="font-serif text-lg text-tea-text mb-2">Cancel Reservation?</h3>
            <p className="text-sm text-tea-text-sec">
              Are you sure you want to cancel{' '}
              <span className="text-tea-text">{attendeeName}'s</span> reservation?
            </p>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 bg-tea-surface border border-tea-border text-tea-text text-xs uppercase tracking-[0.15em] rounded-sm hover:bg-tea-elevated transition-colors"
          >
            Keep My Seat
          </button>
          <button
            onClick={onConfirm}
            disabled={isPending}
            className="flex-1 py-3 bg-red-500/10 border border-red-500/20 text-red-400 text-xs uppercase tracking-[0.15em] rounded-sm hover:bg-red-500/20 disabled:opacity-50 transition-colors flex items-center justify-center"
          >
            {isPending ? (
              <span className="inline-block w-4 h-4 border-2 border-red-400/30 border-t-red-400 rounded-full animate-spin" />
            ) : (
              'Cancel'
            )}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes scaleIn {
          from { transform: scale(0.95); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
};

export default GuestManagement;

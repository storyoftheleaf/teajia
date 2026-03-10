import React, { useState, lazy, Suspense } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Users, X, ChevronDown, Clock, AlertCircle } from 'lucide-react';
import {
  useGuestManagement,
  useUpdatePlusOne,
  useCancelRSVP,
  useClaimSeat,
} from '../../hooks/useEventPolling';
import type { GuestManagementData } from '../../types/events';
import EventCountdown from './EventCountdown';
import CalendarDownload from './CalendarDownload';
import AvailabilityBadge from './AvailabilityBadge';

const VenueGuide = lazy(() => import('./VenueGuide'));
const TeaMenuPreview = lazy(() => import('./TeaMenuPreview'));
const TastingNotesForm = lazy(() => import('./TastingNotesForm'));
const PostSessionArchive = lazy(() => import('./PostSessionArchive'));

function formatEventDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function isDayOf(eventDate: string): boolean {
  const now = new Date();
  const event = new Date(eventDate);
  return now.toDateString() === event.toDateString();
}

function getClaimTimeRemaining(deadline: string): string {
  const diff = new Date(deadline).getTime() - Date.now();
  if (diff <= 0) return 'Expired';
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  if (hours > 0) return `${hours}h ${mins}m remaining`;
  return `${mins}m remaining`;
}

const GuestManagement: React.FC = () => {
  const { magicToken } = useParams<{ magicToken: string }>();
  const navigate = useNavigate();

  const { data, isLoading, isError, error } = useGuestManagement(magicToken);
  const updatePlusOne = useUpdatePlusOne(magicToken || '');
  const cancelRSVP = useCancelRSVP(magicToken || '');
  const claimSeat = useClaimSeat(magicToken || '');

  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [plusOneName, setPlusOneName] = useState('');
  const [guidelinesExpanded, setGuidelinesExpanded] = useState(false);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-tea-bg flex items-center justify-center">
        <div className="text-center animate-pulse">
          <div className="w-12 h-12 rounded-full bg-tea-gold/10 mx-auto mb-4" />
          <div className="h-3 w-40 bg-tea-text-dim/10 rounded-sm mx-auto" />
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

  const { attendee, event } = data;
  const isCompleted = event.status === 'completed';
  const isConfirmed = attendee.status === 'confirmed';
  const isWaitlisted = attendee.status === 'waitlisted';
  const isCancelled = attendee.status === 'cancelled';
  const hasClaimOffer = attendee.claim_status === 'offered' && attendee.claim_deadline;
  const showDayOf = isDayOf(event.event_date);

  // Initialize plus one name
  if (attendee.plus_one_name && !plusOneName) {
    setPlusOneName(attendee.plus_one_name);
  }

  const handleTogglePlusOne = () => {
    if (attendee.plus_one) {
      updatePlusOne.mutate({ plusOne: false });
    } else {
      updatePlusOne.mutate({ plusOne: true, plusOneName: plusOneName || undefined });
    }
  };

  const handleUpdatePlusOneName = () => {
    if (plusOneName.trim()) {
      updatePlusOne.mutate({ plusOne: true, plusOneName: plusOneName.trim() });
    }
  };

  const handleCancel = () => {
    cancelRSVP.mutate(undefined, {
      onSuccess: () => setShowCancelConfirm(false),
    });
  };

  const handleClaim = () => {
    claimSeat.mutate();
  };

  // --- POST-EVENT STATE ---
  if (isCompleted) {
    return (
      <div className="min-h-screen bg-tea-bg animate-[fadeIn_0.5s_ease-out]">
        <div className="max-w-xl mx-auto px-6 py-10">
          {/* Completed header */}
          <div className="text-center mb-10">
            <p className="text-[10px] uppercase tracking-[0.3em] text-tea-text-dim mb-4">
              {formatEventDate(event.event_date)}
            </p>
            <h1 className="font-serif text-3xl text-tea-text mb-2">{event.title}</h1>
            <p className="text-sm text-tea-text-sec">Session Complete</p>
          </div>

          {/* Post-session archive */}
          <Suspense fallback={null}>
            <PostSessionArchive
              teaMenu={event.tea_menu}
              playlistUrl={event.playlist_url}
              galleryImages={event.gallery_images}
              aggregatedNotes={event.aggregated_notes}
              className="mb-10"
            />
          </Suspense>

          {/* Tasting notes form */}
          {event.tea_menu && event.tea_menu.length > 0 && magicToken && (
            <Suspense fallback={null}>
              <div className="border-t border-tea-border pt-10">
                <TastingNotesForm teaMenu={event.tea_menu} token={magicToken} />
              </div>
            </Suspense>
          )}

          {/* Footer */}
          <div className="text-center pt-10 pb-12">
            <p className="text-[10px] uppercase tracking-[0.3em] text-tea-text-dim/50">
              Thank you for attending
            </p>
          </div>
        </div>
      </div>
    );
  }

  // --- CANCELLED GUEST ---
  if (isCancelled) {
    return (
      <div className="min-h-screen bg-tea-bg flex items-center justify-center px-6 animate-[fadeIn_0.5s_ease-out]">
        <div className="text-center max-w-md">
          <h1 className="font-serif text-3xl text-tea-text mb-4">Reservation Cancelled</h1>
          <p className="text-sm text-tea-text-sec mb-8">
            Your reservation for <span className="text-tea-text">{event.title}</span> has been cancelled.
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

  // --- PRE-EVENT: CLAIM AVAILABLE (waitlisted with open claim) ---
  if (isWaitlisted && hasClaimOffer) {
    return (
      <div className="min-h-screen bg-tea-bg animate-[fadeIn_0.5s_ease-out]">
        <div className="max-w-xl mx-auto px-6 py-10">
          <div className="text-center mb-8">
            <p className="text-[10px] uppercase tracking-[0.3em] text-tea-gold mb-4 animate-pulse">
              A seat has opened
            </p>
            <h1 className="font-serif text-3xl text-tea-text mb-3">{event.title}</h1>
          </div>

          {/* Claim card */}
          <div className="p-6 bg-tea-surface border-2 border-tea-gold/40 rounded-md mb-8 animate-[fadeIn_0.5s_ease-out]">
            <div className="text-center">
              <h2 className="font-serif text-xl text-tea-text mb-2">
                A seat just became available!
              </h2>
              <p className="text-sm text-tea-text-sec mb-4">
                Claim it before it goes to the next person on the waitlist.
              </p>

              {/* Claim deadline */}
              {attendee.claim_deadline && (
                <div className="flex items-center justify-center gap-2 mb-6 text-tea-gold">
                  <Clock className="w-4 h-4" />
                  <span className="text-xs uppercase tracking-[0.15em] font-medium">
                    {getClaimTimeRemaining(attendee.claim_deadline)}
                  </span>
                </div>
              )}

              <button
                onClick={handleClaim}
                disabled={claimSeat.isPending}
                className="w-full py-4 bg-tea-gold text-white text-xs uppercase tracking-[0.25em] font-semibold rounded-sm hover:bg-tea-gold/90 disabled:opacity-50 transition-all duration-300 flex items-center justify-center gap-2 shadow-lg shadow-tea-gold/20"
              >
                {claimSeat.isPending ? (
                  <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
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

          {/* Event info */}
          <div className="text-center text-sm text-tea-text-sec">
            <p>{formatEventDate(event.event_date)}</p>
            <p className="text-tea-gold mt-1">{formatTime(event.event_date)}</p>
            {event.location_name && <p className="mt-1">{event.location_name}</p>}
          </div>
        </div>
      </div>
    );
  }

  // --- PRE-EVENT: WAITLISTED ---
  if (isWaitlisted) {
    return (
      <div className="min-h-screen bg-tea-bg animate-[fadeIn_0.5s_ease-out]">
        <div className="max-w-xl mx-auto px-6 py-10">
          <div className="text-center mb-8">
            <h1 className="font-serif text-3xl text-tea-text mb-3">{event.title}</h1>
          </div>

          {/* Waitlist card - muted */}
          <div className="p-6 bg-tea-surface border border-tea-border rounded-md mb-8">
            <div className="text-center">
              <p className="text-[10px] uppercase tracking-[0.3em] text-tea-text-dim mb-3">
                Your Status
              </p>
              <h2 className="font-serif text-xl text-tea-text-sec mb-2">
                Awaiting Your Seat
              </h2>
              <p className="text-sm text-tea-text-dim mb-1">
                You're on the waitlist. We'll notify you if a spot opens up.
              </p>
              {event.waitlist_count > 1 && (
                <p className="text-xs text-tea-text-dim/60 mt-2">
                  Others are waiting too
                </p>
              )}
            </div>
          </div>

          {/* Event details */}
          <div className="text-center mb-8">
            <p className="text-sm text-tea-text-sec">{formatEventDate(event.event_date)}</p>
            <p className="text-sm text-tea-gold mt-1">{formatTime(event.event_date)}</p>
            {event.location_name && (
              <p className="text-sm text-tea-text-dim mt-1">{event.location_name}</p>
            )}
          </div>

          {/* Cancel option */}
          <div className="text-center">
            <button
              onClick={() => setShowCancelConfirm(true)}
              className="text-xs text-tea-text-dim hover:text-red-400 transition-colors uppercase tracking-[0.15em]"
            >
              Cancel my waitlist spot
            </button>
          </div>

          {/* Cancel confirmation */}
          {showCancelConfirm && (
            <CancelConfirmModal
              attendeeName={attendee.full_name}
              plusOneName={attendee.plus_one ? attendee.plus_one_name : undefined}
              onConfirm={handleCancel}
              onClose={() => setShowCancelConfirm(false)}
              isPending={cancelRSVP.isPending}
            />
          )}
        </div>
      </div>
    );
  }

  // --- PRE-EVENT: CONFIRMED (default) ---
  return (
    <div className="min-h-screen bg-tea-bg animate-[fadeIn_0.5s_ease-out]">
      <div className="max-w-xl mx-auto px-6 py-10">
        {/* Flyer card with gold border */}
        <div className="border-2 border-tea-gold/30 rounded-md overflow-hidden mb-8">
          {event.flyer_image_url && (
            <img
              src={event.flyer_image_url}
              alt={event.title}
              className="w-full h-auto"
            />
          )}
          <div className="p-6 text-center bg-tea-surface">
            <p className="text-[10px] uppercase tracking-[0.3em] text-tea-gold mb-3">
              Your seat has been set
            </p>
            <h1 className="font-serif text-2xl md:text-3xl text-tea-text mb-2">
              {event.title}
            </h1>

            {/* Guest info */}
            <p className="text-sm text-tea-text-sec mt-3">
              {attendee.full_name}
              {attendee.plus_one && attendee.plus_one_name && (
                <span className="text-tea-text-dim"> + {attendee.plus_one_name}</span>
              )}
            </p>

            <div className="w-8 h-px bg-tea-gold/30 mx-auto my-5" />

            <p className="font-serif text-base text-tea-text">{formatEventDate(event.event_date)}</p>
            <p className="font-serif text-base text-tea-gold mt-1">{formatTime(event.event_date)}</p>
            {event.location_name && (
              <p className="text-sm text-tea-text-dim mt-2">{event.location_name}</p>
            )}
          </div>
        </div>

        {/* Countdown */}
        <EventCountdown eventDate={event.event_date} className="mb-8" />

        {/* Calendar download */}
        <div className="flex justify-center mb-10">
          <CalendarDownload event={event} />
        </div>

        {/* Divider */}
        <div className="w-12 h-px bg-tea-border mx-auto mb-10" />

        {/* +1 management */}
        <div className="mb-8">
          <div className="p-5 bg-tea-surface border border-tea-border rounded-md">
            <div className="flex items-center justify-between mb-1">
              <div>
                <p className="text-sm text-tea-text font-medium">Plus One</p>
                <p className="text-xs text-tea-text-dim mt-0.5">
                  {attendee.plus_one ? 'A second seat is reserved' : 'Bring a guest'}
                </p>
              </div>
              <button
                type="button"
                onClick={handleTogglePlusOne}
                disabled={updatePlusOne.isPending}
                className={`relative w-11 h-6 rounded-full transition-colors duration-300 ${
                  attendee.plus_one ? 'bg-tea-gold' : 'bg-tea-text-dim/20'
                }`}
                aria-label="Toggle plus one"
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-300 ${
                    attendee.plus_one ? 'translate-x-5' : ''
                  }`}
                />
              </button>
            </div>

            {attendee.plus_one && (
              <div className="mt-3 flex gap-2 animate-[fadeIn_0.3s_ease-out]">
                <input
                  type="text"
                  value={plusOneName}
                  onChange={(e) => setPlusOneName(e.target.value)}
                  placeholder="Guest's name"
                  className="flex-1 px-3 py-2.5 bg-tea-bg border border-tea-border rounded-sm text-tea-text text-sm placeholder:text-tea-text-dim/50 focus:outline-none focus:border-tea-gold/50 transition-colors"
                />
                {plusOneName !== (attendee.plus_one_name || '') && (
                  <button
                    onClick={handleUpdatePlusOneName}
                    disabled={updatePlusOne.isPending}
                    className="px-4 py-2.5 bg-tea-gold text-white text-xs rounded-sm hover:bg-tea-gold/90 disabled:opacity-50 transition-colors"
                  >
                    Save
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Venue guide */}
        {event.venue_guide && (
          <Suspense fallback={null}>
            <VenueGuide
              venueGuide={event.venue_guide}
              mapLink={event.map_link}
              className="mb-10"
            />
          </Suspense>
        )}

        {/* Session flow (day-of only) */}
        {showDayOf && event.session_flow && event.session_flow.length > 0 && (
          <div className="mb-10 animate-[fadeIn_0.5s_ease-out]">
            <h3 className="font-serif text-xl text-tea-text mb-5">Today's Flow</h3>
            <div className="space-y-0">
              {event.session_flow.map((item, idx) => (
                <div key={idx} className="flex gap-4 pb-5 relative">
                  {/* Timeline line */}
                  {idx < event.session_flow!.length - 1 && (
                    <div className="absolute left-[11px] top-6 bottom-0 w-px bg-tea-border" />
                  )}
                  {/* Dot */}
                  <div className="w-6 h-6 rounded-full border-2 border-tea-gold/40 bg-tea-bg flex items-center justify-center shrink-0 relative z-10">
                    <div className="w-2 h-2 rounded-full bg-tea-gold" />
                  </div>
                  <div className="flex-1 min-w-0 pt-0.5">
                    <p className="text-xs text-tea-gold uppercase tracking-[0.15em] mb-1">{item.time}</p>
                    <p className="text-sm text-tea-text font-medium">{item.title}</p>
                    {item.description && (
                      <p className="text-xs text-tea-text-dim mt-1">{item.description}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tea menu preview */}
        {event.tea_menu && event.tea_menu.length > 0 && (
          <Suspense fallback={null}>
            <TeaMenuPreview
              teaMenu={event.tea_menu}
              eventDate={event.event_date}
              className="mb-10"
            />
          </Suspense>
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

        {/* Cancel reservation */}
        <div className="text-center pt-6 pb-12 border-t border-tea-border">
          <button
            onClick={() => setShowCancelConfirm(true)}
            className="text-xs text-tea-text-dim hover:text-red-400 transition-colors uppercase tracking-[0.15em] py-3"
          >
            Cancel my reservation
          </button>
        </div>

        {/* Cancel confirmation modal */}
        {showCancelConfirm && (
          <CancelConfirmModal
            attendeeName={attendee.full_name}
            plusOneName={attendee.plus_one ? attendee.plus_one_name : undefined}
            onConfirm={handleCancel}
            onClose={() => setShowCancelConfirm(false)}
            isPending={cancelRSVP.isPending}
          />
        )}
      </div>
    </div>
  );
};

// --- Cancel Confirmation Modal ---
interface CancelConfirmModalProps {
  attendeeName: string;
  plusOneName?: string;
  onConfirm: () => void;
  onClose: () => void;
  isPending: boolean;
}

const CancelConfirmModal: React.FC<CancelConfirmModalProps> = ({
  attendeeName,
  plusOneName,
  onConfirm,
  onClose,
  isPending,
}) => {
  return (
    <div
      className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm flex items-center justify-center p-6 animate-[fadeIn_0.2s_ease-out]"
      onClick={onClose}
    >
      <div
        className="bg-tea-bg border border-tea-border rounded-md p-6 max-w-sm w-full shadow-2xl animate-[scaleIn_0.3s_ease-out]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3 mb-5">
          <AlertCircle className="w-5 h-5 text-red-400 mt-0.5 shrink-0" />
          <div>
            <h3 className="font-serif text-lg text-tea-text mb-2">Cancel Reservation?</h3>
            <p className="text-sm text-tea-text-sec">
              Are you sure you want to cancel your reservation?
              {plusOneName && (
                <> This will also cancel <span className="text-tea-text">{plusOneName}'s</span> spot.</>
              )}
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

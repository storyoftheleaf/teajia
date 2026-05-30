import React from 'react';
import { Clock } from 'lucide-react';
import type { EventAttendee, TeaEvent } from '../../../types/events';
import { formatEventDate, formatTime, getClaimTimeRemaining } from './helpers';
import CancelConfirmModal from './CancelConfirmModal';

interface WaitlistViewProps {
  attendee: EventAttendee;
  event: TeaEvent;
  // Claim-seat mutation
  onClaimSeat: () => void;
  claimPending: boolean;
  claimIsError: boolean;
  claimError: unknown;
  // Cancel flow
  showCancelConfirm: boolean;
  onOpenCancelConfirm: () => void;
  onCloseCancelConfirm: () => void;
  onConfirmCancel: () => void;
  cancelPending: boolean;
}

const WaitlistView: React.FC<WaitlistViewProps> = ({
  attendee,
  event,
  onClaimSeat,
  claimPending,
  claimIsError,
  claimError,
  showCancelConfirm,
  onOpenCancelConfirm,
  onCloseCancelConfirm,
  onConfirmCancel,
  cancelPending,
}) => {
  const hasClaimOffer =
    !!attendee.claimExpiresAt &&
    new Date(attendee.claimExpiresAt).getTime() > Date.now();

  if (hasClaimOffer) {
    return (
      <div className="min-h-screen bg-tea-bg animate-[fadeIn_0.5s_ease-out] pb-nav">
        <div className="max-w-xl mx-auto px-6 py-10">
          <div className="text-center mb-8">
            <p className="text-ui-10 uppercase tracking-[0.3em] text-tea-gold mb-4 animate-pulse">
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
                  <span className="text-xs font-medium">
                    {getClaimTimeRemaining(attendee.claimExpiresAt)}
                  </span>
                </div>
              )}

              <button
                onClick={onClaimSeat}
                disabled={claimPending}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-md bg-tea-gold text-tea-bg text-xs font-semibold hover:bg-tea-gold/90 disabled:opacity-50 transition-colors"
              >
                {claimPending ? (
                  <span className="inline-block w-4 h-4 border-2 border-tea-bg/40 border-t-tea-bg rounded-full animate-spin" />
                ) : (
                  'Claim my seat'
                )}
              </button>

              {claimIsError && (
                <p className="text-ui-12 text-tea-error mt-3">
                  {(claimError as Error)?.message || 'Failed to claim seat. Please try again.'}
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
    <div className="min-h-screen bg-tea-bg animate-[fadeIn_0.5s_ease-out] pb-nav">
      <div className="max-w-xl mx-auto px-6 py-10">
        <div className="text-center mb-8">
          <h1 className="font-serif text-2xl text-tea-text mb-3">{event.title}</h1>
          {event.areaHint && (
            <p className="text-sm text-tea-text-sec">{event.areaHint}</p>
          )}
        </div>

        <div className="p-6 bg-tea-surface border border-tea-border rounded-md mb-8 text-center">
          <p className="text-ui-10 uppercase tracking-[0.3em] text-tea-text-sec mb-3">
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
            onClick={onOpenCancelConfirm}
            className="tap-target text-xs font-semibold text-tea-text-sec hover:text-tea-error transition-colors"
          >
            Cancel my waitlist spot
          </button>
        </div>

        {showCancelConfirm && (
          <CancelConfirmModal
            attendeeName={attendee.fullName}
            onConfirm={onConfirmCancel}
            onClose={onCloseCancelConfirm}
            isPending={cancelPending}
          />
        )}
      </div>
    </div>
  );
};

export default WaitlistView;

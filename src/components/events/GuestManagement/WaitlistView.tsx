import React from 'react';
import { Clock } from 'lucide-react';
import type { EventAttendee, TeaEvent } from '../../../types/events';
import { formatEventDate, formatTime, getClaimTimeRemaining } from './helpers';
import CancelConfirmModal from './CancelConfirmModal';
import type { SessionMoment } from '../../../../shared/sessionEnd';
import { anyoneHostsOpen } from '../../../lib/anyoneHosts';

interface WaitlistViewProps {
  attendee: EventAttendee;
  event: TeaEvent;
  /** Where the table stands now. From the start no seat is offered to claim (review A9-6). */
  moment?: SessionMoment;
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
  moment = 'before',
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
  // A person's table's wording is Launch 3's (J13); closed, the guest sees their place in line, as on main.
  const personsTableWords = event.privateHost === true && anyoneHostsOpen();
  const hasClaimOffer =
    moment === 'before' &&
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
                className="btn-primary btn-primary-lg w-full"
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
            <p>{formatEventDate(event.eventDate, event.timezone)}</p>
            <p className="text-tea-gold mt-1">{formatTime(event.eventDate, event.timezone)}</p>
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
            {personsTableWords ? "You're on the waiting list." : "You're on the list."}
          </h2>
          <p className="text-sm text-tea-text-sec leading-relaxed">
            {personsTableWords
              // A person's table: a freed seat sends the guest back to asking, and the host answers (J13 finding 1).
              ? 'The table is full. If a seat opens, the host will answer you.'
              : attendee.waitlistPosition
              ? `You're ${attendee.waitlistPosition === 1 ? 'first' : `#${attendee.waitlistPosition}`} in line.`
              : "We'll let you know the moment a seat opens."}
          </p>
        </div>

        <div className="text-center mb-8">
          <p className="text-sm text-tea-text-sec">{formatEventDate(event.eventDate, event.timezone)}</p>
          <p className="text-sm text-tea-gold mt-1">{formatTime(event.eventDate, event.timezone)}</p>
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

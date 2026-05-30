import React, { Suspense, lazy } from 'react';
import { ChevronDown, Check, Save } from 'lucide-react';
import type { GuestManagementData } from '../../../types/events';
import { formatEventDate, formatTime } from './helpers';
import EventCountdown from '../EventCountdown';
import CalendarDownload from '../CalendarDownload';
import CopyInviteLink from './CopyInviteLink';
import CancelConfirmModal from './CancelConfirmModal';

const VenueGuide = lazy(() => import('../VenueGuide'));
const TeaMenuPreview = lazy(() => import('../TeaMenuPreview'));

interface ConfirmedViewProps {
  data: GuestManagementData;
  statusBanner: React.ReactNode;
  // Guidelines accordion
  guidelinesExpanded: boolean;
  onToggleGuidelines: () => void;
  // Plus-one toggle
  currentPlusOne: boolean;
  onTogglePlusOne: () => void;
  updateGuestsPending: boolean;
  updateGuestsIsError: boolean;
  updateGuestsError: unknown;
  // Dietary notes
  currentNotes: string;
  onChangeNotes: (value: string) => void;
  onSaveNotes: () => void;
  notesSaved: boolean;
  updateNotesPending: boolean;
  updateNotesIsError: boolean;
  updateNotesError: unknown;
  // Guest-list visibility
  onToggleGuestListVisibility: (checked: boolean) => void;
  updateVisibilityPending: boolean;
  updateVisibilityIsError: boolean;
  updateVisibilityError: unknown;
  // Cancel flow
  showCancelConfirm: boolean;
  onOpenCancelConfirm: () => void;
  onCloseCancelConfirm: () => void;
  onConfirmCancel: () => void;
  cancelPending: boolean;
}

const ConfirmedView: React.FC<ConfirmedViewProps> = ({
  data,
  statusBanner,
  guidelinesExpanded,
  onToggleGuidelines,
  currentPlusOne,
  onTogglePlusOne,
  updateGuestsPending,
  updateGuestsIsError,
  updateGuestsError,
  currentNotes,
  onChangeNotes,
  onSaveNotes,
  notesSaved,
  updateNotesPending,
  updateNotesIsError,
  updateNotesError,
  onToggleGuestListVisibility,
  updateVisibilityPending,
  updateVisibilityIsError,
  updateVisibilityError,
  showCancelConfirm,
  onOpenCancelConfirm,
  onCloseCancelConfirm,
  onConfirmCancel,
  cancelPending,
}) => {
  const { attendee, event, guestInvites } = data;
  const status = attendee.status;

  // Show approved guest invite links
  const approvedGuests = guestInvites ?? [];

  return (
    <div className="min-h-screen bg-tea-bg animate-[fadeIn_0.5s_ease-out]">
      {statusBanner}
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
            <p className="text-ui-10 uppercase tracking-[0.3em] text-tea-gold mb-3">
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

        {/* Guest invite links — divide-y list rows with identity miniatures */}
        {approvedGuests.length > 0 && (
          <div className="mb-10 bg-tea-surface border border-tea-border rounded-xl overflow-hidden">
            <p className="label-caps px-5 pt-5 pb-3">
              Your guests
            </p>
            <div className="divide-y divide-tea-border">
              {approvedGuests.map((invite) => (
                <div key={invite.id} className="flex items-center gap-3 px-5 py-4">
                  <CopyInviteLink
                    inviteToken={invite.inviteToken}
                    nameHint={invite.nameHint}
                    contact={invite.contact}
                    eventTitle={event.title}
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

        {/* Venue photos — only shown to confirmed attendees */}
        {event.venuePhotos && event.venuePhotos.length > 0 && (
          <div className="mb-10">
            <p className="text-ui-10 uppercase tracking-[0.3em] text-tea-text-sec mb-4">The Space</p>
            <div className={`grid gap-2 ${event.venuePhotos.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
              {event.venuePhotos.slice(0, 2).map((url, idx) => (
                <div key={idx} className="rounded-md overflow-hidden border border-tea-border aspect-[4/3]">
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
              onClick={onToggleGuidelines}
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

        {/* Guest count toggle (plus one) */}
        {status === 'confirmed' && (
          <div className="mb-8 p-5 bg-tea-surface border border-tea-border rounded-md">
            <p className="text-ui-10 uppercase tracking-[0.2em] text-tea-text-sec mb-3">
              Bringing a guest?
            </p>
            <div className="flex items-center gap-3">
              <button
                onClick={onTogglePlusOne}
                disabled={updateGuestsPending}
                className={`flex items-center gap-2 px-4 py-2 rounded-md text-xs border transition-colors duration-200 ${
                  currentPlusOne
                    ? 'bg-tea-gold/10 border-tea-border text-tea-gold'
                    : 'bg-tea-surface border-tea-border text-tea-text-sec hover:border-tea-gold/30 hover:text-tea-text'
                }`}
              >
                {currentPlusOne ? <Check className="w-3.5 h-3.5" /> : null}
                {currentPlusOne ? '1 guest added' : 'Add +1'}
              </button>
              {updateGuestsPending && (
                <span className="text-xs text-tea-text-dim">Updating...</span>
              )}
              {updateGuestsIsError && (
                <span className="text-xs text-tea-error">
                  {(updateGuestsError as Error)?.message || 'Could not update'}
                </span>
              )}
            </div>
            {currentPlusOne && (
              <p className="text-xs text-tea-text-dim mt-2">
                Your seat covers you + 1 additional guest.
              </p>
            )}
          </div>
        )}

        {/* Dietary requirements / notes */}
        {status === 'confirmed' && (
          <div className="mb-8 p-5 bg-tea-surface border border-tea-border rounded-md">
            <label htmlFor="rsvp-dietary-notes" className="block text-ui-10 uppercase tracking-[0.2em] text-tea-text-sec mb-3">
              Dietary notes or special requests
            </label>
            <textarea
              id="rsvp-dietary-notes"
              value={currentNotes}
              onChange={e => onChangeNotes(e.target.value)}
              placeholder="Allergies, dietary needs, or anything helpful for the host..."
              rows={3}
              className="w-full bg-tea-bg border border-tea-border rounded-md px-3 py-2.5 text-sm text-tea-text placeholder-tea-text-dim resize-none focus:outline-none focus:border-tea-gold/40 transition-colors"
            />
            <div className="flex items-center justify-between mt-2">
              {notesSaved ? (
                <span className="flex items-center gap-1 text-xs text-tea-gold">
                  <Check className="w-3.5 h-3.5" /> Saved
                </span>
              ) : (
                <span />
              )}
              <button
                onClick={onSaveNotes}
                disabled={updateNotesPending || currentNotes === (attendee.notes || '')}
                className="flex items-center gap-1.5 text-xs text-tea-text-sec hover:text-tea-gold disabled:opacity-40 transition-colors"
              >
                <Save className="w-3.5 h-3.5" />
                {updateNotesPending ? 'Saving...' : 'Save notes'}
              </button>
            </div>
            {updateNotesIsError && (
              <p className="text-xs text-tea-error mt-1">
                {(updateNotesError as Error)?.message || 'Could not save notes'}
              </p>
            )}
          </div>
        )}

        {/* Guest list opt-in toggle */}
        {status === 'confirmed' && (
          <div className="mb-8 p-5 bg-tea-surface border border-tea-border rounded-md">
            <p className="text-ui-10 uppercase tracking-[0.2em] text-tea-text-sec mb-3">
              Guest list
            </p>
            <label className="flex items-start gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={!!attendee.showInGuestList}
                onChange={(e) => onToggleGuestListVisibility(e.target.checked)}
                disabled={updateVisibilityPending}
                className="mt-0.5 w-4 h-4 rounded-md border border-tea-border bg-tea-bg accent-tea-gold cursor-pointer"
              />
              <span className="text-xs text-tea-text-sec leading-relaxed group-hover:text-tea-text transition-colors">
                Show my first name to other confirmed guests
                <span className="block text-ui-10 text-tea-text-dim mt-0.5">
                  {attendee.showInGuestList ? 'Your name is visible to other guests' : 'Only the host can see your name'}
                </span>
              </span>
            </label>
            {updateVisibilityPending && (
              <span className="text-xs text-tea-text-dim mt-2 block">Updating...</span>
            )}
            {updateVisibilityIsError && (
              <p className="text-ui-12 text-tea-error mt-2">
                {(updateVisibilityError as Error)?.message || 'Could not update'}
              </p>
            )}
          </div>
        )}

        {/* Cancel reservation */}
        <div className="text-center pt-6 pb-12 border-t border-tea-border">
          <button
            onClick={onOpenCancelConfirm}
            className="tap-target text-xs font-semibold text-tea-text-sec hover:text-tea-error transition-colors py-3"
          >
            Cancel my reservation
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

export default ConfirmedView;

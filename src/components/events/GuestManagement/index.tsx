import React, { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  useGuestManagement,
  useCancelRSVP,
  useClaimSeat,
  useMarkBriefed,
  useUpdateRSVPNotes,
  useUpdateApprovedGuests,
  useUpdateGuestListVisibility,
} from '../../../hooks/useEventPolling';
import { api } from '../../../lib/api';
import StoryCardsBriefing from '../StoryCardsBriefing';
import { formatDay, isPast } from './helpers';
import RequestedView from './RequestedView';
import DeniedView from './DeniedView';
import WaitlistView from './WaitlistView';
import CancelledView from './CancelledView';
import PostEventView from './PostEventView';
import ConfirmedView from './ConfirmedView';

// ----------------------------------------------------------------
// GuestManagement - thin status router.
// Owns all state + hooks; per-status views are presentational and
// receive data + mutation callbacks as props.
// ----------------------------------------------------------------
const GuestManagement: React.FC = () => {
  const { magicToken } = useParams<{ magicToken: string }>();
  const navigate = useNavigate();

  const { data, isLoading, isError, error } = useGuestManagement(magicToken || '');
  const cancelRSVP = useCancelRSVP(magicToken || '');
  const claimSeat = useClaimSeat(magicToken || '');
  const markBriefed = useMarkBriefed(magicToken || '');
  const updateNotes = useUpdateRSVPNotes(magicToken || '');
  const updateGuests = useUpdateApprovedGuests(magicToken || '');
  const updateGuestListVisibility = useUpdateGuestListVisibility(magicToken || '');

  // Post-session archive data (gallery, session notes, aggregated tasting
  // impressions). Fetched lazily for the post-event recap view. Returns
  // null silently if the host hasn't published post-session data yet.
  const { data: postSession } = useQuery({
    queryKey: ['guest-post-session', magicToken],
    queryFn: async () => {
      if (!magicToken) throw new Error('Missing reservation token');
      try {
        return await api.rsvp.getPostSession(magicToken);
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
  const [notesValue, setNotesValue] = useState<string | null>(null);
  const [notesSaved, setNotesSaved] = useState(false);
  const [plusOneValue, setPlusOneValue] = useState<boolean | null>(null);
  const [transitionBanner, setTransitionBanner] = useState<string | null>(null);
  const prevStatusRef = useRef<string | null>(null);
  const hasTriggeredBriefingRef = useRef(false);

  useEffect(() => {
    if (!data) return;
    const prev = prevStatusRef.current;
    const next = data.attendee.status;
    if ((prev === 'requested' || prev === 'waitlist') && next === 'confirmed') {
      setTransitionBanner('confirmed');
    } else if (prev === 'requested' && next === 'denied') {
      setTransitionBanner('denied');
    }
    prevStatusRef.current = next;
  }, [data?.attendee.status]);

  // ---- STORY CARDS BRIEFING ----
  // Show on first visit after confirmation if briefing cards exist.
  const hasBriefing = Array.isArray(data?.briefingCards) && data.briefingCards.length > 0;
  const shouldShowBriefing =
    !!data &&
    data.attendee.status === 'confirmed' &&
    !data.attendee.firstVisitBriefed &&
    hasBriefing &&
    !showBriefing; // hasn't been shown yet this session

  // Trigger briefing exactly once when the condition first becomes true.
  // Data is undefined on first mount, so this must re-evaluate when
  // `shouldShowBriefing` flips - the ref guards against re-showing.
  useEffect(() => {
    if (shouldShowBriefing && !hasTriggeredBriefingRef.current) {
      hasTriggeredBriefingRef.current = true;
      setShowBriefing(true);
    }
  }, [shouldShowBriefing]);

  // ---- Loading ----
  if (isLoading) {
    return (
      <div className="min-h-screen bg-tea-bg flex items-center justify-center">
        <div className="text-center animate-pulse">
          <div className="w-12 h-12 rounded-full bg-tea-gold/10 mx-auto mb-4" />
          <div className="h-3 w-40 bg-tea-text-sec/10 rounded-md mx-auto" />
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="min-h-screen bg-tea-bg flex items-center justify-center px-6">
        <div className="text-center max-w-md">
          <h1 className="h1 mb-4">Reservation not found</h1>
          <p className="body-light mb-8">
            {(error as Error)?.message || 'This link may be invalid or expired.'}
          </p>
          <button
            onClick={() => navigate('/')}
            className="inline-flex items-center justify-center px-4 py-3 rounded-md cta-solid text-xs font-semibold transition-colors"
          >
            Return home
          </button>
        </div>
      </div>
    );
  }

  const { attendee, event, briefingCards } = data;
  const eventPast = isPast(event.eventDate);
  const isCompleted = event.status === 'closed' || eventPast;
  const status = attendee.status;

  // Initialize local notes/guest state from attendee data on first load
  const currentNotes = notesValue ?? (attendee.notes || '');
  const currentPlusOne = plusOneValue ?? (attendee.plusOne ?? false);

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
    return (
      <PostEventView
        data={data}
        magicToken={magicToken!}
        postSession={postSession as Record<string, unknown> | null | undefined}
        showTasting={showTasting}
        onShowTasting={() => setShowTasting(true)}
        onHideTasting={() => setShowTasting(false)}
      />
    );
  }

  // ---- STATUS-TRANSITION BANNER (injected at top of any status screen) ----
  const statusBanner = transitionBanner ? (
    <div
      role="status"
      aria-live="polite"
      className={`sticky top-0 z-10 px-4 py-3 text-center text-xs font-medium animate-[fadeIn_0.4s_ease-out] border-b border-tea-border ${
        transitionBanner === 'confirmed'
          ? 'bg-tea-gold/10 text-tea-text'
          : 'bg-tea-elevated text-tea-text-sec'
      }`}
    >
      {transitionBanner === 'confirmed'
        ? "You've been approved. Your seat is confirmed."
        : "Your request wasn't approved this time."}
    </div>
  ) : null;

  // ---- REQUESTED (pending approval) ----
  if (status === 'requested') {
    return <RequestedView attendee={attendee} event={event} />;
  }

  // ---- DENIED ----
  if (status === 'denied') {
    return <DeniedView attendee={attendee} event={event} statusBanner={statusBanner} />;
  }

  // ---- WAITLISTED ----
  if (status === 'waitlist') {
    return (
      <WaitlistView
        attendee={attendee}
        event={event}
        onClaimSeat={() => claimSeat.mutate()}
        claimPending={claimSeat.isPending}
        claimIsError={claimSeat.isError}
        claimError={claimSeat.error}
        showCancelConfirm={showCancelConfirm}
        onOpenCancelConfirm={() => setShowCancelConfirm(true)}
        onCloseCancelConfirm={() => setShowCancelConfirm(false)}
        onConfirmCancel={handleCancel}
        cancelPending={cancelRSVP.isPending}
      />
    );
  }

  // ---- CANCELLED ----
  if (status === 'cancelled') {
    return <CancelledView attendee={attendee} event={event} />;
  }

  // ---- CONFIRMED ----
  return (
    <ConfirmedView
      data={data}
      statusBanner={statusBanner}
      guidelinesExpanded={guidelinesExpanded}
      onToggleGuidelines={() => setGuidelinesExpanded(!guidelinesExpanded)}
      currentPlusOne={currentPlusOne}
      onTogglePlusOne={() => {
        const next = !currentPlusOne;
        setPlusOneValue(next);
        updateGuests.mutate({ plusOne: next });
      }}
      updateGuestsPending={updateGuests.isPending}
      updateGuestsIsError={updateGuests.isError}
      updateGuestsError={updateGuests.error}
      currentNotes={currentNotes}
      onChangeNotes={(value) => { setNotesValue(value); setNotesSaved(false); }}
      onSaveNotes={() => {
        updateNotes.mutate(currentNotes, {
          onSuccess: () => setNotesSaved(true),
        });
      }}
      notesSaved={notesSaved}
      updateNotesPending={updateNotes.isPending}
      updateNotesIsError={updateNotes.isError}
      updateNotesError={updateNotes.error}
      onToggleGuestListVisibility={(checked) => updateGuestListVisibility.mutate(checked)}
      updateVisibilityPending={updateGuestListVisibility.isPending}
      updateVisibilityIsError={updateGuestListVisibility.isError}
      updateVisibilityError={updateGuestListVisibility.error}
      showCancelConfirm={showCancelConfirm}
      onOpenCancelConfirm={() => setShowCancelConfirm(true)}
      onCloseCancelConfirm={() => setShowCancelConfirm(false)}
      onConfirmCancel={handleCancel}
      cancelPending={cancelRSVP.isPending}
    />
  );
};

export default GuestManagement;

import { PrivateSessionReflection } from '../PrivateSessionReflection';
import React, { Suspense, lazy } from 'react';
import type { GuestManagementData } from '../../../types/events';
import { TYPOGRAPHY_CLASSES } from '../../../designTokens';
import { formatEventDate } from './helpers';

const TastingNotesForm = lazy(() => import('../TastingNotesForm'));
const PostSessionArchive = lazy(() => import('../PostSessionArchive'));
const InterestCapture = lazy(() => import('../InterestCapture'));

interface PostEventViewProps {
  data: GuestManagementData;
  magicToken: string;
  postSession: Record<string, unknown> | null | undefined;
  showTasting: boolean;
  onShowTasting: () => void;
  onHideTasting: () => void;
}

const PostEventView: React.FC<PostEventViewProps> = ({
  data,
  magicToken,
  postSession,
  showTasting,
  onShowTasting,
  onHideTasting,
}) => {
  const { attendee, event } = data;
  const didAttend = attendee.attended === true;
  const canLeaveNotes = didAttend && attendee.status === 'confirmed' &&
    (event.lifecycleStatus ?? event.status) === 'completed' && data.teaMenu.length > 0;

  // Full-screen tasting form - shown first before the post-event summary
  if (showTasting && canLeaveNotes) {
    return (
      <div className="fixed inset-0 sidebar-inset z-50 bg-tea-bg overflow-y-auto animate-[fadeIn_0.4s_ease-out]">
        <div className="max-w-xl mx-auto px-4 pt-5 pb-nav-gap-lg">
          <div className="mb-4">
            <p className={`mb-1 ${TYPOGRAPHY_CLASSES.accountMeta}`}>
              {formatEventDate(event.eventDate, event.timezone)}
            </p>
            <h1 className={TYPOGRAPHY_CLASSES.h2}>{event.title}</h1>
          </div>
          <Suspense fallback={null}>
            <TastingNotesForm
              teaMenu={data.teaMenu}
              token={magicToken}
              eventId={event.id}
              eventSlug={event.slug}
              eventTitle={event.title}
              onClose={onHideTasting}
            />
          </Suspense>
        </div>
      </div>
    );
  }

  // Count tasting notes collected across all attendees
  const tastingNotesCount = Array.isArray(postSession?.tasting_notes)
    ? (postSession.tasting_notes as unknown[]).length
    : 0;

  // Extract recap content - may come as session_notes or recap_content
  const recapContent = typeof postSession?.session_notes === 'string' && postSession.session_notes.trim()
    ? postSession.session_notes
    : typeof postSession?.recap_content === 'string'
      ? postSession.recap_content as string
      : null;

  const hasPostSessionData = !!(
    postSession &&
    (recapContent || postSession.playlist_url || Array.isArray(postSession.gallery_images))
  );

  return (
    <div className="min-h-screen bg-tea-bg animate-[fadeIn_0.5s_ease-out] pb-nav">
      <div className="max-w-xl mx-auto px-6 py-10">
        <div className="text-center mb-10">
          <p className="text-ui-10 uppercase tracking-[0.3em] text-tea-text-sec mb-4">
            {formatEventDate(event.eventDate, event.timezone)}
          </p>
          <h1 className="font-serif text-3xl text-tea-text mb-2">{event.title}</h1>
          <p className="text-sm text-tea-text-sec">Session Complete</p>
        </div>

        {/* Session Recap, only for attendees who were present */}
        {didAttend && (
          <div className="mb-10">
            {hasPostSessionData ? (
              <>
                {/* Recap header */}
                <div className="mb-6">
                  <p className="text-ui-10 uppercase tracking-[0.3em] text-tea-gold mb-2">Session Recap</p>
                  {tastingNotesCount > 0 && (
                    <p className="text-xs text-tea-text-sec">
                      {tastingNotesCount} tasting {tastingNotesCount === 1 ? 'note' : 'notes'} collected from this session.
                    </p>
                  )}
                </div>
                {/* Recap prose */}
                {recapContent && (
                  <div className="mb-8 p-5 bg-tea-surface border border-tea-border rounded-md">
                    {recapContent.split('\n').filter(Boolean).map((para: string, idx: number) => (
                      <p key={idx} className="text-sm text-tea-text leading-relaxed mb-3 last:mb-0">
                        {para}
                      </p>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="p-5 bg-tea-surface border border-tea-border rounded-md mb-4">
                <p className="text-sm text-tea-text-sec italic leading-relaxed">
                  Your session recap will appear here after the host publishes it.
                </p>
              </div>
            )}
          </div>
        )}

        <Suspense fallback={null}>
          <PostSessionArchive
            teaMenu={data.teaMenu}
            playlistUrl={(postSession?.playlist_url as string | undefined) || event.playlistUrl}
            galleryImages={Array.isArray(postSession?.gallery_images) ? postSession.gallery_images as string[] : undefined}
            aggregatedNotes={
              Array.isArray(postSession?.tasting_notes)
                ? (postSession.tasting_notes as Array<{ impression?: string | null }>)
                    .map(n => n.impression)
                    .filter((imp): imp is string => typeof imp === 'string' && imp.trim().length > 0)
                : undefined
            }
            sessionNotes={typeof postSession?.session_notes === 'string' ? postSession.session_notes : undefined}
            className="mb-10"
          />
        </Suspense>

        {canLeaveNotes && (
          <Suspense fallback={null}>
            <div className="border-t border-tea-border pt-10">
              <button
                onClick={onShowTasting}
                className="tap-target text-xs font-semibold text-tea-text-sec hover:text-tea-text transition-colors"
              >
                Add tasting notes
              </button>
            </div>
          </Suspense>
        )}

        {didAttend && attendee.status === 'confirmed' && <PrivateSessionReflection token={magicToken} />}

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
          <p className="text-ui-10 uppercase tracking-[0.3em] text-tea-text-sec/50">
            Thank you for attending
          </p>
        </div>
      </div>
    </div>
  );
};

export default PostEventView;

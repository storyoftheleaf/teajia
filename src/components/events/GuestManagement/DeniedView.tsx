import React, { Suspense, lazy } from 'react';
import type { EventAttendee, TeaEvent } from '../../../types/events';
import { formatEventDate } from './helpers';

const InterestCapture = lazy(() => import('../InterestCapture'));

interface DeniedViewProps {
  attendee: EventAttendee;
  event: TeaEvent;
  statusBanner: React.ReactNode;
}

const DeniedView: React.FC<DeniedViewProps> = ({ attendee, event, statusBanner }) => {
  return (
    <div className="min-h-screen bg-tea-bg animate-[fadeIn_0.5s_ease-out] pb-nav">
      {statusBanner}
      <div className="max-w-md mx-auto px-6 py-16">
        {/* Event context */}
        <div className="text-center mb-10">
          <p className="text-ui-10 uppercase tracking-[0.3em] text-tea-text-sec mb-3">
            {formatEventDate(event.eventDate)}
          </p>
          <h1 className="font-serif text-2xl text-tea-text mb-1">{event.title}</h1>
          {event.areaHint && (
            <p className="text-sm text-tea-text-sec mt-1">{event.areaHint}</p>
          )}
        </div>

        {/* Main message */}
        <div className="p-7 bg-tea-surface border border-tea-border rounded-md text-center mb-6">
          <div className="w-10 h-10 rounded-full bg-tea-border flex items-center justify-center mx-auto mb-5">
            <span className="text-xl font-serif text-tea-text-sec">茶</span>
          </div>
          <p className="font-serif text-lg text-tea-text mb-4 leading-snug">
            We couldn't fit you in this time.
          </p>
          {attendee.denialMessage ? (
            <p className="text-sm text-tea-text-sec leading-relaxed italic pl-4 text-left">
              <span className="text-tea-text-dim font-serif text-base mr-1">“</span>
              {attendee.denialMessage}
              <span className="text-tea-text-dim font-serif text-base ml-1">”</span>
            </p>
          ) : (
            <p className="text-sm text-tea-text-sec leading-relaxed max-w-xs mx-auto">
              Our sessions are small by design. We balance first-time guests, returning
              members, and the tea itself. Sometimes the timing simply doesn't align.
            </p>
          )}
        </div>

        {/* Reassurance */}
        <div className="space-y-3 mb-10">
          <p className="text-sm text-tea-text-sec leading-relaxed text-center">
            This doesn't close the door. Being on the list means you'll be considered
            first when the next session opens.
          </p>
        </div>

        {/* Next session capture */}
        <div className="border-t border-tea-border pt-8">
          <p className="text-xs text-tea-text-sec text-center mb-5">
            Stay on the list for the next one
          </p>
          <Suspense fallback={null}>
            <InterestCapture slug={event.slug} />
          </Suspense>
        </div>

        <div className="text-center pt-10 pb-4">
          <p className="text-ui-10 uppercase tracking-[0.3em] text-tea-text-sec/40">
            Hosted by Teajia
          </p>
        </div>
      </div>
    </div>
  );
};

export default DeniedView;

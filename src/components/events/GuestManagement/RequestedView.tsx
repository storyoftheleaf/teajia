import React from 'react';
import { Bookmark } from 'lucide-react';
import type { EventAttendee, TeaEvent } from '../../../types/events';
import { formatEventDate } from './helpers';

interface RequestedViewProps {
  attendee: EventAttendee;
  event: TeaEvent;
}

const RequestedView: React.FC<RequestedViewProps> = ({ attendee, event }) => {
  return (
    <div className="min-h-screen bg-tea-bg animate-[fadeIn_0.5s_ease-out] pb-nav">
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
          <p className="text-ui-10 uppercase tracking-[0.3em] text-tea-text-sec mb-3">
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
          <p className="text-ui-10 uppercase tracking-[0.2em] text-tea-text-sec">What you submitted</p>
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
              <p className="text-ui-10 uppercase tracking-[0.2em] text-tea-text-sec mb-2 mt-1">
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
          <p className="text-ui-10 uppercase tracking-[0.3em] text-tea-text-sec/50">
            Hosted by Teajia
          </p>
        </div>
      </div>
    </div>
  );
};

export default RequestedView;

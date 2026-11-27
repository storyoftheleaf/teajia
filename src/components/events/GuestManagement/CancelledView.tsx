import React from 'react';
import { useNavigate } from 'react-router-dom';
import type { EventAttendee, TeaEvent } from '../../../types/events';
import { formatEventDate } from './helpers';

interface CancelledViewProps {
  attendee: EventAttendee;
  event: TeaEvent;
  /** The host cancelled the table itself, not this guest's seat (review A9-3). */
  tableCancelled?: boolean;
}

const CancelledView: React.FC<CancelledViewProps> = ({ attendee, event, tableCancelled = false }) => {
  const navigate = useNavigate();

  if (tableCancelled) {
    // The table is not happening. Its own page is closed with it, so the way
    // out is home, and nothing here asks the guest to do anything.
    return (
      <div className="min-h-screen bg-tea-bg flex items-center justify-center px-6 pb-nav animate-[fadeIn_0.5s_ease-out]">
        <div className="text-center max-w-md" role="status">
          <h1 className="h1 mb-4">This table is cancelled</h1>
          <p className="body-light mb-2">
            The host cancelled <span className="text-tea-text">{event.title}</span>
            {event.eventDate ? `, ${formatEventDate(event.eventDate, event.timezone)}` : ''}.
          </p>
          <p className="body-light mb-8">There is no seat to keep and nothing for you to do.</p>
          <button onClick={() => navigate('/')} className="btn-primary btn-primary-lg">
            Return home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-tea-bg flex items-center justify-center px-6 animate-[fadeIn_0.5s_ease-out]">
      <div className="text-center max-w-md">
        <h1 className="h1 mb-4">Reservation cancelled</h1>
        <p className="body-light mb-8">
          Your reservation for <span className="text-tea-text">{event.title}</span> has been cancelled.
          {attendee.cancellationNote && (
            <span className="block mt-2">{attendee.cancellationNote}</span>
          )}
        </p>
        <button
          onClick={() => navigate(`/event/${event.slug}`)}
          className="btn-primary btn-primary-lg"
        >
          View event
        </button>
      </div>
    </div>
  );
};

export default CancelledView;

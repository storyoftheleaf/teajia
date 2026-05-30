import React from 'react';
import { useNavigate } from 'react-router-dom';
import type { EventAttendee, TeaEvent } from '../../../types/events';

interface CancelledViewProps {
  attendee: EventAttendee;
  event: TeaEvent;
}

const CancelledView: React.FC<CancelledViewProps> = ({ attendee, event }) => {
  const navigate = useNavigate();

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
          className="inline-flex items-center justify-center px-4 py-3 rounded-md bg-tea-gold text-tea-bg text-xs font-semibold hover:bg-tea-gold/90 transition-colors"
        >
          View event
        </button>
      </div>
    </div>
  );
};

export default CancelledView;

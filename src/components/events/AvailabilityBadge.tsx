import React from 'react';
import { useEventAvailability } from '../../hooks/useEventPolling';

interface AvailabilityBadgeProps {
  slug: string;
  className?: string;
}

const AvailabilityBadge: React.FC<AvailabilityBadgeProps> = ({ slug, className = '' }) => {
  const { data } = useEventAvailability(slug);

  if (!data) {
    return (
      <span className={`inline-flex items-center gap-2 px-4 py-2 text-xs uppercase tracking-[0.2em] text-tea-text-dim ${className}`}>
        <span className="w-2 h-2 rounded-full bg-tea-text-dim/30 animate-pulse" />
        Checking availability...
      </span>
    );
  }

  if (data.isFull) {
    return (
      <span className={`inline-flex items-center gap-2 px-4 py-2 text-xs uppercase tracking-[0.2em] text-tea-text-dim bg-tea-surface border border-tea-border rounded-sm ${className}`}>
        <span className="w-2 h-2 rounded-full bg-tea-text-dim/40" />
        Registration closed
      </span>
    );
  }

  if (data.seatsRemaining <= 0) {
    return (
      <span className={`inline-flex items-center gap-2 px-4 py-2 text-xs uppercase tracking-[0.2em] text-tea-text-sec bg-tea-surface border border-tea-border rounded-sm ${className}`}>
        <span className="w-2 h-2 rounded-full bg-tea-gold/60 animate-pulse" />
        Waitlist open
      </span>
    );
  }

  const isLow = data.seatsRemaining <= 3;

  return (
    <span className={`inline-flex items-center gap-2 px-4 py-2 text-xs uppercase tracking-[0.2em] rounded-sm ${
      isLow
        ? 'text-tea-gold bg-tea-gold/10 border border-tea-gold/30'
        : 'text-tea-gold bg-tea-surface border border-tea-border'
    } ${className}`}>
      <span className={`w-2 h-2 rounded-full bg-tea-gold ${isLow ? 'animate-pulse' : ''}`} />
      {data.seatsRemaining} {data.seatsRemaining === 1 ? 'seat' : 'seats'} remaining
    </span>
  );
};

export default AvailabilityBadge;

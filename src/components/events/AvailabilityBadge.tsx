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
      <span className={`inline-block w-36 h-[30px] rounded-full border border-tea-border bg-tea-bg animate-pulse ${className}`} />
    );
  }

  const base = `inline-flex items-center px-4 py-2 text-ui-12 uppercase tracking-[0.25em] rounded-full ${className}`;

  if (data.isFull) {
    return (
      <span role="status" aria-live="polite" className={`${base} bg-tea-bg text-tea-text-sec`}>
        Registration closed
      </span>
    );
  }

  if (data.seatsRemaining <= 0) {
    return (
      <span role="status" aria-live="polite" className={`${base} bg-tea-elevated text-tea-gold`}>
        Waitlist open
      </span>
    );
  }

  const total = data.totalCapacity > 0 ? ` of ${data.totalCapacity}` : '';

  return (
    <span role="status" aria-live="polite" className={`${base} bg-tea-elevated text-tea-gold`}>
      {data.seatsRemaining}{total} seats open
    </span>
  );
};

export default AvailabilityBadge;

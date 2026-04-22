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

  const base = `inline-flex items-center px-4 py-2 text-[10px] uppercase tracking-[0.25em] rounded-full border ${className}`;

  if (data.isFull) {
    return (
      <span className={`${base} bg-tea-bg border-tea-border text-tea-text-sec`}>
        Registration closed
      </span>
    );
  }

  if (data.seatsRemaining <= 0) {
    return (
      <span className={`${base} bg-tea-bg border-tea-gold/40 text-tea-gold`}>
        Waitlist open
      </span>
    );
  }

  const total = data.totalCapacity > 0 ? ` of ${data.totalCapacity}` : '';

  return (
    <span className={`${base} bg-tea-bg border-tea-gold/40 text-tea-gold`}>
      {data.seatsRemaining}{total} seats open
    </span>
  );
};

export default AvailabilityBadge;

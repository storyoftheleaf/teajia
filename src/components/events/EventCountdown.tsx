import React, { useState, useEffect } from 'react';

interface EventCountdownProps {
  eventDate: string;
  className?: string;
}

interface TimeRemaining {
  days: number;
  hours: number;
  minutes: number;
  total: number;
  isPast: boolean;
}

function getTimeRemaining(targetDate: string): TimeRemaining {
  const now = new Date().getTime();
  const target = new Date(targetDate).getTime();
  const total = target - now;

  if (total <= 0) {
    return { days: 0, hours: 0, minutes: 0, total: 0, isPast: true };
  }

  const days = Math.floor(total / (1000 * 60 * 60 * 24));
  const hours = Math.floor((total % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((total % (1000 * 60 * 60)) / (1000 * 60));

  return { days, hours, minutes, total, isPast: false };
}

const CountdownUnit: React.FC<{ value: number; label: string }> = ({ value, label }) => (
  <div className="flex flex-col items-center min-w-[4rem]">
    <span className="font-serif text-3xl md:text-4xl text-tea-text tabular-nums leading-none">
      {String(value).padStart(2, '0')}
    </span>
    <span className="text-ui-10 uppercase tracking-[0.25em] text-tea-text-sec mt-2">
      {label}
    </span>
  </div>
);

const Separator: React.FC = () => (
  <span className="font-serif text-2xl md:text-3xl text-tea-text-sec/40 self-start mt-0.5 mx-1">
    :
  </span>
);

const EventCountdown: React.FC<EventCountdownProps> = ({ eventDate, className = '' }) => {
  const [time, setTime] = useState<TimeRemaining>(() => getTimeRemaining(eventDate));

  useEffect(() => {
    const interval = setInterval(() => {
      setTime(getTimeRemaining(eventDate));
    }, 60_000);

    // Also update immediately
    setTime(getTimeRemaining(eventDate));

    return () => clearInterval(interval);
  }, [eventDate]);

  if (time.isPast) {
    return (
      <div className={`text-center ${className}`}>
        <p className="text-sm uppercase tracking-display text-tea-text-sec">
          Session has begun
        </p>
      </div>
    );
  }

  const isDayOf = time.days === 0;

  return (
    <div className={`${className}`}>
      <p className="text-ui-10 uppercase tracking-[0.3em] text-tea-text-sec text-center mb-4">
        {isDayOf ? 'Starting in' : 'Begins in'}
      </p>
      <div className="flex items-center justify-center gap-1">
        {!isDayOf && (
          <>
            <CountdownUnit value={time.days} label={time.days === 1 ? 'Day' : 'Days'} />
            <Separator />
          </>
        )}
        <CountdownUnit value={time.hours} label={time.hours === 1 ? 'Hour' : 'Hours'} />
        <Separator />
        <CountdownUnit value={time.minutes} label={time.minutes === 1 ? 'Min' : 'Mins'} />
      </div>
    </div>
  );
};

export default EventCountdown;

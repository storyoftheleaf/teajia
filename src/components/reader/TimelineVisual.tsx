import React, { useEffect, useRef, useState } from 'react';

interface TimelineEvent {
  date: string;
  title: string;
  description?: string;
  imageUrl?: string;
}

interface TimelineVisualProps {
  events: TimelineEvent[];
  title?: string;
}

/**
 * TimelineVisual — Horizontal scrollable event timeline.
 * CSS scroll-snap-type: x mandatory. Each event snaps.
 * Gold dots and connecting line. Scroll-hint gradient fades on right edge.
 */
const TimelineVisual: React.FC<TimelineVisualProps> = ({ events, title }) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [atEnd, setAtEnd] = useState(false);
  const [atStart, setAtStart] = useState(true);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    setAtStart(el.scrollLeft <= 8);
    setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 8);
  };

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => el.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="flex flex-col gap-3 w-full">
      {title && (
        <h3 className="text-sm font-semibold text-tea-text px-1">{title}</h3>
      )}

      <div className="relative">
        {/* Scroll container */}
        <div
          ref={scrollRef}
          className="flex overflow-x-auto pb-4"
          style={{
            scrollSnapType: 'x mandatory',
            WebkitOverflowScrolling: 'touch',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
          }}
        >
          {/* Spacer before first item */}
          <div className="flex-shrink-0 w-4" />

          {events.map((event, index) => (
            <div
              key={index}
              className="flex-shrink-0 flex flex-col"
              style={{
                scrollSnapAlign: 'start',
                width: 180,
                marginRight: index < events.length - 1 ? 0 : 0,
              }}
            >
              {/* Timeline row */}
              <div className="flex items-center h-6 relative">
                {/* Left connector line */}
                {index > 0 && (
                  <div
                    className="absolute left-0 right-1/2 top-1/2 -translate-y-px h-px bg-tea-gold"
                    style={{ opacity: 0.5 }}
                  />
                )}
                {/* Right connector line */}
                {index < events.length - 1 && (
                  <div
                    className="absolute left-1/2 right-0 top-1/2 -translate-y-px h-px bg-tea-gold"
                    style={{ opacity: 0.5 }}
                  />
                )}
                {/* Dot */}
                <div
                  className="relative z-10 mx-auto w-3 h-3 rounded-full bg-tea-gold flex-shrink-0"
                  style={{ boxShadow: '0 0 0 3px var(--tea-bg)' }}
                />
              </div>

              {/* Event card */}
              <div className="mt-3 mr-4 bg-tea-surface rounded-xl overflow-hidden flex-1">
                {event.imageUrl && (
                  <img
                    src={event.imageUrl}
                    alt={event.title}
                    className="w-full h-24 object-cover"
                  />
                )}
                <div className="p-3 flex flex-col gap-1">
                  <span className="text-tea-gold text-xs font-medium">{event.date}</span>
                  <h4 className="text-tea-text text-xs font-semibold leading-snug">
                    {event.title}
                  </h4>
                  {event.description && (
                    <p className="text-tea-text-dim text-xs leading-relaxed line-clamp-3">
                      {event.description}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}

          {/* Spacer after last item */}
          <div className="flex-shrink-0 w-4" />
        </div>

        {/* Left fade gradient */}
        {!atStart && (
          <div
            className="absolute left-0 top-0 bottom-4 w-8 pointer-events-none"
            style={{
              background: 'linear-gradient(to right, var(--tea-bg), transparent)',
            }}
          />
        )}

        {/* Right fade gradient (scroll hint) */}
        {!atEnd && (
          <div
            className="absolute right-0 top-0 bottom-4 w-12 pointer-events-none"
            style={{
              background: 'linear-gradient(to left, var(--tea-bg), transparent)',
            }}
          />
        )}
      </div>
    </div>
  );
};

export default TimelineVisual;

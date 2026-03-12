import React, { useState } from 'react';
import { MapPin, ChevronLeft, ChevronRight, Navigation, Car, Train, DoorOpen } from 'lucide-react';
import type { VenueGuide as VenueGuideType } from '../../types/events';

interface VenueGuideProps {
  venueGuide: VenueGuideType;
  mapLink?: string;
  className?: string;
}

const VenueGuide: React.FC<VenueGuideProps> = ({ venueGuide, mapLink, className = '' }) => {
  const [activeStep, setActiveStep] = useState(0);
  const steps = venueGuide.steps;

  const hasSteps = steps && steps.length > 0;
  const hasParkingNotes = !!venueGuide.parking_notes;
  const hasTransitNotes = !!venueGuide.transit_notes;
  const hasArrivalNotes = !!venueGuide.arrival_notes;
  const hasInfoCards = hasParkingNotes || hasTransitNotes || hasArrivalNotes;

  const goNext = () => setActiveStep((p) => Math.min(p + 1, steps.length - 1));
  const goPrev = () => setActiveStep((p) => Math.max(p - 1, 0));

  // Handle swipe on mobile
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const handleTouchStart = (e: React.TouchEvent) => setTouchStart(e.touches[0].clientX);
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStart === null) return;
    const diff = touchStart - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) {
      if (diff > 0) goNext();
      else goPrev();
    }
    setTouchStart(null);
  };

  return (
    <div className={`${className}`}>
      <h3 className="font-serif text-xl text-tea-text mb-6">Getting There</h3>

      {/* Step-by-step directions */}
      {hasSteps && (
        <div className="mb-8">
          <div
            className="relative bg-tea-surface border border-tea-border rounded-md overflow-hidden"
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
            {/* Step image */}
            {steps[activeStep].image_url && (
              <div className="relative aspect-[16/9] overflow-hidden">
                <img
                  src={steps[activeStep].image_url}
                  alt={`Step ${activeStep + 1}`}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-tea-surface via-transparent to-transparent" />
              </div>
            )}

            {/* Step content */}
            <div className="p-5">
              <div className="flex items-center gap-3 mb-3">
                <span className="flex items-center justify-center w-7 h-7 rounded-full bg-tea-gold text-white text-xs font-semibold shrink-0">
                  {activeStep + 1}
                </span>
                <p className="text-sm text-tea-text-sec leading-relaxed">
                  {steps[activeStep].description}
                </p>
              </div>

              {/* Video link if available */}
              {steps[activeStep].video_url && (
                <a
                  href={steps[activeStep].video_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 mt-3 ml-10 text-xs text-tea-gold uppercase tracking-[0.15em] hover:text-tea-gold/80 transition-colors"
                >
                  Watch walkthrough
                </a>
              )}
            </div>

            {/* Navigation arrows */}
            {steps.length > 1 && (
              <div className="flex items-center justify-between px-5 pb-5">
                <button
                  onClick={goPrev}
                  disabled={activeStep === 0}
                  className="p-2 text-tea-text-sec hover:text-tea-gold disabled:opacity-30 disabled:hover:text-tea-text-sec transition-colors"
                  aria-label="Previous step"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>

                {/* Step indicators */}
                <div className="flex gap-1.5">
                  {steps.map((_, idx) => (
                    <button
                      key={idx}
                      onClick={() => setActiveStep(idx)}
                      className={`w-2 h-2 rounded-full transition-all duration-300 ${
                        idx === activeStep
                          ? 'bg-tea-gold w-5'
                          : 'bg-tea-text-sec/30 hover:bg-tea-text-sec/50'
                      }`}
                      aria-label={`Go to step ${idx + 1}`}
                    />
                  ))}
                </div>

                <button
                  onClick={goNext}
                  disabled={activeStep === steps.length - 1}
                  className="p-2 text-tea-text-sec hover:text-tea-gold disabled:opacity-30 disabled:hover:text-tea-text-sec transition-colors"
                  aria-label="Next step"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Info cards */}
      {hasInfoCards && (
        <div className="grid gap-3">
          {hasParkingNotes && (
            <div className="flex items-start gap-3 p-4 bg-tea-surface border border-tea-border rounded-md">
              <Car className="w-4 h-4 text-tea-gold mt-0.5 shrink-0" />
              <div>
                <p className="text-[10px] uppercase tracking-[0.2em] text-tea-text-sec mb-1">Parking</p>
                <p className="text-sm text-tea-text-sec leading-relaxed">{venueGuide.parking_notes}</p>
              </div>
            </div>
          )}
          {hasTransitNotes && (
            <div className="flex items-start gap-3 p-4 bg-tea-surface border border-tea-border rounded-md">
              <Train className="w-4 h-4 text-tea-gold mt-0.5 shrink-0" />
              <div>
                <p className="text-[10px] uppercase tracking-[0.2em] text-tea-text-sec mb-1">Transit</p>
                <p className="text-sm text-tea-text-sec leading-relaxed">{venueGuide.transit_notes}</p>
              </div>
            </div>
          )}
          {hasArrivalNotes && (
            <div className="flex items-start gap-3 p-4 bg-tea-surface border border-tea-border rounded-md">
              <DoorOpen className="w-4 h-4 text-tea-gold mt-0.5 shrink-0" />
              <div>
                <p className="text-[10px] uppercase tracking-[0.2em] text-tea-text-sec mb-1">On Arrival</p>
                <p className="text-sm text-tea-text-sec leading-relaxed">{venueGuide.arrival_notes}</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Open in Maps */}
      {mapLink && (
        <a
          href={mapLink}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-3 mt-6 px-6 py-3 bg-tea-surface border border-tea-border rounded-sm text-tea-text hover:border-tea-gold/40 hover:text-tea-gold transition-all duration-300 group"
        >
          <Navigation className="w-4 h-4 text-tea-text-sec group-hover:text-tea-gold transition-colors duration-300" />
          <span className="text-xs uppercase tracking-[0.2em] font-medium">
            Open in Maps
          </span>
        </a>
      )}
    </div>
  );
};

export default VenueGuide;

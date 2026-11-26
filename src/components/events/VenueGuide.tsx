// The way to the house, for a guest with a phone in one hand (Launch 2, slice
// H8: todo/plans/guests-and-tea-masters-launch-2-run.md, "Sol, H8").
//
// One step at a time: a large photograph, the line beneath, and Back and Next
// as large targets at the bottom, where a thumb reaches. "Open in maps" sits
// at the top. Given `keep`, the steps and photographs are kept on the phone
// (src/lib/keptWay.ts) so the page still opens where the signal ends; given
// `fromKept`, the photographs are read from what was kept. Who receives the
// way is decided by the worker (a confirmed seat, until the session ends).
import React, { useEffect, useState } from 'react';
import { Car, DoorOpen, Navigation, Phone, Train } from 'lucide-react';
import type { VenueGuide as VenueGuideType } from '../../types/events';
import { keepWay, keptPhoto, wayPhotoUrl } from '../../lib/keptWay';
import { Button } from '../shared/Button';

export interface VenueGuideKeep {
  /** The guest's page this copy belongs to (their link's token). */
  page: string;
  /** When the session ends, in milliseconds, or null when it cannot be read. */
  endsAt: number | null;
  title?: string | null;
  address?: string | null;
}

interface VenueGuideProps {
  venueGuide: VenueGuideType;
  mapLink?: string;
  className?: string;
  /** Keep this way on the phone for when there is no signal. */
  keep?: VenueGuideKeep;
  /** Show the photographs kept on the phone (no signal). */
  fromKept?: string;
}

/** The photograph addresses to show: from the network, or from what this phone kept. */
function usePhotoSources(urls: (string | undefined)[], keptPage: string | undefined) {
  const [sources, setSources] = useState<Record<string, string>>({});
  const joined = urls.join('\n');
  useEffect(() => {
    if (!keptPage) return undefined;
    let live = true;
    const made: string[] = [];
    void Promise.all(urls.map(async url => {
      if (!url) return;
      const local = await keptPhoto(keptPage, url);
      if (!local) return;
      made.push(local);
      if (live) setSources(previous => ({ ...previous, [url]: local }));
    }));
    return () => {
      live = false;
      made.forEach(url => { try { URL.revokeObjectURL(url); } catch { /* already gone */ } });
    };
  }, [joined, keptPage]); // eslint-disable-line react-hooks/exhaustive-deps
  return (url: string | undefined) => (url ? (keptPage ? sources[url] : url) : undefined);
}

const VenueGuide: React.FC<VenueGuideProps> = ({ venueGuide, mapLink, className = '', keep, fromKept }) => {
  const steps = venueGuide.steps ?? [];
  const [activeStep, setActiveStep] = useState(0);
  const index = Math.min(activeStep, Math.max(steps.length - 1, 0));
  const photoUrls = steps.map(step => wayPhotoUrl(step.image_url));
  const source = usePhotoSources(photoUrls, fromKept);

  // Keep the way on this phone, each time it is opened with signal.
  const keepSignature = keep ? JSON.stringify([keep.page, keep.endsAt, keep.title, keep.address, mapLink, venueGuide]) : '';
  useEffect(() => {
    if (!keep) return;
    void keepWay(keep.page, {
      ends_at: keep.endsAt, title: keep.title ?? null, address: keep.address ?? null,
      map_link: mapLink ?? null, guide: venueGuide,
    });
  }, [keepSignature]); // eslint-disable-line react-hooks/exhaustive-deps

  const goNext = () => setActiveStep(Math.min(index + 1, steps.length - 1));
  const goPrev = () => setActiveStep(Math.max(index - 1, 0));

  const [touchStart, setTouchStart] = useState<number | null>(null);
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStart === null) return;
    const diff = touchStart - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) (diff > 0 ? goNext : goPrev)();
    setTouchStart(null);
  };

  const step = steps[index];
  const photo = source(photoUrls[index]);
  const notes = [
    venueGuide.parking_notes && { icon: Car, label: 'Parking', text: venueGuide.parking_notes },
    venueGuide.transit_notes && { icon: Train, label: 'Getting here', text: venueGuide.transit_notes },
    venueGuide.arrival_notes && { icon: DoorOpen, label: 'Bring or wear', text: venueGuide.arrival_notes },
  ].filter(Boolean) as { icon: typeof Car; label: string; text: string }[];
  const phone = venueGuide.lost_phone?.trim();
  const dial = phone ? phone.replace(/[^\d+]/g, '') : '';

  return (
    <section className={className} aria-labelledby="venue-guide-heading" data-venue-guide>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h3 id="venue-guide-heading" className="font-display text-ui-20 text-tea-text">The way in</h3>
        {mapLink && (
          <a href={mapLink} target="_blank" rel="noopener noreferrer" className="btn-secondary btn-sm tap-target">
            <Navigation className="h-4 w-4" aria-hidden />
            <span>Open in maps</span>
          </a>
        )}
      </div>

      {step && (
        <div
          className="mb-6 overflow-hidden rounded-md border border-tea-border bg-tea-surface"
          onTouchStart={e => setTouchStart(e.touches[0].clientX)}
          onTouchEnd={handleTouchEnd}
          data-way-reader
        >
          {photoUrls[index] && (
            <div className="aspect-[3/4] w-full overflow-hidden bg-tea-elevated sm:aspect-[4/3]">
              {photo && (
                <img src={photo} alt={step.description || `Step ${index + 1}`} className="h-full w-full object-cover"
                  data-way-photo={index + 1} />
              )}
            </div>
          )}
          <div className="space-y-2 p-4" aria-live="polite">
            <p className="text-ui-12 uppercase tracking-[0.15em] text-tea-text-sec">
              Step {index + 1} of {steps.length}
            </p>
            {step.description && <p className="type-body text-tea-text" data-way-line>{step.description}</p>}
            {step.video_url && (
              <a href={step.video_url} target="_blank" rel="noopener noreferrer" className="type-link">Watch the way in</a>
            )}
          </div>
          {steps.length > 1 && (
            <div className="grid grid-cols-2 gap-3 px-4 pb-4">
              <Button type="button" variant="secondary" size="lg" fullWidth onClick={goPrev} disabled={index === 0}
                className="tap-target disabled:opacity-40">
                Back
              </Button>
              <Button type="button" variant="primary" size="lg" fullWidth onClick={goNext} disabled={index === steps.length - 1}
                className="tap-target disabled:opacity-40">
                Next
              </Button>
            </div>
          )}
        </div>
      )}

      {(notes.length > 0 || phone) && (
        <div className="grid gap-3">
          {notes.map(({ icon: Icon, label, text }) => (
            <div key={label} className="flex items-start gap-3 rounded-md border border-tea-border bg-tea-surface p-4">
              <Icon className="mt-0.5 h-4 w-4 shrink-0 text-tea-gold" aria-hidden />
              <div className="min-w-0">
                <p className="mb-1 text-ui-12 uppercase tracking-[0.15em] text-tea-text-sec">{label}</p>
                <p className="type-body text-tea-text-sec">{text}</p>
              </div>
            </div>
          ))}
          {phone && (
            <a href={`tel:${dial}`} className="flex items-start gap-3 rounded-md border border-tea-border bg-tea-surface p-4 tap-target">
              <Phone className="mt-0.5 h-4 w-4 shrink-0 text-tea-gold" aria-hidden />
              <span className="min-w-0">
                <span className="mb-1 block text-ui-12 uppercase tracking-[0.15em] text-tea-text-sec">If you are lost</span>
                <span className="type-body text-tea-text">{phone}</span>
              </span>
            </a>
          )}
        </div>
      )}
    </section>
  );
};

export default VenueGuide;

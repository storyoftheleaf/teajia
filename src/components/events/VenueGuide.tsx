// The way to the house, for a guest with a phone in one hand (Launch 2, slice
// H8: todo/plans/guests-and-tea-masters-launch-2-run.md, "Sol, H8").
//
// One step at a time, filling a tall card: the step's photograph or film
// behind a large numeral and the line, or the numeral and the line alone where
// there is no picture (Adrian, 2026-11-27: led by words, a picture only where
// one exists). Back and Next are large targets at the bottom, where a thumb
// reaches, and the whole way is listed beneath, each step a tap away. "Open in maps" sits
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
  const spaceUrl = wayPhotoUrl(venueGuide.space_image_url);
  const source = usePhotoSources([...photoUrls, spaceUrl], fromKept);
  const spacePhoto = source(spaceUrl);

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
  // A film that is a file plays in place, silent and looping; any other link opens beside the page.
  const film = step?.video_url && /\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(step.video_url) ? step.video_url : null;
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

      {spacePhoto && (
        <img src={spacePhoto} alt="The tea space" data-way-space
          className="mb-6 aspect-[4/3] w-full rounded-md border border-tea-border object-cover" />
      )}

      {step && (
        <div
          className={`relative mb-6 flex aspect-[3/4] w-full flex-col justify-end overflow-hidden rounded-md border border-tea-border sm:aspect-[4/3] ${photoUrls[index] ? 'bg-tea-elevated' : 'bg-tea-surface'}`}
          onTouchStart={e => setTouchStart(e.touches[0].clientX)}
          onTouchEnd={handleTouchEnd}
          data-way-reader
        >
          {/* The step's own picture or film fills the card; with neither, the numeral and the line carry it. */}
          {film ? (
            <video key={film} src={film} autoPlay muted loop playsInline className="absolute inset-0 h-full w-full object-cover" data-way-film={index + 1} />
          ) : photo && (
            <img src={photo} alt={step.description || `Step ${index + 1}`} className="absolute inset-0 h-full w-full object-cover"
              data-way-photo={index + 1} />
          )}
          {(film || photoUrls[index]) && <div className="absolute inset-0 bg-gradient-to-t from-tea-bg via-tea-bg/60 to-transparent" aria-hidden />}
          {steps.length > 1 && (
            <div className="absolute inset-x-3 top-3 flex gap-1" aria-hidden>
              {steps.map((_, at) => (
                <span key={at} className={`h-0.5 flex-1 rounded-full ${at <= index ? 'bg-tea-gold' : 'bg-tea-text-dim opacity-40'}`} />
              ))}
            </div>
          )}
          <div className="relative space-y-2 p-4" aria-live="polite">
            <p className={`font-display leading-none ${film || photoUrls[index] ? 'text-7xl text-tea-text' : 'text-9xl text-tea-gold'}`} aria-hidden>{index + 1}</p>
            <p className="text-ui-12 uppercase tracking-[0.15em] text-tea-text-sec">
              Step {index + 1} of {steps.length}
            </p>
            {step.description && <p className="font-display text-ui-30 leading-tight text-tea-text" data-way-line>{step.description}</p>}
            {step.video_url && !film && (
              <a href={step.video_url} target="_blank" rel="noopener noreferrer" className="type-link">Watch the way in</a>
            )}
          </div>
          {steps.length > 1 && (
            <div className="relative grid grid-cols-2 gap-3 px-4 pb-4">
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

      {steps.length > 1 && (
        <ol className="mb-6 flex flex-col" aria-label="The whole way">
          {steps.map((one, at) => {
            const thumb = source(photoUrls[at]);
            return (
              <li key={at}>
                <Button type="button" variant="plain" onClick={() => setActiveStep(at)} aria-current={at === index ? 'step' : undefined}
                  className="flex w-full items-center gap-3 border-l border-tea-border py-2 pl-4 text-left transition-colors active:bg-tea-elevated aria-[current=step]:border-tea-gold">
                  {thumb
                    ? <img src={thumb} alt="" loading="lazy" className="h-12 w-12 shrink-0 rounded-full object-cover" />
                    : <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-tea-border font-display text-xl text-tea-gold" aria-hidden>{at + 1}</span>}
                  <span className="type-body min-w-0 flex-1 break-words text-tea-text">{one.description || `Step ${at + 1}`}</span>
                </Button>
              </li>
            );
          })}
        </ol>
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

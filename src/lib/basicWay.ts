// The way in when a host gave only the basics (Adrian, 2026-11-27: "the steps
// through it should work if you don't add anything except your basics and make
// it generic"). A place with a name, an address or a map link and no written
// steps still reads as steps: the same card, numeral and Back / Next as a way
// the host walked. Steps a host wrote are never touched.
import type { VenueGuide } from '../types/events';

export interface WayBasics {
  place?: string | null;
  address?: string | null;
  mapLink?: string | null;
}

/** The plain steps for a place known only by its basics; none when nothing is known. */
export function basicWaySteps({ place, address, mapLink }: WayBasics): VenueGuide['steps'] {
  const where = [place?.trim(), address?.trim()].filter(Boolean).join(', ');
  if (!where && !mapLink?.trim()) return [];
  return [
    { description: where ? `Make your way to ${where}.` : 'Open the map and make your way there.' },
    { description: 'At the door, say you are here for tea.' },
    { description: 'Come in and take a seat at the table.' },
  ];
}

/** The guide to show: the host's own when it has steps, otherwise the same guide with the plain steps. */
export function wayWithBasics(guide: VenueGuide | null | undefined, basics: WayBasics): VenueGuide | null {
  if (guide?.steps?.length) return guide;
  const steps = basicWaySteps(basics);
  if (!steps.length) return guide ?? null;
  return { ...(guide ?? {}), steps };
}

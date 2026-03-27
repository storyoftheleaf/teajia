import { ContentType } from '../../types';
import { ReadableStory } from '../../types/read';
import { PEOPLE } from '../people';

export const cinematicPhotoSequence: ReadableStory = {
  id: 'template-cinematic',
  type: ContentType.Article,
  status: 'vault',
  title: 'Cinematic Photo Sequence',
  subtitle: 'The Slow Pour',
  thumbnailUrl: 'https://images.unsplash.com/photo-1544787219-7f47ccb76574?w=800&h=1200&fit=crop',
  durationOrTime: '19 Pages',
  origin: 'In-house',
  description: 'A visually driven narrative using full-bleed photography, letterbox framing, and minimal text to create a cinematic experience.',
  tags: ['Culture', 'Ceremony'],
  content: [
    ":::COVER_MAIN:::THE SLOW\nPOUR|https://images.unsplash.com/photo-1544787219-7f47ccb76574?w=800&h=1200&fit=crop",

    ":::IMG_FULL_BLEED:::Dawn light enters the tea room — the day's first illumination falls across the wooden table where everything will happen|https://images.unsplash.com/photo-1545579133-99bb5ab189bd?w=800&h=1200&fit=crop",

    ":::IMG_PANORAMIC:::The instruments arranged with surgical precision: kettle, pot, fairness pitcher, cups, waste tray, tea pick, cloth|https://images.unsplash.com/photo-1594631252845-29fc4cc8cde9?w=800&h=1200&fit=crop",

    ":::IMG_SPLIT_VERTICAL:::Left: the dry leaves waiting in the caddy. Right: the empty pot waiting to receive them.|https://images.unsplash.com/photo-1563911892437-1feda0179e1b?w=800&h=1200&fit=crop|https://images.unsplash.com/photo-1594631252845-29fc4cc8cde9?w=800&h=1200&fit=crop",

    ":::TEXT_CENTER_NARROW:::The ceremony begins before anyone notices it has begun. There is no announcement, no bow, no bell. The hands simply start moving — reaching for the kettle, lifting it from the heating element, carrying it to the table. The transition from stillness to motion is so gradual that the exact moment of beginning is impossible to identify. This is deliberate. The ceremony does not begin. It emerges.",

    ":::IMG_FILM_STRIP_VERTICAL:::The sequence: measuring, placing, pouring, waiting|https://images.unsplash.com/photo-1544787219-7f47ccb76574?w=800&h=1200&fit=crop|https://images.unsplash.com/photo-1597318181409-cf64d0b5d8a2?w=800&h=1200&fit=crop|https://images.unsplash.com/photo-1571934811356-5cc061b6821f?w=800&h=1200&fit=crop|https://images.unsplash.com/photo-1545579133-99bb5ab189bd?w=800&h=1200&fit=crop",

    ":::IMG_FULL_BLEED:::The first pour — water meets clay in a controlled arc, the stream unbroken from spout to pot, catching light as it falls|https://images.unsplash.com/photo-1544787219-7f47ccb76574?w=800&h=1200&fit=crop",

    ":::QUOTE_BIG:::The pour is not a means to an end. The pour is the end.",

    ":::IMG_FULL_BLEED_TITLE:::RINSE|https://images.unsplash.com/photo-1571934811356-5cc061b6821f?w=800&h=1200&fit=crop",

    ":::IMG_FULL_BLEED:::The rinse water cascades over the exterior of the pot — warming the clay, sealing the pores, coaxing the first whisper of aroma from the leaves inside|https://images.unsplash.com/photo-1544787219-7f47ccb76574?w=800&h=1200&fit=crop",

    ":::IMG_FULL_BLEED:::Steam rises from the wet pot in a column that fractures, spreads, and vanishes — a ghost that exists for two seconds|https://images.unsplash.com/photo-1571934811356-5cc061b6821f?w=800&h=1200&fit=crop",

    ":::TEXT_CENTER_NARROW:::Five seconds of contact. That is all the first real steep requires. The water enters the pot at 95 degrees Celsius and exits five seconds later transformed — no longer water, not yet fully tea, but something in between. A transitional liquid. A becoming.",

    ":::TEXT_JUSTIFIED_NARROW:::The leaves have barely begun to unfurl. They have offered only their outermost layer, the surface compounds that dissolve on contact: the bright floral volatiles, the initial rush of caffeine, the lightest amino acids. The deeper flavors — the ones stored in the cellular structure, the ones that require heat and time and patience to extract — those are still locked inside, waiting for the second steep, the third, the tenth.",

    ":::IMG_VIGNETTE_SOFT:::The first cup — pale gold, almost transparent, holding the light like stained glass|https://images.unsplash.com/photo-1544787219-7f47ccb76574?w=800&h=1200&fit=crop",

    ":::POEM_HAIKU_MINIMAL:::One sip —\nthe mountain arrives\nin the mouth",

    ":::IMG_FULL_BLEED:::Hands cradling the cup — the thumbs and forefingers form a frame within a frame, the liquid a warm lens at the center|https://images.unsplash.com/photo-1597318181409-cf64d0b5d8a2?w=800&h=1200&fit=crop",

    ":::IMG_OVERLAY_TEXT:::By the seventh steep, the tea has deepened from pale gold to amber. The leaves have surrendered their architecture and lie open in the pot like small green hands.|https://images.unsplash.com/photo-1563911892437-1feda0179e1b?w=800&h=1200&fit=crop",

    ":::IMG_FULL_BLEED:::The spent leaves — removed from the pot and arranged on the lid for examination, each one a record of its own unfolding|https://images.unsplash.com/photo-1563911892437-1feda0179e1b?w=800&h=1200&fit=crop",

    ":::EPILOGUE_CENTERED:::The session lasted forty-five minutes and produced eleven steeps from seven grams of leaf. No words were exchanged during the brewing. The only sounds were water, ceramic, and breath. When it was over, the participants sat for several minutes in the silence the tea had created — a silence different from the one that preceded it, thicker somehow, more inhabited. Then someone spoke, and the ordinary world resumed.",

    ":::COPYRIGHT_PAGE:::Cinematography and Direction: Li Jun\nProduced for Teajia Journal\nShot on location, Taipei"
  ],
  author: PEOPLE.li,
};

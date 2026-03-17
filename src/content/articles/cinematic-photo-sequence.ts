import { ContentType } from '../../types';
import { ReadableStory } from '../../types/read';
import { PEOPLE } from '../people';

export const cinematicPhotoSequence: ReadableStory = {
  id: 'template-cinematic',
  type: ContentType.Article,
  status: 'published',
  title: 'Cinematic Photo Sequence',
  subtitle: 'The Slow Pour',
  thumbnailUrl: 'https://picsum.photos/800/1200?random=cine1',
  durationOrTime: '20 Pages',
  origin: 'In-house',
  description: 'A visually driven narrative using full-bleed photography, letterbox framing, and minimal text to create a cinematic experience.',
  tags: ['Culture', 'Ceremony'],
  content: [
    ":::COVER_MAIN:::THE SLOW\nPOUR|https://picsum.photos/800/1200?random=cine2",

    ":::IMG_FULL_BLEED:::Dawn light enters the tea room — the day's first illumination falls across the wooden table where everything will happen|https://picsum.photos/800/1200?random=cine3",

    ":::IMG_PANORAMIC:::The instruments arranged with surgical precision: kettle, pot, fairness pitcher, cups, waste tray, tea pick, cloth|https://picsum.photos/1200/500?random=cine4",

    ":::IMG_SPLIT_VERTICAL:::Left: the dry leaves waiting in the caddy. Right: the empty pot waiting to receive them.|https://picsum.photos/400/800?random=cine5|https://picsum.photos/400/800?random=cine6",

    ":::TEXT_CENTER_NARROW:::The ceremony begins before anyone notices it has begun. There is no announcement, no bow, no bell. The hands simply start moving — reaching for the kettle, lifting it from the heating element, carrying it to the table. The transition from stillness to motion is so gradual that the exact moment of beginning is impossible to identify. This is deliberate. The ceremony does not begin. It emerges.",

    ":::IMG_FILM_STRIP_VERTICAL:::The sequence: measuring, placing, pouring, waiting|https://picsum.photos/600/400?random=cine7|https://picsum.photos/600/400?random=cine8|https://picsum.photos/600/400?random=cine9|https://picsum.photos/600/400?random=cine10",

    ":::IMG_FULL_BLEED:::The first pour — water meets clay in a controlled arc, the stream unbroken from spout to pot, catching light as it falls|https://picsum.photos/800/1200?random=cine11",

    ":::QUOTE_BIG:::The pour is not a means to an end. The pour is the end.",

    ":::IMG_FULL_BLEED_TITLE:::RINSE|https://picsum.photos/800/1200?random=cine12",

    ":::IMG_FULL_BLEED:::The rinse water cascades over the exterior of the pot — warming the clay, sealing the pores, coaxing the first whisper of aroma from the leaves inside|https://picsum.photos/800/1200?random=cine13",

    ":::IMG_FULL_BLEED:::Steam rises from the wet pot in a column that fractures, spreads, and vanishes — a ghost that exists for two seconds|https://picsum.photos/800/1200?random=cine14",

    ":::TEXT_CENTER_NARROW:::Five seconds of contact. That is all the first real steep requires. The water enters the pot at 95 degrees Celsius and exits five seconds later transformed — no longer water, not yet fully tea, but something in between. A transitional liquid. A becoming. The leaves have barely begun to unfurl. They have offered only their outermost layer, the surface compounds that dissolve on contact: the bright floral volatiles, the initial rush of caffeine, the lightest amino acids. The deeper flavors — the ones stored in the cellular structure, the ones that require heat and time and patience to extract — those are still locked inside, waiting for the second steep, the third, the tenth.",

    ":::IMG_VIGNETTE_SOFT:::The first cup — pale gold, almost transparent, holding the light like stained glass|https://picsum.photos/800/1200?random=cine15",

    ":::POEM_HAIKU_MINIMAL:::One sip —\nthe mountain arrives\nin the mouth",

    ":::IMG_FULL_BLEED:::Hands cradling the cup — the thumbs and forefingers form a frame within a frame, the liquid a warm lens at the center|https://picsum.photos/800/1200?random=cine16",

    ":::IMG_OVERLAY_TEXT:::By the seventh steep, the tea has deepened from pale gold to amber. The leaves have surrendered their architecture and lie open in the pot like small green hands.|https://picsum.photos/800/1200?random=cine17",

    ":::IMG_FULL_BLEED:::The spent leaves — removed from the pot and arranged on the lid for examination, each one a record of its own unfolding|https://picsum.photos/800/1200?random=cine18",

    ":::EPILOGUE_CENTERED:::The session lasted forty-five minutes and produced eleven steeps from seven grams of leaf. No words were exchanged during the brewing. The only sounds were water, ceramic, and breath. When it was over, the participants sat for several minutes in the silence the tea had created — a silence different from the one that preceded it, thicker somehow, more inhabited. Then someone spoke, and the ordinary world resumed.",

    ":::COPYRIGHT_PAGE:::Cinematography and Direction: Li Jun\nProduced for Teajia Journal\nShot on location, Taipei"
  ],
  author: PEOPLE.li,
};

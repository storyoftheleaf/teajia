import { ContentType } from '../../types';
import { ReadableStory } from '../../types/read';
import { PEOPLE } from '../people';

export const experimentalArt: ReadableStory = {
  id: 'template-experimental',
  type: ContentType.Article,
  status: 'published',
  title: 'Experimental Art Layout',
  subtitle: 'Fluid Dynamics',
  thumbnailUrl: 'https://picsum.photos/800/1200?random=ex100',
  durationOrTime: '20 Pages',
  origin: 'Curated',
  description: 'An avant-garde visual essay pushing the boundaries of editorial design with unconventional layouts.',
  tags: ['Culture'],
  content: [
    ":::COVER_ABSTRACT:::FLUID|DYNAMICS|https://picsum.photos/800/1200?random=ex101",
    ":::POEM_SCATTERED:::Water has no memory\n   yet it remembers\n      every vessel\n         it has ever\n            filled",
    ":::IMG_DIAGONAL_SPLIT:::The moment of pouring — when water becomes tea|https://picsum.photos/800/1200?random=ex102",
    ":::IMG_DUOTONE:::Steam rising from a gaiwan in morning light|https://picsum.photos/800/1200?random=ex103",
    ":::TEXT_CENTER_NARROW:::Consider the physics of a pour. Water leaves the kettle at approximately 96 degrees Celsius, traveling in a laminar stream that breaks into turbulence as it strikes the dry leaves. The impact creates a microclimate of steam and spray — a cloud no larger than a fist — where temperature, humidity, and chemical concentration reach their most extreme values. In this transient zone, lasting perhaps two seconds, the first extraction occurs: surface waxes dissolve, cell walls rupture, and the earliest aromatic compounds — the lightest, most volatile molecules — leap from the leaf into the steam and vanish upward. You smell them before you taste them. This is the ghost of the tea, the phantom that precedes the body. Every subsequent steep will be a negotiation between the remaining compounds and the increasingly saturated water, but nothing will match the intensity of this first violent contact. The pour is not preparation. The pour is the event.",
    ":::IMG_OVERLAY_TEXT:::Every cup is a river\nin miniature — source,\ncurrent, delta, sea.|https://picsum.photos/800/1200?random=ex104",
    ":::POEM_VISUAL:::T H E   W A T E R   C Y C L E\n\n    rain → mountain → spring\n         ↓\n    kettle → cup → mouth\n         ↓\n    breath → cloud → rain",
    ":::TEXT_OVERLAPPING_IMAGES:::The fluid dynamics of tea preparation are governed by forces both visible and invisible. Surface tension holds the meniscus in a delicate curve against the rim of the cup — a boundary layer where liquid meets air in a negotiation mediated by temperature and the dissolved solids that give tea its body. Break this tension with the lip and the tea flows, carrying with it a thermal gradient that the tongue maps with extraordinary precision: the first sip is always hottest at the center, cooler at the edges where the air has done its work. Below the surface, convection currents circulate continuously, driven by the temperature differential between the hot liquid and the cooler walls of the vessel. In a glass cup, you can see these currents — sinuous, slow-moving streams of slightly different density carrying dissolved compounds from the bottom to the top, creating the schlieren patterns that make tea one of the most visually dynamic of all beverages. These are not decorations. They are the visible evidence of chemistry in motion.|https://picsum.photos/600/800?random=ex105|https://picsum.photos/600/800?random=ex106",
    ":::IMG_OVAL_VIGNETTE:::A single drop, suspended between kettle and cup|https://picsum.photos/800/1000?random=ex107",
    ":::TEXT_CENTER_NARROW:::Steam is tea's calligraphy — written in air, read by the nose, dissolved by time. Watch the steam rise from a freshly poured cup and you are watching a column of water vapor carrying thousands of aromatic molecules in a thermal updraft. The column rises, cools, disperses. The molecules that reach your olfactory epithelium are a tiny fraction of those released — a sample, not a census. This is why smelling tea is an act of interpretation rather than measurement. Each inhalation captures a different cross-section of the aromatic profile, biased by the temperature of the steam, the distance from the cup, and the speed of your breath. The tea you smell is never the same tea twice. It is a series of approximations, each one true, none complete.",
    ":::IMG_POLAROID_SCATTER:::Moments of stillness between pours|https://picsum.photos/400/400?random=ex108|https://picsum.photos/400/400?random=ex109|https://picsum.photos/400/400?random=ex110|https://picsum.photos/400/400?random=ex111",
    ":::POEM_HAIKU_MINIMAL:::kettle whispers low\nleaves uncurl in borrowed heat\ntime dissolves like sugar",
    ":::TEXT_TYPEWRITER:::FIELD OBSERVATION — 14:22 — STUDIO\n\nPoured 95°C water into a 120ml porcelain gaiwan\ncontaining 7g of aged white peony (2018 harvest).\nObserved: immediate color change in contact zone.\nGolden amber spreading from leaves outward,\nlike ink dropped into still water.\nConvection visible within 4 seconds.\nFirst aroma detected at 6 seconds: dried apricot.\nSecond aroma at 11 seconds: wild honey.\nSurface foam (saponins) formed a ring\nat the perimeter and collapsed by 15 seconds.\nPoured at 18 seconds.\nLiquor color: pale gold with amber highlights.\nTransparency: high — text readable through the cup.\nViscosity: noticeably higher than water.\nConclusion: the tea is awake.",
    ":::IMG_GALLERY_MOSAIC:::Visual studies of tea in motion: pour, steep, swirl, settle|https://picsum.photos/600/400?random=ex112|https://picsum.photos/400/600?random=ex113|https://picsum.photos/600/600?random=ex114|https://picsum.photos/400/400?random=ex115|https://picsum.photos/600/400?random=ex116",
    ":::TEXT_CENTER_NARROW:::In the end, what is a cup of tea but a body of water that has been changed by passage through a body of leaves? The water enters one thing and exits another — carrying the memory of the plant, the soil, the rain, the hand that picked, the fire that dried. It is an act of translation: solid becomes liquid, leaf becomes flavor, matter becomes experience. And then it is gone — drunk, absorbed, metabolized, exhaled. The molecules that were tea become the molecules of you. The boundary between drinker and drink dissolves. This is the final fluid dynamic: the one where the river reaches the sea, and the sea does not notice, and the river does not care, and somewhere upstream it is raining again.",
    ":::BACK_COVER:::FLUID DYNAMICS|A visual essay by Li Jun|Teajia Magazine"
  ],
  author: PEOPLE.li,
};

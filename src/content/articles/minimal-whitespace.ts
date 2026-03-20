import { ContentType } from '../../types';
import { ReadableStory } from '../../types/read';
import { PEOPLE } from '../people';

export const minimalWhitespace: ReadableStory = {
  id: 'template-minimal',
  type: ContentType.Article,
  status: 'published',
  title: 'Minimal White Space',
  subtitle: 'The Art of Less',
  thumbnailUrl: 'https://images.unsplash.com/photo-1464982326199-86f32f81b211?w=800&h=1200&fit=crop',
  durationOrTime: '17 Pages',
  origin: 'In-house',
  description: 'A study in restraint — maximum white space, minimal text, and careful typography create a meditative reading experience.',
  tags: ['Philosophy', 'Space Design'],
  content: [
    ":::COVER_MINIMAL:::Minimal\nWhite Space",

    ":::TEXT_CENTER_NARROW:::There is a crack in my favorite teacup. A hairline fracture that runs from the rim to just below the handle, barely visible unless the light catches it at the right angle. Most people would discard it. I reach for it first, every morning, before any other vessel in the cupboard. The crack is not a flaw. It is the cup's autobiography.",

    ":::POEM_CENTERED:::The crack runs\nfrom rim to base —\na river on a map\nof somewhere\nI have never been\nbut recognize\nimmediately.",

    ":::IMG_OVAL_VIGNETTE:::Still life with cracked vessel|https://images.unsplash.com/photo-1594631252845-29fc4cc8cde9?w=800&h=1200&fit=crop",

    ":::TEXT_JUSTIFIED_NARROW:::The concept of wabi-sabi is frequently invoked in Western tea culture, usually as a vague synonym for rustic aesthetics — unglazed pottery, rough textures, earth tones. This domesticated version strips the philosophy of its radical core. Wabi-sabi is not an interior design trend. It is an ontological position — a way of understanding reality itself.",

    ":::TEXT_CENTER_NARROW:::At its heart lies the Buddhist recognition of three marks of existence: impermanence, suffering, and the absence of fixed self. Everything changes. Nothing satisfies permanently. Nothing possesses an inherent, unchanging identity. Wabi-sabi takes these potentially devastating truths and finds in them not despair but liberation.",

    ":::IMG_FULL_BLEED:::Morning light on weathered wood — beauty in the passage of time|https://images.unsplash.com/photo-1464982326199-86f32f81b211?w=800&h=1200&fit=crop",

    ":::QUOTE_BIG:::Perfection is a kind of death. Only the imperfect can be alive.",

    ":::TEXT_SINGLE_COL:::Consider the act of brewing tea through this lens. Every session is unrepeatable. The water temperature varies by a degree or two. The leaves have aged another day since the last brewing. Your own body chemistry shifts the perception of flavor. All of these variables converge to create a moment that will never exist again in exactly this configuration.",

    ":::IMG_WITH_CAPTION_BOTTOM:::A single tea session — unrepeatable, impermanent, complete|https://images.unsplash.com/photo-1545579133-99bb5ab189bd?w=800&h=1200&fit=crop",

    ":::TEXT_CENTER_NARROW:::The wabi-sabi practitioner sees this not as noise to be controlled but as the fundamental texture of reality, to be noticed and appreciated rather than eliminated. This is why the tea ceremony places such emphasis on seasonal awareness. The scroll in the alcove changes with the month. The flowers reflect what is blooming now. These are acknowledgments that this gathering is happening in a specific moment in time.",

    ":::POEM_HAIKU_MINIMAL:::Autumn cup —\nthe tea cools faster\nthan my words",

    ":::DEDICATION_SIMPLE:::For those who drink slowly.",

    ":::IMG_CIRCLE_MASK:::A single leaf|https://images.unsplash.com/photo-1563911892437-1feda0179e1b?w=800&h=1200&fit=crop",

    ":::TEXT_CENTER_NARROW:::The great tea master Sen no Rikyu distilled his aesthetic philosophy into four principles: wa (harmony), kei (respect), sei (purity), and jaku (tranquility). Notice what is absent from this list: beauty, elegance, refinement, sophistication. His revolution was about stripping away everything unnecessary until only the essential remained.",

    ":::TEXT_JUSTIFIED_NARROW:::A room barely large enough for two people. A single flower in a bamboo vase. A bowl made by hands that had never studied under a master. In this radical reduction, Rikyu discovered that beauty does not require addition. It requires subtraction. The empty space around an object is not absence — it is presence of a different kind.",

    ":::IMG_OVAL_VIGNETTE:::Empty room with single tea bowl — the sufficiency of nothing|https://images.unsplash.com/photo-1464982326199-86f32f81b211?w=800&h=1200&fit=crop",

    ":::TEXT_SINGLE_COL:::I have been practicing tea for twenty years now, and the most important thing I have learned is how to do less. In the beginning, I collected — rare teas, beautiful teaware, arcane knowledge. I accumulated experiences like trophies. I sought out the oldest puerh, the highest mountain oolong, the most celebrated potter's work.",

    ":::IMG_FULL_BLEED:::The quiet discipline of returning to the familiar|https://images.unsplash.com/photo-1597318181409-cf64d0b5d8a2?w=800&h=1200&fit=crop",

    ":::TEXT_CENTER_NARROW:::Gradually, imperceptibly, the collection began to thin. Not through deliberate minimalism — that would be just another form of striving — but through a natural settling. I stopped reaching for novelty and started returning to the familiar. The same three teas, brewed in the same two pots, drunk from the same cup with its hairline crack. And in that repetition, in that narrowing of scope, the depth increased immeasurably.",

    ":::EPILOGUE_CENTERED:::The empty cup is not waiting to be filled.\nIt is already complete.",

    ":::COPYRIGHT_PAGE:::First published in Teajia Journal\nPhotography by Zhou Yu"
  ],
  author: PEOPLE.zhou,
};

import { ContentType } from '../../types';
import { ReadableStory } from '../../types/read';
import { PEOPLE } from '../people';

export const minimalWhitespace: ReadableStory = {
  id: 'template-minimal',
  type: ContentType.Article,
  status: 'published',
  title: 'Minimal White Space',
  subtitle: 'The Art of Less',
  thumbnailUrl: 'https://picsum.photos/800/1200?random=minimal1',
  durationOrTime: '18 Pages',
  origin: 'In-house',
  description: 'A study in restraint — maximum white space, minimal text, and careful typography create a meditative reading experience.',
  tags: ['Philosophy', 'Space Design'],
  content: [
    ":::COVER_MINIMAL:::Minimal\nWhite Space",

    ":::TEXT_CENTER_NARROW:::There is a crack in my favorite teacup. A hairline fracture that runs from the rim to just below the handle, barely visible unless the light catches it at the right angle. Most people would discard it. I reach for it first, every morning, before any other vessel in the cupboard. The crack is not a flaw. It is the cup's autobiography — the record of a single moment when gravity and ceramic met, and the ceramic chose to hold together rather than shatter. That choice, that stubborn coherence in the face of breaking, is what the Japanese call wabi-sabi. It is the beauty that emerges not despite imperfection but because of it.",

    ":::POEM_CENTERED:::The crack runs\nfrom rim to base —\na river on a map\nof somewhere\nI have never been\nbut recognize\nimmediately.",

    ":::IMG_OVAL_VIGNETTE:::Still life with cracked vessel|https://picsum.photos/800/1200?random=minimal2",

    ":::TEXT_JUSTIFIED_NARROW:::The concept of wabi-sabi is frequently invoked in Western tea culture, usually as a vague synonym for rustic aesthetics — unglazed pottery, rough textures, earth tones. This domesticated version strips the philosophy of its radical core. Wabi-sabi is not an interior design trend. It is an ontological position — a way of understanding reality itself. At its heart lies the Buddhist recognition of three marks of existence: impermanence (mujo), suffering or dissatisfaction (ku), and the absence of fixed self (ku). Everything changes. Nothing satisfies permanently. Nothing possesses an inherent, unchanging identity. Wabi-sabi takes these potentially devastating truths and finds in them not despair but liberation. If nothing lasts, then every moment of beauty is precious precisely because it is fleeting. If nothing is perfect, then the pursuit of perfection is not merely futile but misguided — a refusal to engage with reality as it actually presents itself.",

    ":::QUOTE_BIG:::Perfection is a kind of death. Only the imperfect can be alive.",

    ":::IMG_FULL_BLEED:::Morning light on weathered wood|https://picsum.photos/800/1200?random=minimal3",

    ":::TEXT_SINGLE_COL:::Consider the act of brewing tea through this lens. Every session is unrepeatable. The water temperature varies by a degree or two. The leaves have aged another day since the last brewing. Your own body chemistry — hydration, hunger, mood, the lingering taste of whatever you ate an hour ago — shifts the perception of flavor. The ambient temperature of the room, the humidity in the air, the cup you chose today rather than yesterday — all of these variables converge to create a moment that will never exist again in exactly this configuration. A scientific materialist might see this as noise, as unwanted variation to be controlled and minimized. The wabi-sabi practitioner sees it as the fundamental texture of reality, to be noticed and appreciated rather than eliminated.\n\nThis is why the tea ceremony — in both its Japanese and Chinese forms — places such emphasis on seasonal awareness. The scroll in the alcove changes with the month. The flowers reflect what is blooming now, not what bloomed last week. The charcoal arrangement shifts between summer and winter styles. These are not arbitrary decorative choices. They are acknowledgments that this gathering is happening in a specific moment in time, a moment that carries its own character and will not return.",

    ":::POEM_HAIKU_MINIMAL:::Autumn cup —\nthe tea cools faster\nthan my words",

    ":::DEDICATION_SIMPLE:::For those who drink slowly.",

    ":::IMG_CIRCLE_MASK:::A single leaf|https://picsum.photos/800/800?random=minimal4",

    ":::TEXT_CENTER_NARROW:::The great tea master Sen no Rikyu distilled his aesthetic philosophy into four principles: wa (harmony), kei (respect), sei (purity), and jaku (tranquility). Notice what is absent from this list: beauty, elegance, refinement, sophistication. These are the values of aristocratic culture — the culture Rikyu deliberately subverted by serving tea in a tiny hut using peasant pottery rather than Chinese porcelain. His revolution was not about aesthetics in the decorative sense. It was about stripping away everything unnecessary until only the essential remained. A room barely large enough for two people. A single flower in a bamboo vase. A bowl made by hands that had never studied under a master. In this radical reduction, Rikyu discovered that beauty does not require addition. It requires subtraction. The empty space around an object is not absence — it is presence of a different kind. The silence between words in a conversation is not void — it is where understanding lives.",

    ":::IMG_OVAL_VIGNETTE:::Empty room with single tea bowl|https://picsum.photos/800/1200?random=minimal5",

    ":::TEXT_JUSTIFIED_NARROW:::I have been practicing tea for twenty years now, and the most important thing I have learned is how to do less. In the beginning, I collected — rare teas, beautiful teaware, arcane knowledge. I accumulated experiences like trophies. I sought out the oldest puerh, the highest mountain oolong, the most celebrated potter's work. My tea shelf groaned under the weight of acquisition. Gradually, imperceptibly, the collection began to thin. Not through deliberate minimalism — that would be just another form of striving — but through a natural settling, the way sediment finds the bottom of a cup. I stopped reaching for novelty and started returning to the familiar. The same three teas, brewed in the same two pots, drunk from the same cup with its hairline crack. And in that repetition, in that narrowing of scope, the depth increased immeasurably. I began to taste things I had never noticed in twenty years of variety-seeking. The mineral undertone that appears only in the seventh steep. The way the same tea tastes different at dawn than at dusk. The almost imperceptible shift in character between this year's spring harvest and last year's.",

    ":::EPILOGUE_CENTERED:::The empty cup is not waiting to be filled.\nIt is already complete.",

    ":::COPYRIGHT_PAGE:::First published in Teajia Journal\nPhotography by Zhou Yu"
  ],
  author: PEOPLE.zhou,
};

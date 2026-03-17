import { ContentType } from '../../types';
import { ReadableStory } from '../../types/read';
import { PEOPLE } from '../people';

export const notebookJournal: ReadableStory = {
  id: 'template-notebook',
  type: ContentType.Article,
  status: 'published',
  title: 'Notebook Journal Layout',
  subtitle: 'Field Notes',
  thumbnailUrl: 'https://images.unsplash.com/photo-1587049352846-4a222e784d38?w=800&h=1200&fit=crop',
  durationOrTime: '16 Pages',
  origin: 'In-house',
  description: 'A handwritten notebook aesthetic with ruled paper, marginalia, and sketched observations from the tea fields.',
  tags: ['Culture', 'Sourcing', 'Tasting'],
  content: [
    ":::COVER_PHOTO_INSET:::FIELD\nNOTES|Yunnan Sourcing Journal|https://images.unsplash.com/photo-1587049352846-4a222e784d38?w=800&h=1200&fit=crop",

    ":::NOTE_PAPER:::DAY 1 — Kunming to Menghai\n\nArrived Kunming 6:40 AM, flight delayed two hours out of Taipei. The airport smells of instant noodles and cigarette smoke despite the smoking ban. Mr. Zhao, our driver and fixer, met us at arrivals holding a cardboard sign that simply read 'TEA' in English — his entire vocabulary in the language.",

    ":::TEXT_SIDEBAR_IMAGE:::The drive to Menghai is eight hours on paper, twelve in practice. The highway ends at Pu'er city; after that, the road winds through mountains on hairpin turns that test the suspension of Zhao's ancient Toyota and the constitution of my stomach. Stopped twice for construction delays. Used the time to review my tasting notes from last year's purchases.|The road to Menghai|https://images.unsplash.com/photo-1587049352846-4a222e784d38?w=800&h=1200&fit=crop",

    ":::TEXT_TYPEWRITER:::SOURCING CHECKLIST — Spring 2025\n\nPriority targets:\n[ ] Yiwu Guafengzhai ancient tree maocha\n[ ] Jingmai large-leaf sun-dried\n[ ] Laobanzhang — if price hasn't doubled again\n[ ] Nannuo mountain wild-growth material\n[ ] Bingdao samples for comparison (probably can't afford)\n\nSecondary:\n[ ] Menghai Dayi factory seconds\n[ ] Bulang mountain small-holder lots\n[ ] Any interesting shou puerh under 3 years",

    ":::POSTCARD_STYLE:::Greetings from Menghai!\nPopulation: 320,000 (and 100,000 tea trees)\nElevation: 1,200m\nTemperature: 24°C and climbing\nMood: Exhausted but excited\n\nThe hotel is basic but clean. The lobby doubles as a tea showroom — every surface covered with sample cakes wrapped in tissue paper.|https://images.unsplash.com/photo-1587049352846-4a222e784d38?w=800&h=1200&fit=crop",

    ":::IMG_POLAROID_SCATTER:::First morning in Menghai — the market|https://images.unsplash.com/photo-1556881286-fc6915169721?w=800&h=1200&fit=crop|https://images.unsplash.com/photo-1563911892437-1feda0179e1b?w=800&h=1200&fit=crop",

    ":::NOTE_PAPER:::DAY 3 — The Yiwu Road\n\nThe road to Yiwu is legendary among tea buyers and for good reason: it is terrifying. A single lane of crumbling asphalt carved into a mountainside, with no guardrails and drops of several hundred meters into jungle ravines. Zhao drives it with one hand, the other holding his phone to his ear, negotiating our appointments.",

    ":::IMG_FULL_BLEED:::The ancient tea forests of Yiwu — trees over ten meters tall with trunks thicker than a person|https://images.unsplash.com/photo-1582793988951-9aed5509eb97?w=800&h=1200&fit=crop",

    ":::TEXT_SINGLE_COL:::The landscape changes dramatically as we climb. The lowland rubber plantations give way to mixed forest, then to the ancient tea gardens. The trees here are not the neat hedgerows of a Japanese plantation. They are actual trees — some over ten meters tall, with trunks thicker than my waist and canopies that merge with the surrounding jungle. This is not agriculture. This is a forest that happens to produce tea.",

    ":::TEXT_SIDEBAR_RIGHT:::TASTING: Guafengzhai Spring 2025|Dry leaf: Dark, twisted, with visible silver buds. Aroma of honey and dried apricot. Exceptionally fragrant. First steep: Bright, floral, almost perfumed. Viscous mouthfeel that coats the entire palate. No bitterness at all in the first three steeps. Fourth steep onward: Stone fruit emerges. A menthol coolness in the throat that persists for minutes. The hui gan is extraordinary. Verdict: Outstanding. Bought 15 kilograms at a price I am not comfortable writing down.|https://images.unsplash.com/photo-1563911892437-1feda0179e1b?w=800&h=1200&fit=crop",

    ":::IMG_WITH_CAPTION_BOTTOM:::Lao Zhang examining the first flush picking from his family's 300-year-old tea trees|https://images.unsplash.com/photo-1582793988951-9aed5509eb97?w=800&h=1200&fit=crop",

    ":::BOTANICAL_SKETCH:::CAMELLIA SINENSIS VAR. ASSAMICA (Ancient Tree Specimen)\n\nLeaf: 12-18cm length, serrated edge, prominent veining\nBud: Silver-white, densely pubescent\nBranch: Woody, covered in lichen and moss\nRoot system: Tap root extending 2-5 meters into rocky substrate\nEstimated age of specimen: 250-400 years\nElevation: 1,680m\nSoil: Red laterite over sandstone",

    ":::NOTE_PAPER:::DAY 5 — Laobanzhang\n\nThe village of Laobanzhang has become the most expensive address in the tea world, and it shows. Where five years ago there were dirt paths between wooden farmhouses, there are now paved roads, concrete mansions with marble facades, and more Mercedes-Benz SUVs than I have ever seen in a village of 120 families.",

    ":::IMG_FULL_BLEED:::The transformation of Laobanzhang — tea wealth reshaping a mountain village|https://images.unsplash.com/photo-1587049352846-4a222e784d38?w=800&h=1200&fit=crop",

    ":::TEXT_SINGLE_COL:::The asking price for spring 2025 ancient tree maocha is 12,000 yuan per kilogram — roughly $1,650 USD. Five years ago it was 5,000 yuan. Ten years ago it was 800. I tasted six lots today. Two were excellent — dense, powerful, with the characteristic 'Banzhang bitterness' that transforms into sweetness. Four were mediocre, overpicked and carelessly processed, trading entirely on the village name.",

    ":::LIST_CHECKLIST:::SOURCING PROGRESS\n[x] Yiwu Guafengzhai — purchased 15kg\n[x] Jingmai — purchased 8kg (good but not exceptional)\n[ ] Laobanzhang — passed, price too high for quality\n[x] Nannuo — purchased 5kg of wild-growth material\n[ ] Bingdao — confirmed: cannot afford\n[x] Menghai factory — found excellent 2022 shou, bought 3 tongs\n[x] Bulang — surprise find, exceptional small lot, 10kg",

    ":::TEXT_SIDEBAR_IMAGE:::The days have fallen into a rhythm. Wake at six when the roosters begin their competitive shouting. Breakfast of rice porridge and pickled vegetables. Then into the Toyota for the day's journey. The tasting sessions are intense — eight to twelve lots per morning, each brewed gongfu style in identical gaiwans. I take notes in a shorthand I've developed over years: arrows for bitterness trajectory, circles for body, wavy lines for fragrance intensity, stars for hui gan.|Morning tasting session|https://images.unsplash.com/photo-1544787219-7f47ccb76574?w=800&h=1200&fit=crop",

    ":::MAP_CARTOGRAPHY:::Yunnan Tea Regions — Spring 2025 Route",

    ":::QUOTE_MINIMAL:::The tea knows who picked it. You can taste carelessness. — Lao Zhang, Yiwu",

    ":::NOTE_PAPER:::DAY 10 — Final Reflections\n\nFlying home tomorrow with 45 kilograms of maocha packed into reinforced cardboard boxes. Total expenditure: more than I budgeted, less than I feared. The standout purchase is the Guafengzhai — I believe it will age into something remarkable over the next decade.",

    ":::IMG_WITH_CAPTION_BOTTOM:::45 kilograms of carefully sourced maocha, ready for the journey home|https://images.unsplash.com/photo-1563911892437-1feda0179e1b?w=800&h=1200&fit=crop",

    ":::TEXT_CENTER_NARROW:::What strikes me most after ten days in Yunnan is the speed of change. Every year the roads improve, the guesthouses get nicer, the prices climb, and the old ways erode a little further. The ancient trees are finite. The knowledge of traditional processing is concentrated in an aging generation. Each trip feels a little more precious than the last.",

    ":::COPYRIGHT_PAGE:::Field Notes — Yunnan Sourcing Journal\nSpring 2025\nText and photographs by Chen Wei"
  ],
  author: PEOPLE.chen,
};

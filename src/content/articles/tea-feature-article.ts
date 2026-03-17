import { ContentType } from '../../types';
import { ReadableStory } from '../../types/read';
import { PEOPLE } from '../people';

export const teaFeatureArticle: ReadableStory = {
  id: 'template-tea-feature',
  type: ContentType.Article,
  status: 'published',
  title: 'Tea Feature Article',
  subtitle: 'Laoshan Green',
  thumbnailUrl: 'https://picsum.photos/800/1200?random=tfa001',
  durationOrTime: '17 Pages',
  origin: 'In-house',
  description: 'A deep-dive feature on a single tea variety with terroir analysis, tasting notes, brewing guide, and sourcing story.',
  tags: ['Green', 'Sourcing', 'China', 'Tasting'],
  featured: true,
  category: 'tea-feature',
  isFeatured: true,
  endOfArticleCTA: { type: 'shop', text: 'This tea is in our shop.', linkTarget: 'shop' },
  content: [
    ":::COVER_MAIN:::Laoshan Green|崂山绿茶 — Where the Mountain Meets the Sea|https://picsum.photos/800/1200?random=tfa002",

    ":::TEXT_DROP_CAP:::Most of China's great green teas grow in the misty interior — the lake regions of Zhejiang, the river valleys of Anhui, the mountain forests of Sichuan. Laoshan Green is the exception that proves every rule. Grown on the granite slopes of Mount Lao in Shandong Province, within sight and smell of the Yellow Sea, this is a coastal tea in the fullest sense. The ocean fogs that roll up the mountainside each morning bathe the tea bushes in salt-tinged moisture, while the mineral-dense granite bedrock filters snowmelt and rainwater through millennia of accumulated stone before it reaches the roots. The result is a green tea unlike any other — a tea with structure, with minerality, with what the Chinese call hai wei: the taste of the sea. Laoshan Green is not delicate. It is not subtle. It is a tea that announces itself with a chestnut sweetness on the first sip and then reveals, over successive infusions, layers of vegetal depth, oceanic salinity, and a finish that seems to resonate in the chest long after the cup is empty.",

    ":::MAP_CARTOGRAPHY:::Laoshan, Shandong Province — 36.1°N, 120.6°E — Elevation 200-800m — Maritime climate with cold winters and humid summers",

    ":::TEXT_SIDEBAR_RIGHT:::The Terroir of Laoshan|Laoshan's terroir is defined by three forces: granite, ocean, and altitude. The mountain itself is a massive granite intrusion that rose from the seabed millions of years ago. The rock is rich in feldspar and quartz, minerals that slowly weather into a sandy, well-drained soil with a slightly acidic pH — ideal conditions for Camellia sinensis. The proximity to the Yellow Sea creates a maritime microclimate that moderates temperature extremes: winters are cold but rarely severe, summers are warm but tempered by ocean breezes. The persistent morning fogs — which locals call the mountain's breath — provide natural shade that slows photosynthesis and increases the amino acid content of the leaves. This combination of mineral-rich soil, moderate climate, and natural fog-shading produces tea with an exceptional ratio of L-theanine to catechins, which translates as sweetness and umami in the cup rather than bitterness and astringency.|https://picsum.photos/600/800?random=tfa003",

    ":::DEFINITION_LARGE:::Hai Wei (海味)|The taste of the sea — a briny, mineral quality unique to coastal teas. In Laoshan Green, it manifests as a saline undertone that amplifies sweetness and extends the finish.",

    ":::IMG_FULL_BLEED:::Morning harvest on the eastern slopes of Mount Lao — the Yellow Sea visible through retreating fog|https://picsum.photos/800/1200?random=tfa004",

    ":::TEXT_DOUBLE_COL:::A History in Brief|Tea cultivation on Mount Lao dates to the Sui Dynasty, roughly the sixth century CE, when Taoist monks planted bushes near their mountain temples. For over a thousand years, Laoshan tea was a monastic product — grown in small quantities, consumed locally, and never commercialized. The modern Laoshan tea industry began in 1959 when the Chinese government initiated a southern-tea-north project, transplanting cultivars from Zhejiang and Anhui to Shandong. Many of these transplants failed — the winters were too harsh, the soil too different. But those that survived adapted, developing thicker leaves, deeper root systems, and a chemical profile distinctly different from their southern cousins. By the 1980s, Laoshan Green had emerged as a regional specialty. Today it is recognized as one of China's notable teas, though it remains far less known internationally than Longjing or Bi Luo Chun.\n\nThe Modern Challenge|Laoshan's tea industry faces a tension familiar to many Chinese tea regions: the pull between artisanal quality and commercial demand. The best Laoshan Green is picked by hand in spring, processed in small batches by skilled tea makers using traditional pan-firing methods, and sold in limited quantities at premium prices. But the domestic market's appetite for Laoshan tea has grown faster than artisanal production can supply, leading to machine-harvested, factory-processed versions that bear the Laoshan name but little of its character. Our sourcing focuses exclusively on hand-picked, small-batch production from gardens above 400 meters elevation, where the terroir's influence is most pronounced and the shortcuts of industrial production are impractical.",

    ":::RECIPE_CARD:::Brewing Guide — Gongfu Method|5g leaf per 120ml gaiwan|Water: 80°C (176°F) — lower than most greens|Rinse: 5 seconds, discard|First steep: 30 seconds|Add 10 seconds each subsequent round|Good for 6-8 infusions|Note: Laoshan Green rewards patience. The third and fourth infusions are often the most complex.",

    ":::IMG_CIRCLE_MASK:::The dry leaf — tightly rolled, dark green with visible white trichomes|https://picsum.photos/800/800?random=tfa005",

    ":::QUOTE_BIG:::Where the mountain meets the sea, the leaf finds a voice that belongs to neither land nor water but to the conversation between them.",

    ":::TEXT_SINGLE_COL:::The flavor profile of Laoshan Green unfolds across multiple infusions like a conversation that deepens with each exchange. The first infusion is direct and immediate — roasted chestnut sweetness, a clean vegetal note like blanched spinach, and the first hint of that characteristic mineral undertone. It is a welcoming cup, accessible and pleasant, but it reveals only the surface. By the second infusion, with the leaves now fully hydrated and expanded, the tea begins to show its depth. The vegetal notes shift from spinach to artichoke heart, richer and more complex.",
    ":::TEXT_SINGLE_COL:::The mineral quality intensifies, and a faint salinity appears at the edges of each sip — this is the hai wei, the ocean's signature, not salty in the way of food but saline in the way of sea air, a brightness that lifts and extends every other flavor. The third and fourth infusions are where Laoshan Green truly distinguishes itself. Here the chestnut sweetness and the mineral depth converge, and a new quality emerges: a thick, almost oily mouthfeel that coats the tongue and lingers in the throat. The Chinese term for this is hou yun — throat resonance — and in a great Laoshan Green it can persist for minutes after the last sip.",

    ":::TASTING_NOTES_GRID:::Aroma: Roasted chestnut, sea breeze, fresh cut grass|Flavor: Sweet corn, artichoke, blanched spinach, mineral salt|Mouthfeel: Medium-full body, oily texture, coating|Finish: Long, saline-sweet, chest-warming|Liquor: Pale gold-green, clear, with slight opalescence|Character: Structured, confident, marine-influenced",

    ":::IMG_WITH_CAPTION_BOTTOM:::The wet leaf after six infusions — note the intact bud-and-two-leaf sets, evidence of careful hand-picking|https://picsum.photos/800/600?random=tfa006",

    ":::TEXT_SIDEBAR_LEFT:::Sourcing Notes|Our Laoshan Green comes from a family-operated garden on the eastern slope of Mount Lao, at approximately 500 meters elevation. The garden owner, Mr. Zhang, is a second-generation tea farmer who inherited the plot from his father, one of the original participants in the 1959 transplanting project. The cultivar is a Laoshan-adapted descendant of Huangshan Zhong, a variety originally from Anhui Province. Mr. Zhang picks only the spring flush — typically a two-week window in late April — and processes the tea himself using a wood-fired wok. His annual production is less than 200 kilograms. We have been buying from him since 2021 and consider his tea among the most consistent and characterful Laoshan Greens available.|https://picsum.photos/600/800?random=tfa007",

    ":::STAT_BIG_NUMBER:::80,000|Individual hand-plucks required to produce one kilogram of finished Laoshan Green",

    ":::COPYRIGHT_PAGE:::Words by Chen Wei\nPhotography by Li Jun\nTeajia Journal — Tea Feature Series"
  ],
  author: PEOPLE.chen,
};

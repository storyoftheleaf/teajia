import { ContentType } from '../../types';
import { ReadableStory } from '../../types/read';
import { PEOPLE } from '../people';

export const teaFeatureArticle: ReadableStory = {
  id: 'template-tea-feature',
  type: ContentType.Article,
  status: 'published',
  title: 'Tea Feature Article',
  subtitle: 'Laoshan Green',
  thumbnailUrl: 'https://images.unsplash.com/photo-1556881286-fc6915169721?w=800&h=1200&fit=crop',
  durationOrTime: '17 Pages',
  origin: 'In-house',
  description: 'A deep-dive feature on a single tea variety with terroir analysis, tasting notes, brewing guide, and sourcing story.',
  tags: ['Green', 'Sourcing', 'China', 'Tasting'],
  featured: true,
  category: 'tea-feature',
  isFeatured: true,
  endOfArticleCTA: { type: 'shop', text: 'This tea is in our shop.', linkTarget: 'shop' },
  content: [
    ":::COVER_MAIN:::Laoshan Green|崂山绿茶 — Where the Mountain Meets the Sea|https://images.unsplash.com/photo-1556881286-fc6915169721?w=800&h=1200&fit=crop",

    ":::TEXT_DROP_CAP:::Most of China's great green teas grow in the misty interior — the lake regions of Zhejiang, the river valleys of Anhui, the mountain forests of Sichuan. Laoshan Green is the exception that proves every rule. Grown on the granite slopes of Mount Lao in Shandong Province, within sight and smell of the Yellow Sea, this is a coastal tea in the fullest sense.",

    ":::TEXT_SIDEBAR_IMAGE:::The ocean fogs that roll up the mountainside each morning bathe the tea bushes in salt-tinged moisture, while the mineral-dense granite bedrock filters snowmelt through millennia of accumulated stone. The result is a green tea unlike any other — a tea with structure, with minerality, with what the Chinese call hai wei: the taste of the sea. Laoshan Green is not delicate. It is a tea that announces itself with chestnut sweetness and then reveals layers of vegetal depth, oceanic salinity, and a finish that resonates in the chest.|Coastal tea gardens|https://images.unsplash.com/photo-1587049352846-4a222e784d38?w=800&h=1200&fit=crop",

    ":::MAP_CARTOGRAPHY:::Laoshan, Shandong Province — 36.1°N, 120.6°E — Elevation 200-800m — Maritime climate with cold winters and humid summers",

    ":::IMG_FULL_BLEED:::Morning harvest on the eastern slopes of Mount Lao|https://images.unsplash.com/photo-1582793988951-9aed5509eb97?w=800&h=1200&fit=crop",

    ":::TEXT_SIDEBAR_RIGHT:::The Terroir of Laoshan|Laoshan's terroir is defined by three forces: granite, ocean, and altitude. The mountain is a massive granite intrusion rich in feldspar and quartz, weathering into a sandy, well-drained soil with slightly acidic pH — ideal for Camellia sinensis. The proximity to the Yellow Sea creates a maritime microclimate that moderates temperature extremes. The persistent morning fogs provide natural shade that increases amino acid content.|https://images.unsplash.com/photo-1556881286-fc6915169721?w=800&h=1200&fit=crop",

    ":::DEFINITION_LARGE:::Hai Wei (海味)|The taste of the sea — a briny, mineral quality unique to coastal teas. In Laoshan Green, it manifests as a saline undertone that amplifies sweetness and extends the finish.",

    ":::IMG_FULL_BLEED:::Morning harvest on the eastern slopes of Mount Lao — the Yellow Sea visible through retreating fog|https://images.unsplash.com/photo-1587049352846-4a222e784d38?w=800&h=1200&fit=crop",

    ":::TEXT_DOUBLE_COL:::A History in Brief|Tea cultivation on Mount Lao dates to the Sui Dynasty, roughly the sixth century CE, when Taoist monks planted bushes near their mountain temples. The modern Laoshan tea industry began in 1959 when the Chinese government transplanted cultivars from Zhejiang and Anhui. Many failed — the winters were too harsh. But those that survived adapted, developing thicker leaves and deeper root systems.\n\nThe Modern Challenge|Laoshan's tea industry faces a familiar tension: artisanal quality versus commercial demand. The best Laoshan Green is picked by hand in spring, processed in small batches using traditional pan-firing. But domestic appetite has grown faster than artisanal production can supply. Our sourcing focuses exclusively on hand-picked, small-batch production from gardens above 400 meters.",

    ":::RECIPE_CARD:::Brewing Guide — Gongfu Method|5g leaf per 120ml gaiwan|Water: 80°C (176°F) — lower than most greens|Rinse: 5 seconds, discard|First steep: 30 seconds|Add 10 seconds each subsequent round|Good for 6-8 infusions|Note: Laoshan Green rewards patience. The third and fourth infusions are often the most complex.",

    ":::IMG_CIRCLE_MASK:::The dry leaf — tightly rolled, dark green with visible white trichomes|https://images.unsplash.com/photo-1563911892437-1feda0179e1b?w=800&h=1200&fit=crop",

    ":::QUOTE_BIG:::Where the mountain meets the sea, the leaf finds a voice that belongs to neither land nor water but to the conversation between them.",

    ":::TEXT_SINGLE_COL:::The flavor profile of Laoshan Green unfolds across multiple infusions like a conversation that deepens with each exchange. The first infusion is direct and immediate — roasted chestnut sweetness, a clean vegetal note like blanched spinach, and the first hint of that characteristic mineral undertone.",

    ":::IMG_WITH_CAPTION_BOTTOM:::Tea liquor showing the pale gold-green color|https://images.unsplash.com/photo-1530968033775-2c92736b131e?w=800&h=1200&fit=crop",

    ":::TEXT_SINGLE_COL:::By the second infusion, with the leaves now fully hydrated, the tea begins to show its depth. The vegetal notes shift from spinach to artichoke heart. The mineral quality intensifies, and a faint salinity appears — this is the hai wei, the ocean's signature. The third and fourth infusions are where Laoshan Green truly distinguishes itself, as a thick, almost oily mouthfeel emerges that coats the tongue and lingers in the throat.",

    ":::TASTING_NOTES_GRID:::Aroma: Roasted chestnut, sea breeze, fresh cut grass|Flavor: Sweet corn, artichoke, blanched spinach, mineral salt|Mouthfeel: Medium-full body, oily texture, coating|Finish: Long, saline-sweet, chest-warming|Liquor: Pale gold-green, clear, with slight opalescence|Character: Structured, confident, marine-influenced",

    ":::IMG_WITH_CAPTION_BOTTOM:::The wet leaf after six infusions — note the intact bud-and-two-leaf sets, evidence of careful hand-picking|https://images.unsplash.com/photo-1563911892437-1feda0179e1b?w=800&h=1200&fit=crop",

    ":::TEXT_SIDEBAR_LEFT:::Sourcing Notes|Our Laoshan Green comes from a family-operated garden on the eastern slope of Mount Lao, at approximately 500 meters elevation. The garden owner, Mr. Zhang, is a second-generation tea farmer. The cultivar is a Laoshan-adapted descendant of Huangshan Zhong. Mr. Zhang picks only the spring flush — typically a two-week window in late April — and processes the tea himself using a wood-fired wok. His annual production is less than 200 kilograms.|https://images.unsplash.com/photo-1597318181409-cf64d0b5d8a2?w=800&h=1200&fit=crop",

    ":::STAT_BIG_NUMBER:::80,000|Individual hand-plucks required to produce one kilogram of finished Laoshan Green",

    ":::COPYRIGHT_PAGE:::Words by Chen Wei\nPhotography by Li Jun\nTeajia Journal — Tea Feature Series"
  ],
  author: PEOPLE.chen,
};

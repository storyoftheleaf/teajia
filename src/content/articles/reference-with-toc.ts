import { ContentType } from '../../types';
import { ReadableStory } from '../../types/read';
import { PEOPLE } from '../people';

export const referenceWithToc: ReadableStory = {
  id: 'template-reference',
  type: ContentType.Article,
  status: 'published',
  title: 'Reference with TOC',
  subtitle: 'Living Archive',
  thumbnailUrl: 'https://images.unsplash.com/photo-1563911892437-1feda0179e1b?w=800&h=1200&fit=crop',
  durationOrTime: '24 Pages',
  origin: 'In-house',
  description: 'A curated reference guide with table of contents, index, and organized sections — the encyclopedia format.',
  tags: ['Teaching', 'History'],
  content: [
    ":::COVER_TYPOGRAPHIC:::The Living Archive|A Comprehensive Reference to Tea",

    ":::TOC_IMAGE:::Processing Methods|Tea Categories & Types|Famous Regions of Origin|Key Terminology & Glossary|The Timeline of Tea|https://images.unsplash.com/photo-1563911892437-1feda0179e1b?w=800&h=1200&fit=crop",

    ":::CHAPTER_BOLD:::I. Processing Methods",

    ":::TEXT_DOUBLE_COL:::Understanding Processing|Every tea begins as the same plant — Camellia sinensis — yet the finished product can range from a pale, sweet white tea to a pitch-dark, earthy puerh. The difference lies entirely in processing. The decisions made in the hours and days after picking determine the category, character, and quality of the final tea.\n\nThe Kill-Green Step|Perhaps the most critical moment in tea processing is sha qing — the kill-green step — where heat is applied to halt oxidation. Pan-firing in a wok produces teas with a toasty, nutty quality. Steaming preserves a vivid green color and marine, umami-rich flavor. Baking creates something between the two. Each method denatures the same enzymes but leaves a different aromatic fingerprint.",

    ":::IMG_FULL_BLEED:::Tea processing in the traditional way|https://images.unsplash.com/photo-1545579133-99bb5ab189bd?w=800&h=1200&fit=crop",

    ":::TEXT_TRIPLE_COL:::Withering|The first step for most teas. Fresh leaves are spread on bamboo trays or cloth and allowed to lose moisture. Indoor withering under controlled conditions produces consistent results; outdoor withering under sunlight adds complexity but introduces variability. Duration ranges from two hours for a light green tea to twenty-four hours for a heavily withered white or black tea.|Oxidation|The enzymatic browning that transforms green leaf into amber, copper, or black. Controlled by temperature, humidity, and time. Green tea: 0% oxidation. Oolong: 15-85%. Black tea: 85-100%. The art lies in stopping oxidation at precisely the right moment.|Rolling & Shaping|After or during oxidation, leaves are rolled to break cell walls and release juices. This step also determines the tea's physical form — tightly rolled balls, twisted strips, flat needles, or compressed cakes. Each shape affects how the tea brews and ages.",

    ":::DEFINITION_LARGE:::Sha Qing (杀青)|Kill-green: the application of heat to halt enzymatic oxidation. The single most important step in determining a tea's category.",

    ":::INDEX_GRID:::Pan-firing (Chao Qing)|Wok-tossed at 200-280°C. Produces toasty, chestnut notes. Used for Longjing, Bi Luo Chun, most Chinese greens.,Steaming (Zheng Qing)|Brief steam exposure at 100°C. Preserves chlorophyll and amino acids. Used for Sencha, Gyokuro, all Japanese greens.,Baking (Hong Qing)|Gentle oven heat at 100-130°C. Produces mellow, sweet character. Used for Huang Shan Mao Feng, some Yunnan greens.,Sun-drying (Shai Qing)|Gentle solar heat. Minimal enzyme deactivation allows continued slow oxidation. Essential for Sheng Puerh and Yunnan sun-dried greens.",

    ":::IMG_GRID_2x2:::Processing steps: withering on bamboo trays, hand-rolling on stone table, charcoal roasting in bamboo baskets, final sorting by grade|https://images.unsplash.com/photo-1545579133-99bb5ab189bd?w=800&h=1200&fit=crop",

    ":::CHAPTER_BOLD:::II. Tea Categories & Types",

    ":::IMG_FULL_BLEED:::The diversity of tea types|https://images.unsplash.com/photo-1530968033775-2c92736b131e?w=800&h=1200&fit=crop",

    ":::TEXT_DOUBLE_COL:::The Six Categories|Chinese tea classification recognizes six fundamental categories based on processing method: green (lu cha), white (bai cha), yellow (huang cha), oolong (qing cha), red/black (hong cha), and dark/post-fermented (hei cha). This system, codified during the Ming Dynasty, remains the most useful framework for understanding tea.\n\nBeyond the Six|Modern tea production has produced styles that resist easy categorization. Purple tea from Kenya does not fit neatly into any Chinese category. GABA tea crosses boundaries between oolong and black tea. Aged white tea develops characteristics that approach dark tea. The six-category system is a starting point, not a final word.",

    ":::TEXT_SIDEBAR_RIGHT:::Green Tea (Lu Cha)|The most consumed category worldwide. Defined by minimal oxidation — the kill-green step is applied as soon as possible after picking to preserve the leaf's fresh, vegetal character. Flavor profiles range from sweet and chestnut-like (Longjing) to marine and umami-rich (Gyokuro) to smoky and bold (Gunpowder). The best green teas are seasonal products, meant to be consumed within months of production.|https://images.unsplash.com/photo-1556881286-fc6915169721?w=800&h=1200&fit=crop",

    ":::TEXT_SINGLE_COL:::White tea represents the least processed category. The leaves are simply withered and dried, with no kill-green step and minimal handling. This apparent simplicity is deceptive — producing excellent white tea requires exceptional raw material and precise environmental control during the extended withering period.",

    ":::TEXT_JUSTIFIED_NARROW:::The two most famous styles are Bai Hao Yin Zhen (Silver Needle), made entirely from unopened buds, and Bai Mu Dan (White Peony), which includes the bud and one or two leaves. Young white tea is delicate and sweet, with notes of hay, melon, and honey. Aged white tea — stored for five years or more — develops dried fruit, medicinal, and even camphor characteristics that bear little resemblance to the fresh product.",

    ":::LIST_TIMELINE:::2737 BCE|Legendary discovery by Emperor Shen Nung,760 CE|Lu Yu writes the Chajing (Classic of Tea),1391|Ming Dynasty emperor bans compressed tea and mandates loose-leaf production,1610|Dutch East India Company brings tea to Europe for the first time,1823|Robert Bruce discovers wild tea trees in Assam confirming non-Chinese origin,1848|Robert Fortune smuggles tea plants from China to India on behalf of the British,1869|Suez Canal opens — halves shipping time and transforms the tea trade,1908|Thomas Sullivan accidentally invents the tea bag in New York City,1974|Yunnan government begins systematic classification of puerh tea,2020|Global tea production exceeds 6 million metric tons for the first time",

    ":::CHAPTER_BOLD:::III. Famous Regions of Origin",

    ":::IMG_FULL_BLEED:::Mountain tea fields stretching into the distance|https://images.unsplash.com/photo-1587049352846-4a222e784d38?w=800&h=1200&fit=crop",

    ":::TEXT_SINGLE_COL:::China remains the origin and spiritual home of tea, producing more variety than any other country. The major producing provinces include Fujian (oolong, white, red), Yunnan (puerh, ancient tree teas), Zhejiang (Longjing and other premium greens), Anhui (Keemun, Huangshan Mao Feng), and Guangdong (Phoenix Dan Cong).",

    ":::TEXT_JUSTIFIED_NARROW:::Each region has its own terroir, cultivars, and processing traditions, making Chinese tea a subject that rewards a lifetime of study. The concept of mingcha — famous teas — dates to the Tang Dynasty, when imperial tributes established hierarchies of quality that persist, in modified form, to this day.",

    ":::STAT_BIG_NUMBER:::3,000+|Distinct named tea varieties produced in China alone",

    ":::TEXT_DOUBLE_COL:::Taiwan|Despite its small size, Taiwan produces some of the world's most sought-after oolongs. The high-mountain tea gardens of Alishan, Lishan, and Da Yu Ling benefit from cool temperatures, intense UV radiation, and persistent fog. Dong Ding, the island's most traditional oolong style, is roasted over charcoal in a process that can take thirty hours.\n\nJapan|Japanese tea culture is defined by two innovations: steaming as a kill-green method, which produces teas with vivid green color and intense umami; and shading, which forces tea plants to overproduce chlorophyll and amino acids. Uji in Kyoto Prefecture is the historical center, producing the finest matcha and gyokuro.",

    ":::IMG_WITH_CAPTION_BOTTOM:::High mountain tea gardens in Taiwan|https://images.unsplash.com/photo-1582793988951-9aed5509eb97?w=800&h=1200&fit=crop",

    ":::TEXT_SIDEBAR_RIGHT:::India & Sri Lanka|India is the world's second-largest tea producer, with Darjeeling, Assam, and the Nilgiris as its three most important regions. Darjeeling teas, grown at elevations up to 2,000 meters, are light, muscatel, and floral — often called the Champagne of teas. Assam produces robust, malty black teas that form the backbone of most British and Irish blends. Sri Lanka produces a range of styles determined largely by elevation.|https://images.unsplash.com/photo-1556881286-fc6915169721?w=800&h=1200&fit=crop",

    ":::CHAPTER_BOLD:::IV. Key Terminology",

    ":::DEFINITION_LARGE:::Terroir (风土)|The complete natural environment in which tea is grown — soil composition, elevation, climate, surrounding vegetation, water sources, and microbiome. In Chinese, the concept is expressed as shanchangqi (山场气), literally 'mountain field energy.'",

    ":::DEFINITION_LARGE:::Cha Qi (茶气)|The physical and psychological effect of tea on the body. Experienced as warmth, tingling, mental clarity, or a sense of calm energy. Particularly associated with aged puerh and high-quality oolongs from ancient trees.",

    ":::INDEX_GRID:::Gongfu (工夫)|Literally 'with skill.' A brewing method using high leaf-to-water ratio and short infusion times to produce multiple steepings that reveal a tea's evolution.,Maocha (毛茶)|Rough or crude tea — the semi-finished product before final processing. For puerh, this is the sun-dried loose leaf before compression.,Huigan (回甘)|Returning sweetness — a pleasant sweet aftertaste that lingers after swallowing. Considered a hallmark of high-quality tea.,Yan Yun (岩韵)|Rock rhyme — the mineral, stony quality characteristic of Wuyi Yan Cha (rock oolong). Attributed to the mineral-rich soil of the Wuyi cliff-face gardens.,Hou Yun (喉韵)|Throat resonance — the sensation of flavor and texture felt deep in the throat after swallowing. Distinguished from mouth-feel as a deeper and more persistent sensation.,Shan Tou (山头)|Mountain head — a specific named peak or growing area within a larger tea region. In puerh, shan tou is analogous to a vineyard or cru in wine.",

    ":::EPILOGUE_CENTERED:::This reference guide is a living document. Tea knowledge evolves as new research emerges, old traditions are rediscovered, and producers continue to innovate. We invite readers to approach these entries as starting points for their own exploration rather than definitive pronouncements. The best way to understand any term in this glossary is to taste the tea it describes.",

    ":::COPYRIGHT_PAGE:::Compiled and written by Sarah Jenkins\nWith contributions from Chen Wei and Master Zhou Yu\nTeajia Journal — The Living Archive"
  ],
  author: PEOPLE.sarah,
};

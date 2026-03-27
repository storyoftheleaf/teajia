import { ContentType } from '../../types';
import { ReadableStory } from '../../types/read';
import { PEOPLE } from '../people';

export const travelFeatureVideo: ReadableStory = {
  id: 'template-travel-video',
  type: ContentType.Article,
  status: 'published',
  title: 'Into the Wuyi Mountains',
  subtitle: 'A Tea Pilgrimage to Fujian',
  thumbnailUrl: 'https://images.unsplash.com/photo-1587049352846-4a222e784d38?w=800&h=1200&fit=crop',
  durationOrTime: '18 Pages',
  origin: 'In-house',
  description: 'A pilgrimage to the birthplace of rock oolong, following Master Zhou through Fujian\'s ancient ravines.',
  tags: ['Oolong', 'China', 'Fujian', 'Sourcing'],
  content: [
    ":::COVER_MAIN:::Into the Wuyi Mountains|A Tea Pilgrimage to Fujian|https://images.unsplash.com/photo-1587049352846-4a222e784d38?w=800&h=1200&fit=crop",

    ":::TEXT_DROP_CAP:::The overnight train from Fuzhou arrives at Wuyishan North Station just before dawn. Outside the window, the landscape has already changed — limestone karsts rise from the river valley like the petrified fingers of some ancient hand. The air carries a dampness that feels botanical, thick with the exhalations of ten thousand species of fern and moss and lichen.",

    ":::TEXT_SINGLE_COL:::This is the Wuyi Mountain UNESCO World Heritage Site, a place where geology and botany conspire to produce some of the most celebrated teas on earth. The locals call it yan yun — the rock rhyme — that ineffable mineral character that marks a true Wuyi oolong. I have come to understand where that flavor begins.",

    ":::IMG_FULL_BLEED:::Dawn breaks over the Nine Bend River, Wuyi Mountains|https://images.unsplash.com/photo-1587049352846-4a222e784d38?w=800&h=1200&fit=crop",

    ":::TEXT_WITH_VIDEO:::Our first morning begins with Master Zhou Yu, a third-generation tea maker whose family has tended plots along Huiyuan Keng since the 1940s. He meets us at the trailhead wearing rubber boots and carrying a bamboo basket. The path narrows quickly, winding between moss-covered boulders. Zhou points to tea bushes growing from a crack in the cliff face. 'Rou Gui,' he says. 'But here, because of this rock, this exact angle of sun — it becomes something else entirely.'|dQw4w9WgXcQ|Master Zhou guides us through Huiyuan Keng|The narrow ravine channels moisture and minerals to the tea bushes growing from the cliff walls.",

    ":::IMG_WITH_CAPTION_BOTTOM:::Tea growing from ancient cliff faces|https://images.unsplash.com/photo-1582793988951-9aed5509eb97?w=800&h=1200&fit=crop",

    ":::TEXT_SINGLE_COL:::The concept of terroir in tea mirrors that of wine, but in Wuyi it reaches an almost absurd level of specificity. Two bushes of the same cultivar planted fifty meters apart will produce teas so different they might as well be separate varieties. This is zhengyan — true rock tea — and it commands prices ten to fifty times higher than the same cultivar grown in the flatlands below.",

    ":::TEXT_DOUBLE_COL:::The Ravines|Wuyi's named ravines — known as keng or jian — are the grand crus of Chinese oolong. The most famous include Niulan Keng, Huiyuan Keng, Liuxiang Jian, Wuyuan Jian, and Daoshui Keng. Together these form the core zhengyan production area of perhaps 70 square kilometers. Within this zone, microclimates shift dramatically with every turn of the path.\n\nThe Processing|After picking, the leaves are spread on bamboo trays for initial withering. Then begins zuoqing — alternating shaking and resting that bruises leaf edges and initiates oxidation. Zhou learned the rhythmic tossing motion from his grandfather. 'The timing is everything,' he says. 'When the fragrance shifts from green to floral, you stop.'",

    ":::QUOTE_BIG:::The mountain does not make the tea. The mountain makes the conditions. The tea makes itself. — Master Zhou Yu",

    ":::IMG_FULL_BLEED:::The misty ravines of Wuyi|https://images.unsplash.com/photo-1464982326199-86f32f81b211?w=800&h=1200&fit=crop",

    ":::TEXT_WITH_VIDEO:::The charcoal roasting stage is where Wuyi oolong diverges most dramatically from other Chinese teas. Zhou maintains a roasting room with a sunken pit filled with longan wood charcoal covered in rice ash. The temperature is controlled not by thermometer but by palm. Each session lasts six to eight hours, during which Zhou rotates bamboo baskets, occasionally pressing his face into the warm leaves to read their progress through scent. 'Roasting is a conversation,' he tells us. 'The fire speaks, and the tea answers.'|dQw4w9WgXcQ|The art of charcoal roasting in Wuyi|Master Zhou demonstrates the traditional hongbei roasting method passed down through three generations.",

    ":::IMG_SPLIT_VERTICAL:::Left: Fresh leaves after picking. Right: After the third charcoal roast.|https://images.unsplash.com/photo-1563911892437-1feda0179e1b?w=800&h=1200&fit=crop|https://images.unsplash.com/photo-1530968033775-2c92736b131e?w=800&h=1200&fit=crop",

    ":::TEXT_SINGLE_COL:::On our third day, Zhou takes us to see the mother trees — the original Da Hong Pao bushes that cling to a cliff face above Jiulong Ke. These six bushes, estimated to be over 350 years old, are the most famous tea plants in the world. The last harvest occurred in 2005, yielding just 20 grams that was placed in the National Museum in Beijing.",

    ":::TEXT_JUSTIFIED_NARROW:::Standing below them, I feel the weight of the mythology that sustains this industry. Every Da Hong Pao sold today is a cutting descended from these six plants. The original flavor exists now only in memory and legend. What remains is the aspiration toward it, carried forward in every carefully roasted batch.",

    ":::IMG_CIRCLE_MASK:::Master Zhou Yu at the entrance to Huiyuan Keng|https://images.unsplash.com/photo-1597318181409-cf64d0b5d8a2?w=800&h=1200&fit=crop",

    ":::RECIPE_CARD:::Wuyi Yancha Gongfu Method|Vessel: 110ml gaiwan or Yixing clay pot.|Leaf: 8g (fill vessel 2/3 with dry leaf).|Water: 100°C — full boil, always.|Rinse: One quick wash, discard.|Steep 1-3: 10 seconds each.|Steep 4-6: 15 seconds each.|Steep 7+: Add 10 seconds per round.|Expect 8-12 quality steeps from true zhengyan material.",

    ":::TEXT_SIDEBAR_RIGHT:::Evening Sessions|Each night, Zhou hosts an informal tasting session on his veranda. A clay tea tray, a kettle over charcoal, and a row of small white cups. He lines up four or five teas and pours them in silence. We taste without speaking, letting the liquor coat our tongues. Only after everyone has tasted does the discussion begin. These sessions stretch past midnight, fueled by the kind of unhurried conversation possible only where the nearest city is three hours away.|https://images.unsplash.com/photo-1545579133-99bb5ab189bd?w=800&h=1200&fit=crop",

    ":::MAP_CARTOGRAPHY:::Wuyi Mountain Tea Region|Niulan Keng|Huiyuan Keng|Liuxiang Jian|Wuyuan Jian|Daoshui Keng|Zhushao|Shuilian Dong",

    ":::TEXT_DOUBLE_COL:::The Economics|True zhengyan Wuyi oolong occupies a peculiar market position. Premium Niulan Keng Rou Gui can exceed 10,000 RMB per jin ($1,400 USD). Zhou is unusual in selling directly to a small network, cutting out middlemen. 'I produce less than 40 kilograms per year,' he explains. 'I will not sell it to someone who will blend it with flatland tea.'\n\nThe Future|Zhou's daughter studied agriculture at Fujian Normal University and has returned to help. She brings scientific rigor — soil testing, weather monitoring, controlled experiments — while her father contributes intuitive knowledge. 'The mountain does not change,' he says. 'But we must learn to speak its language in new ways.'",

    ":::IMG_FULL_BLEED:::The Nine Bend River winds through Wuyi|https://images.unsplash.com/photo-1464982326199-86f32f81b211?w=800&h=1200&fit=crop",

    ":::TEXT_SINGLE_COL:::On our final morning, we hike to the summit of Tianyou Peak. The entire Wuyi landscape unfolds beneath us: the dark ribbon of the Nine Bend River, the terraced tea gardens, the scattered farmhouses sending up threads of smoke.",

    ":::TEXT_CENTER_NARROW:::From this height, the karst peaks look like calligraphy — bold vertical strokes drawn by a cosmic brush across a green canvas. I think about Zhou's phrase, yan yun, the rock rhyme. Standing here, I finally understand that it refers not just to the flavor of the tea but to the rhythm of this entire landscape — the way stone and water and leaf and human effort rhyme together across centuries.",

    ":::COPYRIGHT_PAGE:::Words by Chen Wei\nPhotography by Li Jun\nWith gratitude to Master Zhou Yu\nand the tea farmers of Wuyi Mountain\n\nTeajia Magazine"
  ],
  author: PEOPLE.chen,
  interviewee: PEOPLE.zhou,
};

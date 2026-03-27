import { ContentType } from '../../types';
import { ReadableStory } from '../../types/read';
import { PEOPLE } from '../people';

export const beginnersGuide: ReadableStory = {
  id: 'template-beginners',
  type: ContentType.Article,
  status: 'published',
  title: "Your First Cup",
  subtitle: "A Beginner's Guide to Real Tea",
  thumbnailUrl: 'https://images.unsplash.com/photo-1544787219-7f47ccb76574?w=800&h=1200&fit=crop',
  durationOrTime: '19 Pages',
  origin: 'In-house',
  description: 'A welcoming, accessible guide for newcomers to quality tea, covering the basics with warmth and clarity.',
  tags: ['Brewing', 'Tasting', 'Teaching'],
  startHere: true,
  content: [
    ":::COVER_PHOTO_INSET:::Your First Cup|A Beginner's Guide to Real Tea|https://images.unsplash.com/photo-1544787219-7f47ccb76574?w=800&h=1200&fit=crop",

    ":::TEXT_DROP_CAP:::If you are reading this, you have probably already had thousands of cups of tea in your life. Tea bags at breakfast, iced tea at restaurants, a cup of chamomile before bed. And all of that is fine. But somewhere along the way, you encountered something different — a cup that stopped you mid-sip, that tasted like nothing you had filed under the word 'tea.'",

    ":::TEXT_SIDEBAR_IMAGE:::Maybe it was a friend's gongfu session, a sample at a specialty shop, or a cup served at a restaurant that took tea seriously. Whatever it was, it opened a door. This guide is for the person standing in that doorway, curious but uncertain. You do not need to memorize anything. You do not need expensive equipment. You need only three things: leaves, water, and the willingness to pay attention.|A welcoming cup of tea|https://images.unsplash.com/photo-1597318181409-cf64d0b5d8a2?w=800&h=1200&fit=crop",

    ":::TEXT_SINGLE_COL:::The first thing to understand is that all 'real' tea — green, white, yellow, oolong, black, and dark — comes from a single plant species: Camellia sinensis. This evergreen shrub, native to the borderlands of China, Myanmar, and India, is one of the most versatile crop plants on earth.",

    ":::TEXT_CENTER_NARROW:::The staggering variety of tea types you see in shops is not the result of different plants (mostly) but of different processing methods applied to the same basic raw material. Understanding this single fact — same plant, different processing — is the most important conceptual leap a beginner can make.",

    ":::IMG_FULL_BLEED:::Tea leaves in their natural state — the source of all tea varieties|https://images.unsplash.com/photo-1563911892437-1feda0179e1b?w=800&h=1200&fit=crop",

    ":::CHAPTER_CENTERED_SMALL:::The Six Types of Tea",

    ":::TEXT_DOUBLE_COL:::Green Tea|The freshest and most delicate category, green tea is processed quickly after harvest to prevent oxidation. Chinese greens are typically pan-fired in a wok, producing toasty, nutty, or chestnut-like flavors. Japanese greens are steamed, preserving a vivid green color and marine, umami-rich character. Beginner-friendly picks: Longjing (Dragon Well) from China for its clean, sweet chestnut flavor, or Sencha from Japan for its refreshing vegetal brightness.\n\nWhite Tea|The least processed tea category — leaves are simply withered and dried with minimal handling. The result is subtle, sweet, and often floral. Silver Needle (Bai Hao Yin Zhen), made only from unopened buds, offers a honeyed sweetness and silk-like texture. White Peony (Bai Mu Dan), including both buds and young leaves, has more body and a pleasant hay-like sweetness. White tea is an excellent starting point for beginners because it is nearly impossible to over-brew into unpleasantness.",

    ":::RECIPE_CARD:::Your Very First Brew|What you need: Any small cup or mug, a way to heat water, 2-3 grams of loose leaf tea (about a tablespoon)|Heat water to roughly 80°C — if you don't have a thermometer, bring water to a boil and let it cool for 2-3 minutes|Place leaves directly in your cup|Pour water over leaves|Wait 2-3 minutes|Drink directly from the cup, using your lips to filter the leaves (this is called 'grandpa style' and it is a perfectly legitimate method used daily by millions of people in China)|When the cup is half empty, add more hot water for a second infusion",

    ":::IMG_FULL_BLEED:::Morning light through a simple glass cup of green tea|https://images.unsplash.com/photo-1556881286-fc6915169721?w=800&h=1200&fit=crop",

    ":::TEXT_SIDEBAR_RIGHT:::The Equipment Myth|The internet will tell you that you need a gaiwan, a fairness pitcher, tasting cups, a tea tray, a bamboo scoop, a tea pet, and a dedicated water source before you can brew properly. This is nonsense. The entire history of Chinese tea drinking begins with a bowl and hot water. You can brew excellent tea in a coffee mug, a mason jar, or a paper cup. Equipment is fun and can improve your experience, but it is never a prerequisite. The only purchase I recommend for a beginner is a simple 100ml gaiwan — a lidded bowl that costs $5–$15 and opens up the world of gongfu brewing whenever you are ready to explore it.|https://images.unsplash.com/photo-1594631252845-29fc4cc8cde9?w=800&h=1200&fit=crop",

    ":::DEFINITION_LARGE:::Gongfu Brewing|Literally 'brewing with skill' — a Chinese method using a high leaf-to-water ratio (5–8g per 100ml) and very short steep times (5–30 seconds). The same leaves are steeped many times, with each infusion revealing different aspects of the tea's character. It is not better or worse than Western brewing — it is a different approach that rewards attention and repetition.",

    ":::LIST_CHECKLIST:::Your First Shopping List|One Chinese green tea (Longjing, Biluochun, or Mao Feng) — approx. $5–15 for 50g|One light oolong (Tieguanyin or Ali Shan) — approx. $8–20 for 50g|One black tea (Dian Hong or Keemun) — approx. $5–15 for 50g|A simple 100ml gaiwan — $5–15|A small pitcher or cup to decant into — any cup works|A kitchen scale that measures in grams — useful but not essential|A variable-temperature kettle — helpful but a regular kettle with a cooling period works fine",

    ":::IMG_GRID_2x2:::Loose leaf green tea|https://images.unsplash.com/photo-1563911892437-1feda0179e1b?w=800&h=1200&fit=crop|Rolled oolong pearls|https://images.unsplash.com/photo-1563911892437-1feda0179e1b?w=800&h=1200&fit=crop|Twisted black tea leaves|https://images.unsplash.com/photo-1563911892437-1feda0179e1b?w=800&h=1200&fit=crop|Compressed puerh cake|https://images.unsplash.com/photo-1563911892437-1feda0179e1b?w=800&h=1200&fit=crop",

    ":::TEXT_HIGHLIGHTED:::$$dark$$The single biggest mistake beginners make is using boiling water for everything. This is fine for black tea and puerh, but it will scorch green tea into bitter misery. If you remember nothing else from this guide, remember this: for green and white tea, let your boiling water cool for 2–3 minutes before pouring. That small act of patience will transform your experience.",

    ":::IMG_WITH_CAPTION_BOTTOM:::The difference water temperature makes — same leaves, different results|https://images.unsplash.com/photo-1571934811356-5cc061b6821f?w=800&h=1200&fit=crop",

    ":::TEXT_SINGLE_COL:::The second biggest mistake is using too little leaf. Tea bags have conditioned us to think of tea as weak and watery. Loose-leaf tea, used in proper quantities, produces a liquor with body, depth, and intensity that bears almost no resemblance to bagged tea.",

    ":::TASTING_NOTES_GRID:::Building Your Vocabulary|Sweet: honey, sugar cane, brown sugar, caramel|Floral: orchid, gardenia, jasmine, rose|Vegetal: grass, spinach, artichoke, asparagus|Nutty: chestnut, almond, walnut, hazelnut|Fruity: peach, apricot, citrus, berry|Woody: cedar, sandalwood, pine, oak|Earthy: wet stone, mushroom, forest floor, clay|Marine: seaweed, ocean breeze, mineral, kelp",

    ":::TEXT_DOUBLE_COL:::Oolong Tea|The most diverse and arguably most rewarding category for exploration. Oolongs range from barely oxidized (close to green tea) to heavily oxidized (close to black tea), with an enormous spectrum of flavors in between. Light Taiwanese oolongs like Ali Shan and Li Shan taste of butter, cream, and gardenias. Medium oolongs like Tieguanyin offer orchid fragrance and a smooth, coating mouthfeel. Dark, roasted oolongs like Da Hong Pao present dried fruit, caramel, and mineral depth.\n\nBlack Tea|Known as 'red tea' (hong cha) in China — named for the color of the liquor, not the leaf. Fully oxidized teas with rich, bold flavors ranging from malty and honeyed to fruity and chocolatey. Chinese blacks like Dian Hong (Yunnan Gold) and Keemun are smoother and more complex than the Indian and Sri Lankan blacks most Westerners grew up with. Dian Hong, with its golden buds and sweet, peppery character, is a superb beginner's black tea — it is nearly impossible to make it taste bad.",

    ":::QUOTE_BIG:::You don't need to be an expert to enjoy tea. You just need to slow down long enough to notice what's already there.",

    ":::IMG_WITH_CAPTION_BOTTOM:::A simple gaiwan setup — all you need to start gongfu brewing|https://images.unsplash.com/photo-1594631252845-29fc4cc8cde9?w=800&h=1200&fit=crop",

    ":::TEXT_SINGLE_COL:::Dark tea and puerh deserve their own introduction, but a brief word for the curious. Dark teas — including shou (ripe) puerh, liu bao, and fu zhuan — are post-fermented, meaning they undergo microbial transformation after initial processing. Shou puerh tastes of earth, wet wood, and dark chocolate, with a thick, smooth body unlike anything else in the tea world.",

    ":::TEXT_CENTER_NARROW:::Sheng (raw) puerh is a different beast entirely: young sheng is intensely bitter, astringent, and floral, while aged sheng (10–30+ years) develops extraordinary complexity — dried fruit, camphor, old books, and a sweetness that seems impossible given the leaf's youth profile. Puerh is deep water, and you should not feel pressured to explore it immediately. But keep it in mind. When you are ready, it will change your understanding of what tea can be.",

    ":::EPILOGUE_CENTERED:::The journey of a thousand teas begins with a single steep. Welcome. The water is ready.",

    ":::COPYRIGHT_PAGE:::Teajia Editorial"
  ],
  author: PEOPLE.chen,
};

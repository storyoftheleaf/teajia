// Tea Glossary - Comprehensive tea terminology

export type GlossaryCategory = 'processing' | 'tasting' | 'ceremony' | 'origin' | 'equipment' | 'tea-type';

export interface TryThisSuggestion {
  id: string;
  title: string;
  description: string;
  difficulty: 'easy' | 'moderate' | 'advanced';
  timeRequired?: string;
}

export interface GlossaryDeepDive {
  extendedDescription: string;
  culturalContext?: string;
  tryThis?: TryThisSuggestion[];
}

export interface GlossaryTerm {
  id: string;
  term: string;
  pronunciation?: string; // e.g., "gong-foo"
  chineseCharacters?: string; // e.g., "功夫"
  category: GlossaryCategory;
  definition: string;
  relatedTerms?: string[]; // IDs of related terms
  exampleUsage?: string;
  imageUrl?: string;
  // Deep Dive fields
  audioUrl?: string;
  videoClipId?: string; // YouTube embed ID
  deepDive?: GlossaryDeepDive;
  relatedLessonIds?: string[];
}

export const GLOSSARY_CATEGORIES: Record<GlossaryCategory, { label: string; description: string }> = {
  'processing': { label: 'Processing', description: 'How tea leaves are transformed' },
  'tasting': { label: 'Tasting', description: 'Flavors, aromas, and sensations' },
  'ceremony': { label: 'Ceremony', description: 'Rituals and brewing methods' },
  'origin': { label: 'Origin', description: 'Regions and terroir' },
  'equipment': { label: 'Equipment', description: 'Tools and vessels' },
  'tea-type': { label: 'Tea Types', description: 'Categories of tea' },
};

export const GLOSSARY_TERMS: GlossaryTerm[] = [
  // Ceremony & Brewing Methods
  {
    id: 'gongfu',
    term: 'Gongfu',
    pronunciation: 'gong-foo',
    chineseCharacters: '功夫',
    category: 'ceremony',
    definition: 'A traditional Chinese tea brewing method emphasizing skill and attention. Uses small vessels, high leaf-to-water ratio, and multiple short infusions to extract the full range of flavors from quality tea.',
    relatedTerms: ['gaiwan', 'yixing', 'chahai'],
    exampleUsage: 'Gongfu brewing reveals the full complexity of a high-quality oolong.',
    deepDive: {
      extendedDescription: 'Gongfu literally translates to "making tea with skill" or "tea with great effort." Originating in the Chaoshan region of Guangdong province, this method uses a high leaf-to-water ratio in small vessels (typically 100-150ml), with multiple short infusions that gradually increase in duration. Each steep reveals a different facet of the tea — the first might be bright and aromatic, the middle steeps full and complex, the final ones sweet and gentle.',
      culturalContext: 'In Chaoshan culture, gongfu tea is deeply embedded in daily life and social interaction. Refusing a cup is considered impolite. The practice spread throughout southern China and Taiwan, evolving into the dominant method for appreciating fine oolong, puerh, and other premium teas.',
      tryThis: [
        { id: 'try-gf-1', title: 'Your First Gongfu Session', description: 'Use 5g of oolong in a 100ml gaiwan. Start with a 15-second steep, adding 5 seconds each round. Aim for at least 6 infusions.', difficulty: 'easy', timeRequired: '30 minutes' },
        { id: 'try-gf-2', title: 'Flash Steeping Experiment', description: 'Try steeping for only 3-5 seconds on each round. Notice how the flavors change compared to longer steeps — often more aromatic, less bitter.', difficulty: 'moderate', timeRequired: '20 minutes' },
      ],
    },
  },
  {
    id: 'chado',
    term: 'Chadō',
    pronunciation: 'cha-doh',
    chineseCharacters: '茶道',
    category: 'ceremony',
    definition: 'The Japanese "Way of Tea," a ceremonial practice centered around the preparation and presentation of matcha. Encompasses aesthetics, philosophy, and mindfulness.',
    relatedTerms: ['matcha', 'chawan', 'chasen'],
    exampleUsage: 'Studying chadō teaches appreciation for simplicity and presence.',
    deepDive: {
      extendedDescription: 'Chadō encompasses four fundamental principles established by Sen no Rikyū in the 16th century: wa (harmony), kei (respect), sei (purity), and jaku (tranquility). Every aspect of the ceremony — from the arrangement of flowers to the cleaning of utensils — is performed with intention. The practice is not about making the best cup of tea; it is about cultivating presence and connection between host and guest.',
      culturalContext: 'There are three main schools of Japanese tea ceremony: Urasenke, Omotesenke, and Mushakojisenke — all descended from Sen no Rikyū. Each has subtle differences in procedure and aesthetic preference. Chadō influenced Japanese architecture, garden design, ceramics, and the concept of wabi-sabi (finding beauty in imperfection).',
      tryThis: [
        { id: 'try-cd-1', title: 'Mindful Matcha Moment', description: 'Prepare matcha slowly and deliberately. Focus on each action: sifting the powder, hearing the water pour, feeling the whisk. Drink in three sips.', difficulty: 'easy', timeRequired: '10 minutes' },
      ],
    },
  },
  {
    id: 'grandpa-style',
    term: 'Grandpa Style',
    category: 'ceremony',
    definition: 'An informal Chinese brewing method where tea leaves are placed directly in a tall glass and repeatedly topped with hot water throughout the day. Named for its association with elderly Chinese tea drinkers.',
    relatedTerms: ['gongfu'],
    exampleUsage: 'Green tea brewed grandpa style is perfect for the office.',
  },
  {
    id: 'western-brewing',
    term: 'Western Brewing',
    category: 'ceremony',
    definition: 'A brewing style using larger vessels, lower leaf-to-water ratios, and longer steeping times. Common in European and American tea traditions.',
    relatedTerms: ['gongfu'],
    exampleUsage: 'Western brewing works well for robust black teas.',
  },
  {
    id: 'cold-brew',
    term: 'Cold Brew',
    category: 'ceremony',
    definition: 'A brewing method using cold or room temperature water over an extended period (4-12 hours). Produces a smooth, sweet, and less astringent tea.',
    exampleUsage: 'Cold brew sencha is incredibly refreshing on summer days.',
  },

  // Equipment
  {
    id: 'gaiwan',
    term: 'Gaiwan',
    pronunciation: 'guy-wahn',
    chineseCharacters: '蓋碗',
    category: 'equipment',
    definition: 'A traditional Chinese lidded bowl for brewing and drinking tea. Consists of a saucer, bowl, and lid. Versatile and ideal for appreciating any tea type.',
    relatedTerms: ['gongfu', 'chahai'],
    exampleUsage: 'A white porcelain gaiwan is perfect for light oolongs.',
    deepDive: {
      extendedDescription: 'The gaiwan is perhaps the most versatile brewing vessel in the tea world. Its three-part design (saucer, bowl, lid) represents earth, humanity, and heaven in Chinese cosmology. White porcelain gaiwans are preferred by tea professionals because they don\'t absorb flavors and allow you to see the tea\'s true color. The lid can be used to push back leaves while sipping directly, or the gaiwan can serve as a brewing vessel from which you decant into a sharing pitcher.',
      culturalContext: 'Developed during the Ming Dynasty when loose-leaf tea replaced compressed cakes, the gaiwan became the standard brewing vessel in much of China. Today it remains essential for professional tea evaluation and is the recommended starting point for anyone learning gongfu brewing.',
      tryThis: [
        { id: 'try-gw-1', title: 'Master the Gaiwan Pour', description: 'Practice pouring with just water first. Tilt the lid slightly, grip the saucer and lid between thumb and middle finger, and pour in one smooth motion. The goal: no drips.', difficulty: 'easy', timeRequired: '10 minutes' },
        { id: 'try-gw-2', title: 'Compare Vessels', description: 'Brew the same tea in a gaiwan and a Yixing pot. Taste side by side. Notice how the porcelain gives a brighter, more transparent result while clay rounds the edges.', difficulty: 'moderate', timeRequired: '30 minutes' },
      ],
    },
  },
  {
    id: 'yixing',
    term: 'Yixing',
    pronunciation: 'ee-shing',
    chineseCharacters: '宜興',
    category: 'equipment',
    definition: 'Unglazed clay teapots from Yixing, Jiangsu province. The porous clay absorbs tea oils over time, developing a patina that enhances future brews. Each pot is traditionally dedicated to one tea type.',
    relatedTerms: ['gongfu', 'zisha'],
    exampleUsage: 'My aged Yixing pot brings out remarkable depth in sheng puerh.',
    deepDive: {
      extendedDescription: 'Yixing teapots are handcrafted from zisha clay found only in the Yixing region. The clay\'s unique porosity allows it to absorb tea oils over years of use, gradually building a patina that enriches future brews. Traditional practice dedicates each pot to a single tea type to develop a focused seasoning. Master potters like Gu Jingzhou have elevated Yixing pottery to fine art, with antique pots fetching prices comparable to fine ceramics.',
      culturalContext: 'Yixing pottery dates back over 500 years to the Ming Dynasty. The craft was nearly lost during the Cultural Revolution but was revived in the 1970s-80s. Today, authentic Yixing clay is increasingly scarce, making vintage pots highly collectible. The three primary clay types — zini (purple), zhuni (red), and duanni (yellow) — each impart different characteristics to tea.',
      tryThis: [
        { id: 'try-yx-1', title: 'Season a New Yixing Pot', description: 'Boil your new pot in plain water for 20 minutes, then brew your chosen tea type in it 5-6 times without drinking. This initial seasoning starts the relationship between clay and tea.', difficulty: 'easy', timeRequired: '2 hours' },
      ],
    },
  },
  {
    id: 'zisha',
    term: 'Zisha',
    pronunciation: 'dzuh-sha',
    chineseCharacters: '紫砂',
    category: 'equipment',
    definition: 'The purple clay unique to the Yixing region, used for making traditional teapots. Known for its porosity and heat retention properties.',
    relatedTerms: ['yixing'],
    exampleUsage: 'True zisha clay comes only from Yixing.',
  },
  {
    id: 'chahai',
    term: 'Chahai',
    pronunciation: 'cha-high',
    chineseCharacters: '茶海',
    category: 'equipment',
    definition: 'A sharing pitcher used in gongfu tea. Tea is poured from the brewing vessel into the chahai before serving, ensuring even distribution of flavor and temperature.',
    relatedTerms: ['gongfu', 'gaiwan'],
    exampleUsage: 'Pour directly into the chahai to prevent over-steeping.',
  },
  {
    id: 'chawan',
    term: 'Chawan',
    pronunciation: 'cha-wahn',
    chineseCharacters: '茶碗',
    category: 'equipment',
    definition: 'A ceramic bowl used for drinking matcha in Japanese tea ceremony. The size, shape, and aesthetic are chosen to match the season and occasion.',
    relatedTerms: ['matcha', 'chado', 'chasen'],
    exampleUsage: 'A summer chawan is typically shallow and wide.',
  },
  {
    id: 'chasen',
    term: 'Chasen',
    pronunciation: 'cha-sen',
    chineseCharacters: '茶筅',
    category: 'equipment',
    definition: 'A bamboo whisk used to prepare matcha by whisking powder and hot water into a frothy consistency. Crafted from a single piece of bamboo with 80-120 tines.',
    relatedTerms: ['matcha', 'chawan'],
    exampleUsage: 'A well-made chasen creates a fine, uniform froth.',
  },
  {
    id: 'tetsubin',
    term: 'Tetsubin',
    pronunciation: 'tet-soo-been',
    chineseCharacters: '鉄瓶',
    category: 'equipment',
    definition: 'A Japanese cast iron kettle traditionally used to boil water. Believed to add beneficial iron and soften water quality. Not to be confused with cast iron teapots with enamel lining.',
    exampleUsage: 'Water from a tetsubin has a noticeably round quality.',
  },
  {
    id: 'cha-tuo',
    term: 'Cha Tuo',
    pronunciation: 'cha twoh',
    chineseCharacters: '茶托',
    category: 'equipment',
    definition: 'A small coaster or saucer placed under individual tea cups. Both functional and decorative.',
    exampleUsage: 'Wooden cha tuo complement a rustic tea aesthetic.',
  },
  {
    id: 'cha-pan',
    term: 'Cha Pan',
    pronunciation: 'cha pahn',
    chineseCharacters: '茶盤',
    category: 'equipment',
    definition: 'A tea tray with a drainage system for catching overflow and rinse water during gongfu brewing. Often made of bamboo, wood, or stone.',
    relatedTerms: ['gongfu'],
    exampleUsage: 'A well-designed cha pan makes cleanup effortless.',
  },

  // Tea Types
  {
    id: 'green-tea',
    term: 'Green Tea',
    chineseCharacters: '綠茶',
    category: 'tea-type',
    definition: 'Tea that is minimally oxidized, quickly heated after harvest to prevent oxidation. Ranges from vegetal and grassy to sweet and nutty depending on origin and processing.',
    relatedTerms: ['oxidation', 'fixation'],
    exampleUsage: 'Longjing is one of China\'s most famous green teas.',
  },
  {
    id: 'white-tea',
    term: 'White Tea',
    chineseCharacters: '白茶',
    category: 'tea-type',
    definition: 'The least processed tea type, made primarily from young buds and leaves that are simply withered and dried. Delicate, subtle, and often aged for complexity.',
    relatedTerms: ['withering', 'baimudan', 'yinzhen'],
    exampleUsage: 'Aged white tea develops honey and dried fruit notes.',
  },
  {
    id: 'oolong',
    term: 'Oolong',
    pronunciation: 'oo-long',
    chineseCharacters: '烏龍',
    category: 'tea-type',
    definition: 'Partially oxidized tea spanning a wide spectrum from lightly oxidized (green) to heavily oxidized (near-black). Known for complex, evolving flavors across multiple infusions.',
    relatedTerms: ['oxidation', 'roasting'],
    exampleUsage: 'Taiwanese high mountain oolong is prized for its floral fragrance.',
    deepDive: {
      extendedDescription: 'Oolong occupies the vast middle ground between green and black tea, ranging from roughly 10% to 80% oxidation. This enormous spectrum is why oolong is often called the most complex tea category. Light oolongs from Taiwan and Anxi have floral, buttery characteristics. Medium-oxidized dancong from Guangdong mimics fruit fragrances. Heavily roasted Wuyi rock teas have deep mineral and caramel notes. A single oolong can evolve dramatically across 8-12 gongfu infusions.',
      culturalContext: 'The name "oolong" (wūlóng, 烏龍) means "black dragon." Multiple origin stories exist — one attributes the name to the dark, twisted appearance of the dried leaves. Oolong production requires the most skill of any tea type, as the tea master must judge the precise moment to halt oxidation.',
      tryThis: [
        { id: 'try-ol-1', title: 'The Oolong Spectrum Tasting', description: 'Taste three oolongs side by side: a light Taiwanese high mountain, a medium Dancong, and a heavy Wuyi rock tea. This single session teaches more about oolong than any book.', difficulty: 'moderate', timeRequired: '45 minutes' },
        { id: 'try-ol-2', title: 'Track the Evolution', description: 'Brew one oolong gongfu-style for 8+ rounds. Write one word describing each steep. Watch how "floral" might become "honey" then "mineral" then "sweet."', difficulty: 'easy', timeRequired: '30 minutes' },
      ],
    },
  },
  {
    id: 'black-tea',
    term: 'Black Tea',
    chineseCharacters: '紅茶',
    category: 'tea-type',
    definition: 'Fully oxidized tea with robust flavor. Called "red tea" in China for its reddish liquor. Includes famous varieties like Keemun, Darjeeling, and Assam.',
    relatedTerms: ['oxidation'],
    exampleUsage: 'A quality Keemun has notes of chocolate and rose.',
  },
  {
    id: 'puerh',
    term: 'Puerh',
    pronunciation: 'poo-air',
    chineseCharacters: '普洱',
    category: 'tea-type',
    definition: 'A fermented tea from Yunnan province. Divided into sheng (raw, naturally aged) and shou (ripe, accelerated fermentation). Can be aged for decades.',
    relatedTerms: ['sheng', 'shou', 'fermentation'],
    exampleUsage: 'A 20-year-old sheng puerh has remarkable depth.',
    deepDive: {
      extendedDescription: 'Puerh is unique among teas for its capacity to improve with age, sometimes over decades. All puerh originates from Camellia sinensis var. assamica grown in Yunnan province. The two main categories — sheng (raw) and shou (ripe) — offer profoundly different experiences. Sheng starts bright and assertive, mellowing over years into complex depth. Shou undergoes accelerated fermentation for immediate smoothness. Puerh is often compressed into cakes, bricks, or tuocha for aging and storage.',
      culturalContext: 'Puerh tea takes its name from the trading town of Pu\'er in Yunnan. For centuries it was transported via the Tea Horse Road to Tibet and beyond. The microbial fermentation that defines puerh was originally a happy accident of long-distance transport. Today, vintage puerh cakes are collected and traded like fine wine.',
      tryThis: [
        { id: 'try-pe-1', title: 'Sheng vs. Shou Side by Side', description: 'Brew a young sheng and a shou of similar age simultaneously. Taste alternately. This is the fastest way to understand what fermentation does to tea.', difficulty: 'easy', timeRequired: '30 minutes' },
        { id: 'try-pe-2', title: 'Start Your Own Aging Experiment', description: 'Buy two identical sheng cakes. Open one now, store the other in a cool, dry place. Taste the stored one in 6 months, then annually. You\'re watching time transform tea.', difficulty: 'moderate', timeRequired: 'Ongoing' },
      ],
    },
  },
  {
    id: 'sheng',
    term: 'Sheng Puerh',
    pronunciation: 'shung',
    chineseCharacters: '生普',
    category: 'tea-type',
    definition: 'Raw puerh tea that ages naturally over time. Young sheng can be bitter and astringent, while aged sheng develops sweet, complex, and earthy characteristics.',
    relatedTerms: ['puerh', 'shou'],
    exampleUsage: 'Some collectors age sheng for 30+ years.',
  },
  {
    id: 'shou',
    term: 'Shou Puerh',
    pronunciation: 'show',
    chineseCharacters: '熟普',
    category: 'tea-type',
    definition: 'Ripe puerh tea that undergoes accelerated fermentation (wo dui) to mimic aged characteristics. Smooth, earthy, and less astringent than young sheng.',
    relatedTerms: ['puerh', 'sheng', 'wo-dui'],
    exampleUsage: 'Well-made shou has clean earthiness without fishiness.',
  },
  {
    id: 'yellow-tea',
    term: 'Yellow Tea',
    chineseCharacters: '黃茶',
    category: 'tea-type',
    definition: 'A rare tea type with an extra "yellowing" step after fixation. Men huan (smothering) creates a sweeter, less vegetal flavor than green tea.',
    relatedTerms: ['men-huan', 'green-tea'],
    exampleUsage: 'Junshan Yinzhen is among the most famous yellow teas.',
  },
  {
    id: 'matcha',
    term: 'Matcha',
    pronunciation: 'maht-cha',
    chineseCharacters: '抹茶',
    category: 'tea-type',
    definition: 'Shade-grown green tea ground into fine powder. Consumed whole by whisking with water. High in L-theanine and caffeine.',
    relatedTerms: ['chado', 'chasen', 'chawan', 'tencha'],
    exampleUsage: 'Ceremonial grade matcha has a rich umami flavor.',
    deepDive: {
      extendedDescription: 'Matcha is made from shade-grown tea (tencha) that is stone-ground into an extremely fine powder. Because you consume the whole leaf, matcha delivers more caffeine and L-theanine than any other tea preparation. Quality varies enormously: ceremonial grade is vibrant green, smooth, and sweet; culinary grade is more bitter and meant for cooking. The shade-growing process (20+ days before harvest) increases chlorophyll and amino acid content.',
      tryThis: [
        { id: 'try-mt-1', title: 'Whisk a Perfect Bowl', description: 'Sift 2g of matcha into a warm chawan. Add 60ml of 80°C water. Whisk in a W-motion with your chasen until a fine, even froth covers the surface. The goal is no dry powder and no large bubbles.', difficulty: 'easy', timeRequired: '5 minutes' },
        { id: 'try-mt-2', title: 'Ceremonial vs. Culinary', description: 'Prepare two bowls: one with ceremonial grade, one with culinary grade. Taste both plain. The difference in color, aroma, sweetness, and bitterness is striking.', difficulty: 'easy', timeRequired: '10 minutes' },
      ],
    },
  },
  {
    id: 'heicha',
    term: 'Heicha',
    pronunciation: 'hay-cha',
    chineseCharacters: '黑茶',
    category: 'tea-type',
    definition: 'Dark tea, a category of post-fermented teas including puerh and regional varieties like Liu Bao and Fu Zhuan. Characterized by microbial fermentation.',
    relatedTerms: ['puerh', 'fermentation'],
    exampleUsage: 'Liu Bao heicha has a distinctive betel nut aroma.',
  },

  // Processing
  {
    id: 'oxidation',
    term: 'Oxidation',
    category: 'processing',
    definition: 'The enzymatic browning process that occurs when tea leaves are bruised or rolled, exposing internal chemistry to oxygen. Controls the tea\'s color, flavor, and aroma profile.',
    relatedTerms: ['fixation', 'rolling'],
    exampleUsage: 'Stopping oxidation early preserves green tea\'s freshness.',
    deepDive: {
      extendedDescription: 'Oxidation is the single most important variable in tea processing — it determines whether a leaf becomes green tea, oolong, or black tea. When tea leaves are bruised or rolled, enzymes in the cell walls react with oxygen, darkening the leaf and transforming its chemical profile. Green tea is barely oxidized (0-5%), oolong partially (10-80%), and black tea fully (80-100%). The tea maker controls oxidation through timing, temperature, and physical handling.',
      tryThis: [
        { id: 'try-ox-1', title: 'See Oxidation in Action', description: 'Take a fresh apple and cut it in half. Watch one half darken over 30 minutes — that\'s the same enzymatic browning that happens in tea leaves. Now imagine a tea maker deciding exactly when to stop that process.', difficulty: 'easy', timeRequired: '30 minutes' },
      ],
    },
  },
  {
    id: 'fixation',
    term: 'Fixation',
    chineseCharacters: '殺青',
    category: 'processing',
    definition: 'The application of heat to stop oxidation enzymes (sha qing, "killing the green"). Can be done through pan-firing, steaming, or baking.',
    relatedTerms: ['oxidation'],
    exampleUsage: 'Pan-fired fixation gives tea a nuttier character than steaming.',
  },
  {
    id: 'withering',
    term: 'Withering',
    category: 'processing',
    definition: 'The first step in tea processing where fresh leaves lose moisture and become pliable. Develops initial flavor compounds and prepares leaves for further processing.',
    relatedTerms: ['oxidation'],
    exampleUsage: 'Extended withering brings out floral notes in white tea.',
  },
  {
    id: 'rolling',
    term: 'Rolling',
    category: 'processing',
    definition: 'Shaping tea leaves and breaking cell walls to initiate oxidation and develop flavor. Can be done by hand or machine.',
    relatedTerms: ['oxidation'],
    exampleUsage: 'Tight rolling creates balled oolong\'s distinctive shape.',
  },
  {
    id: 'roasting',
    term: 'Roasting',
    chineseCharacters: '焙火',
    category: 'processing',
    definition: 'The application of heat to finished tea for flavor development, moisture reduction, and shelf stability. Ranges from light charcoal roasting to heavy baking.',
    exampleUsage: 'Heavy roasting gives Wuyi rock oolongs their signature character.',
  },
  {
    id: 'fermentation',
    term: 'Fermentation',
    category: 'processing',
    definition: 'Microbial transformation of tea, distinct from oxidation. Occurs naturally during puerh aging or is induced through controlled conditions.',
    relatedTerms: ['puerh', 'wo-dui'],
    exampleUsage: 'Fermentation creates the earthy character of shou puerh.',
  },
  {
    id: 'wo-dui',
    term: 'Wo Dui',
    pronunciation: 'woh dway',
    chineseCharacters: '渥堆',
    category: 'processing',
    definition: 'Accelerated fermentation technique for shou puerh, developed in the 1970s. Leaves are piled, moistened, and covered to generate heat and encourage microbial activity.',
    relatedTerms: ['shou', 'fermentation'],
    exampleUsage: 'Wo dui can take 45-60 days to complete.',
  },
  {
    id: 'men-huan',
    term: 'Men Huan',
    pronunciation: 'mun hwahn',
    chineseCharacters: '悶黃',
    category: 'processing',
    definition: 'The "yellowing" step unique to yellow tea production. Tea is wrapped and allowed to slowly oxidize in a warm, moist environment.',
    relatedTerms: ['yellow-tea'],
    exampleUsage: 'Men huan creates yellow tea\'s mellow sweetness.',
  },
  {
    id: 'aging',
    term: 'Aging',
    category: 'processing',
    definition: 'The practice of storing tea under controlled conditions to develop complexity over time. Common with puerh, white tea, and some oolongs.',
    relatedTerms: ['puerh', 'white-tea'],
    exampleUsage: 'Properly stored tea can improve for decades.',
  },

  // Tasting
  {
    id: 'huigan',
    term: 'Huigan',
    pronunciation: 'hway-gahn',
    chineseCharacters: '回甘',
    category: 'tasting',
    definition: 'The returning sweetness that emerges after swallowing, often following initial bitterness. A sign of quality tea with complex chemistry.',
    relatedTerms: ['astringency'],
    exampleUsage: 'Great sheng puerh has powerful, lasting huigan.',
    deepDive: {
      extendedDescription: 'Huigan is one of the most prized qualities in Chinese tea evaluation. It describes the phenomenon where initial bitterness transforms into a lingering sweetness that seems to rise from the back of the throat. The duration and intensity of huigan is used as a marker of tea quality — exceptional teas can produce huigan that lasts for minutes. The mechanism involves complex polyphenol interactions with saliva proteins.',
      tryThis: [
        { id: 'try-hg-1', title: 'Hunt for Huigan', description: 'Brew a quality sheng puerh or Wuyi rock oolong. After swallowing, close your mouth and breathe slowly through your nose. Wait 10-15 seconds. The sweetness that arrives is huigan.', difficulty: 'easy', timeRequired: '15 minutes' },
      ],
    },
  },
  {
    id: 'cha-qi',
    term: 'Cha Qi',
    pronunciation: 'cha chee',
    chineseCharacters: '茶氣',
    category: 'tasting',
    definition: 'The energetic or physical sensation produced by drinking tea. May manifest as warmth, alertness, relaxation, or a sense of wellbeing.',
    exampleUsage: 'Old-growth puerh is known for strong cha qi.',
  },
  {
    id: 'mouthfeel',
    term: 'Mouthfeel',
    category: 'tasting',
    definition: 'The tactile sensation of tea in the mouth. Described as thick, thin, silky, velvety, oily, or astringent.',
    relatedTerms: ['astringency'],
    exampleUsage: 'High-quality aged tea has a thick, oily mouthfeel.',
  },
  {
    id: 'astringency',
    term: 'Astringency',
    category: 'tasting',
    definition: 'A drying, puckering sensation caused by tannins binding with proteins in saliva. Not to be confused with bitterness. Can be desirable in moderation.',
    exampleUsage: 'Young sheng puerh often has notable astringency.',
  },
  {
    id: 'umami',
    term: 'Umami',
    pronunciation: 'oo-mah-mee',
    category: 'tasting',
    definition: 'The savory, brothy taste sensation. In tea, associated with high L-theanine content, particularly in shade-grown Japanese teas.',
    relatedTerms: ['l-theanine'],
    exampleUsage: 'Gyokuro has intense umami from extended shading.',
    deepDive: {
      extendedDescription: 'Umami in tea is primarily driven by L-theanine and glutamic acid — amino acids that increase when tea plants are shaded from sunlight before harvest. Japanese gyokuro and matcha, shaded for 20+ days, have the most pronounced umami. Chinese teas can also have umami: high-quality longjing and some aged white teas develop a brothy, savory quality. Training your palate to recognize umami in tea is a gateway to deeper appreciation.',
      tryThis: [
        { id: 'try-um-1', title: 'Find Umami in Your Cup', description: 'Brew gyokuro at 60°C (much cooler than normal). Steep for 90 seconds. The resulting liquor should be thick and savory. Compare it to a regular green tea brewed at 80°C — the umami difference is dramatic.', difficulty: 'moderate', timeRequired: '15 minutes' },
      ],
    },
  },
  {
    id: 'l-theanine',
    term: 'L-Theanine',
    category: 'tasting',
    definition: 'An amino acid unique to tea (and some mushrooms) that promotes calm alertness. Balances caffeine\'s stimulating effects. Higher in shade-grown teas.',
    relatedTerms: ['umami'],
    exampleUsage: 'L-theanine creates matcha\'s focused energy.',
  },
  {
    id: 'terroir',
    term: 'Terroir',
    pronunciation: 'tehr-wahr',
    category: 'tasting',
    definition: 'The complete natural environment where tea grows—soil, climate, altitude, and surrounding ecosystem. Imparts unique characteristics to the finished tea.',
    exampleUsage: 'Wuyi rock tea\'s mineral quality comes from its terroir.',
    deepDive: {
      extendedDescription: 'Terroir in tea, as in wine, describes how environment shapes flavor. Altitude affects growth rate and chemical composition — slower growth at high elevations concentrates amino acids. Soil minerals are absorbed through roots and expressed in the cup. Climate determines when the plant flushes and how stressed it becomes. Even fog matters: it diffuses sunlight and increases L-theanine production. Two teas from the same cultivar planted in different locations will taste remarkably different.',
      tryThis: [
        { id: 'try-tr-1', title: 'Taste Terroir Directly', description: 'Find two oolongs from different regions — a Taiwanese high mountain and a Wuyi rock tea. Brew them side by side with identical parameters. Everything you taste that\'s different is terroir.', difficulty: 'moderate', timeRequired: '30 minutes' },
      ],
    },
  },

  // Origin
  {
    id: 'gushu',
    term: 'Gushu',
    pronunciation: 'goo-shoo',
    chineseCharacters: '古樹',
    category: 'origin',
    definition: 'Ancient tea trees, typically over 100 years old. Highly valued for deep roots that access complex soil minerals and produce tea with distinctive character.',
    relatedTerms: ['puerh'],
    exampleUsage: 'Gushu puerh commands premium prices.',
  },
  {
    id: 'dancong',
    term: 'Dancong',
    pronunciation: 'dahn-tsong',
    chineseCharacters: '單叢',
    category: 'origin',
    definition: 'Oolong tea from Phoenix Mountain, Guangdong. Literally "single bush," referring to the practice of processing leaves from individual trees with distinct flavor profiles.',
    relatedTerms: ['oolong'],
    exampleUsage: 'Milan Xiang Dancong mimics honey orchid fragrance.',
  },
  {
    id: 'yancha',
    term: 'Yancha',
    pronunciation: 'yahn-cha',
    chineseCharacters: '岩茶',
    category: 'origin',
    definition: 'Rock oolong from the Wuyi Mountains of Fujian. Grown in mineral-rich rocky terrain that imparts distinctive "rock rhyme" (yan yun) character.',
    relatedTerms: ['oolong', 'roasting'],
    exampleUsage: 'Da Hong Pao is the most famous yancha.',
  },
  {
    id: 'high-mountain',
    term: 'High Mountain',
    chineseCharacters: '高山',
    category: 'origin',
    definition: 'Tea grown at elevations above 1,000 meters. Cooler temperatures, more fog, and slower growth create sweeter, more aromatic teas.',
    exampleUsage: 'Taiwan\'s high mountain oolongs are renowned worldwide.',
  },
  {
    id: 'first-flush',
    term: 'First Flush',
    category: 'origin',
    definition: 'The first harvest of spring, typically producing the most delicate and prized teas of the year. Particularly important in Darjeeling and Japanese tea.',
    exampleUsage: 'First flush Darjeeling has distinctive muscatel notes.',
  },
  {
    id: 'single-origin',
    term: 'Single Origin',
    category: 'origin',
    definition: 'Tea sourced from a specific garden, village, or mountain rather than blended from multiple sources. Allows appreciation of terroir.',
    exampleUsage: 'Single origin teas showcase regional character.',
  },
  {
    id: 'wild-tea',
    term: 'Wild Tea',
    chineseCharacters: '野生',
    category: 'origin',
    definition: 'Tea from naturally occurring trees growing without cultivation. Distinct from gushu (cultivated ancient trees). Often found in Yunnan forests.',
    relatedTerms: ['gushu'],
    exampleUsage: 'Wild tea often has unusual and complex flavor profiles.',
  },
];

/**
 * Tisanes — non–Camellia-sinensis "teas." Herbal infusions, mate (Ilex),
 * rooibos and honeybush, fermented Camellia outliers (cocoa tea), spice
 * teas, fruit teas, mushroom decoctions.
 *
 * Genmaicha and matcha-iri-genmaicha live in `japan.ts` because they
 * include Camellia sinensis. Bori-cha (Korean barley) lives here.
 */

import type { TeaEntry, TeaRegion } from './types';

export const tisanes: TeaEntry[] = [
  // ══════════════════════════════════════════════════════════════════════
  //  ROOIBOS & HONEYBUSH (Cederberg, South Africa)
  // ══════════════════════════════════════════════════════════════════════
  {
    id: 'tisane-rooibos-red',
    name: 'Red Rooibos',
    altNames: ['Aspalathus linearis', 'Bush tea', 'Red bush'],
    category: 'rooibos',
    origin: { country: 'South Africa', province: 'Western Cape', locality: 'Cederberg' },
    processing: ['oxidize', 'sun-dry'],
    flavorNotes: ['vanilla', 'sweet woody', 'honey', 'earthy'],
    brewing: { waterTempC: [95, 100], timeSec: [300, 600], leafGramsPer100ml: 2 },
    description: 'Aspalathus linearis — naturally caffeine-free legume native only to the Cederberg mountains. Oxidised ("fermented") to develop the red colour.',
    flagship: true,
  },
  { id: 'tisane-rooibos-green', name: 'Green Rooibos', category: 'rooibos',
    origin: { country: 'South Africa', province: 'Western Cape', locality: 'Cederberg' },
    flavorNotes: ['fresh hay', 'green vegetal', 'mild'],
    description: 'Unoxidised rooibos — higher antioxidant content, lighter profile.' },
  { id: 'tisane-honeybush', name: 'Honeybush',
    altNames: ['Cyclopia genistoides / intermedia / subternata'],
    category: 'herbal',
    origin: { country: 'South Africa', province: 'Western Cape', locality: 'Cederberg / Eastern Cape' },
    flavorNotes: ['honey', 'apricot', 'caramel'],
    description: 'Cyclopia spp. — sweeter cousin of rooibos, naturally caffeine-free.' },

  // ══════════════════════════════════════════════════════════════════════
  //  ILEX FAMILY (Yerba Mate, Yaupon, Guayusa)
  // ══════════════════════════════════════════════════════════════════════
  {
    id: 'tisane-yerba-mate-green',
    name: 'Yerba Mate (Green)',
    altNames: ['Ilex paraguariensis'],
    category: 'mate',
    origin: { country: 'Argentina / Paraguay / Brazil / Uruguay' },
    processing: ['fix', 'sun-dry'],
    flavorNotes: ['grassy', 'bitter', 'vegetal', 'earthy'],
    brewing: { waterTempC: [70, 80], timeSec: [60, 180], leafGramsPer100ml: 5 },
    description: 'Caffeinated holly leaf — South American daily ritual; drunk via bombilla through hot water in a calabaza gourd.',
    flagship: true,
  },
  { id: 'tisane-yerba-mate-aged', name: 'Yerba Mate Estacionado (Aged)', category: 'mate',
    origin: { country: 'Argentina / Brazil' },
    processing: ['age'],
    description: 'Aged 9–24 months in wood — mellower, smoother profile.' },
  { id: 'tisane-yerba-mate-barbacua', name: 'Barbacuá-smoked Mate', category: 'mate',
    origin: { country: 'Brazil', province: 'Rio Grande do Sul' },
    description: 'Wood-fire-dried mate — distinct smoky character.' },
  { id: 'tisane-terere', name: 'Tereré (cold-brewed mate)',
    category: 'mate', origin: { country: 'Paraguay' },
    description: 'Cold-water mate — Paraguayan summer ritual, often with citrus and yuyos (medicinal herbs).' },
  { id: 'tisane-chimarrao', name: 'Chimarrão',
    category: 'mate', origin: { country: 'Brazil', province: 'Rio Grande do Sul' },
    description: 'Southern Brazilian mate style — finer cut, no smoke, water at lower temp.' },
  { id: 'tisane-yaupon', name: 'Yaupon Tea',
    altNames: ['Ilex vomitoria', 'Cassina'],
    category: 'mate', origin: { country: 'USA', province: 'Carolinas / Florida / Texas' },
    flavorNotes: ['light caffeine', 'green', 'soft earthy'],
    description: 'The only caffeinated plant native to North America. Known historically as the "Black Drink" of Southeastern Indigenous peoples.',
    flagship: true },
  { id: 'tisane-guayusa', name: 'Guayusa',
    altNames: ['Ilex guayusa'],
    category: 'mate', origin: { country: 'Ecuador', province: 'Amazon' },
    flavorNotes: ['smooth caffeine', 'soft earthy', 'maté-adjacent'],
    description: 'Kichwa Amazonian ritual tea — high caffeine, no bitterness.',
    flagship: true },

  // ══════════════════════════════════════════════════════════════════════
  //  TULSI / HOLY BASIL
  // ══════════════════════════════════════════════════════════════════════
  { id: 'tisane-tulsi-rama', name: 'Rama Tulsi',
    altNames: ['Ocimum sanctum (green stem)'],
    category: 'herbal', origin: { country: 'India' },
    flavorNotes: ['clove-spice', 'green', 'cooling'],
    flagship: true },
  { id: 'tisane-tulsi-krishna', name: 'Krishna Tulsi',
    altNames: ['Ocimum sanctum (purple stem)'],
    category: 'herbal', origin: { country: 'India' } },
  { id: 'tisane-tulsi-vana', name: 'Vana Tulsi (Wild Holy Basil)',
    altNames: ['Ocimum gratissimum'],
    category: 'herbal', origin: { country: 'India' } },

  // ══════════════════════════════════════════════════════════════════════
  //  CHAMOMILE
  // ══════════════════════════════════════════════════════════════════════
  { id: 'tisane-chamomile-german', name: 'German Chamomile',
    altNames: ['Matricaria chamomilla', 'Matricaria recutita'],
    category: 'flower', origin: { country: 'Egypt' },
    flavorNotes: ['apple', 'sweet hay', 'soft floral'],
    flagship: true },
  { id: 'tisane-chamomile-roman', name: 'Roman Chamomile',
    altNames: ['Chamaemelum nobile'],
    category: 'flower', origin: { country: 'United Kingdom / France' },
    flavorNotes: ['bitter floral', 'apple peel', 'fresh herbal'] },

  // ══════════════════════════════════════════════════════════════════════
  //  MINT FAMILY
  // ══════════════════════════════════════════════════════════════════════
  { id: 'tisane-peppermint', name: 'Peppermint',
    altNames: ['Mentha × piperita'],
    category: 'herbal', origin: { country: 'Worldwide; benchmark crops US/Pacific NW, Egypt' },
    flavorNotes: ['bright menthol', 'cooling', 'sweet'],
    flagship: true },
  { id: 'tisane-spearmint', name: 'Spearmint',
    altNames: ['Mentha spicata'],
    category: 'herbal', origin: { country: 'Worldwide' },
    flavorNotes: ['soft mint', 'sweet', 'rounded'] },
  { id: 'tisane-nana-mint', name: 'Moroccan Nana Mint',
    altNames: ['Mentha spicata var. crispa'],
    category: 'herbal', origin: { country: 'Morocco' },
    description: 'The mint used in Touareg tea (Maghrebi mint tea), traditionally combined with green gunpowder.' },
  { id: 'tisane-touareg', name: 'Maghrebi Mint Tea (Touareg)',
    altNames: ['Moroccan mint tea'],
    category: 'blend', origin: { country: 'Morocco / Algeria / Tunisia' },
    description: 'Green gunpowder steeped with Nana mint and heavy sugar — note this contains Camellia, but is grouped here for cultural completeness.' },
  { id: 'tisane-lemon-balm', name: 'Lemon Balm',
    altNames: ['Melissa officinalis'],
    category: 'herbal', origin: { country: 'Mediterranean / Europe' } },
  { id: 'tisane-catnip', name: 'Catnip',
    altNames: ['Nepeta cataria'],
    category: 'herbal', origin: { country: 'Europe / North America' } },

  // ══════════════════════════════════════════════════════════════════════
  //  HIBISCUS / FRUIT
  // ══════════════════════════════════════════════════════════════════════
  { id: 'tisane-hibiscus', name: 'Hibiscus',
    altNames: ['Hibiscus sabdariffa', 'Karkadeh', 'Agua de Jamaica', 'Bissap', 'Sorrel'],
    category: 'fruit', origin: { country: 'Egypt / Sudan / Mexico / West Africa' },
    flavorNotes: ['cranberry', 'tart', 'red-fruit', 'astringent'],
    flagship: true },
  { id: 'tisane-rosehip', name: 'Rose Hip',
    altNames: ['Rosa canina'],
    category: 'fruit', origin: { country: 'Chile / Eastern Europe' } },
  { id: 'tisane-lemon-verbena', name: 'Lemon Verbena',
    altNames: ['Aloysia citrodora', 'Cedrón'],
    category: 'herbal', origin: { country: 'Argentina / Chile / France' } },
  { id: 'tisane-lemongrass', name: 'Lemongrass',
    altNames: ['Cymbopogon citratus'],
    category: 'herbal', origin: { country: 'Southeast Asia' } },
  { id: 'tisane-yuzu-peel', name: 'Yuzu Peel',
    category: 'fruit', origin: { country: 'Japan / Korea' } },
  {
    id: 'tisane-chen-pi',
    name: 'Chen Pi (Aged Citrus Peel)',
    altNames: ['Xinhui Chen Pi', 'Aged Tangerine Peel'],
    category: 'fruit', origin: { country: 'China', province: 'Guangdong', locality: 'Xinhui' },
    description: 'Mandarin orange peel aged at least three years — central to Cantonese herbal tradition; often blended with shou puer to make "Gan Pu."',
    flagship: true,
  },
  { id: 'tisane-gan-pu', name: 'Gan Pu (Mandarin Puer)',
    category: 'blend', origin: { country: 'China', province: 'Guangdong', locality: 'Xinhui' },
    description: 'Whole dried mandarin stuffed with shou puer — a Cantonese specialty.' },
  { id: 'tisane-apple-peel', name: 'Dried Apple Peel',
    category: 'fruit', origin: { country: 'Worldwide' } },

  // ══════════════════════════════════════════════════════════════════════
  //  SPICE
  // ══════════════════════════════════════════════════════════════════════
  { id: 'tisane-ginger', name: 'Ginger Root Tea',
    altNames: ['Zingiber officinale'],
    category: 'spice', origin: { country: 'India / China / Nigeria' } },
  { id: 'tisane-cinnamon-cassia', name: 'Cinnamon (Cassia)',
    altNames: ['Cinnamomum cassia'],
    category: 'spice', origin: { country: 'China / Vietnam' } },
  { id: 'tisane-cinnamon-ceylon', name: 'Cinnamon (True Ceylon)',
    altNames: ['Cinnamomum verum'],
    category: 'spice', origin: { country: 'Sri Lanka' } },
  { id: 'tisane-turmeric', name: 'Turmeric Tea',
    altNames: ['Curcuma longa', 'Golden Milk'],
    category: 'spice', origin: { country: 'India' } },
  { id: 'tisane-cardamom', name: 'Cardamom',
    altNames: ['Elettaria cardamomum'],
    category: 'spice', origin: { country: 'Guatemala / India' } },
  { id: 'tisane-saffron', name: 'Saffron Tea',
    altNames: ['Crocus sativus'],
    category: 'spice', origin: { country: 'Iran / Spain / Kashmir' } },
  { id: 'tisane-licorice', name: 'Licorice Root',
    altNames: ['Glycyrrhiza glabra'],
    category: 'spice', origin: { country: 'Iran / China' } },

  // ══════════════════════════════════════════════════════════════════════
  //  FLORAL
  // ══════════════════════════════════════════════════════════════════════
  {
    id: 'tisane-chrysanthemum-hangbai',
    name: 'Hangbai Chrysanthemum',
    chineseName: '杭白菊',
    altNames: ['Tongxiang Hangju'],
    category: 'flower', origin: { country: 'China', province: 'Zhejiang', locality: 'Tongxiang' },
    description: 'White-petalled chrysanthemum — the benchmark culinary chrysanthemum in Chinese tradition.',
    flagship: true,
  },
  { id: 'tisane-chrysanthemum-gongju', name: 'Gongju (Tribute Chrysanthemum)',
    chineseName: '贡菊',
    category: 'flower', origin: { country: 'China', province: 'Anhui', locality: 'Huangshan' } },
  { id: 'tisane-chrysanthemum-snow', name: 'Snow Chrysanthemum (Kunlun)',
    chineseName: '昆仑雪菊',
    category: 'flower', origin: { country: 'China', province: 'Xinjiang', locality: 'Kunlun Mountains' },
    description: 'High-altitude orange-red chrysanthemum (Coreopsis tinctoria) — distinct genus, marketed as "snow chrysanthemum".' },
  { id: 'tisane-osmanthus', name: 'Osmanthus (Gui Hua)',
    chineseName: '桂花',
    altNames: ['Osmanthus fragrans'],
    category: 'flower', origin: { country: 'China' } },
  { id: 'tisane-rose-bud', name: 'Rose Bud (Mei Gui Hua)',
    chineseName: '玫瑰花',
    altNames: ['Rosa rugosa'],
    category: 'flower', origin: { country: 'Iran / China / Bulgaria' } },
  { id: 'tisane-lavender', name: 'Lavender',
    altNames: ['Lavandula angustifolia'],
    category: 'flower', origin: { country: 'France / Bulgaria' } },
  { id: 'tisane-elderflower', name: 'Elderflower',
    altNames: ['Sambucus nigra'],
    category: 'flower', origin: { country: 'Europe' } },
  { id: 'tisane-linden', name: 'Linden / Lime Flower',
    altNames: ['Tilia cordata'],
    category: 'flower', origin: { country: 'Europe' } },
  { id: 'tisane-jasmine-flower', name: 'Jasmine Flower (Mo Li Hua)',
    chineseName: '茉莉花',
    altNames: ['Jasminum sambac'],
    category: 'flower', origin: { country: 'China', province: 'Guangxi / Fujian' },
    description: 'Standalone jasmine flower tisane — distinct from jasmine-scented green tea.' },

  // ══════════════════════════════════════════════════════════════════════
  //  ASIAN / CHINESE EVERYDAY HERBALS
  // ══════════════════════════════════════════════════════════════════════
  { id: 'tisane-goji', name: 'Goji Berry (Wolfberry)',
    altNames: ['Lycium barbarum', 'Ningxia Goji'],
    category: 'fruit', origin: { country: 'China', province: 'Ningxia' } },
  { id: 'tisane-ba-bao', name: 'Ba Bao Cha (Eight Treasures)',
    chineseName: '八宝茶',
    category: 'blend', origin: { country: 'China', province: 'Northwest China' },
    description: 'Hui Muslim northwest blend — green tea with rock sugar, goji, jujube, longan, chrysanthemum, sesame and other "treasures."' },
  { id: 'tisane-kuding', name: 'Kuding Cha',
    altNames: ['Ilex kudingcha', 'Bitter Tea'],
    category: 'herbal', origin: { country: 'China', province: 'Guizhou / Yunnan' },
    description: 'Bitter holly leaf — sometimes called tea but is Ilex (related to mate).' },
  { id: 'tisane-du-zhong', name: 'Du Zhong',
    altNames: ['Eucommia ulmoides'],
    category: 'herbal', origin: { country: 'China' } },
  { id: 'tisane-mulberry-leaf', name: 'Mulberry Leaf (Sang Ye)',
    chineseName: '桑叶',
    category: 'herbal', origin: { country: 'China' } },
  { id: 'tisane-lotus-leaf', name: 'Lotus Leaf (He Ye)',
    chineseName: '荷叶',
    category: 'herbal', origin: { country: 'China' } },
  { id: 'tisane-bamboo-leaf', name: 'Bamboo Leaf',
    chineseName: '竹叶',
    category: 'herbal', origin: { country: 'China' } },

  // ══════════════════════════════════════════════════════════════════════
  //  KOREAN AND JAPANESE GRAIN/HERB INFUSIONS
  // ══════════════════════════════════════════════════════════════════════
  { id: 'tisane-bori-cha', name: 'Bori-cha (Korean Barley Tea)',
    koreanName: '보리차',
    category: 'herbal', origin: { country: 'Korea' },
    description: 'Roasted barley grain — Korea\'s default everyday drink, served hot or cold.' },
  { id: 'tisane-oksusu-cha', name: 'Oksusu-cha (Korean Corn Tea)',
    koreanName: '옥수수차',
    category: 'herbal', origin: { country: 'Korea' } },
  { id: 'tisane-hyeonmi-cha', name: 'Hyeonmi-cha (Brown Rice Tea)',
    koreanName: '현미차',
    category: 'herbal', origin: { country: 'Korea' } },
  { id: 'tisane-memil-cha', name: 'Memil-cha (Buckwheat Tea)',
    koreanName: '메밀차',
    category: 'herbal', origin: { country: 'Korea' } },
  { id: 'tisane-omija-cha', name: 'Omija-cha (Five-Flavor Berry Tea)',
    koreanName: '오미자차',
    altNames: ['Schisandra chinensis'],
    category: 'fruit', origin: { country: 'Korea' } },
  { id: 'tisane-yuja-cha', name: 'Yuja-cha (Citron Marmalade Tea)',
    koreanName: '유자차',
    category: 'fruit', origin: { country: 'Korea' } },
  { id: 'tisane-sujeonggwa', name: 'Sujeonggwa (Cinnamon-Persimmon Punch)',
    koreanName: '수정과',
    category: 'blend', origin: { country: 'Korea' } },
  { id: 'tisane-ssanghwa', name: 'Ssanghwa-cha (Medicinal Blend)',
    koreanName: '쌍화차',
    category: 'blend', origin: { country: 'Korea' } },
  { id: 'tisane-sobacha', name: 'Sobacha (Japanese Buckwheat Tea)',
    japaneseName: 'そば茶',
    category: 'herbal', origin: { country: 'Japan' } },
  { id: 'tisane-mugicha', name: 'Mugicha (Japanese Roasted Barley)',
    japaneseName: '麦茶',
    category: 'herbal', origin: { country: 'Japan' } },
  { id: 'tisane-yomogi-cha', name: 'Yomogi-cha (Mugwort Tea)',
    japaneseName: 'よもぎ茶',
    category: 'herbal', origin: { country: 'Japan' } },

  // ══════════════════════════════════════════════════════════════════════
  //  MIDDLE EASTERN / EUROPEAN TRADITIONAL
  // ══════════════════════════════════════════════════════════════════════
  { id: 'tisane-sage', name: 'Sage Tea (Çay)',
    altNames: ['Salvia officinalis'],
    category: 'herbal', origin: { country: 'Turkey / Greece / Albania' } },
  { id: 'tisane-greek-mountain', name: 'Greek Mountain Tea (Sideritis)',
    altNames: ['Ironwort', 'Tsai tou Vounou'],
    category: 'herbal', origin: { country: 'Greece' } },
  { id: 'tisane-marjoram', name: 'Marjoram',
    altNames: ['Origanum majorana'],
    category: 'herbal', origin: { country: 'Mediterranean' } },
  { id: 'tisane-rooibos-vanilla-blend', name: 'Vanilla Rooibos',
    category: 'blend', origin: { country: 'South Africa' } },

  // ══════════════════════════════════════════════════════════════════════
  //  MUSHROOM "TEAS"
  // ══════════════════════════════════════════════════════════════════════
  { id: 'tisane-chaga', name: 'Chaga',
    altNames: ['Inonotus obliquus'],
    category: 'mushroom', origin: { country: 'Russia / Finland / Canada' },
    description: 'Birch-tree fungus — used as a hot-water decoction. Slightly bitter, earthy.' },
  { id: 'tisane-reishi', name: 'Reishi',
    altNames: ['Ganoderma lucidum', 'Ling Zhi'],
    category: 'mushroom', origin: { country: 'China / Japan' } },
  { id: 'tisane-lions-mane', name: "Lion's Mane",
    altNames: ['Hericium erinaceus'],
    category: 'mushroom', origin: { country: 'East Asia / North America' } },
  { id: 'tisane-cordyceps', name: 'Cordyceps',
    altNames: ['Cordyceps militaris', 'Cordyceps sinensis'],
    category: 'mushroom', origin: { country: 'Tibet / China' } },

  // ══════════════════════════════════════════════════════════════════════
  //  CACAO / COFFEE-LEAF
  // ══════════════════════════════════════════════════════════════════════
  { id: 'tisane-cacao-husk', name: 'Cacao Husk Tea',
    altNames: ['Cocoa Shell Tea'],
    category: 'herbal', origin: { country: 'Ecuador / Ghana / Côte d\'Ivoire' } },
  { id: 'tisane-coffee-leaf', name: 'Coffee Leaf Tea',
    altNames: ['Coffea leaf'],
    category: 'herbal', origin: { country: 'Yemen / Ethiopia / South Sudan' } },

  // ══════════════════════════════════════════════════════════════════════
  //  COCOA TEA — caffeine-free Camellia (technically Camellia, not herbal,
  //  but lives here because of how it's positioned commercially)
  // ══════════════════════════════════════════════════════════════════════
  { id: 'tisane-cocoa-tea', name: 'Cocoa Tea (Ke Cha)',
    chineseName: '可可茶',
    altNames: ['Camellia ptilophylla'],
    category: 'herbal', origin: { country: 'China', province: 'Guangdong' },
    description: 'Naturally caffeine-free Camellia species — produces theobromine in place of caffeine. Rare specialty.' },

  // ══════════════════════════════════════════════════════════════════════
  //  ANDEAN / INDIGENOUS AMERICAN
  // ══════════════════════════════════════════════════════════════════════
  { id: 'tisane-mate-de-coca', name: 'Mate de Coca',
    altNames: ['Erythroxylum coca leaf tea'],
    category: 'herbal', origin: { country: 'Peru / Bolivia' },
    description: 'Andean traditional infusion — used at altitude. Note legal restrictions outside the Andes.' },
  { id: 'tisane-muna', name: 'Muña',
    altNames: ['Andean mint', 'Minthostachys mollis'],
    category: 'herbal', origin: { country: 'Peru / Bolivia' } },

  // ══════════════════════════════════════════════════════════════════════
  //  ROOT / BARK
  // ══════════════════════════════════════════════════════════════════════
  { id: 'tisane-dandelion-root', name: 'Dandelion Root',
    altNames: ['Taraxacum officinale'],
    category: 'herbal', origin: { country: 'Worldwide' } },
  { id: 'tisane-burdock', name: 'Burdock Root',
    altNames: ['Arctium lappa', 'Gobō'],
    category: 'herbal', origin: { country: 'East Asia / Europe' } },
  { id: 'tisane-chicory', name: 'Chicory Root',
    altNames: ['Cichorium intybus'],
    category: 'herbal', origin: { country: 'France / India' },
    description: 'Roasted root used as a coffee substitute and additive.' },
  { id: 'tisane-ginseng', name: 'Ginseng Tea',
    altNames: ['Panax ginseng', 'Panax quinquefolius'],
    category: 'herbal', origin: { country: 'Korea / China / USA' } },
];

// ──────────────────────────────────────────────────────────────────────────
// Tisane regions — origin terroirs of the major non-Camellia infusions.
// ──────────────────────────────────────────────────────────────────────────
export const tisaneRegions: TeaRegion[] = [
  { id: 'rg-tisane-cederberg', name: 'Cederberg', country: 'South Africa', province: 'Western Cape',
    coordinates: { lat: -32.4500, lon: 19.1167 },
    elevation: '300–800 m',
    primaryCategories: ['rooibos', 'herbal'],
    notes: 'Only place in the world where Aspalathus linearis grows commercially; UNESCO Cape Floral Kingdom.' },
  { id: 'rg-tisane-misiones', name: 'Misiones', country: 'Argentina', province: 'Misiones',
    primaryCategories: ['mate'],
    notes: 'Heart of Argentine yerba mate — Ilex paraguariensis subtropical forests.' },
  { id: 'rg-tisane-rio-grande-do-sul', name: 'Rio Grande do Sul', country: 'Brazil', province: 'Rio Grande do Sul',
    primaryCategories: ['mate'],
    notes: 'Brazilian chimarrão country — finer-cut mate, gaucho tradition.' },
  { id: 'rg-tisane-paraguay-yerbales', name: 'Paraguay Yerbales', country: 'Paraguay',
    primaryCategories: ['mate'],
    notes: 'Tereré (cold-brewed mate) heartland.' },
  { id: 'rg-tisane-amazon-ecuador', name: 'Ecuadorian Amazon', country: 'Ecuador',
    primaryCategories: ['mate', 'herbal'],
    notes: 'Indigenous Kichwa guayusa cultivation.' },
  { id: 'rg-tisane-egypt-fayoum', name: 'Fayoum / Beni Suef', country: 'Egypt',
    primaryCategories: ['flower', 'herbal'],
    notes: "World's benchmark commercial chamomile and hibiscus crop." },
  { id: 'rg-tisane-bulgaria-rose-valley', name: 'Bulgarian Rose Valley', country: 'Bulgaria',
    primaryCategories: ['flower'],
    notes: 'Damascena rose cultivation — Kazanlak.' },
  { id: 'rg-tisane-iran-mashhad', name: 'Mashhad Saffron', country: 'Iran', province: 'Khorasan',
    primaryCategories: ['spice'] },
  { id: 'rg-tisane-ningxia', name: 'Ningxia', country: 'China', province: 'Ningxia',
    primaryCategories: ['fruit'],
    notes: 'Premier goji-berry origin.' },
  { id: 'rg-tisane-xinhui', name: 'Xinhui', country: 'China', province: 'Guangdong',
    primaryCategories: ['fruit'],
    notes: 'Origin of GI-protected Chen Pi (aged citrus peel).' },
  { id: 'rg-tisane-tongxiang', name: 'Tongxiang', country: 'China', province: 'Zhejiang',
    primaryCategories: ['flower'],
    notes: 'Hangbai Chrysanthemum — the benchmark Chinese culinary chrysanthemum.' },
  { id: 'rg-tisane-pacific-nw', name: 'Pacific Northwest mint', country: 'USA', province: 'Oregon / Washington / Idaho',
    primaryCategories: ['herbal'],
    notes: "World's benchmark peppermint and spearmint commercial production." },
];

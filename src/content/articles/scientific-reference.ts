import { ContentType } from '../../types';
import { ReadableStory } from '../../types/read';
import { PEOPLE } from '../people';

export const scientificReference: ReadableStory = {
  id: 'template-scientific',
  type: ContentType.Article,
  status: 'vault',
  title: 'Scientific Reference Layout',
  subtitle: 'Camellia Sinensis Atlas',
  thumbnailUrl: 'https://images.unsplash.com/photo-1556881286-fc6915169721?w=800&h=1200&fit=crop',
  durationOrTime: '17 Pages',
  origin: 'In-house',
  description: 'A systematic, botanical reference guide showcasing the scientific classification approach.',
  tags: ['Health', 'Teaching'],
  content: [
    ":::COVER_TYPOGRAPHIC:::CAMELLIA|SINENSIS|ATLAS",

    ":::TEXT_DROP_CAP:::The tea plant, Camellia sinensis, is a member of the family Theaceae, order Ericales — a flowering evergreen shrub or small tree native to the borderlands where modern China, Myanmar, Laos, and Vietnam converge. First described scientifically by Carl Linnaeus in 1753 as Thea sinensis, it was later reclassified into the genus Camellia by Robert Sweet in 1818.",

    ":::TEXT_SIDEBAR_IMAGE:::Despite its apparent simplicity as a single species, C. sinensis displays extraordinary morphological and chemical variation across its range, a diversity that has been amplified by centuries of human selection and cultivation. This atlas presents a systematic survey of the major varieties, cultivars, and chemotypes, drawing on field observations from twelve tea-producing regions across six countries.|The tea plant in its natural habitat|https://images.unsplash.com/photo-1556881286-fc6915169721?w=800&h=1200&fit=crop",

    ":::IMG_FULL_BLEED:::Tea gardens in the mountains|https://images.unsplash.com/photo-1587049352846-4a222e784d38?w=800&h=1200&fit=crop",

    ":::TEXT_DOUBLE_COL:::Taxonomic Position|Kingdom: Plantae. Clade: Tracheophytes. Clade: Angiosperms. Clade: Eudicots. Order: Ericales. Family: Theaceae. Genus: Camellia. Species: C. sinensis. The genus Camellia contains over 250 recognized species, of which C. sinensis is the only one widely cultivated for tea production.\n\nMajor Varieties|Two principal varieties are recognized: C. sinensis var. sinensis (the China type) and C. sinensis var. assamica (the Assam type). The China type is a small-leafed, cold-hardy shrub typically growing to 2-3 meters. The Assam type is a large-leafed tropical tree that can reach 15-20 meters in the wild. Between these lies a continuum of intermediate forms.",

    ":::TEXT_TRIPLE_COL:::Leaf Morphology|Tea leaves are alternate, simple, serrate, and coriaceous. The leaf blade is elliptic to lanceolate, with an acute apex and cuneate base. Venation is pinnate, with 7-9 pairs of lateral veins. The upper surface is glabrous and dark green; the lower surface may be pubescent in young leaves. Leaf size and serration pattern are the primary markers used to distinguish cultivars.\n\nFlower Structure|C. sinensis produces white to pale pink flowers, typically 2.5-4 cm in diameter, with 5-7 petals and a prominent central boss of yellow stamens. The flowers are bisexual and primarily insect-pollinated. Flowering occurs from October to February in the Northern Hemisphere.\n\nRoot System|The root system is characterized by a strong taproot that can penetrate 1.5-3 meters in well-drained soils, with extensive lateral root development in the upper 30-60 cm. Mycorrhizal associations are common. In ancient tea trees — specimens over 500 years old — the root system may extend laterally up to 10 meters from the trunk.",

    ":::BOTANICAL_SKETCH:::Camellia sinensis var. sinensis — leaf, flower, and seed capsule|https://images.unsplash.com/photo-1563911892437-1feda0179e1b?w=800&h=1200&fit=crop",

    ":::DEFINITION_LARGE:::Terroir|/tɛˈrwɑːr/|noun|The complete natural environment in which a tea is produced, including soil composition, altitude, slope aspect, microclimate, rainfall patterns, fog frequency, and surrounding vegetation.",

    ":::IMG_GRID_2x2:::Top left: var. sinensis leaf. Top right: var. assamica leaf. Bottom left: Wild Yunnan specimen. Bottom right: Cultivar cross-section.|https://images.unsplash.com/photo-1556881286-fc6915169721?w=800&h=1200&fit=crop|https://images.unsplash.com/photo-1563911892437-1feda0179e1b?w=800&h=1200&fit=crop|https://images.unsplash.com/photo-1587049352846-4a222e784d38?w=800&h=1200&fit=crop|https://images.unsplash.com/photo-1582793988951-9aed5509eb97?w=800&h=1200&fit=crop",

    ":::TEXT_SIDEBAR_RIGHT:::Chemical Composition|The young leaves contain polyphenols (25-35% of dry weight), caffeine (2-5%), amino acids (1-5%, primarily L-theanine), and volatile aromatic compounds (0.01-0.02%). The polyphenol fraction is dominated by catechins — specifically EC, ECG, EGC, and EGCG. Var. assamica typically contains higher total catechin levels than var. sinensis, contributing to its more astringent flavor profile.|https://images.unsplash.com/photo-1563911892437-1feda0179e1b?w=800&h=1200&fit=crop",

    ":::IMG_WITH_CAPTION_BOTTOM:::Cross-section of a tea leaf under electron microscopy|https://images.unsplash.com/photo-1530968033775-2c92736b131e?w=800&h=1200&fit=crop",

    ":::STAT_BIG_NUMBER:::3,000+|Registered cultivars of Camellia sinensis worldwide",

    ":::TEXT_DOUBLE_COL:::Altitude and Chemistry|Research consistently demonstrates a positive correlation between cultivation altitude and tea quality. Teas grown above 1,200 meters show higher concentrations of L-theanine and aromatic compounds. Cooler temperatures slow leaf growth, higher UV radiation stimulates phenolic production, and persistent fog reduces catechin production while preserving amino acid levels.\n\nSoil and Mineral Uptake|The mineral composition of tea reflects its growing site with remarkable fidelity. Studies using ICP-MS have shown that the elemental fingerprint of a finished tea can identify its geographic origin with over 90% accuracy. Tea plants are unusual hyperaccumulators of aluminum and manganese — elements toxic to most crops.",

    ":::IMG_FULL_BLEED:::Ancient tea trees in Yunnan|https://images.unsplash.com/photo-1582793988951-9aed5509eb97?w=800&h=1200&fit=crop",

    ":::TEXT_SINGLE_COL:::Modern tea cultivation relies overwhelmingly on clonally propagated cultivars — genetically identical plants derived from cuttings of a single mother bush. In China alone, over 130 national-level approved cultivars are registered. The most widely planted cultivar globally is probably TRFK 6/8, developed in Kenya for high-yield CTC production.",

    ":::TEXT_JUSTIFIED_NARROW:::The tension between clonal uniformity and genetic diversity is one of the central challenges facing the tea industry. Clonal plantations offer predictability and yield, but they are vulnerable to disease and climate stress. Ancient seed-grown tea forests, with their heterogeneous genetics, offer resilience — but at the cost of consistency.",

    ":::BOTANICAL_SKETCH:::Comparative morphology: var. sinensis, var. assamica, and wild Yunnan type|https://images.unsplash.com/photo-1556881286-fc6915169721?w=800&h=1200&fit=crop",

    ":::TEXT_SINGLE_COL:::The question of what constitutes a species, a variety, or a cultivar in Camellia is far from settled. Recent molecular phylogenetic studies have revealed that the traditional two-variety classification dramatically understates the genetic diversity within cultivated tea.",

    ":::TEXT_SIDEBAR_IMAGE:::Some researchers have proposed recognizing a third variety — var. dehungensis — for ancient Chinese populations. Others argue that the genus-level taxonomy itself needs revision. The practical implications are significant: understanding the true genetic architecture informs breeding strategies, conservation priorities, and our ability to predict how tea populations will respond to climate change.|The diversity of tea genetics|https://images.unsplash.com/photo-1587049352846-4a222e784d38?w=800&h=1200&fit=crop",

    ":::STAT_BIG_NUMBER:::~15,000 years|Estimated divergence time between var. sinensis and var. assamica",

    ":::TEXT_DOUBLE_COL:::Conservation Challenges|The ancient tea forests of Yunnan, Myanmar, and Laos represent one of the most significant reservoirs of Camellia genetic diversity on earth. Trees exceeding 1,000 years of age contain alleles lost from cultivated populations. Yet these forests face mounting pressures: conversion to rubber plantations, unregulated harvesting, and attrition of traditional land management.\n\nFuture Directions|Climate change is projected to shift optimal growing zones northward and upward by 100-500 meters. Some prime regions may become less suitable, while currently marginal regions may become viable. Genomic tools are being deployed to identify climate-adaptive traits in wild populations, with the goal of breeding cultivars that maintain quality under warmer conditions.",

    ":::IMG_FULL_BLEED:::The future of tea in a changing climate|https://images.unsplash.com/photo-1464982326199-86f32f81b211?w=800&h=1200&fit=crop",

    ":::COPYRIGHT_PAGE:::Text by Sarah Jenkins\nBotanical illustrations by the Teajia Studio\nScientific review by the Kunming Institute of Botany\n\nTeajia Magazine — Reference Series"
  ],
  author: PEOPLE.sarah,
};

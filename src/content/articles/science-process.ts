import { ContentType } from '../../types';
import { ReadableStory } from '../../types/read';
import { PEOPLE } from '../people';

export const scienceProcess: ReadableStory = {
  id: 'template-science-process',
  type: ContentType.Article,
  status: 'published',
  title: 'Science Process Article',
  subtitle: 'The Oxidation Spectrum',
  thumbnailUrl: 'https://images.unsplash.com/photo-1563911892437-1feda0179e1b?w=800&h=1200&fit=crop',
  durationOrTime: '19 Pages',
  origin: 'In-house',
  description: 'A scientific deep-dive into tea oxidation, using data visualization and step-by-step process documentation.',
  category: 'science',
  tags: ['Brewing', 'Origins', 'Health'],
  content: [
    ":::COVER_ABSTRACT:::The Oxidation|Spectrum|https://images.unsplash.com/photo-1563911892437-1feda0179e1b?w=800&h=1200&fit=crop",

    ":::TEXT_DROP_CAP:::Every tea leaf begins its life the same way — as a bright, supple shoot on a Camellia sinensis bush, packed with polyphenols, amino acids, and volatile aromatic compounds. What happens next, in the hours and days following harvest, determines whether that leaf becomes a grassy Japanese sencha, a floral Tieguanyin, or a malty Assam breakfast tea. The answer lies in a single biochemical process: oxidation.",

    ":::TEXT_SIDEBAR_IMAGE:::This is not the slow rusting of iron or the browning of a forgotten banana. Tea oxidation is a carefully orchestrated enzymatic reaction, controlled by skilled artisans who manipulate time, temperature, humidity, and physical force. Understanding oxidation is understanding the very grammar of tea — the system of rules that generates infinite variety from a single plant species.|The science of transformation|https://images.unsplash.com/photo-1556881286-fc6915169721?w=800&h=1200&fit=crop",

    ":::TEXT_DOUBLE_COL:::The Living Leaf|A freshly plucked tea leaf is a marvel of biochemistry. Its cells contain polyphenol oxidase (PPO) and peroxidase enzymes, sequestered in specialized compartments called vacuoles. Meanwhile, polyphenolic substrates — primarily catechins — reside in other cellular compartments. As long as the cell membranes remain intact, enzyme and substrate never meet.\n\nThe Trigger Event|The moment a tea master rolls or bruises the withered leaf, cell membranes rupture. Polyphenol oxidase floods into contact with catechins in the presence of atmospheric oxygen. The enzyme catalyzes the oxidation of catechins into quinones — highly reactive molecules that rapidly polymerize into larger compounds. This is the point of no return.",

    ":::STAT_BIG_NUMBER:::0–5%|Oxidation Level: Green Tea",

    ":::IMG_FILM_STRIP_VERTICAL:::The oxidation progression from fresh leaf to fully oxidized|https://images.unsplash.com/photo-1563911892437-1feda0179e1b?w=800&h=1200&fit=crop|https://images.unsplash.com/photo-1530968033775-2c92736b131e?w=800&h=1200&fit=crop|https://images.unsplash.com/photo-1544787219-7f47ccb76574?w=800&h=1200&fit=crop",

    ":::TEXT_SIDEBAR_RIGHT:::Kill-Green: The Critical Moment|In Chinese tea processing, 'sha qing' literally means 'killing the green.' This step uses high heat to denature the polyphenol oxidase enzyme, permanently halting oxidation. The temperature must reach at least 80°C internally. Japanese producers favor steaming for 30-120 seconds, producing a bright, marine character. Chinese producers typically use wok-firing at 200-300°C for a nuttier, more toasted profile.|https://images.unsplash.com/photo-1545579133-99bb5ab189bd?w=800&h=1200&fit=crop",

    ":::DEFINITION_LARGE:::Theaflavin|A golden-orange pigment formed during oxidation when two catechin molecules fuse. Responsible for the briskness and brightness of black tea liquor. Higher theaflavin content correlates with higher quality in orthodox black teas.",

    ":::IMG_GRID_2x2:::Fresh green leaf|https://images.unsplash.com/photo-1556881286-fc6915169721?w=800&h=1200&fit=crop|Partially oxidized oolong|https://images.unsplash.com/photo-1530968033775-2c92736b131e?w=800&h=1200&fit=crop|Fully oxidized black|https://images.unsplash.com/photo-1544787219-7f47ccb76574?w=800&h=1200&fit=crop|Post-fermented puerh|https://images.unsplash.com/photo-1594631252845-29fc4cc8cde9?w=800&h=1200&fit=crop",

    ":::TEXT_SINGLE_COL:::The oolong category occupies the vast middle ground of oxidation, ranging from roughly 15% to 85%. This is where the tea maker's skill is most visibly on display, because small variations in oxidation level produce dramatically different results.",

    ":::TEXT_JUSTIFIED_NARROW:::A lightly oxidized Taiwanese High Mountain oolong at 20% tastes of gardenia, butter, and spring rain. A medium-oxidized Tieguanyin at 40% offers orchid fragrance and a creamy mouthfeel. A heavily oxidized Da Hong Pao at 70% presents dried stone fruit, caramel, and mineral depth. The oolong master must monitor the leaves constantly — touching them, smelling them, watching the color shift — and apply heat at precisely the right moment.",

    ":::IMG_FULL_BLEED:::Tea leaves at various stages of oxidation|https://images.unsplash.com/photo-1563911892437-1feda0179e1b?w=800&h=1200&fit=crop",

    ":::DATA_BAR_CHART:::Catechin Content by Oxidation Level|Green Tea (5%): 80|Light Oolong (25%): 60|Medium Oolong (50%): 40|Dark Oolong (75%): 25|Black Tea (95%): 10",

    ":::TEXT_TRIPLE_COL:::Catechins to Theaflavins|As oxidation proceeds, monomeric catechins (EGCG, ECG) are converted into dimeric theaflavins. These compounds are responsible for the brisk, bright character and golden color of well-made black tea. Theaflavin content is a key quality indicator used by tea tasters worldwide.\n\nTheaflavins to Thearubigins|Further polymerization converts theaflavins into thearubigins — larger, more complex molecules that give black tea its deep reddish-brown color and body. Thearubigins account for up to 20% of black tea's dry weight and contribute smoothness and depth.\n\nVolatile Aromatics|Oxidation also drives the formation of volatile aromatic compounds. Linalool provides floral notes, geraniol adds rose-like sweetness, and nerolidol contributes woody depth. The specific aromatic profile depends on cultivar, terroir, and the precise oxidation conditions.",

    ":::BOTANICAL_SKETCH:::Cross-section of a tea leaf showing polyphenol oxidase compartmentalization|https://images.unsplash.com/photo-1563911892437-1feda0179e1b?w=800&h=1200&fit=crop",

    ":::QUOTE_MINIMAL:::Oxidation is not a spectrum from bad to good. It is a spectrum from one kind of beauty to another.",

    ":::IMG_FULL_BLEED:::Tea leaves at various stages of oxidation laid out on bamboo trays|https://images.unsplash.com/photo-1545579133-99bb5ab189bd?w=800&h=1200&fit=crop",

    ":::TEXT_DOUBLE_COL:::The Dark Teas: Beyond Oxidation|Dark teas — including shou puerh, liu bao, and fu zhuan — undergo a fundamentally different process called microbial fermentation. After initial processing, the leaves are piled, moistened, and allowed to undergo controlled microbial activity over weeks or months, producing earthy, woody flavors entirely absent from oxidized teas.\n\nThe Role of Withering|Before oxidation can begin, freshly plucked leaves must lose moisture through withering. This step reduces the leaf's water content from roughly 75% to 60-65%. Withering softens the leaves, making them pliable for rolling, and initiates subtle chemical changes that prime the leaf for oxidation.",

    ":::STAT_BIG_NUMBER:::600+|Volatile Aromatic Compounds in Finished Tea",

    ":::IMG_WITH_CAPTION_BOTTOM:::The hands of a tea master evaluating oxidation|https://images.unsplash.com/photo-1597318181409-cf64d0b5d8a2?w=800&h=1200&fit=crop",

    ":::TEXT_SINGLE_COL:::The industrial reality of oxidation differs significantly from artisanal practice. In large-scale CTC production, machines shred the leaves into fine particles, maximizing surface area and accelerating oxidation to completion in as little as 30 minutes. Orthodox production, by contrast, may involve gentle hand-rolling and oxidation periods of 2-5 hours under careful supervision.",

    ":::TEXT_JUSTIFIED_NARROW:::The difference is analogous to industrial bread versus sourdough — the same basic chemistry, but vastly different in craft, time, and resulting complexity. As specialty tea continues to grow, there is renewed interest in understanding and preserving the artisanal oxidation techniques that produce the world's most distinctive teas.",

    ":::EPILOGUE_CENTERED:::The next time you lift a cup to your lips, consider the invisible hand of oxidation that shaped its character — the enzymes that fired, the polyphenols that transformed, the aromatic compounds that bloomed. Every sip is a conversation with chemistry.",

    ":::COPYRIGHT_PAGE:::Teajia Science"
  ],
  author: PEOPLE.sarah,
};

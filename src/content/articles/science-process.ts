import { ContentType } from '../../types';
import { ReadableStory } from '../../types/read';
import { PEOPLE } from '../people';

export const scienceProcess: ReadableStory = {
  id: 'template-science-process',
  type: ContentType.Article,
  status: 'published',
  title: 'Science Process Article',
  subtitle: 'The Oxidation Spectrum',
  thumbnailUrl: 'https://picsum.photos/800/1200?random=sp100',
  durationOrTime: '22 Pages',
  origin: 'In-house',
  description: 'A scientific deep-dive into tea oxidation, using data visualization and step-by-step process documentation.',
  category: 'science',
  tags: ['Brewing', 'Origins', 'Health'],
  content: [
    ":::COVER_ABSTRACT:::The Oxidation|Spectrum|https://picsum.photos/800/1200?random=sp101",

    ":::TEXT_DROP_CAP:::Every tea leaf begins its life the same way — as a bright, supple shoot on a Camellia sinensis bush, packed with polyphenols, amino acids, and volatile aromatic compounds. What happens next, in the hours and days following harvest, determines whether that leaf becomes a grassy Japanese sencha, a floral Tieguanyin, or a malty Assam breakfast tea. The answer lies in a single biochemical process: oxidation. This is not the slow rusting of iron or the browning of a forgotten banana. Tea oxidation is a carefully orchestrated enzymatic reaction, controlled by skilled artisans who manipulate time, temperature, humidity, and physical force to coax a specific flavor profile from the raw material. Understanding oxidation is understanding the very grammar of tea — the system of rules that generates infinite variety from a single plant species. In this article, we trace the chemistry step by step, from the moment a leaf is plucked to the moment it is sealed in its final form.",

    ":::TEXT_DOUBLE_COL:::The Living Leaf|A freshly plucked tea leaf is a marvel of biochemistry. Its cells contain polyphenol oxidase (PPO) and peroxidase enzymes, sequestered in specialized compartments called vacuoles. Meanwhile, polyphenolic substrates — primarily catechins like EGCG, ECG, EC, and EGC — reside in other cellular compartments. As long as the cell membranes remain intact, enzyme and substrate never meet. The leaf stays green, vibrant, and chemically stable. This compartmentalization is the leaf's natural defense mechanism, evolved over millions of years to protect against herbivory and pathogen attack. Only when the cell walls are deliberately damaged — through rolling, bruising, or cutting — does the oxidation cascade begin.\n\nThe Trigger Event|The moment a tea master rolls or bruises the withered leaf, cell membranes rupture. Polyphenol oxidase floods into contact with catechins in the presence of atmospheric oxygen. The enzyme catalyzes the oxidation of catechins into quinones — highly reactive molecules that rapidly polymerize into larger, more complex compounds. This is the point of no return. The clock starts ticking, and every minute that passes changes the leaf's chemical profile. The tea maker's art lies in knowing exactly when to stop this reaction — through the application of heat — to achieve the desired balance of flavor, aroma, and color. Too little oxidation yields a tea that tastes raw or vegetal. Too much produces a flat, one-dimensional brew lacking nuance.",

    ":::STAT_BIG_NUMBER:::0–5%|Oxidation Level: Green Tea",

    ":::IMG_FILM_STRIP_VERTICAL:::The oxidation progression from fresh leaf to fully oxidized|https://picsum.photos/600/400?random=sp102|https://picsum.photos/600/400?random=sp103|https://picsum.photos/600/400?random=sp104",

    ":::TEXT_SIDEBAR_RIGHT:::Kill-Green: The Critical Moment|In Chinese tea processing, the term 'sha qing' (杀青) literally means 'killing the green.' This step uses high heat — either dry heat in a wok or steam in a steamer — to denature the polyphenol oxidase enzyme, permanently halting oxidation. The temperature must reach at least 80°C internally to fully deactivate the enzyme. Japanese producers favor steaming for 30–120 seconds, producing a bright, marine character. Chinese producers typically use wok-firing at 200–300°C for a nuttier, more toasted profile. The choice of kill-green method is arguably the single most consequential decision in green tea production, defining the entire flavor trajectory of the finished leaf.|https://picsum.photos/600/800?random=sp105",

    ":::DEFINITION_LARGE:::Theaflavin|A golden-orange pigment formed during oxidation when two catechin molecules fuse. Responsible for the briskness and brightness of black tea liquor. Higher theaflavin content correlates with higher quality in orthodox black teas.",

    ":::IMG_GRID_2x2:::Fresh green leaf|https://picsum.photos/400/400?random=sp106|Partially oxidized oolong|https://picsum.photos/400/400?random=sp107|Fully oxidized black|https://picsum.photos/400/400?random=sp108|Post-fermented puerh|https://picsum.photos/400/400?random=sp109",

    ":::TEXT_SINGLE_COL:::The oolong category occupies the vast middle ground of oxidation, ranging from roughly 15% to 85%. This is where the tea maker's skill is most visibly on display, because small variations in oxidation level produce dramatically different results. A lightly oxidized Taiwanese High Mountain oolong at 20% oxidation tastes of gardenia, butter, and spring rain. A medium-oxidized Tieguanyin at 40% offers orchid fragrance and a creamy, coating mouthfeel. A heavily oxidized Da Hong Pao at 70% presents dried stone fruit, caramel, and mineral depth. The oolong master must monitor the leaves constantly during oxidation — touching them, smelling them, watching the color shift from green to copper at the leaf edges — and make the decision to apply heat at precisely the right moment. There is no instrument that can replace this judgment. It is accumulated through decades of practice, and it is why great oolong makers are revered as artists.",

    ":::DATA_BAR_CHART:::Catechin Content by Oxidation Level|Green Tea (5%): 80|Light Oolong (25%): 60|Medium Oolong (50%): 40|Dark Oolong (75%): 25|Black Tea (95%): 10",

    ":::TEXT_TRIPLE_COL:::Catechins to Theaflavins|As oxidation proceeds, monomeric catechins (EGCG, ECG) are converted into dimeric theaflavins. These compounds are responsible for the brisk, bright character and golden color of well-made black tea. Theaflavin content is a key quality indicator used by tea tasters worldwide.\n\nTheaflavins to Thearubigins|Further polymerization converts theaflavins into thearubigins — larger, more complex molecules that give black tea its deep reddish-brown color and body. Thearubigins account for up to 20% of black tea's dry weight and contribute smoothness and depth.\n\nVolatile Aromatics|Oxidation also drives the formation of volatile aromatic compounds. Linalool provides floral notes, geraniol adds rose-like sweetness, and nerolidol contributes woody depth. The specific aromatic profile depends on cultivar, terroir, and the precise oxidation conditions.",

    ":::BOTANICAL_SKETCH:::Cross-section of a tea leaf showing polyphenol oxidase compartmentalization|https://picsum.photos/800/600?random=sp110",

    ":::QUOTE_MINIMAL:::Oxidation is not a spectrum from bad to good. It is a spectrum from one kind of beauty to another.",

    ":::IMG_FULL_BLEED:::Tea leaves at various stages of oxidation laid out on bamboo trays|https://picsum.photos/800/1200?random=sp111",

    ":::TEXT_DOUBLE_COL:::The Dark Teas: Beyond Oxidation|Dark teas — including shou puerh, liu bao, and fu zhuan — undergo a fundamentally different process called microbial fermentation. After initial processing, the leaves are piled, moistened, and allowed to undergo controlled microbial activity. Aspergillus niger, Penicillium, and various yeasts transform the leaf chemistry over weeks or months, producing earthy, woody, and sometimes camphor-like flavors entirely absent from oxidized teas. This is not oxidation in the enzymatic sense but a separate biochemical pathway that deserves its own detailed examination.\n\nThe Role of Withering|Before oxidation can begin, freshly plucked leaves must lose moisture through withering. This step, lasting 12–24 hours depending on conditions, reduces the leaf's water content from roughly 75% to 60–65%. Withering softens the leaves, making them pliable enough to roll without shattering, and initiates subtle chemical changes that prime the leaf for oxidation. During withering, some volatile compounds begin to develop, and protein breakdown releases free amino acids that will later contribute to flavor complexity. The withering room is carefully controlled for temperature and airflow — too fast and the leaves dry unevenly; too slow and unwanted fermentation may begin.",

    ":::STAT_BIG_NUMBER:::600+|Volatile Aromatic Compounds in Finished Tea",

    ":::TEXT_SINGLE_COL:::The industrial reality of oxidation differs significantly from artisanal practice. In large-scale CTC (Crush, Tear, Curl) production, machines shred the leaves into fine particles, maximizing surface area and accelerating oxidation to completion in as little as 30 minutes. This produces a strong, one-dimensional tea optimized for teabags and blending. Orthodox production, by contrast, may involve gentle hand-rolling and oxidation periods of 2–5 hours under careful supervision. The difference is analogous to industrial bread versus sourdough — the same basic chemistry, but vastly different in craft, time, and resulting complexity. As specialty tea continues to grow, there is renewed interest in understanding and preserving the artisanal oxidation techniques that produce the world's most distinctive teas.",

    ":::EPILOGUE_CENTERED:::The next time you lift a cup to your lips, consider the invisible hand of oxidation that shaped its character — the enzymes that fired, the polyphenols that transformed, the aromatic compounds that bloomed. Every sip is a conversation with chemistry.",

    ":::COPYRIGHT_PAGE:::Teajia Science"
  ],
  author: PEOPLE.sarah,
};

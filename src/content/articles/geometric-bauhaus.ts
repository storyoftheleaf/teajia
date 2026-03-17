import { ContentType } from '../../types';
import { ReadableStory } from '../../types/read';
import { PEOPLE } from '../people';

export const geometricBauhaus: ReadableStory = {
  id: 'template-geometric',
  type: ContentType.Article,
  status: 'published',
  title: 'Geometric Bauhaus Layout',
  subtitle: 'Form Follows Function',
  thumbnailUrl: 'https://picsum.photos/800/1200?random=geo1',
  durationOrTime: '14 Pages',
  origin: 'In-house',
  description: 'A modernist grid-based design inspired by Bauhaus principles, featuring strict geometry and bold typography.',
  tags: ['Space Design', 'Culture'],
  content: [
    ":::COVER_TYPOGRAPHIC:::GEOMETRY\nOF TEA\nForm Follows Function",

    ":::IMG_GRID_2x2:::Terraced rows from above|https://picsum.photos/600/600?random=geo2|https://picsum.photos/600/600?random=geo3|https://picsum.photos/600/600?random=geo4|https://picsum.photos/600/600?random=geo5",

    ":::IMG_GRID_3x3:::The grid in nature — nine views of tea garden patterns|https://picsum.photos/400/400?random=geo6|https://picsum.photos/400/400?random=geo7|https://picsum.photos/400/400?random=geo8|https://picsum.photos/400/400?random=geo9|https://picsum.photos/400/400?random=geo10|https://picsum.photos/400/400?random=geo11|https://picsum.photos/400/400?random=geo12|https://picsum.photos/400/400?random=geo13|https://picsum.photos/400/400?random=geo14",

    ":::TEXT_DOUBLE_COL:::The Grid in the Garden|Stand at the edge of a Japanese tea plantation and you see something that would have delighted the Bauhaus masters: perfect geometry extending to the horizon. Row after row of precisely clipped hedges, each exactly 1.2 meters wide, separated by paths of exactly 0.6 meters. The curves of the hillside impose gentle arcs on the grid, creating a tension between human order and natural topography that is profoundly beautiful. This is not accidental aesthetics. Every dimension serves a function. The row width maximizes photosynthetic surface area while allowing workers to reach the center of each hedge for hand-picking. The path width accommodates a single person carrying bamboo baskets. The hedge height — maintained at exactly 0.8 meters — ensures that new growth occurs at the optimal picking position, reducing strain on harvesters' backs.\n\nThe Module in Processing|The Bauhaus principle of the module — a basic unit that repeats and combines to create complex forms — appears throughout tea processing architecture. Traditional Fujian oolong workshops are built on a modular plan: identical withering rooms arranged in a row, each sized to hold exactly one batch of fresh leaf. The bamboo withering trays themselves are modules, stackable and interchangeable. The roasting room contains rows of identical charcoal pits. Even the woven bamboo baskets used to transport leaf between stations are standardized in dimension. This modular system allows a workshop to scale up or down with the season's harvest without wasting space or energy. Walter Gropius himself could not have designed a more rational production facility.",

    ":::IMG_QUAD_GRID:::Processing geometry|https://picsum.photos/600/600?random=geo15|https://picsum.photos/600/600?random=geo16|https://picsum.photos/600/600?random=geo17|https://picsum.photos/600/600?random=geo18",

    ":::IMG_GRID_MONDRIAN:::Composition in tea and geometry|https://picsum.photos/800/600?random=geo19|https://picsum.photos/400/600?random=geo20|https://picsum.photos/400/300?random=geo21|https://picsum.photos/400/300?random=geo22",

    ":::TEXT_TRIPLE_COL:::Circle|The teacup is the most elemental geometric form in the tea ritual: a circle. Viewed from above, it becomes a frame — a small round window into color and light. The circular form is not decorative but functional. A cylinder distributes heat evenly, prevents thermal stress cracks, and fits naturally in the curved palm of a human hand. The gaiwan's lid, bowl, and saucer create three concentric circles when viewed from above, a Kandinsky composition in everyday porcelain.|Triangle|The triangular relationship of water, leaf, and heat forms the irreducible core of tea brewing. Remove any one element and the system collapses. This triangulation appears physically in the traditional charcoal brazier arrangement: three stones supporting the kettle over fire, the most stable possible structure. It appears conceptually in the three-pour method of gongfu brewing: rinse, awaken, extract. And it appears chemically in the three major compound groups that define tea's character: catechins (astringency), amino acids (sweetness), and volatile aromatics (fragrance).|Square|The tea brick is perhaps tea's most iconic geometric form — a compressed rectangle of leaves designed not for aesthetics but for transport efficiency. The square maximizes volume-to-surface-area ratio, minimizes breakage during transit, and stacks without wasted space. Along the ancient tea-horse road, the geometry of the brick determined the geometry of the saddlebag, which determined the geometry of the horse train's formation, which determined the width of the mountain paths carved into cliff faces. One shape propagated outward through an entire system of trade and infrastructure.",

    ":::STAT_BIG_NUMBER:::1.2m|Standard row width in Japanese sencha plantations. This measurement optimizes the ratio of leaf surface area to accessible picking depth, unchanged since the Meiji era.",

    ":::CHAPTER_BOLD:::THE MATHEMATICS\nOF STEEPING",

    ":::IMG_DIAGONAL_SPLIT:::The geometry of the pour — precision meets fluidity|https://picsum.photos/800/1200?random=geo23|https://picsum.photos/800/1200?random=geo24",

    ":::TEXT_SINGLE_COL:::Gongfu brewing is an exercise in applied mathematics, whether the practitioner thinks of it in those terms or not. The fundamental variables — leaf-to-water ratio, water temperature, steep time — interact nonlinearly. Doubling the leaf quantity does not simply double the strength; it changes the extraction curve, emphasizing certain compounds over others. The relationship between temperature and extraction rate follows an Arrhenius equation: for every 10 degrees Celsius increase in water temperature, the rate of catechin extraction roughly doubles. But amino acid extraction is less temperature-sensitive, which is why lower-temperature brewing produces sweeter, less astringent cups.\n\nExperienced brewers intuit these mathematical relationships through thousands of repetitions, developing a feel for the right ratio, the right temperature, the right duration.",
    ":::TEXT_SINGLE_COL:::They adjust in real time — shortening a steep if the leaves are tightly rolled (higher surface area once they unfurl), lengthening it if the water has cooled slightly, reducing leaf quantity for teas known to be intensely flavored. This intuitive calculus is the skill that separates a competent brewer from a masterful one. The geometry of the setup — the angle of the pour, the height of the kettle above the pot, the circular motion of the water entering the vessel — all serve this underlying mathematics, directing the flow of energy through the system in precisely controlled patterns.",

    ":::INDEX_GRID:::Geometric Forms in Tea Culture|Circle — Gaiwan, tea cup, rolling motion|Triangle — Brazier stones, three-pour method|Square — Tea brick, withering tray, storage chest|Spiral — Hand-rolled oolong, unfurling leaf|Line — Tea garden rows, bamboo chopstick|Hexagon — Honeycomb cake wrapping pattern",

    ":::BACK_COVER:::GEOMETRY OF TEA\nA Teajia Visual Study\nDesign: Li Jun"
  ],
  author: PEOPLE.li,
};

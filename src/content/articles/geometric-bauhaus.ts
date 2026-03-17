import { ContentType } from '../../types';
import { ReadableStory } from '../../types/read';
import { PEOPLE } from '../people';

export const geometricBauhaus: ReadableStory = {
  id: 'template-geometric',
  type: ContentType.Article,
  status: 'published',
  title: 'Geometric Bauhaus Layout',
  subtitle: 'Form Follows Function',
  thumbnailUrl: 'https://images.unsplash.com/photo-1556881286-fc6915169721?w=800&h=1200&fit=crop',
  durationOrTime: '14 Pages',
  origin: 'In-house',
  description: 'A modernist grid-based design inspired by Bauhaus principles, featuring strict geometry and bold typography.',
  tags: ['Space Design', 'Culture'],
  content: [
    ":::COVER_TYPOGRAPHIC:::GEOMETRY\nOF TEA\nForm Follows Function",

    ":::IMG_GRID_2x2:::Terraced rows from above|https://images.unsplash.com/photo-1556881286-fc6915169721?w=800&h=1200&fit=crop|https://images.unsplash.com/photo-1582793988951-9aed5509eb97?w=800&h=1200&fit=crop|https://images.unsplash.com/photo-1587049352846-4a222e784d38?w=800&h=1200&fit=crop|https://images.unsplash.com/photo-1556881286-fc6915169721?w=800&h=1200&fit=crop",

    ":::IMG_GRID_3x3:::The grid in nature — nine views of tea garden patterns|https://images.unsplash.com/photo-1556881286-fc6915169721?w=800&h=1200&fit=crop|https://images.unsplash.com/photo-1582793988951-9aed5509eb97?w=800&h=1200&fit=crop|https://images.unsplash.com/photo-1587049352846-4a222e784d38?w=800&h=1200&fit=crop|https://images.unsplash.com/photo-1563911892437-1feda0179e1b?w=800&h=1200&fit=crop|https://images.unsplash.com/photo-1556881286-fc6915169721?w=800&h=1200&fit=crop|https://images.unsplash.com/photo-1582793988951-9aed5509eb97?w=800&h=1200&fit=crop|https://images.unsplash.com/photo-1587049352846-4a222e784d38?w=800&h=1200&fit=crop|https://images.unsplash.com/photo-1563911892437-1feda0179e1b?w=800&h=1200&fit=crop|https://images.unsplash.com/photo-1556881286-fc6915169721?w=800&h=1200&fit=crop",

    ":::TEXT_DOUBLE_COL:::The Grid in the Garden|Stand at the edge of a Japanese tea plantation and you see something that would have delighted the Bauhaus masters: perfect geometry extending to the horizon. Row after row of precisely clipped hedges, each exactly 1.2 meters wide, separated by paths of exactly 0.6 meters. The curves of the hillside impose gentle arcs on the grid, creating a tension between human order and natural topography that is profoundly beautiful.\n\nThe Module in Processing|The Bauhaus principle of the module — a basic unit that repeats and combines to create complex forms — appears throughout tea processing architecture. Traditional Fujian oolong workshops are built on a modular plan: identical withering rooms arranged in a row, each sized to hold exactly one batch of fresh leaf. Even the woven bamboo baskets used to transport leaf between stations are standardized in dimension.",

    ":::IMG_FULL_BLEED:::The geometry of terraced tea gardens — human order meeting natural form|https://images.unsplash.com/photo-1582793988951-9aed5509eb97?w=800&h=1200&fit=crop",

    ":::IMG_QUAD_GRID:::Processing geometry|https://images.unsplash.com/photo-1563911892437-1feda0179e1b?w=800&h=1200&fit=crop|https://images.unsplash.com/photo-1530968033775-2c92736b131e?w=800&h=1200&fit=crop|https://images.unsplash.com/photo-1594631252845-29fc4cc8cde9?w=800&h=1200&fit=crop|https://images.unsplash.com/photo-1545579133-99bb5ab189bd?w=800&h=1200&fit=crop",

    ":::IMG_GRID_MONDRIAN:::Composition in tea and geometry|https://images.unsplash.com/photo-1556881286-fc6915169721?w=800&h=1200&fit=crop|https://images.unsplash.com/photo-1594631252845-29fc4cc8cde9?w=800&h=1200&fit=crop|https://images.unsplash.com/photo-1530968033775-2c92736b131e?w=800&h=1200&fit=crop|https://images.unsplash.com/photo-1545579133-99bb5ab189bd?w=800&h=1200&fit=crop",

    ":::TEXT_TRIPLE_COL:::Circle|The teacup is the most elemental geometric form in the tea ritual: a circle. Viewed from above, it becomes a frame — a small round window into color and light. The circular form distributes heat evenly, prevents thermal stress cracks, and fits naturally in the curved palm of a human hand.|Triangle|The triangular relationship of water, leaf, and heat forms the irreducible core of tea brewing. Remove any one element and the system collapses. This triangulation appears physically in the traditional charcoal brazier arrangement: three stones supporting the kettle over fire, the most stable possible structure.|Square|The tea brick is perhaps tea's most iconic geometric form — a compressed rectangle of leaves designed not for aesthetics but for transport efficiency. The square maximizes volume-to-surface-area ratio, minimizes breakage during transit, and stacks without wasted space.",

    ":::STAT_BIG_NUMBER:::1.2m|Standard row width in Japanese sencha plantations. This measurement optimizes the ratio of leaf surface area to accessible picking depth, unchanged since the Meiji era.",

    ":::CHAPTER_BOLD:::THE MATHEMATICS\nOF STEEPING",

    ":::IMG_DIAGONAL_SPLIT:::The geometry of the pour — precision meets fluidity|https://images.unsplash.com/photo-1544787219-7f47ccb76574?w=800&h=1200&fit=crop|https://images.unsplash.com/photo-1571934811356-5cc061b6821f?w=800&h=1200&fit=crop",

    ":::TEXT_SINGLE_COL:::Gongfu brewing is an exercise in applied mathematics, whether the practitioner thinks of it in those terms or not. The fundamental variables — leaf-to-water ratio, water temperature, steep time — interact nonlinearly. Doubling the leaf quantity does not simply double the strength; it changes the extraction curve, emphasizing certain compounds over others.",

    ":::QUOTE_BIG:::For every 10 degrees Celsius increase in water temperature, the rate of catechin extraction roughly doubles. But amino acid extraction is less temperature-sensitive — which is why lower-temperature brewing produces sweeter, less astringent cups.",

    ":::IMG_WITH_CAPTION_BOTTOM:::The circular geometry of a gaiwan viewed from above — a Kandinsky composition in porcelain|https://images.unsplash.com/photo-1594631252845-29fc4cc8cde9?w=800&h=1200&fit=crop",

    ":::TEXT_SIDEBAR_IMAGE:::Experienced brewers intuit these mathematical relationships through thousands of repetitions, developing a feel for the right ratio, the right temperature, the right duration. They adjust in real time — shortening a steep if the leaves are tightly rolled, lengthening it if the water has cooled slightly. This intuitive calculus is the skill that separates a competent brewer from a masterful one.|The precision of gongfu brewing|https://images.unsplash.com/photo-1544787219-7f47ccb76574?w=800&h=1200&fit=crop",

    ":::INDEX_GRID:::Geometric Forms in Tea Culture|Circle — Gaiwan, tea cup, rolling motion|Triangle — Brazier stones, three-pour method|Square — Tea brick, withering tray, storage chest|Spiral — Hand-rolled oolong, unfurling leaf|Line — Tea garden rows, bamboo chopstick|Hexagon — Honeycomb cake wrapping pattern",

    ":::BACK_COVER:::GEOMETRY OF TEA\nA Teajia Visual Study\nDesign: Li Jun"
  ],
  author: PEOPLE.li,
};

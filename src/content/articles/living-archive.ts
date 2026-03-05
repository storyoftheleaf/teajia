import { ContentType } from '../../types';
import { ReadableStory } from '../../types/read';
import { PEOPLE } from '../people';

export const livingArchive: ReadableStory = {
  id: 'content-display-8',
  type: ContentType.Article,
  status: 'published',
  title: 'Living Archive',
  subtitle: 'Annotated Collection',
  thumbnailUrl: 'https://picsum.photos/800/1200?random=cd8',
  durationOrTime: '22 Pages',
  origin: 'Curated',
  description: 'A curated collection of essential tea knowledge, references, and external resources.',
  tags: ['History', 'Culture', 'Origins'],
  content: [
    ":::COVER_MINIMAL:::Living|Archive",
    ":::TOC_MINIMAL:::Botanical Reference|Processing Methods|Regional Studies|Scientific Papers|Cultural Context",
    ":::DEFINITION_LARGE:::Archive (n.)\nA collection of historical documents or records providing information about a place, institution, or group of people.",
    ":::TEXT_SIDEBAR_LEFT:::Botanical Reference|Essential reading on Camellia Sinensis taxonomy, cultivars, and growing conditions.|https://picsum.photos/600/800?random=cd8-1",
    ":::CURATED_LINKS:::The Genetics of Tea|https://www.nature.com/articles/tea-genetics|Nature Genetics|Comprehensive study mapping the tea plant genome and identifying genetic markers for quality traits.,Tea Plant Physiology|https://academic.oup.com/tea-physiology|Oxford Academic|How altitude, temperature, and soil composition affect secondary metabolite production.",
    ":::DEFINITION_LARGE:::Terroir (n.)\nThe complete natural environment in which tea is grown, including soil, climate, and topography.",
    ":::TEXT_SIDEBAR_RIGHT:::Processing Methods|Detailed documentation of traditional and modern tea processing techniques.|https://picsum.photos/600/800?random=cd8-2",
    ":::CURATED_LINKS:::Kill-Green Techniques|https://teaprocessing.org/kill-green|Tea Processing Institute|Comparison of pan-firing, steaming, and baking methods for enzyme deactivation.,Oxidation Control|https://fermentation-science.edu/tea-oxidation|Fermentation Science Journal|The chemistry behind oolong and black tea oxidation processes.",
    ":::TEXT_SIDEBAR_LEFT:::Regional Studies|Geographic deep-dives into the world's most important tea-producing regions.|https://picsum.photos/600/800?random=cd8-3",
    ":::CURATED_LINKS:::Wuyi Yan Cha Research|https://wuyi-research.cn/oolong-study|Wuyi Research Center|10-year longitudinal study on mineral content's effect on rock tea flavor.,Darjeeling Flush Analysis|https://indian-tea-board.gov.in/darjeeling|Indian Tea Board|Official documentation comparing first, second, and autumn flush characteristics.",
    ":::DEFINITION_LARGE:::Cultivar (n.)\nA plant variety that has been produced in cultivation by selective breeding.",
    ":::TEXT_SIDEBAR_RIGHT:::Scientific Papers|Peer-reviewed research on tea's health effects and chemical composition.|https://picsum.photos/600/800?random=cd8-4",
    ":::CURATED_LINKS:::L-Theanine & Cognition|https://pubmed.ncbi.nlm.nih.gov/theanine-study|PubMed|Meta-analysis of theanine's effects on attention and anxiety reduction.,Polyphenol Bioavailability|https://sciencedirect.com/polyphenols-tea|ScienceDirect|How preparation method affects antioxidant absorption rates.",
    ":::TEXT_SIDEBAR_LEFT:::Cultural Context|Anthropological and historical perspectives on tea culture worldwide.|https://picsum.photos/600/800?random=cd8-5",
    ":::CURATED_LINKS:::Tea Horse Road Documentary|https://documentary.net/tea-horse-road|Documentary Archives|Award-winning film tracing the ancient trade routes through the Himalayas.,Japanese Tea Ceremony Origins|https://kyoto-cultural-studies.jp/chanoyu|Kyoto Cultural Studies|Historical evolution of Chanoyu from Zen Buddhist rituals to formalized practice.",
    ":::COPYRIGHT_PAGE:::Curated by Chen Wei & Sarah Jenkins"
  ],
  author: PEOPLE.chen,
};

import { ContentType } from '../../types';
import { ReadableStory } from '../../types/read';
import { PEOPLE } from '../people';

export const dataInfographic: ReadableStory = {
  id: 'template-data',
  type: ContentType.Article,
  status: 'published',
  title: 'Data-Driven Infographic',
  subtitle: 'Terroir in Numbers',
  thumbnailUrl: 'https://picsum.photos/800/1200?random=data1',
  durationOrTime: '19 Pages',
  origin: 'In-house',
  description: 'A data-rich feature using charts, statistics, and infographic elements to analyze tea terroir scientifically.',
  tags: ['Science', 'Data', 'Terroir'],
  content: [
    ":::COVER_ABSTRACT:::TERROIR\nIN NUMBERS\nA Data-Driven Analysis",

    ":::TEXT_DROP_CAP:::Terroir is the most borrowed and least understood word in the tea lexicon. Lifted from French wine culture, it refers to the complete natural environment in which a crop is produced — soil, climate, altitude, microorganisms, hydrology, and the dozens of other variables that give a product its sense of place. Wine drinkers have debated terroir for centuries. Tea drinkers are only now beginning to quantify it. For this feature, we compiled data from 47 tea-growing regions across China, Taiwan, Japan, India, and Sri Lanka, analyzing the measurable environmental factors that correlate with cup quality, market price, and chemical composition. The results challenge several popular assumptions and reveal patterns that even experienced tea professionals may find surprising.",

    ":::STAT_BIG_NUMBER:::1,847m|Average altitude of tea gardens producing competition-winning oolongs in Taiwan (2015-2024). Gardens below 1,000m won zero top prizes in the same period.",

    ":::STAT_BIG_NUMBER:::4.8 – 5.5|Optimal soil pH range for Camellia sinensis. Soils outside this range showed 35% lower L-theanine concentration in harvested leaves.",

    ":::TEXT_DOUBLE_COL:::Altitude and Flavor Complexity|The correlation between altitude and tea quality is one of the most persistent claims in tea culture, and our data largely supports it — with important caveats. High-altitude tea gardens (above 1,500 meters) consistently produce leaves with higher concentrations of amino acids, particularly L-theanine, which contributes sweetness and umami character. The mechanism is well understood: cooler temperatures slow leaf growth, allowing more time for amino acid accumulation. UV radiation, which increases with altitude, triggers the production of catechins and other polyphenols as a natural sunscreen. The combination of concentrated amino acids and complex polyphenols creates the layered flavor profiles that judges and consumers prize. However, altitude alone explains only about 40% of the variance in chemical composition across our sample.\n\nThe Rainfall Paradox|Conventional wisdom holds that tea plants thrive with abundant rainfall — and indeed, most major tea regions receive between 1,500 and 2,500mm annually. But our analysis revealed a counterintuitive pattern: the highest-rated teas in blind tastings came from regions where rainfall distribution was uneven rather than consistent. Regions with distinct dry periods — particularly a dry spell of 2-4 weeks before spring harvest — produced teas with 22% higher aromatic volatile concentrations than regions with steady year-round precipitation. The stress of mild drought appears to concentrate flavor compounds in the leaves, much as water stress improves grape quality in viticulture. Wuyi Mountain's famous yancha benefit from exactly this pattern: dry winters followed by misty springs.",

    ":::DATA_BAR_CHART:::Amino Acid Concentration by Altitude (mg/g dry weight)\n>2000m: 28.4\n1500-2000m: 24.1\n1000-1500m: 19.7\n500-1000m: 15.3\n<500m: 12.8",

    ":::TEXT_TRIPLE_COL:::Soil Chemistry|The mineral composition of soil directly influences tea character. Volcanic soils rich in iron and manganese — found in parts of Taiwan, Java, and Kenya — produce teas with distinctive mineral notes often described as 'rocky' or 'metallic.' Limestone-derived soils in Yunnan contribute to the alkaline mineral character of aged puerh. Sandy, well-drained soils in Darjeeling create stress conditions that concentrate muscatel flavors. Our analysis found that soil type was the single strongest predictor of a tea's mineral finish in blind tasting, accounting for 52% of taster agreement on minerality scores.|Temperature Variance|Perhaps our most surprising finding concerns not average temperature but temperature variance — the difference between daytime highs and nighttime lows. Regions with high diurnal temperature variance (15°C or more between day and night) produced teas rated significantly higher for aromatic complexity. Alishan, Taiwan (18°C variance), Darjeeling first flush (16°C variance), and Uji, Japan (15°C variance) all share this characteristic. The mechanism likely involves the plant accumulating sugars through daytime photosynthesis, then converting those sugars to aromatic compounds during cool nighttime metabolic shifts.|Fog and Diffused Light|Nearly every premium tea region in our dataset shares one climatic feature: frequent fog or cloud cover during the growing season. Wuyi Mountain averages 220 foggy days per year. Alishan sits above the cloud line for much of spring. Darjeeling's first flush emerges through morning mist. Fog serves a dual purpose: it provides moisture without the diluting effect of rain, and it diffuses sunlight, reducing the ratio of catechins (bitter) to amino acids (sweet) in the leaf. Our data showed a strong positive correlation (r=0.71) between annual fog days and blind tasting scores.",

    ":::IMG_GRID_2x2:::Soil samples from four regions|https://picsum.photos/600/600?random=data2|https://picsum.photos/600/600?random=data3|https://picsum.photos/600/600?random=data4|https://picsum.photos/600/600?random=data5",

    ":::TEXT_SIDEBAR_RIGHT:::The Microbiome Factor|Recent research from Yunnan Agricultural University has added another dimension to terroir analysis: the soil and leaf microbiome. Every tea garden harbors unique communities of bacteria, fungi, and other microorganisms that interact with the tea plant in ways we are only beginning to understand. These microbial communities influence nutrient uptake, disease resistance, and — most intriguingly — the production of volatile aromatic compounds. Two genetically identical tea plants grown in the same climate but with different soil microbiomes can produce measurably different flavor profiles. This may explain why transplanted tea cultivars rarely taste the same in their new environment, even when altitude, rainfall, and temperature are carefully matched.|https://picsum.photos/600/800?random=data6",

    ":::DEFINITION_LARGE:::Terroir (n.)|The complete set of environmental factors — geological, climatic, biological, and anthropogenic — that give an agricultural product its distinctive character of place. In tea, terroir encompasses soil composition, altitude, rainfall, temperature variance, fog patterns, microbiome, and traditional processing methods specific to a region.",

    ":::STAT_BIG_NUMBER:::220|Average annual fog days in Wuyi Mountain, Fujian. The diffused light produces leaves with a catechin-to-amino-acid ratio of 1:1.4, versus 1:0.8 in full-sun lowland gardens.",

    ":::TEXT_SINGLE_COL:::Our data compels us to expand the traditional definition of terroir beyond purely natural factors. Processing tradition — the human element — proved to be a significant variable in our analysis. Two gardens with nearly identical environmental profiles can produce radically different teas if one follows a traditional charcoal-roasting protocol while the other uses electric drum roasters. The specific timing of harvest, the duration of withering, the temperature and method of fixation, the degree of oxidation, the style of rolling — these human decisions interact with the raw material that terroir provides. In wine, this is sometimes called the 'hand of the winemaker.' In tea, we might call it the 'hand of the tea master.' Our statistical models improved significantly when we included processing method as a variable alongside environmental factors. The best model — combining altitude, diurnal temperature variance, annual fog days, soil pH, rainfall distribution, and processing tradition — explained 78% of the variance in professional tasting scores across our 47-region sample.",

    ":::INDEX_GRID:::Regions Analyzed|Wuyi Mountain, Fujian|Alishan, Taiwan|Darjeeling, India|Uji, Kyoto|Yiwu, Yunnan|Laoshan, Shandong|Nuwara Eliya, Sri Lanka|Boseong, South Korea",

    ":::TASTING_NOTES_GRID:::Wuyi Yancha|Mineral, roasted, orchid, stone fruit, lingering hui gan|Alishan Oolong|Floral, creamy, buttery, light honey, alpine freshness|Darjeeling FF|Muscatel, astringent, bright, citrus zest, green grape|Uji Gyokuro|Marine, intense umami, sweet grass, chlorophyll, broth-like",

    ":::QUOTE_MINIMAL:::Data does not replace the palate. It illuminates what the palate already knows. — Professor Liu Zhenghe, Fujian Agricultural University",

    ":::COPYRIGHT_PAGE:::Data compiled by Sarah Jenkins\nTeajia Research Division\nAll datasets available upon request"
  ],
  author: PEOPLE.sarah,
};

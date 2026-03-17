import { ContentType } from '../../types';
import { ReadableStory } from '../../types/read';
import { PEOPLE } from '../people';

export const curatedLinks: ReadableStory = {
  id: 'template-curated',
  type: ContentType.Article,
  status: 'published',
  title: 'Curated Links Page',
  subtitle: 'This Week in Tea',
  thumbnailUrl: 'https://images.unsplash.com/photo-1563911892437-1feda0179e1b?w=800&h=1200&fit=crop',
  durationOrTime: '13 Pages',
  origin: 'Curated',
  description: 'An external link roundup template with curator notes, categories, and editorial commentary.',
  tags: ['Culture'],
  category: 'curated',
  content: [
    ":::COVER_MASTHEAD:::This Week in Tea|Volume 47 — Spring Equinox Edition|https://images.unsplash.com/photo-1556881286-fc6915169721?w=800&h=1200&fit=crop",

    ":::TEXT_SINGLE_COL:::Welcome to the spring equinox edition of our weekly roundup. The tea world is stirring after a long winter — new harvests are arriving from southern Yunnan, Japanese farmers are preparing for the first shincha of the season, and the annual debate over pre-Qingming pricing has begun in earnest on Chinese social media.",

    ":::TEXT_CENTER_NARROW:::This week we have gathered the most compelling reads, watches, and listens from across the tea internet. As always, our selections are guided by a simple question: does this deepen our understanding of tea, or does it merely add to the noise?",

    ":::IMG_FULL_BLEED:::Spring tea gardens awakening after winter dormancy|https://images.unsplash.com/photo-1556881286-fc6915169721?w=800&h=1200&fit=crop",

    ":::CURATED_LINKS:::The Neuroscience of Tea Meditation|https://www.nature.com/articles/s41598-024-tea-meditation|Nature Scientific Reports|A groundbreaking fMRI study from Kyoto University demonstrates that the ritualized preparation of tea activates neural pathways associated with mindfulness meditation. Participants who performed a simplified gongfu ceremony showed increased activity in the prefrontal cortex and decreased amygdala response compared to those who simply drank the same tea from a mug. The researchers conclude that the physical ritual — not just the chemical compounds — contributes significantly to tea's calming effect.,First Flush Dispatches from Darjeeling|https://teadb.org/darjeeling-first-flush-2026|TeaDB|The first flush season in Darjeeling is underway, and the early reports are encouraging. After two consecutive years of drought-reduced harvests, 2026 is shaping up to be exceptional. This dispatch from TeaDB includes tasting notes from twelve estates, price comparisons with previous years, and an honest assessment of which gardens are producing their best work and which are coasting on reputation.,Why Korean Tea Deserves Your Attention|https://www.bbc.com/travel/korean-tea-renaissance|BBC Travel|Korea's tea culture has operated in the shadow of its Chinese and Japanese neighbors for centuries, but a new generation of producers in Boseong and Hadong is changing that. This beautifully photographed piece follows three young farmers who are reviving abandoned tea gardens using organic methods.",

    ":::TEXT_DOUBLE_COL:::Editor's Note|The Darjeeling first flush market has become increasingly speculative in recent years, with some estates releasing teas within days of picking to capitalize on scarcity pricing. We encourage readers to wait until mid-April before purchasing, when the full range of estates will have released their offerings and prices will have stabilized.\n\nOn Korean Tea|Sarah Jenkins, who visited Boseong last autumn, adds: 'The BBC piece is excellent but understates how far Korean processing has come. The jukro (shade-grown) teas I tasted in Hadong rivaled mid-grade gyokuro at a fraction of the price. If you can find Korean hwangcha (yellow tea), buy it — this style is practically unknown outside the peninsula and it is extraordinary.'",

    ":::IMG_WITH_CAPTION_BOTTOM:::A tea farmer in Boseong, South Korea, inspects new spring growth on shade-grown bushes|https://images.unsplash.com/photo-1587049352846-4a222e784d38?w=800&h=1200&fit=crop",

    ":::CURATED_LINKS:::The Water Crisis in Yunnan's Tea Mountains|https://www.theguardian.com/environment/yunnan-tea-water|The Guardian|A sobering investigation into how declining groundwater levels in Yunnan's Xishuangbanna prefecture are threatening the ancient tea trees that produce some of the world's most valuable puerh. Interviews with farmers in Yiwu and Menghai reveal that springs that once flowed year-round are now seasonal.,Building a Home Tea Space on Any Budget|https://worldoftea.org/home-tea-space-guide|World of Tea|A practical and refreshingly unpretentious guide to creating a dedicated tea brewing area in your home. The author argues convincingly that you need far less equipment than the Instagram tea community would have you believe.,The Science of Aging Puerh: A 20-Year Longitudinal Study|https://academic.oup.com/puerh-aging-study|Oxford Academic|Finally, proper longitudinal data on puerh aging. Researchers at Kunming University of Science tracked chemical changes in 200 samples of sheng puerh stored under controlled conditions over two decades. Key findings: the most significant flavor transformation occurs between years 7 and 12, and storage humidity matters more than temperature.",

    ":::LIST_CHECKLIST:::This week's recommendations at a glance|Read the Yunnan water crisis piece — it affects every puerh drinker,Try Korean hwangcha if you can find it — a genuinely underappreciated style,Hold off on Darjeeling first flush purchases until mid-April for better value,Consider your home tea space — less equipment and more intention is the way,If you store puerh check your humidity levels based on the Oxford study's findings",

    ":::QUOTE_MINIMAL:::The best tea content does not tell you what to think about tea. It gives you better questions to ask of your next cup.",

    ":::IMG_FULL_BLEED:::Aged puerh cakes in careful storage — patience made tangible|https://images.unsplash.com/photo-1563911892437-1feda0179e1b?w=800&h=1200&fit=crop",

    ":::TEXT_SIDEBAR_RIGHT:::Books We Are Reading|This month we are working through 'The Way of Tea' by Aaron Fisher, a dense but rewarding exploration of tea as a contemplative practice. Fisher writes from the perspective of a Western practitioner who has spent decades studying in Taiwan, and his prose balances the poetic with the practical in a way that few tea writers achieve. We are also re-reading Lu Yu's Chajing in a new translation by Steven Owyoung, which benefits from extensive footnotes placing the eighth-century text in its historical context. Both books reward slow reading — a few pages with tea, not a chapter before bed.|https://images.unsplash.com/photo-1515823064-d6e0c04616a7?w=800&h=1200&fit=crop",

    ":::CURATED_LINKS:::Podcast: The Future of Teaware|https://podcasts.apple.com/teaware-future|The Steep Podcast|An hour-long conversation with three ceramic artists — one from Jingdezhen, one from Tokoname, and one from Portland, Oregon — about where teaware is heading. Particularly interesting is the segment on how social media has created a global aesthetic that is flattening regional pottery traditions.,Video: Inside a Wuyi Yan Cha Factory|https://www.youtube.com/watch?v=wuyi-yancha-factory|Tea Voyager (YouTube)|Rare footage from inside one of the larger Yan Cha processing facilities in Wuyishan. The roasting room footage — where workers manage dozens of charcoal baskets simultaneously — is mesmerizing.,Interactive Map: Global Tea Production|https://datateaviz.org/global-production-map|Data Tea Viz|A beautifully designed interactive map showing tea production volumes, dominant cultivars, and processing styles for every major tea-producing country. The data goes back to 1950 and reveals fascinating trends.",

    ":::TEXT_TRIPLE_COL:::What We Are Drinking|This week's rotation includes a 2024 Lao Ban Zhang from our private collection — powerful, bitter on the first infusion, then opening into waves of camphor and stone fruit. Also a delightful Alishan Jin Xuan from Taiwan that our supplier sent as a sample — creamy, floral, dangerously drinkable.|What We Are Watching|Li Jun recommends 'Tea: A Mirror of the Soul,' a slow-cinema documentary that follows a single tea bush through four seasons. Running time is three hours. You will need a pot of something excellent to sustain you.|What We Are Planning|Next week's roundup will feature a special section on competition teas — the culture of tea competitions in Taiwan and mainland China, how they work, what the judges look for, and whether competition results actually correlate with quality.",

    ":::EPILOGUE_CENTERED:::That is all for this week. If you have found something remarkable in the tea world that we have missed, send it our way. The best roundups are collaborative. Drink well, read widely, and question everything — especially the things you think you already know.",

    ":::COPYRIGHT_PAGE:::Curated by Chen Wei\nWith contributions from Sarah Jenkins and Li Jun\nTeajia Journal — This Week in Tea, Volume 47"
  ],
  author: PEOPLE.chen,
};

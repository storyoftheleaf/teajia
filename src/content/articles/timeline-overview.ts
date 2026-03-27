import { ContentType } from '../../types';
import { ReadableStory } from '../../types/read';
import { PEOPLE } from '../people';

export const timelineOverview: ReadableStory = {
  id: 'template-timeline',
  type: ContentType.Article,
  status: 'vault',
  title: 'Timeline Overview',
  subtitle: 'Five Thousand Years of Tea',
  thumbnailUrl: 'https://images.unsplash.com/photo-1594631252845-29fc4cc8cde9?w=800&h=1200&fit=crop',
  durationOrTime: '19 Pages',
  origin: 'In-house',
  description: 'A chronological feature using timeline layouts, historical imagery, and era-by-era narrative.',
  tags: ['History', 'Origins', 'China'],
  startHere: true,
  content: [
    ":::COVER_MAIN:::Five Thousand Years|of Tea|https://images.unsplash.com/photo-1594631252845-29fc4cc8cde9?w=800&h=1200&fit=crop",

    ":::TEXT_DROP_CAP:::No other plant has shaped human civilization quite like Camellia sinensis. From its misty origins in the mountains of southwest China to its role as the catalyst for global trade wars, colonial empires, and cultural revolutions, tea has been a silent companion to nearly every major chapter of human history. It has been a medicine, a currency, a diplomatic tool, a spiritual practice, a symbol of resistance, and — above all — a daily ritual shared by billions.",

    ":::TEXT_SINGLE_COL:::This is the story of that journey, told era by era, from the mythological age of Chinese emperors to the third-wave tea movement reshaping how we drink today. It is a story of monks and merchants, emperors and farmers, scientists and smugglers, and the quiet leaf that outlasted them all.",

    ":::LIST_TIMELINE:::2737 BCE — Emperor Shennong allegedly discovers tea when a leaf falls into his boiling water|59 BCE — Earliest written reference to tea as a purchased commodity, in Wang Bao's servant contract|220 CE — Tea becomes a daily drink among Chinese nobility during the Three Kingdoms period|760 CE — Lu Yu publishes 'Cha Jing' (The Classic of Tea), the first comprehensive tea treatise|780 CE — Tang Dynasty imposes the first tea tax, recognizing its economic importance|960 CE — Song Dynasty popularizes whisked powdered tea and competitive tea tasting|1391 — Ming Dynasty Emperor Zhu Yuanzhang bans compressed tea, mandating loose-leaf production|1610 — Dutch East India Company brings the first commercial tea shipment to Europe|1662 — Catherine of Braganza introduces tea to the English court|1773 — Boston Tea Party catalyzes the American Revolution|1823 — Robert Bruce discovers native tea plants in Assam, India|1848 — Robert Fortune smuggles tea plants and processing secrets from China to India|1869 — Suez Canal opens, dramatically reducing tea shipping times to Europe|1908 — Thomas Sullivan accidentally invents the tea bag in New York|2000s — Third-wave tea movement begins, emphasizing origin, craft, and single-estate teas",

    ":::IMG_FULL_BLEED:::Ancient tea gardens in the mountains|https://images.unsplash.com/photo-1587049352846-4a222e784d38?w=800&h=1200&fit=crop",

    ":::TEXT_SINGLE_COL:::The earliest relationship between humans and the tea plant was almost certainly medicinal. In the subtropical forests of what is now Yunnan province, indigenous peoples chewed raw tea leaves for their stimulant and antimicrobial properties long before anyone thought to steep them in water.",

    ":::TEXT_JUSTIFIED_NARROW:::Archaeological evidence from the Han Dynasty confirms tea use in royal tombs, and chemical analysis has pushed confirmed tea consumption back at least 2,100 years. But the transition from medicine to beverage — from functional necessity to cultural practice — happened gradually, driven by Buddhist monks who found that tea aided meditation and by Taoist practitioners who associated the plant with longevity.",

    ":::CHAPTER_BOLD:::The Tang Dynasty|The Age of Lu Yu",

    ":::IMG_FULL_BLEED:::Tea ceremony in the traditional style|https://images.unsplash.com/photo-1545579133-99bb5ab189bd?w=800&h=1200&fit=crop",

    ":::TEXT_DOUBLE_COL:::The Birth of Tea Culture|The Tang Dynasty (618-907 CE) transformed tea from a regional habit into a codified cultural practice. At the center stood Lu Yu, an orphan raised by Buddhist monks who became the most influential figure in tea history. His 'Cha Jing' was the world's first comprehensive treatise on tea, establishing principles that would guide tea culture for twelve hundred years.\n\nTang Dynasty Tea Practice|Tang-era tea was prepared by boiling compressed tea cakes ground into powder, then whisked with salt and sometimes ginger. The Tang tea ceremony emphasized simplicity, natural beauty, and mindful attention — values that would later evolve into the Japanese chanoyu.",

    ":::IMG_FULL_BLEED:::Ancient tea trade routes through mountain passes|https://images.unsplash.com/photo-1582793988951-9aed5509eb97?w=800&h=1200&fit=crop",

    ":::IMG_DUOTONE:::A Song Dynasty tea competition painting reproduction|https://images.unsplash.com/photo-1530968033775-2c92736b131e?w=800&h=1200&fit=crop",

    ":::TEXT_SIDEBAR_RIGHT:::Song Dynasty Tea Competitions|The Song Dynasty (960-1279 CE) elevated tea appreciation to a competitive sport. 'Dou Cha' — tea competitions — were elaborate social events where participants judged each other's technique. The goal was to produce the whitest, most persistent foam on whisked powdered tea. The emperor himself was a connoisseur; Emperor Huizong wrote a famous treatise detailing 20 categories of evaluation.|https://images.unsplash.com/photo-1545579133-99bb5ab189bd?w=800&h=1200&fit=crop",

    ":::QUOTE_BIG:::Tea began as a medicine and grew into a beverage. In China it became a form of art. In Japan, a religion of aesthetics. In England, a pretext for social gathering. In America, a reason for revolution.\n— Kakuzo Okakura, The Book of Tea",

    ":::IMG_WITH_CAPTION_BOTTOM:::The transition to loose-leaf tea during the Ming Dynasty|https://images.unsplash.com/photo-1563911892437-1feda0179e1b?w=800&h=1200&fit=crop",

    ":::TEXT_SINGLE_COL:::The Ming Dynasty revolution of 1391 is one of the most consequential and least discussed moments in tea history. Emperor Zhu Yuanzhang issued a decree banning compressed tea cakes — the standard format for over a thousand years. His stated motivation was populist: compressed tea was labor-intensive and associated with imperial luxury.",

    ":::TEXT_JUSTIFIED_NARROW:::The practical consequences were enormous. Without compressed cakes to grind and whisk, an entirely new preparation method was needed — steeping whole loose leaves in hot water. The teapot became essential. The gaiwan emerged as the ideal vessel. And the extraordinary diversity of leaf shapes and processing styles that we celebrate today became possible only because leaves were no longer destined for anonymous powder.",

    ":::MAP_CARTOGRAPHY:::Global Tea Trade Routes circa 1800|https://images.unsplash.com/photo-1464982326199-86f32f81b211?w=800&h=1200&fit=crop",

    ":::TEXT_SIDEBAR_LEFT:::The Great Tea Theft|In 1848, the British East India Company dispatched Robert Fortune on one of history's most consequential acts of industrial espionage. Disguised as a Chinese merchant, Fortune traveled into Fujian and the Wuyi Mountains, collecting tea plants and closely guarded processing secrets. He smuggled everything to British-controlled India. Within decades, Indian tea production rivaled and then surpassed Chinese output.|https://images.unsplash.com/photo-1594631252845-29fc4cc8cde9?w=800&h=1200&fit=crop",

    ":::STAT_BIG_NUMBER:::6.3 Billion|Kilograms of tea produced globally in 2023",

    ":::IMG_FULL_BLEED:::Tea plantation under dramatic skies|https://images.unsplash.com/photo-1582793988951-9aed5509eb97?w=800&h=1200&fit=crop",

    ":::TEXT_DOUBLE_COL:::The Industrial Revolution of Tea|The CTC (Crush, Tear, Curl) machine, invented in 1930, enabled factories to process huge volumes into uniform tea optimized for teabags. The tea bag itself, accidentally invented in 1908, completed the industrialization by severing the consumer's connection to the whole leaf. By the mid-twentieth century, most Western tea drinkers had never seen a whole tea leaf.\n\nThe Third Wave|The third-wave tea movement, emerging in the early 2000s, represents a conscious rejection of tea's industrial period. Single-estate teas replaced anonymous blends. Gongfu brewing offered a method for experiencing complexity. Direct relationships between consumers and farmers bypassed the blending houses that had controlled distribution for centuries.",

    ":::TEXT_SINGLE_COL:::The story of tea is far from over. Climate change is reshaping tea-growing regions worldwide, pushing cultivation to higher altitudes. Darjeeling's first-flush season has shifted earlier by nearly two weeks over three decades. Meanwhile, new tea regions are emerging — Nepal's high-altitude gardens are producing oolongs that rival Taiwan's best.",

    ":::TEXT_JUSTIFIED_NARROW:::The next chapter of tea's five-thousand-year story will be written not in the courts of emperors but in the gardens of a warming planet, by farmers and drinkers who must balance tradition with adaptation. The leaf endures. It always has.",

    ":::EPILOGUE_CENTERED:::From a single leaf in a mythical emperor's cup to six billion kilograms harvested annually across forty countries — tea's journey mirrors humanity's own. We have brewed it in clay pots over charcoal fires and in electric kettles in studio apartments. We have fought wars over it and found peace in it. And every morning, billions of us begin the day the same way our ancestors did five thousand years ago: with hot water and a leaf.",

    ":::COPYRIGHT_PAGE:::Teajia History"
  ],
  author: PEOPLE.chen,
};

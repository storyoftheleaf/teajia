import { ContentType } from '../../types';
import { ReadableStory } from '../../types/read';
import { PEOPLE } from '../people';

export const retroArchive: ReadableStory = {
  id: 'template-retro',
  type: ContentType.Article,
  status: 'published',
  title: 'Retro Archive Template',
  subtitle: 'Tea Culture, 1980',
  thumbnailUrl: 'https://images.unsplash.com/photo-1594631252845-29fc4cc8cde9?w=800&h=1200&fit=crop',
  durationOrTime: '16 Pages',
  origin: 'In-house',
  description: 'A vintage-styled feature using sepia tones, typewriter text, and archival aesthetics to explore tea history.',
  tags: ['History', 'Culture'],
  content: [
    ":::COVER_TYPOGRAPHIC:::THE TAIWAN\nTEA RENAISSANCE\n1978 – 1988",

    ":::TEXT_TYPEWRITER:::Taipei, Republic of China\nDate: March 14, 1980\nClassification: Cultural Report\nSubject: The Transformation of Taiwan's Tea Industry\n\nFor decades, Taiwan's tea estates served a singular purpose: produce as much tea as possible, as cheaply as possible, and ship it abroad. Black tea for blending, green tea for Japan, oolong dust for teabags. The island's farmers were anonymous laborers in a global commodity chain.",

    ":::TEXT_SINGLE_COL:::But something was changing. A quiet revolution was brewing in the mountain villages of Nantou, Pinglin, and Alishan — one that would transform Taiwan from a bulk exporter into the world's most celebrated source of artisanal oolong.",

    ":::IMG_DUOTONE:::Tea auction house, Taipei, 1979|https://images.unsplash.com/photo-1594631252845-29fc4cc8cde9?w=800&h=1200&fit=crop",

    ":::TEXT_DOUBLE_COL:::The Export Era|Throughout the 1950s and 1960s, Taiwan's tea industry operated under strict government quotas. The Taiwan Tea Corporation controlled exports, setting prices and dictating which varieties farmers could grow. Efficiency was everything. The concept of terroir was irrelevant. A kilo of Dong Ding oolong fetched the same price whether it came from a master craftsman's garden or a factory plantation.\n\nThe Turning Point|The shift began not in the tea fields but in the cities. A new generation of Taiwanese intellectuals, artists, and entrepreneurs — many educated abroad — returned home with a hunger for cultural identity. They had witnessed the wine renaissance in France, the craft pottery movement in Japan, the slow food awakening in Italy. They asked: why not tea?",

    ":::IMG_FULL_BLEED:::Traditional tea processing in Taiwan|https://images.unsplash.com/photo-1545579133-99bb5ab189bd?w=800&h=1200&fit=crop",

    ":::NOTE_PAPER:::Personal note from field researcher:\n\nI spoke with Mr. Wang Teh-chuan today at his home in Lugu. He remembers the exact day in 1975 when he decided to stop selling his tea to the export cooperative. 'They paid me 200 NT per jin regardless of quality,' he said. 'I spent three extra weeks hand-processing my spring harvest that year. The cooperative offered the same 200 NT. That was the last time I sold to them.' Wang began selling directly to a small tea shop in Taichung. Within two years, his Dong Ding commanded ten times the cooperative price.",

    ":::IMG_POLAROID_SCATTER:::Wang family tea garden, Lugu, 1982|https://images.unsplash.com/photo-1582793988951-9aed5509eb97?w=800&h=1200&fit=crop|https://images.unsplash.com/photo-1556881286-fc6915169721?w=800&h=1200&fit=crop",

    ":::TEXT_SINGLE_COL:::The competition system proved to be the catalyst that accelerated everything. In 1976, the Lugu Farmers' Association organized Taiwan's first formal tea competition. Farmers submitted their best lots anonymously. Judges evaluated aroma, liquor color, taste, and aftertaste using a standardized protocol. Winners received certificates and the right to sell their tea at premium prices.",

    ":::TEXT_SIDEBAR_IMAGE:::The effect was electric. Within three years, competitions spread to every major tea-growing region on the island. Farmers who had spent decades optimizing for yield suddenly pivoted to optimizing for flavor. Ancient processing techniques — slow withering, careful hand-rolling, precise charcoal roasting — were pulled from the brink of extinction. Elders who remembered the old methods found themselves sought after as consultants and teachers.|Competition tea samples|https://images.unsplash.com/photo-1530968033775-2c92736b131e?w=800&h=1200&fit=crop",

    ":::QUOTE_MINIMAL:::We didn't invent anything new. We simply remembered what our grandfathers already knew. — Farmer Lin Zhi-ming, Alishan, 1983",

    ":::IMG_WITH_CAPTION_BOTTOM:::Competition judges evaluating submissions at the 1981 Nantou County tea competition. Over 400 lots were entered that year, up from just 47 in the inaugural 1976 event.|https://images.unsplash.com/photo-1544787219-7f47ccb76574?w=800&h=1200&fit=crop",

    ":::LIST_TIMELINE:::1975|Wang Teh-chuan stops selling to export cooperative, begins direct sales|1976|First Lugu Farmers' Association tea competition held with 47 entries|1978|Competition system spreads to Pinglin, Muzha, and Alishan|1980|First dedicated tea art studios open in Taipei; 'tea culture' enters popular vocabulary|1982|High Mountain Oolong from Alishan wins blind tasting against Fujian tieguanyin|1984|Government officially recognizes artisanal tea as cultural heritage category|1986|Taiwan tea prices surpass Japanese sencha for first time on per-gram basis|1988|International buyers begin sourcing directly from Taiwan competition winners",

    ":::TEXT_SIDEBAR_RIGHT:::The Chayi Movement|Running parallel to the competition revolution was something more philosophical: the chayi (tea art) movement. Influenced by Japanese chado but deliberately distinct from it, chayi emphasized personal expression over rigid formalism. Practitioners opened intimate tea studios in Taipei's back alleys, curating specific teas with specific teaware, composing atmospheric settings with incense, flowers, and calligraphy.|https://images.unsplash.com/photo-1545579133-99bb5ab189bd?w=800&h=1200&fit=crop",

    ":::TEXT_SINGLE_COL:::The movement gave Taiwanese tea a cultural framework that transcended mere agriculture. Tea became art, philosophy, identity.",

    ":::IMG_VIGNETTE_SOFT:::A chayi practitioner preparing high mountain oolong in her Taipei studio, 1985|https://images.unsplash.com/photo-1597318181409-cf64d0b5d8a2?w=800&h=1200&fit=crop",

    ":::TEXT_DOUBLE_COL:::The Economic Impact|The numbers tell a remarkable story. Between 1975 and 1988, Taiwan's tea export volume actually decreased by nearly 40 percent. Yet the total value of tea sales increased by over 600 percent. The average price per kilogram of premium Taiwanese oolong rose from roughly $8 USD in 1975 to over $120 USD by 1988. Small farmers who had struggled to survive on commodity prices found themselves prosperous.\n\nThe Cultural Legacy|Perhaps more significant was the cultural transformation. Tea drinking shifted from a utilitarian habit to a refined leisure practice. The number of dedicated tea shops in Taipei alone grew from fewer than 30 in 1975 to over 500 by 1988. University students formed tea clubs. Ceramic artists found a booming market for handmade teaware.",

    ":::IMG_FULL_BLEED:::Ceramic teaware from the Taiwan renaissance era|https://images.unsplash.com/photo-1530968033775-2c92736b131e?w=800&h=1200&fit=crop",

    ":::TEXT_SINGLE_COL:::What makes the Taiwan tea renaissance particularly instructive is its organic nature. There was no government master plan, no industry-wide marketing campaign, no single visionary leader. The transformation emerged from thousands of individual decisions — a farmer choosing quality over quantity, an entrepreneur opening a tea studio, a judge refining competition standards.",

    ":::TEXT_JUSTIFIED_NARROW:::The lessons of the 1980s remain relevant today as tea cultures worldwide grapple with similar tensions between commodity production and artisanal craft. Taiwan proved that the path to prosperity runs not through volume but through excellence — not through anonymity but through identity. Every tea-growing region in the world can look to Taiwan's example and find both inspiration and practical guidance.",

    ":::EPILOGUE_CENTERED:::This report was compiled from interviews conducted between 1979 and 1988 across Taiwan's major tea-producing regions. All photographs are from the private collection of the Taiwan Tea Research Institute unless otherwise noted. The author wishes to thank the families of Lugu, Pinglin, and Alishan who opened their homes and their tea tables during the research period.",

    ":::COPYRIGHT_PAGE:::Taiwan Tea Cultural Archives, 1988\nDocument Reference: TTCA-1988-0314\nClassification: Public Record"
  ],
  author: PEOPLE.chen,
};

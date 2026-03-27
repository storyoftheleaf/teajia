import { ContentType } from '../../types';
import { ReadableStory } from '../../types/read';
import { PEOPLE } from '../people';

export const longFormInterview: ReadableStory = {
  id: 'template-interview',
  type: ContentType.Article,
  status: 'published',
  title: 'A Conversation with Master Lin',
  subtitle: 'The Yixing Potter',
  thumbnailUrl: 'https://images.unsplash.com/photo-1610701596007-11502861dcfa?w=800&h=1200&fit=crop',
  durationOrTime: '20 Pages',
  origin: 'In-house',
  description: 'Sixty years of clay and fire — the Yixing master on craft, patience, and the pots that remember.',
  tags: ['Pottery', 'Teaware', 'Philosophy'],
  content: [
    ":::COVER_PHOTO_INSET:::A Conversation with Master Lin|The Yixing Potter|https://images.unsplash.com/photo-1530968033775-2c92736b131e?w=800&h=1200&fit=crop",

    ":::TEXT_SINGLE_COL:::Master Lin's studio sits at the end of a dirt road on the outskirts of Dingshu, the pottery town that has been the center of Yixing purple clay teaware production for over five hundred years. The building is unremarkable from outside — a single-story concrete structure with a corrugated metal roof, indistinguishable from the dozens of small workshops that line the roads of this district.",

    ":::TEXT_SIDEBAR_IMAGE:::Inside, the air smells of damp earth and wood shavings. The walls are lined with wooden shelves holding hundreds of teapots in various stages of completion — some raw, some bisque-fired, some finished and gleaming with the deep, plummy luster that marks authentic zisha clay. Lin sits at a low workbench near the window, his hands wrapped around a cup of aged sheng puer. He is seventy-three years old, has been making teapots since the age of fourteen, and is recognized by the Chinese government as a Provincial-Level Master of Traditional Craft.|Master Lin's workshop|https://images.unsplash.com/photo-1530968033775-2c92736b131e?w=800&h=1200&fit=crop",

    ":::MAGAZINE_INTERVIEW_Q_A:::Chen Wei|You come from a family of potters. How far back does the lineage go?|Master Lin|My grandfather's grandfather was already established in Dingshu by the mid-Qing dynasty — so perhaps seven or eight generations. But I want to be honest about this. The unbroken lineage narrative is partly mythology. There were disruptions. My grandfather's kiln was destroyed during the Japanese occupation. My father was sent to a collective workshop during the Cultural Revolution.",

    ":::IMG_FULL_BLEED:::Rows of Yixing teapots in various stages of completion|https://images.unsplash.com/photo-1594631252845-29fc4cc8cde9?w=800&h=1200&fit=crop",

    ":::TEXT_CENTER_NARROW:::What survived was not technique — technique can be relearned from observation and practice. What survived was an attitude toward the clay. A way of listening to the material rather than imposing your will on it. That is the inheritance I received, and it cannot be written in a manual or taught in a school.",

    ":::IMG_SPLIT_VERTICAL:::Left: Lin's hands shaping a spout. Right: Shelves of finished work awaiting selection.|https://images.unsplash.com/photo-1610701596007-11502861dcfa?w=800&h=1200&fit=crop|https://images.unsplash.com/photo-1530968033775-2c92736b131e?w=800&h=1200&fit=crop",

    ":::MAGAZINE_INTERVIEW_Q_A:::Chen Wei|Describe your relationship with the clay itself. You've said before that you only use locally dug zisha. Why is that so important?|Master Lin|Zisha — purple sand clay — is not one material but a family of materials. The deposits around Yixing contain at least three major types: zini, the classic purple-brown; duanni, the pale golden variety; and zhuni, the rare vermillion clay. The clay I use comes from a deposit that my family has dug for generations. I know this clay the way a vintner knows their vineyard.",

    ":::QUOTE_BIG:::A teapot is not a container. It is a relationship between earth and water, mediated by fire and shaped by hand. Remove any element and you have an object. Include all four and you have something alive. — Master Lin",

    ":::TEXT_DOUBLE_COL:::The Workshop|Lin's working method is deliberately anachronistic. While many contemporary Yixing potters use plaster molds, electric wheels, and machine-mixed clay, Lin works entirely by hand using tools that his grandfather would recognize — bamboo paddles, wooden ribs, horn scrapers. A single teapot takes him three to five days to complete. His annual output is between forty and sixty pieces.\n\nThe Market|The economics of Yixing pottery have been transformed by a speculative market that treats master-crafted teapots as investment vehicles. Pots by nationally recognized masters can sell for six-figure sums. Lin views this with ambivalence. 'The money has brought attention to the craft. But it has also created incentives for fraud — fake clay, forged seals, ghost-made pots attributed to famous names.'",

    ":::IMG_CIRCLE_MASK:::Portrait of Master Lin at his workbench|https://images.unsplash.com/photo-1578365746405-da4f83b81b3b?w=800&h=1200&fit=crop",

    ":::MAGAZINE_INTERVIEW_Q_A:::Chen Wei|You mentioned ghost-made pots. Can you explain that practice?|Master Lin|It is the worst-kept secret in Yixing. A famous master cannot possibly meet the demand for their work through their own hands alone. So they employ assistants to make pots in their style, which the master then finishes, signs, and sells as their own. I have always refused. When you buy a pot with my seal, every mark on it was made by my hands. This is my promise.",

    ":::IMG_FULL_BLEED:::A row of finished zisha teapots catching afternoon light|https://images.unsplash.com/photo-1594631252845-29fc4cc8cde9?w=800&h=1200&fit=crop",

    ":::MAGAZINE_INTERVIEW_Q_A:::Chen Wei|How do you think about innovation within a traditional craft?|Master Lin|This question assumes that tradition and innovation are opposites. They are not. Tradition is a river, not a wall. It flows. It changes course. The classic Yixing forms were themselves innovations when they were first created. Someone looked at the existing vocabulary and added a new word.",

    ":::TEXT_CENTER_NARROW:::The narrow path between — where you understand the rules so deeply that you can break them meaningfully — that is where the interesting work happens. I have spent sixty years learning the rules. Only in the last ten have I felt qualified to break them.",

    ":::IMG_WITH_CAPTION_BOTTOM:::Lin's recent experimental forms — traditional clay, contemporary vision|https://images.unsplash.com/photo-1530968033775-2c92736b131e?w=800&h=1200&fit=crop",

    ":::TEXT_SIDEBAR_LEFT:::On Seasoning|One of the most discussed aspects of Yixing teaware is the concept of seasoning — yanghu in Chinese, literally 'nourishing the pot.' Because zisha clay is porous, it absorbs the oils and compounds from each brewing. Over years of use, the pot develops a patina. Lin is categorical: 'One pot, one tea. Never brew different types of tea in the same pot. The clay will become confused. I have pots that have brewed nothing but aged puer for thirty years. Pour plain hot water into them and the water comes out tasting of tea. That is a pot that has achieved its purpose.'|https://images.unsplash.com/photo-1594631252845-29fc4cc8cde9?w=800&h=1200&fit=crop",

    ":::IMG_FILM_STRIP_VERTICAL:::The making process: slab preparation, body forming, spout attachment, lid fitting|https://images.unsplash.com/photo-1530968033775-2c92736b131e?w=800&h=1200&fit=crop|https://images.unsplash.com/photo-1587825140708-dfaf72ae4b04?w=800&h=1200&fit=crop|https://images.unsplash.com/photo-1594631252845-29fc4cc8cde9?w=800&h=1200&fit=crop|https://images.unsplash.com/photo-1530968033775-2c92736b131e?w=800&h=1200&fit=crop",

    ":::TEXT_SINGLE_COL:::As the afternoon light shifts in Lin's studio, he returns to his workbench and resumes work on a pot he started that morning — a small, round-bodied piece intended for Dancong oolong. He works in silence, his hands moving with a precision that looks effortless but represents six decades of motor learning.",

    ":::TEXT_JUSTIFIED_NARROW:::The bamboo paddle strikes the clay slab with a rhythm that is almost musical — tap, rotate, tap, rotate — gradually curving the flat sheet into a cylinder. He joins the edges with a slip of liquid clay, smoothing the seam with his thumb until it vanishes. Then he begins the compression, tapping the walls thinner and thinner, coaxing the cylinder into a sphere. The clay responds to his touch like a living thing. Watching his hands, I understand what he means about listening to the material.",

    ":::MAGAZINE_INTERVIEW_Q_A:::Chen Wei|What advice would you give to a young person who wants to pursue Yixing pottery seriously?|Master Lin|First, learn to dig clay. Before you touch a tool, go to the mines and understand where the material comes from. Second, find a teacher who will let you fail. My grandfather made me throw away my first two years of work. He said: 'Those pots were made by your ambition. When you can make a pot with your patience, you will know.' Third, use your own pots. Brew tea in them every day. Live with their flaws.",

    ":::IMG_ARCH_MASK:::Master Lin's personal collection of seasoned pots, some over thirty years old|https://images.unsplash.com/photo-1594631252845-29fc4cc8cde9?w=800&h=1200&fit=crop",

    ":::QUOTE_BIG:::When you can make a pot with your patience, you will know.",

    ":::TEXT_SINGLE_COL:::We leave Lin's studio as the sun drops behind the kiln chimneys of Dingshu. He does not say goodbye. He says: 'Come back in spring. The clay dug after the New Year rains is the best. I will show you.' It is an invitation, but also a statement of continuity. Spring will come. The rains will fall. The clay will be dug. The pots will be made.",

    ":::EPILOGUE_CENTERED:::A master's hands speak\na language older than words.\nClay remembers everything.",

    ":::COPYRIGHT_PAGE:::Interview conducted by Chen Wei\nPhotography by Teajia Studios\nWith gratitude to Master Lin\nfor opening his workshop and his mind.\n\nTeajia Magazine"
  ],
  author: PEOPLE.chen,
  interviewee: PEOPLE.lin,
};

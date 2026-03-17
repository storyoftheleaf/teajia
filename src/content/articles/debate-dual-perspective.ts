import { ContentType } from '../../types';
import { ReadableStory } from '../../types/read';
import { PEOPLE } from '../people';

export const debateDualPerspective: ReadableStory = {
  id: 'template-debate',
  type: ContentType.Article,
  status: 'published',
  title: 'Debate / Dual Perspective',
  subtitle: 'East Meets West',
  thumbnailUrl: 'https://picsum.photos/800/1200?random=ddp001',
  durationOrTime: '26 Pages',
  origin: 'In-house',
  description: 'A split-screen dialogue format presenting two contrasting perspectives on tea culture side by side.',
  tags: ['Philosophy', 'Ceremony', 'Culture'],
  content: [
    ":::COVER_MINIMAL:::Dual|Perspectives",

    ":::TEXT_DOUBLE_COL:::Master Zhou Yu — Eastern Tradition|I was born into tea. My earliest memory is the scent of charcoal and roasting leaves in my grandfather's workshop in the Wuyi Mountains. Before I could read, I could identify Da Hong Pao by its aroma alone. Tea was never a choice for me — it was the language of my family, our livelihood, our spiritual practice, and our connection to every generation that came before us. When I sit down to brew, I am not merely preparing a beverage. I am continuing a conversation that began centuries ago between this mountain, this water, and the hands that shaped the leaves. Every session is a small act of devotion, a prayer offered through steam and fragrance.\n\nDr. Sarah Jenkins — Western Approach|I came to tea through academia. My doctoral research at Oxford focused on the anthropology of ritual spaces, and tea houses kept appearing in my fieldwork across East Asia. I was a coffee drinker — embarrassingly devoted to espresso — until a research trip to Kyoto in 2009 changed everything. A tea master served me a bowl of matcha in a room so quiet I could hear my own heartbeat. That silence, that deliberate attention to every gesture, rewired something in my understanding of what a beverage could mean. I have spent the last fifteen years trying to bridge the gap between scholarly analysis and lived experience, between measuring and feeling.",

    ":::IMG_SPLIT_VERTICAL:::Two traditions, one leaf — the convergence of Eastern intuition and Western inquiry|https://picsum.photos/800/1200?random=ddp002",

    ":::CHAPTER_SPLIT:::On|Water",

    ":::TEXT_SIDEBAR_RIGHT:::Zhou's Water Philosophy|In the Chajing, Lu Yu ranked water sources: mountain spring first, river water second, well water last. But rankings miss the point. Water is not a variable to optimize — it is a partner in dialogue. I collect water from three springs near my workshop, each at a different elevation. The spring at eight hundred meters produces water with a softness that opens high-fired oolongs beautifully. The lower spring has more mineral content and suits aged puerh. I do not analyze the mineral parts per million. I taste. I listen to the kettle. When the bubbles sound like wind through pine trees — what we call songfeng — the temperature is right for oolong. This is not mysticism. It is a refined empiricism that operates through senses Western science has not yet learned to measure.|https://picsum.photos/600/800?random=ddp003",

    ":::TEXT_SIDEBAR_LEFT:::Sarah's Water Science|I appreciate Zhou's poetic language, but I also think precision has its place. My research with the Tea Research Institute in Hangzhou showed that water with a TDS between 50 and 150 parts per million consistently produced higher ratings in blind tastings across all tea categories. Soft water under-extracts; hard water introduces off-flavors. I use a simple TDS meter and a temperature-controlled kettle. This is not because I lack respect for tradition — it is because I want to isolate variables. When I can control water quality, I can better appreciate the tea itself. That said, Zhou taught me something important: the sound of the kettle does correlate with temperature stages. Physics and poetry are describing the same phenomenon from different angles.|https://picsum.photos/600/800?random=ddp004",

    ":::TEXT_DOUBLE_COL:::Zhou|Sarah, you measure what I feel. There is no conflict. But I worry that your students will learn to trust their instruments more than their senses. A thermometer cannot tell you when the water is alive — when it has the right energy for the tea you are about to brew. There is a quality beyond temperature.\n\nSarah|And I worry that without measurement, knowledge becomes inaccessible. If only those born into tea families can learn to hear the songfeng, then the tradition dies with its last hereditary practitioners. My instruments are democratizing tools. They lower the barrier to entry.\n\nZhou|But they also lower the ceiling. The student who relies on a thermometer will never develop the sensitivity to notice when the same water, at the same temperature, behaves differently because of humidity, altitude, or the energy of the people in the room.\n\nSarah|You are asking me to accept variables I cannot measure. That is a significant epistemological leap.",

    ":::TEXT_BLOCKQUOTE_CENTER:::The question is not whether to measure or to feel — it is whether we have the courage to do both simultaneously, holding precision and intuition in the same hand.",

    ":::CHAPTER_SPLIT:::The|Vessel",

    ":::IMG_SPLIT_VERTICAL:::Left: Zhou's seasoned Yixing collection, each pot dedicated to a single tea for decades. Right: Sarah's porcelain gaiwans, pristine and neutral|https://picsum.photos/800/1200?random=ddp005",

    ":::TEXT_DOUBLE_COL:::Zhou|My oldest Yixing pot is one hundred and forty years old. It belonged to my great-grandfather. The clay has absorbed thousands of sessions of Da Hong Pao. When I pour plain hot water through it, the water comes out tasting of tea. Some would call this contamination. I call it memory. The pot has become a participant in the brewing — it contributes its own voice to the conversation. Each session adds another layer, another whisper of history. To brew in this pot is to taste not just today's tea but every session that came before. This is what I mean when I say the vessel and the tea are married.\n\nSarah|I understand the romance of that idea, and I respect the material science behind it — Yixing zisha clay is genuinely porous and does absorb volatile compounds over time. But as an evaluator, I need neutrality. When I assess a tea, I use white porcelain specifically because it contributes nothing. I want to taste the leaf, the water, the processing — not a century of accumulated residue. For professional cupping, the International Organization for Standardization specifies white porcelain for exactly this reason. The vessel should be transparent, invisible.",

    ":::TEXT_ASYMMETRIC_LEFT:::Zhou responds with characteristic directness: 'You speak of transparency as though it were a virtue. But no vessel is truly transparent. Your porcelain was fired in a kiln that imparted its own character. The glaze contains minerals that interact with hot water. The shape of the gaiwan directs the pour in ways that affect extraction. You have simply chosen to ignore the vessel's influence rather than embrace it. My Yixing pot is honest about its participation.'",

    ":::TEXT_ASYMMETRIC_RIGHT:::Sarah pauses before answering. 'That is a fair point. Complete neutrality is an aspiration, not a reality. But there is a spectrum between a vessel that minimally influences and one that fundamentally transforms. Your pot adds flavor compounds that were not in the original leaf. That is a different category of influence than the subtle mineral exchange of a porcelain glaze. I am not arguing against Yixing — I own several myself, for personal enjoyment. I am arguing for context. There is a time for the married pot and a time for the neutral vessel.'",

    ":::CHAPTER_SPLIT:::Time &|Patience",

    ":::TEXT_SIDEBAR_RIGHT:::The Gongfu Approach|Zhou demonstrates his method: five grams of aged Shui Xian in his great-grandfather's pot. The first infusion lasts eight seconds. He pours it out — the wash. The second infusion: ten seconds. The liquor is amber and clear. He pours for Sarah and himself. 'In gongfu brewing, we do not extract the tea all at once. We court it. Each infusion reveals a different facet — the first is bright and mineral, the second deeper and more fruity, the fifth or sixth reveals the roasted grain notes hiding underneath. A single session can last two hours and yield fifteen infusions. The tea tells you its story at its own pace. You cannot rush it.'|https://picsum.photos/600/800?random=ddp006",

    ":::TEXT_SIDEBAR_LEFT:::The Western Variation|Sarah prepares the same tea in her porcelain gaiwan, Western style: three grams in two hundred milliliters, steeped for three minutes. The result is a single cup with a broader, more blended flavor profile. 'This method asks the tea to reveal everything at once. It is less nuanced than gongfu, I admit, but it is also more accessible. Most people in the world drink tea this way — a single steeping, a single cup. I do not think we should dismiss this approach as inferior. It is simply different. And frankly, some teas — particularly those designed for the Western market — are processed to perform best under these conditions.'|https://picsum.photos/600/800?random=ddp007",

    ":::QUOTE_BIG:::Patience is not waiting. Patience is paying attention to what is already happening.",

    ":::TEXT_DOUBLE_COL:::Zhou|When you steep for three minutes, you are asking the tea to shout. Gongfu asks it to whisper. In the whisper you hear things the shout obscures — the terroir, the hand of the maker, the weather of the harvest day. These subtleties matter. They are what separates tea from mere hydration.\n\nSarah|I do not disagree about subtlety. But I want to push back on the hierarchy implicit in your framing. You are suggesting that gongfu is inherently superior, that the whisper is always more valuable than the shout. A builder does not always need a scalpel. Sometimes a hammer is the right tool. A robust breakfast tea steeped strong with milk has brought comfort to billions of people. That experience has its own dignity.\n\nZhou|I do not dismiss it. I simply observe that it is a different relationship with the leaf. The British Empire built its tea culture on speed and volume — the opposite of what tea was in its homeland.\n\nSarah|And yet that culture produced its own rituals, its own art forms, its own moments of genuine connection. The afternoon tea ceremony in England is no less meaningful to its practitioners than gongfu cha is to yours.",

    ":::IMG_DIAGONAL_SPLIT:::The meeting point — where tradition and innovation share the same table|https://picsum.photos/800/1200?random=ddp008",

    ":::CHAPTER_SPLIT:::Ritual &|Meaning",

    ":::TEXT_DOUBLE_COL:::Zhou|Every movement in gongfu cha has a purpose that extends beyond the practical. The way I warm the cups is not just about temperature — it is about preparation, about creating the conditions for attention. The way I pour is not just about extraction — it is about respect for the leaf, for the water, for the person I am serving. In Zen Buddhism, we say that the way you do one thing is the way you do everything. Tea ceremony is a practice ground for living with intention.\n\nSarah|I find that compelling, and my fieldwork in Kyoto reinforced it. The Japanese tea ceremony — chanoyu — takes this even further, encoding an entire ethical and aesthetic philosophy into the preparation of a single bowl of matcha. But I have also observed something important in my Western tea communities: ritual emerges naturally wherever people gather around tea, even without formal tradition. A mother making her daughter's favorite blend in a particular mug every Sunday morning. A group of friends who meet weekly at the same tea shop. These informal rituals carry meaning that is no less profound for being spontaneous.",

    ":::TEXT_ASYMMETRIC_LEFT:::Zhou considers this for a long moment. 'You are right that ritual does not require formality. My grandmother's tea preparation was the most beautiful I have ever witnessed, and she followed no codified form. She simply paid complete attention to every step. Perhaps what matters is not the structure of the ritual but the quality of presence within it.'",

    ":::TEXT_ASYMMETRIC_RIGHT:::Sarah smiles. 'Now we are finding common ground. The question is not East versus West, traditional versus modern, formal versus informal. The question is: are you fully present with your tea? Are you paying attention? Because attention — genuine, unhurried attention — transforms any method, any vessel, any water into something approaching ceremony.'",

    ":::QUOTE_BIG:::Where there is attention, there is ceremony. Where there is ceremony, there is meaning. Where there is meaning, there is tea.",

    ":::EPILOGUE_CENTERED:::This conversation took place over the course of an afternoon in Zhou's workshop in the Wuyi Mountains, Fujian Province. Eight different teas were consumed. No consensus was reached, which both participants agreed was exactly the point. The dialogue continues — as all good tea conversations must — in the next cup.",

    ":::COPYRIGHT_PAGE:::Conversation between Master Zhou Yu & Dr. Sarah Jenkins\nModerated and edited by Chen Wei\nPhotography by Li Jun\nTeajia Journal"
  ],
  author: PEOPLE.chen,
  interviewee: PEOPLE.zhou,
};

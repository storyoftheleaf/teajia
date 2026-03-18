import { ContentType } from '../../types';
import { ReadableStory } from '../../types/read';
import { PEOPLE } from '../people';

export const debateDualPerspective: ReadableStory = {
  id: 'template-debate',
  type: ContentType.Article,
  status: 'published',
  title: 'Debate / Dual Perspective',
  subtitle: 'East Meets West',
  thumbnailUrl: 'https://images.unsplash.com/photo-1545579133-99bb5ab189bd?w=800&h=1200&fit=crop',
  durationOrTime: '26 Pages',
  origin: 'In-house',
  description: 'A split-screen dialogue format presenting two contrasting perspectives on tea culture side by side.',
  tags: ['Philosophy', 'Ceremony', 'Culture'],
  content: [
    ":::COVER_MINIMAL:::Dual|Perspectives",

    ":::TEXT_DOUBLE_COL:::Master Zhou Yu — Eastern Tradition|I was born into tea. My earliest memory is the scent of charcoal and roasting leaves in my grandfather's workshop in the Wuyi Mountains. Before I could read, I could identify Da Hong Pao by its aroma alone. Tea was never a choice for me — it was the language of my family, our livelihood, our spiritual practice, and our connection to every generation that came before us.\n\nDr. Sarah Jenkins — Western Approach|I came to tea through academia. My doctoral research at Oxford focused on the anthropology of ritual spaces, and tea houses kept appearing in my fieldwork across East Asia. I was a coffee drinker — embarrassingly devoted to espresso — until a research trip to Kyoto in 2009 changed everything. A tea master served me a bowl of matcha in a room so quiet I could hear my own heartbeat.",

    ":::IMG_SPLIT_VERTICAL:::Two traditions, one leaf — the convergence of Eastern intuition and Western inquiry|https://images.unsplash.com/photo-1545579133-99bb5ab189bd?w=800&h=1200&fit=crop|https://images.unsplash.com/photo-1515823064-d6e0c04616a7?w=800&h=1200&fit=crop",

    ":::CHAPTER_SPLIT:::On|Water",

    ":::TEXT_SIDEBAR_RIGHT:::Zhou's Water Philosophy|In the Chajing, Lu Yu ranked water sources: mountain spring first, river water second, well water last. But rankings miss the point. Water is not a variable to optimize — it is a partner in dialogue. I collect water from three springs near my workshop, each at a different elevation. The spring at eight hundred meters produces water with a softness that opens high-fired oolongs beautifully. I do not analyze the mineral parts per million. I taste. I listen to the kettle.|https://images.unsplash.com/photo-1571934811356-5cc061b6821f?w=800&h=1200&fit=crop",

    ":::TEXT_SIDEBAR_LEFT:::Sarah's Water Science|I appreciate Zhou's poetic language, but I also think precision has its place. My research with the Tea Research Institute in Hangzhou showed that water with a TDS between 50 and 150 parts per million consistently produced higher ratings in blind tastings across all tea categories. I use a simple TDS meter and a temperature-controlled kettle. This is not because I lack respect for tradition — it is because I want to isolate variables. That said, Zhou taught me something important: the sound of the kettle does correlate with temperature stages.|https://images.unsplash.com/photo-1571934811356-5cc061b6821f?w=800&h=1200&fit=crop",

    ":::TEXT_DOUBLE_COL:::Zhou|Sarah, you measure what I feel. There is no conflict. But I worry that your students will learn to trust their instruments more than their senses. A thermometer cannot tell you when the water is alive.\n\nSarah|And I worry that without measurement, knowledge becomes inaccessible. If only those born into tea families can learn to hear the songfeng, then the tradition dies with its last hereditary practitioners. My instruments are democratizing tools.",

    ":::IMG_FULL_BLEED:::Water at the songfeng stage — when the bubbles sound like wind through pines|https://images.unsplash.com/photo-1571934811356-5cc061b6821f?w=800&h=1200&fit=crop",

    ":::TEXT_DOUBLE_COL:::Zhou|But they also lower the ceiling. The student who relies on a thermometer will never develop the sensitivity to notice when the same water, at the same temperature, behaves differently because of humidity, altitude, or the energy of the people in the room.\n\nSarah|You are asking me to accept variables I cannot measure. That is a significant epistemological leap.",

    ":::TEXT_BLOCKQUOTE_CENTER:::The question is not whether to measure or to feel — it is whether we have the courage to do both simultaneously, holding precision and intuition in the same hand.",

    ":::CHAPTER_SPLIT:::The|Vessel",

    ":::IMG_SPLIT_VERTICAL:::Left: Zhou's seasoned Yixing collection, each pot dedicated to a single tea for decades. Right: Sarah's porcelain gaiwans, pristine and neutral|https://images.unsplash.com/photo-1594631252845-29fc4cc8cde9?w=800&h=1200&fit=crop|https://images.unsplash.com/photo-1530968033775-2c92736b131e?w=800&h=1200&fit=crop",

    ":::TEXT_DOUBLE_COL:::Zhou|My oldest Yixing pot is one hundred and forty years old. It belonged to my great-grandfather. The clay has absorbed thousands of sessions of Da Hong Pao. When I pour plain hot water through it, the water comes out tasting of tea. The pot has become a participant in the brewing — it contributes its own voice to the conversation.\n\nSarah|I understand the romance of that idea, and I respect the material science behind it — Yixing zisha clay is genuinely porous and does absorb volatile compounds over time. But as an evaluator, I need neutrality. When I assess a tea, I use white porcelain specifically because it contributes nothing. The vessel should be transparent, invisible.",

    ":::TEXT_ASYMMETRIC_LEFT:::Zhou responds with characteristic directness: 'You speak of transparency as though it were a virtue. But no vessel is truly transparent. Your porcelain was fired in a kiln that imparted its own character. The glaze contains minerals that interact with hot water. You have simply chosen to ignore the vessel's influence rather than embrace it. My Yixing pot is honest about its participation.'",

    ":::TEXT_ASYMMETRIC_RIGHT:::Sarah pauses before answering. 'That is a fair point. Complete neutrality is an aspiration, not a reality. But there is a spectrum between a vessel that minimally influences and one that fundamentally transforms. I am not arguing against Yixing — I own several myself, for personal enjoyment. I am arguing for context.'",

    ":::CHAPTER_SPLIT:::Time &|Patience",

    ":::IMG_FULL_BLEED:::The gongfu setup — small vessel, many steeps, infinite patience|https://images.unsplash.com/photo-1594631252845-29fc4cc8cde9?w=800&h=1200&fit=crop",

    ":::TEXT_SIDEBAR_RIGHT:::The Gongfu Approach|Zhou demonstrates his method: five grams of aged Shui Xian in his great-grandfather's pot. The first infusion lasts eight seconds. He pours it out — the wash. The second infusion: ten seconds. 'In gongfu brewing, we do not extract the tea all at once. We court it. Each infusion reveals a different facet. A single session can last two hours and yield fifteen infusions. The tea tells you its story at its own pace.'|https://images.unsplash.com/photo-1544787219-7f47ccb76574?w=800&h=1200&fit=crop",

    ":::TEXT_SIDEBAR_LEFT:::The Western Variation|Sarah prepares the same tea in her porcelain gaiwan, Western style: three grams in two hundred milliliters, steeped for three minutes. 'This method asks the tea to reveal everything at once. It is less nuanced than gongfu, I admit, but it is also more accessible. Most people in the world drink tea this way — a single steeping, a single cup. I do not think we should dismiss this approach as inferior.'|https://images.unsplash.com/photo-1597318181409-cf64d0b5d8a2?w=800&h=1200&fit=crop",

    ":::QUOTE_BIG:::Patience is not waiting. Patience is paying attention to what is already happening.",

    ":::TEXT_DOUBLE_COL:::Zhou|When you steep for three minutes, you are asking the tea to shout. Gongfu asks it to whisper. In the whisper you hear things the shout obscures — the terroir, the hand of the maker, the weather of the harvest day.\n\nSarah|I do not disagree about subtlety. But I want to push back on the hierarchy implicit in your framing. A robust breakfast tea steeped strong with milk has brought comfort to billions of people. That experience has its own dignity.",

    ":::IMG_WITH_CAPTION_BOTTOM:::Two approaches to the same leaf — different methods, shared reverence|https://images.unsplash.com/photo-1544787219-7f47ccb76574?w=800&h=1200&fit=crop",

    ":::TEXT_DOUBLE_COL:::Zhou|I do not dismiss it. I simply observe that it is a different relationship with the leaf. The British Empire built its tea culture on speed and volume — the opposite of what tea was in its homeland.\n\nSarah|And yet that culture produced its own rituals, its own art forms, its own moments of genuine connection. The afternoon tea ceremony in England is no less meaningful to its practitioners than gongfu cha is to yours.",

    ":::IMG_DIAGONAL_SPLIT:::The meeting point — where tradition and innovation share the same table|https://images.unsplash.com/photo-1545579133-99bb5ab189bd?w=800&h=1200&fit=crop",

    ":::CHAPTER_SPLIT:::Ritual &|Meaning",

    ":::TEXT_DOUBLE_COL:::Zhou|Every movement in gongfu cha has a purpose that extends beyond the practical. The way I warm the cups is not just about temperature — it is about preparation, about creating the conditions for attention. The way I pour is not just about extraction — it is about respect for the leaf, for the water, for the person I am serving.\n\nSarah|I find that compelling. But I have also observed something important in my Western tea communities: ritual emerges naturally wherever people gather around tea, even without formal tradition. A mother making her daughter's favorite blend in a particular mug every Sunday morning. These informal rituals carry meaning that is no less profound for being spontaneous.",

    ":::TEXT_ASYMMETRIC_LEFT:::Zhou considers this for a long moment. 'You are right that ritual does not require formality. My grandmother's tea preparation was the most beautiful I have ever witnessed, and she followed no codified form. She simply paid complete attention to every step. Perhaps what matters is not the structure of the ritual but the quality of presence within it.'",

    ":::TEXT_ASYMMETRIC_RIGHT:::Sarah smiles. 'Now we are finding common ground. The question is not East versus West, traditional versus modern, formal versus informal. The question is: are you fully present with your tea? Are you paying attention? Because attention — genuine, unhurried attention — transforms any method, any vessel, any water into something approaching ceremony.'",

    ":::QUOTE_BIG:::Where there is attention, there is ceremony. Where there is ceremony, there is meaning. Where there is meaning, there is tea.",

    ":::EPILOGUE_CENTERED:::This conversation took place over the course of an afternoon in Zhou's workshop in the Wuyi Mountains, Fujian Province. Eight different teas were consumed. No consensus was reached, which both participants agreed was exactly the point. The dialogue continues — as all good tea conversations must — in the next cup.",

    ":::COPYRIGHT_PAGE:::Conversation between Master Zhou Yu & Dr. Sarah Jenkins\nModerated and edited by Chen Wei\nPhotography by Li Jun\nTeajia Journal"
  ],
  author: PEOPLE.chen,
  interviewee: PEOPLE.zhou,
};

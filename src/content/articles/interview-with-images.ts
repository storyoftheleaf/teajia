import { ContentType } from '../../types';
import { ReadableStory } from '../../types/read';
import { PEOPLE } from '../people';

export const interviewWithImages: ReadableStory = {
  id: 'template-interview-images',
  type: ContentType.Article,
  status: 'vault',
  title: 'Interview with Images',
  subtitle: 'The Tea Farmer',
  thumbnailUrl: 'https://images.unsplash.com/photo-1587049352846-4a222e784d38?w=800&h=1200&fit=crop',
  durationOrTime: '16 Pages',
  origin: 'In-house',
  description: 'A portrait-driven interview blending environmental photography with intimate Q&A about life in the tea fields.',
  tags: ['Culture', 'Sourcing'],
  category: 'interview',
  content: [
    ":::COVER_PHOTO_INSET:::Interview with Images|Master Zhou Yu — Life in the Wuyi Mountains|https://images.unsplash.com/photo-1587049352846-4a222e784d38?w=800&h=1200&fit=crop",

    ":::TEXT_SINGLE_COL:::We arrived at Zhou Yu's workshop in the Wuyi Mountains on a morning so misty that the famous rock formations were invisible until we were standing beneath them. The workshop sits at the base of a cliff in the Zhengyan — the 'correct rock' zone that produces the most prized Yan Cha.",

    ":::TEXT_SIDEBAR_IMAGE:::Zhou met us at the gate wearing the same clothes he wears every day: a faded blue cotton jacket, canvas pants stained with charcoal dust, and rubber-soled shoes that grip the steep stone paths between his garden terraces. He is sixty-three years old and has been making tea in this exact location for forty-one years. Before him, his father worked these same gardens for thirty-five years. Before that, his grandfather.|Zhou's mountain workshop|https://images.unsplash.com/photo-1587049352846-4a222e784d38?w=800&h=1200&fit=crop",

    ":::MAGAZINE_INTERVIEW_Q_A:::Chen|Master Zhou, can you describe a typical day during the spring harvest?\n\nZhou|There is no typical day. Every day the mountain gives different conditions and I must respond. But I will describe yesterday. I wake at four-thirty. Before light. I make tea for myself — last year's Rou Gui, the one from the high terrace. I drink three cups standing in the doorway, listening to the mountain. By five-fifteen I can see well enough to walk the garden.",

    ":::IMG_FULL_BLEED:::Zhou's morning walk through the Zhengyan terraces — ancient tea bushes growing from cracks in the cliff face|https://images.unsplash.com/photo-1587049352846-4a222e784d38?w=800&h=1200&fit=crop",

    ":::MAGAZINE_INTERVIEW_Q_A:::Chen|What do you look for in the morning inspection?\n\nZhou|Three things. First, the dew — how heavy is it, and is it clean dew or does it carry dust from the road? Second, the leaf color — has it changed overnight? The buds should be a lighter green than the mature leaves, and the contrast should be sharp. Third, the feel. I roll a bud between my fingers. If it squeaks slightly and springs back, it is ready.",

    ":::MAGAZINE_INTERVIEW_Q_A:::Chen|Your teas are known for their particularly strong yan yun — the rock character. What creates that quality?\n\nZhou|People always want a simple answer. They want me to say 'the minerals in the rock' or 'the microclimate of the gorge.' These things matter, but they are not the full answer. Yan yun is the sum of everything — the rock, the age of the bushes, the specific cultivar, the water that seeps through the cliff face over centuries before reaching the roots.",

    ":::IMG_WITH_CAPTION_BOTTOM:::Morning mist in the Zhengyan gorge — where rock character begins|https://images.unsplash.com/photo-1587049352846-4a222e784d38?w=800&h=1200&fit=crop",

    ":::TEXT_CENTER_NARROW:::The rock gives the potential. The tea maker decides how much of that potential reaches the cup. Processing is everything — withering, oxidation, and above all, roasting. Zhou's Rou Gui receives three rounds of charcoal roasting over a minimum of two months.",

    ":::IMG_SPLIT_VERTICAL:::Left: Zhou's charcoal roasting room, bamboo baskets arranged over smoldering longan charcoal. Right: His weathered hands sorting finished leaves by grade|https://images.unsplash.com/photo-1563911892437-1feda0179e1b?w=800&h=1200&fit=crop|https://images.unsplash.com/photo-1597318181409-cf64d0b5d8a2?w=800&h=1200&fit=crop",

    ":::QUOTE_BIG:::The mountain does not hurry. Why should I? A tea made in haste carries that haste in its flavor. You can taste impatience.",

    ":::TEXT_SIDEBAR_IMAGE:::Zhou pauses our conversation to check on a batch of Shui Xian that has been withering since dawn. He lifts a handful of leaves, brings them close to his face, inhales deeply, then lets them fall back to the tray. 'Another two hours,' he says, and returns to his seat. This kind of interruption happens constantly during our visit. The tea takes priority over everything — conversation, meals, sleep.|Checking the withering leaves|https://images.unsplash.com/photo-1563911892437-1feda0179e1b?w=800&h=1200&fit=crop",

    ":::MAGAZINE_INTERVIEW_Q_A:::Chen|What concerns you about the future of Wuyi tea?\n\nZhou|Many things. The first is price speculation. The market for Zhengyan Yan Cha has become irrational. Some teas sell for prices that bear no relationship to their quality — they are status symbols, not beverages. This creates incentives for fraud.",

    ":::MAGAZINE_INTERVIEW_Q_A:::Chen|And the next generation?\n\nZhou|My son studied computer science in Shanghai. He has no interest in returning to the mountain. I do not blame him — this life is hard, the income is uncertain, and young people want the comforts of the city. But if his generation does not come back, who will tend these gardens? The bushes are alive. They need care. You cannot abandon them for twenty years and then return to find the tea waiting for you.",

    ":::IMG_FULL_BLEED:::The ancient tea gardens of Zhengyan — tended by generations, waiting for the next|https://images.unsplash.com/photo-1556881286-fc6915169721?w=800&h=1200&fit=crop",

    ":::MAGAZINE_INTERVIEW_Q_A:::Chen|Is there hope?\n\nZhou|Some. I see young people from the cities coming to learn. Not my own children, but other people's children. They are idealistic — they want to connect with the land, with tradition. Most leave after one harvest season when they realize the romance is mostly mud and exhaustion. But the ones who stay, they learn quickly, and they bring new ideas.",

    ":::IMG_CIRCLE_MASK:::Zhou's hands — deeply lined, permanently stained by decades of handling charcoal and tea leaves|https://images.unsplash.com/photo-1597318181409-cf64d0b5d8a2?w=800&h=1200&fit=crop",

    ":::MAGAZINE_INTERVIEW_Q_A:::Chen|What is the relationship between you and this mountain?\n\nZhou|[Long pause] It is not a relationship in the way you mean between two people. It is more like... I am part of the mountain. The mountain does not know I am here, not in the way a person knows. But I know the mountain in a way that is deeper than knowledge. I know where the water collects after rain. I know which cliff face catches the morning sun first. I know how the wind moves through the gorge in each season. This knowing is in my body, not my mind.",

    ":::TEXT_DOUBLE_COL:::On Solitude|'People imagine that being a tea farmer is peaceful,' Zhou says as we walk the upper terraces in late afternoon light. 'And there are peaceful moments. But mostly it is worry. Worry about weather, about insects, about market prices. Solitude amplifies worry. There is no one to share the decisions with.'\n\nOn Legacy|'I do not think about legacy in the way journalists want me to,' he continues. 'I think about this year's tea. Is it good? Is it honest? Does it express the mountain? If the answer is yes, then the legacy takes care of itself.'",

    ":::IMG_WITH_CAPTION_BOTTOM:::Evening in the Wuyi Mountains — Zhou's workshop light glowing against the darkening cliff face|https://images.unsplash.com/photo-1587049352846-4a222e784d38?w=800&h=1200&fit=crop",

    ":::TEXT_JUSTIFIED_NARROW:::We left Zhou's workshop the following morning. On the drive to Wuyishan City, we opened a bag of his 2024 Rou Gui — the high-terrace lot he had given us as a parting gift. Even brewed in a hotel room with municipal water, it was extraordinary: deep amber liquor with a cinnabar sweetness, charcoal warmth, and beneath everything, the unmistakable minerality of the Zhengyan cliffs — the taste of the rock that Zhou calls home.",

    ":::EPILOGUE_CENTERED:::Master Zhou Yu continues to produce some of Wuyi's finest Yan Cha from his family workshop in the Zhengyan zone. His teas are available in extremely limited quantities through a small number of trusted vendors. He does not sell online and has no plans to start. 'If the tea is good,' he says, 'people will find it.'",

    ":::COPYRIGHT_PAGE:::Interview by Chen Wei\nPhotography by Li Jun\nTeajia Journal — Voices in Tea"
  ],
  author: PEOPLE.chen,
  interviewee: PEOPLE.zhou,
};

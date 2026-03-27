import { ContentType } from '../../types';
import { ReadableStory } from '../../types/read';
import { PEOPLE } from '../people';

export const originStory: ReadableStory = {
  id: 'template-origin',
  type: ContentType.Article,
  status: 'published',
  title: 'Origin Story',
  subtitle: 'The Creation of Teajia',
  thumbnailUrl: 'https://images.unsplash.com/photo-1545579133-99bb5ab189bd?w=800&h=1200&fit=crop',
  durationOrTime: '16 Pages',
  origin: 'In-house',
  description: 'The founding story of Teajia magazine, told through personal narrative and behind-the-scenes imagery.',
  tags: ['Philosophy', 'Culture', 'Bali'],
  startHere: true,
  content: [
    ":::COVER_MINIMAL:::The Creation of|Teajia",

    ":::TEXT_DROP_CAP:::Teajia began as a frustration. I was sitting in a small tea room in Ubud, Bali, drinking a 1990s sheng puerh that tasted like camphor and dried plums and ancient forests, and I realized that I had no idea how to share this experience with anyone who was not already a tea person. The language did not exist in English — not really. The media did not exist. Wine had its critics, its magazines, its vocabulary that let a novice walk into a shop and communicate desire.",

    ":::TEXT_SIDEBAR_IMAGE:::Coffee had undergone its third-wave revolution, with beautifully designed bags, carefully sourced single-origins, and a culture of transparency that made specialty accessible to anyone willing to pay attention. Tea had none of this. Tea had dusty tins with dragons on them, wellness blogs full of misinformation, and a handful of excellent but deeply niche forums that spoke only to the already converted. There was a vast gulf between the quality of the tea being produced and the quality of the media that represented it. Teajia was born in that gulf.|A quiet tea session in Bali|https://images.unsplash.com/photo-1545579133-99bb5ab189bd?w=800&h=1200&fit=crop",

    ":::TEXT_SINGLE_COL:::The name came first. 'Tea' for the obvious, and 'jia' (家) — the Chinese character meaning home, family, or one who practices. A tea practitioner. A tea family. A tea home. The double meaning felt right, because what I wanted to create was not just a publication but a space — a digital home for people who cared about tea the way others cared about wine or music or architecture.",

    ":::TEXT_JUSTIFIED_NARROW:::A place where a farmer in Wuyi and a barista in Brooklyn could find common ground. Where the science of extraction and the poetry of a quiet morning cup coexisted without contradiction. Where beautiful design served as a bridge between casual curiosity and deep knowledge, rather than a barrier wrapped in exclusivity.",

    ":::IMG_FULL_BLEED:::The original Teajia workspace in Bali — a wooden table overlooking rice paddies|https://images.unsplash.com/photo-1556881286-fc6915169721?w=800&h=1200&fit=crop",

    ":::TEXT_DOUBLE_COL:::The Problem with Tea Media|When I surveyed the landscape of tea content in English, I found three distinct categories, each failing in its own way. First, there were the wellness sites — beautifully designed, heavily Instagrammed, and almost entirely wrong about the science. They told you that white tea had no caffeine, that green tea burned fat, that tea could cure anything from anxiety to cancer. Their aesthetic was aspirational but their content was misinformation dressed in linen.\n\nSecond and Third|Second, there were the enthusiast forums — deeply knowledgeable, fiercely opinionated, and utterly inaccessible to newcomers. The language was insider, the tone was gatekeeping, and the design was an afterthought. Third, there were the vendor blogs — commercial content dressed as education, where every article concluded with a link to buy something.",

    ":::IMG_WITH_CAPTION_BOTTOM:::Tea leaves drying in the afternoon sun|https://images.unsplash.com/photo-1563911892437-1feda0179e1b?w=800&h=1200&fit=crop",

    ":::TEXT_SIDEBAR_IMAGE:::What I could not find, anywhere, was tea media that combined editorial rigor with design excellence. A place that treated tea with the same seriousness and beauty that the best food magazines brought to cuisine. Content that was scientifically accurate without being dry, culturally informed without being appropriative, visually stunning without being vapid, and accessible without being condescending. This was not a gap in the market. It was a gap in the culture.|The vision takes shape|https://images.unsplash.com/photo-1530968033775-2c92736b131e?w=800&h=1200&fit=crop",

    ":::QUOTE_BIG:::I wanted to build the magazine I wished existed when I first fell in love with tea — the one that would have saved me years of confusion and misinformation.",

    ":::IMG_POLAROID_SCATTER:::Early sketches of Teajia's design system|https://images.unsplash.com/photo-1544787219-7f47ccb76574?w=800&h=1200&fit=crop|First prototype of the reading interface|https://images.unsplash.com/photo-1571934811356-5cc061b6821f?w=800&h=1200&fit=crop|Notes from the founding brainstorm session|https://images.unsplash.com/photo-1597318181409-cf64d0b5d8a2?w=800&h=1200&fit=crop",

    ":::TEXT_SINGLE_COL:::The design philosophy emerged from a single conviction: tea content deserved the same visual respect as the tea itself. If a farmer spent decades perfecting the craft of a single oolong, the writing and design that presented that oolong to the world should reflect a comparable level of care.",

    ":::TEXT_JUSTIFIED_NARROW:::This meant rejecting the blog format entirely — the endless scroll, the sidebar clutter, the SEO-optimized headers, the stock photography. Instead, Teajia would adopt the visual language of print magazines and art books, adapted for digital reading. Each article would be designed as a self-contained visual experience, with layout variations that responded to content type. The reading experience itself would be the product, not a wrapper around advertisements.",

    ":::CHAPTER_MINIMAL:::The Bali Principle",

    ":::IMG_FULL_BLEED:::The Bali landscape that inspired Teajia's founding|https://images.unsplash.com/photo-1464982326199-86f32f81b211?w=800&h=1200&fit=crop",

    ":::TEXT_CENTER_NARROW:::There is a concept in Balinese Hinduism called 'Tri Hita Karana' — the three causes of well-being. Harmony with other people. Harmony with nature. Harmony with the spiritual world. I am not Balinese, and I do not practice Hinduism, but this framework resonated deeply with what I felt tea could be.",

    ":::TEXT_SIDEBAR_IMAGE:::Tea connects people — the farmer to the drinker, the host to the guest, the solitary morning practitioner to the centuries of practitioners who came before. Tea connects us to nature — to water, to fire, to the plant itself, to the seasons that shape its character. And tea, at its best, connects us to something interior and contemplative — a quality of attention that the modern world makes increasingly rare. Tri Hita Karana became, informally, the editorial compass of Teajia.|Morning light through tea leaves|https://images.unsplash.com/photo-1587049352846-4a222e784d38?w=800&h=1200&fit=crop",

    ":::IMG_SPLIT_VERTICAL:::The Bali landscape that inspired Teajia's founding|https://images.unsplash.com/photo-1582793988951-9aed5509eb97?w=800&h=1200&fit=crop|https://images.unsplash.com/photo-1545579133-99bb5ab189bd?w=800&h=1200&fit=crop",

    ":::TEXT_SIDEBAR_RIGHT:::Why Digital, Not Print|People asked, repeatedly, why Teajia was not a print magazine. The answer was philosophical as much as practical. Print is beautiful, and I admire the craft of physical publications deeply. But print is also static, expensive, and geographically limited. I wanted Teajia to be accessible to a student in Jakarta, a retiree in Osaka, and a tea farmer in Fujian equally.|https://images.unsplash.com/photo-1594631252845-29fc4cc8cde9?w=800&h=1200&fit=crop",

    ":::TEXT_SINGLE_COL:::I wanted content to be updateable as our understanding evolved — tea science is a living field, and articles should improve over time rather than becoming dated artifacts. Most importantly, I wanted the reading experience to be immersive in ways that print cannot achieve — subtle animations, responsive layouts that adapt to your screen, and eventually, interactive elements that let you explore data and terroir maps on your own terms. Digital was not a compromise. It was the medium that best served the mission.",

    ":::POEM_CENTERED:::Before the first article was written,\nbefore the first layout was designed,\nthere was a cup of tea on a wooden table\nand a question that would not let go:\nwhat if tea had a home on the internet\nthat was worthy of tea?",

    ":::DEDICATION_SIMPLE:::For every tea drinker who felt there should be something better — this is for you. And for the farmers, the processors, the traders, and the brewers whose craft deserves to be seen clearly. Teajia is your home.",

    ":::EPILOGUE_CENTERED:::Teajia is still becoming what it will be. Every article published, every photograph selected, every layout refined brings us closer to the vision — a digital space where tea is treated with the depth it deserves, where science and poetry coexist, where beauty serves understanding rather than obscuring it. If you have read this far, you are already part of that story. Welcome home.",

    ":::COPYRIGHT_PAGE:::Teajia Editorial"
  ],
  author: PEOPLE.chen,
};

import { ContentType } from '../../types';
import { ReadableStory } from '../../types/read';
import { PEOPLE } from '../people';

export const scienceMythDebunking: ReadableStory = {
  id: 'template-science-myth',
  type: ContentType.Article,
  status: 'vault',
  title: 'Science Myth-Debunking',
  subtitle: 'Caffeine in Tea',
  thumbnailUrl: 'https://images.unsplash.com/photo-1563911892437-1feda0179e1b?w=800&h=1200&fit=crop',
  durationOrTime: '16 Pages',
  origin: 'In-house',
  description: 'A myth-busting science article using data, expert quotes, and clear explanations to challenge common misconceptions.',
  category: 'science',
  tags: ['Health', 'Brewing', 'Tasting'],
  content: [
    ":::COVER_TYPOGRAPHIC:::CAFFEINE\nIN TEA|Myths vs. Science",

    ":::TEXT_DROP_CAP:::Few topics in the tea world generate as much confident misinformation as caffeine. Walk into any tea shop, browse any wellness blog, or ask any well-meaning friend, and you will hear the same reassuring claims repeated with absolute certainty: white tea has the least caffeine, green tea has less than black, and you can wash away most of the caffeine by rinsing your leaves for thirty seconds.",

    ":::TEXT_SINGLE_COL:::These statements feel intuitive. They sound scientific. And they are, for the most part, wrong. The relationship between tea and caffeine is far more complex, more interesting, and more counterintuitive than the popular narrative suggests. In this article, we dismantle the five most persistent caffeine myths in tea culture, replacing comfortable fiction with verifiable science.",

    ":::IMG_FULL_BLEED:::Tea leaves in morning light|https://images.unsplash.com/photo-1563911892437-1feda0179e1b?w=800&h=1200&fit=crop",

    ":::TEXT_HIGHLIGHTED:::$$dark$$MYTH #1: White tea has less caffeine than black tea. This is perhaps the most widespread misconception in tea culture. It sounds logical — white tea looks delicate, tastes light, therefore it must be low in caffeine. But caffeine content in the leaf has almost nothing to do with oxidation level.",

    ":::TEXT_SIDEBAR_IMAGE:::$$dark$$The primary determinant of caffeine in a tea leaf is the age and position of the leaf on the plant. Young buds and first leaves contain significantly more caffeine than mature leaves lower on the branch. White teas like Silver Needle are made exclusively from unopened buds — the most caffeine-rich part of the plant. Studies in the Journal of Food Science have consistently shown that Silver Needle contains caffeine levels comparable to or exceeding many black teas.|Young tea buds close-up|https://images.unsplash.com/photo-1563911892437-1feda0179e1b?w=800&h=1200&fit=crop",

    ":::STAT_BIG_NUMBER:::4.7%|Caffeine by dry weight in Silver Needle buds — higher than most Assam black teas",

    ":::TEXT_DOUBLE_COL:::Myth #2: You Can Decaffeinate Tea at Home|The thirty-second rinse myth is one of the most persistent in tea culture. The claim: a brief hot water rinse will extract most of the caffeine while preserving flavor. A 2008 Monash University study found that a 30-second rinse removed only about 9% of the total caffeine. Even a five-minute steep removed only about 70%. Meaningful decaffeination requires industrial processes impossible to replicate in a kitchen.\n\nMyth #3: Oxidation Increases Caffeine|This myth likely stems from the observation that black tea often tastes stronger than green tea. In fact, oxidation has minimal direct effect on caffeine content. Caffeine is a remarkably stable molecule that survives oxidation largely intact. What changes is the surrounding chemical context — the subjective experience may feel different, but actual caffeine per gram is determined by cultivar, harvest standard, and growing conditions.",

    ":::TEXT_BLOCKQUOTE_CENTER:::The idea that you can predict caffeine content by looking at the color of your tea is like predicting the alcohol content of wine by looking at the label design. The variables that matter are invisible to the casual observer.",

    ":::DEFINITION_LARGE:::L-Theanine|An amino acid found almost exclusively in tea (Camellia sinensis) that crosses the blood-brain barrier and promotes alpha brain wave activity. L-theanine modulates the stimulant effect of caffeine, producing a state of calm alertness distinct from the jittery energy of coffee.",

    ":::IMG_FULL_BLEED:::The chemistry of tea leaves|https://images.unsplash.com/image-1556881286-fc6915169721?w=800&h=1200&fit=crop",

    ":::TEXT_SIDEBAR_RIGHT:::Shade Growing and Caffeine|When tea plants are shaded for 2-3 weeks before harvest, they produce dramatically more caffeine and L-theanine. This is the plant's stress response. Japanese gyokuro, shaded for 20+ days, can contain 3.5% caffeine by dry weight — nearly double that of a sun-grown sencha. Matcha concentrates this further because you consume the entire leaf. A single serving of matcha delivers roughly 70mg of caffeine, comparable to espresso.|https://images.unsplash.com/photo-1515823064-d6e0c04616a7?w=800&h=1200&fit=crop",

    ":::DATA_BAR_CHART:::Caffeine Content by Tea Type (mg per gram dry leaf)|Matcha: 35|Gyokuro: 32|Silver Needle: 28|Assam Black: 25|Sencha: 22|Dragonwell Green: 20|Aged Puerh: 18|Hojicha: 12",

    ":::LIST_CHECKLIST:::Evidence-Based Caffeine Guidelines|Choose mature-leaf teas (houjicha, shou mei) for lower caffeine|Avoid bud-only teas (Silver Needle, gyokuro) if caffeine-sensitive|Cold-brewing extracts significantly less caffeine than hot brewing|A 30-second rinse removes only ~9% of caffeine — not meaningful decaffeination|Shade-grown teas (matcha, gyokuro) have the highest caffeine per gram|L-theanine content modulates caffeine effects — high-theanine teas feel smoother|Brewing temperature matters: hotter water extracts caffeine faster|Multiple short steeps distribute caffeine across more cups",

    ":::IMG_WITH_CAPTION_BOTTOM:::Matcha preparation — the highest caffeine tea per serving|https://images.unsplash.com/photo-1515823064-d6e0c04616a7?w=800&h=1200&fit=crop",

    ":::TEXT_SINGLE_COL:::Myth #4 concerns the widely circulated claim that herbal teas are always caffeine-free. While most herbal tisanes — chamomile, rooibos, peppermint — contain no caffeine, there are notable exceptions. Yerba mate contains caffeine levels rivaling black tea, typically 40-80mg per serving. Guayusa delivers even more — up to 90mg per cup.",

    ":::TEXT_JUSTIFIED_NARROW:::And then there is the curious case of wild-grown ancient tree teas sometimes marketed as herbal or medicinal preparations despite being true tea with full caffeine content. The lesson is straightforward: the word 'herbal' on a package is not a reliable indicator of caffeine content. Read the botanical name, not the marketing copy.",

    ":::QUOTE_MINIMAL:::Science does not care what the label says. Measure, test, verify.",

    ":::IMG_FULL_BLEED:::A quiet moment with tea|https://images.unsplash.com/photo-1597318181409-cf64d0b5d8a2?w=800&h=1200&fit=crop",

    ":::TEXT_TRIPLE_COL:::Morning Protocol|If you want maximum alertness from your tea, choose a shade-grown Japanese green (gyokuro or matcha) brewed at 70–80°C. The combination of high caffeine and high L-theanine produces sustained, focused energy without the crash associated with coffee. Drink within 30 minutes of waking for best effect.\n\nAfternoon Protocol|Switch to a medium-oxidized oolong brewed gongfu style — multiple short infusions spread the caffeine release over a longer period, providing gentle sustained energy. Tieguanyin or Dan Cong oolongs work beautifully here. The moderate caffeine combined with complex aromatics creates an alert but unhurried state.\n\nEvening Protocol|After 3pm, transition to naturally low-caffeine options: roasted houjicha, aged shou puerh, or a mature-leaf white like Shou Mei. These teas use older, larger leaves that contain less caffeine, and the roasting or aging process can further reduce stimulant impact. Pair with a calming ritual to signal wind-down to your nervous system.",

    ":::TEXT_HIGHLIGHTED:::$$dark$$MYTH #5: All caffeine is created equal. While the caffeine molecule is chemically identical in tea and coffee, the delivery mechanism differs profoundly. Tea delivers caffeine alongside L-theanine, catechins, and hundreds of other bioactive compounds that modulate its absorption and neurological effects.",

    ":::TEXT_SIDEBAR_IMAGE:::$$dark$$Clinical studies using EEG monitoring have shown that tea consumption increases alpha brain wave activity — associated with relaxed alertness — while coffee tends to increase beta wave activity — associated with active concentration but also anxiety. Tea's caffeine typically produces a gradual onset over 30-45 minutes with a sustained plateau lasting 3-5 hours, while coffee hits faster and harder, often followed by a more pronounced crash.|The difference in caffeine experience|https://images.unsplash.com/photo-1571934811356-5cc061b6821f?w=800&h=1200&fit=crop",

    ":::COPYRIGHT_PAGE:::Teajia Science"
  ],
  author: PEOPLE.sarah,
};

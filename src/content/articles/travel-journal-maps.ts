import { ContentType } from '../../types';
import { ReadableStory } from '../../types/read';
import { PEOPLE } from '../people';

export const travelJournalMaps: ReadableStory = {
  id: 'template-travel-journal',
  type: ContentType.Article,
  status: 'published',
  title: 'Travel Journal with Maps',
  subtitle: 'Ancient Tea Routes',
  thumbnailUrl: 'https://images.unsplash.com/photo-1582793988951-9aed5509eb97?w=800&h=1200&fit=crop',
  durationOrTime: '20 Pages',
  origin: 'In-house',
  description: 'A travelogue featuring cartographic illustrations, field observations, and cultural anthropology along historic tea trade routes.',
  tags: ['Culture', 'History'],
  content: [
    ":::COVER_SPLIT:::Travel Journal with Maps|Ancient Tea Routes|https://images.unsplash.com/photo-1582793988951-9aed5509eb97?w=800&h=1200&fit=crop",

    ":::MAP_CARTOGRAPHY:::The Tea Horse Road|Pu'er (Start)|Dali|Lijiang|Shangri-La|Markam|Chamdo|Lhasa (End)|Chengdu (Branch)|Kangding (Branch)",

    ":::TEXT_DROP_CAP:::The Chamagudao — the Tea Horse Road — is not a single road but a braided network of trails, passes, and river crossings that connected the tea-producing lowlands of Yunnan and Sichuan to the Tibetan Plateau for over a thousand years. At its peak, this network carried an estimated ten million kilograms of compressed tea per year into Tibet.",

    ":::TEXT_SIDEBAR_IMAGE:::The exchange ratio fluctuated but typically hovered around sixty kilograms of tea for one good horse — a price reflecting both the Tibetan addiction to butter tea and the Chinese military's insatiable appetite for cavalry mounts. I have spent the past three months tracing the southern route from Xishuangbanna to Lhasa, traveling by bus, by foot, and occasionally by mule.|Mountain tea route|https://images.unsplash.com/photo-1587049352846-4a222e784d38?w=800&h=1200&fit=crop",

    ":::IMG_FULL_BLEED:::Mountain passes along the ancient route|https://images.unsplash.com/photo-1464982326199-86f32f81b211?w=800&h=1200&fit=crop",

    ":::TEXT_SINGLE_COL:::The journey begins in Pu'er City. The city itself is unremarkable, but the surrounding countryside is the cradle of all tea. Within a hundred-kilometer radius lie the Six Famous Tea Mountains whose names appear in the earliest Qing dynasty records of tribute tea.",

    ":::TEXT_JUSTIFIED_NARROW:::These mountains, ranging from 1,200 to 1,800 meters in altitude, are covered in a patchwork of cultivated tea gardens and fragments of old-growth rainforest. The tea grows in loose, semi-wild groves shaded by taller trees — a cultivation style that produces lower yields but richer leaf material. It is this leaf, compressed into dense cakes, that the Tea Horse Road was built to carry.",

    ":::POSTCARD_STYLE:::Day 7 — Yiwu Village|Dear reader — Arrived in Yiwu after six hours on a road that deserves the word 'road' only in the most generous interpretation. The village is tiny but its name carries immense weight in puer circles. Every second building is a tea processing workshop. Bought a small cake from a family whose grandmother remembers the last horse caravans in the 1950s. She said the mules knew the trail so well they could walk it without a driver.|https://images.unsplash.com/photo-1556881286-fc6915169721?w=800&h=1200&fit=crop",

    ":::NOTE_PAPER:::FIELD NOTES — Elevation: 1,640m — Weather: Fog, light rain\n\nObservations at the old caravan staging ground outside Yiwu:\n- Stone hitching posts still visible, worn smooth by centuries of rope\n- Trail width approximately 1.5 meters — wide enough for two loaded mules\n- Paving stones visible beneath the mud in sections\n- Local informant (Mr. Yang, age 78) says his father made the journey to Tibet four times before 1949\n- Each trip took approximately three months one way\n- A standard mule load was 60 jin (30 kg) of compressed tea",

    ":::IMG_FULL_BLEED:::The ancient stone trail descending toward the Lancang River|https://images.unsplash.com/photo-1582793988951-9aed5509eb97?w=800&h=1200&fit=crop",

    ":::TEXT_SIDEBAR_RIGHT:::The Lancang Crossing|The first great obstacle is the Lancang River — known downstream as the Mekong. At the traditional crossing point, the river runs through a gorge of red sandstone at approximately 600 meters — a drop of over a thousand meters from the tea mountains above. The descent is brutal: switchbacks carved into the cliff face, slippery with condensation. Loaded mules regularly fell to their death on this section.|https://images.unsplash.com/photo-1464982326199-86f32f81b211?w=800&h=1200&fit=crop",

    ":::TEXT_DOUBLE_COL:::Dali: The Crossroads|The walled city of Dali sits at the crossroads of the Tea Horse Road and the Burma Road. For centuries, it was the great trading hub of southwest China — Tibetan horse traders, tea merchants, Burmese jade dealers, and Muslim caravaneers from Central Asia all met here.\n\nThe Three-Course Tea|I visited Bai ethnic minority villages where a distinctive style — sancha, or 'three-course tea' — is still served. The three courses proceed from bitter to sweet to reflective: concentrated roasted green tea, then the same tea sweetened with brown sugar and walnut, then lightly flavored with honey and Sichuan pepper. The Bai say this mirrors the arc of life.",

    ":::IMG_WITH_CAPTION_BOTTOM:::The walled city of Dali at dusk|https://images.unsplash.com/photo-1545579133-99bb5ab189bd?w=800&h=1200&fit=crop",

    ":::LIST_TIMELINE:::Tea Horse Road Timeline|618-907 CE: Tang Dynasty — first documented tea-horse trade between Sichuan and Tibet|960-1279 CE: Song Dynasty — formal Tea-Horse Office (Chama Si) established to regulate trade|1368-1644 CE: Ming Dynasty — peak of Tea Horse Road activity, with designated trading posts and government-set exchange rates|1644-1912 CE: Qing Dynasty — trade continues but gradually declines as maritime routes offer cheaper alternatives|1950s: Last mule caravans operate on the southern route before road construction makes them obsolete|2013: The Tea Horse Road is designated a National Key Cultural Heritage Protection Site",

    ":::IMG_SPLIT_VERTICAL:::Left: A restored section of stone-paved trail near Shaxi. Right: The last working blacksmith in Sideng.|https://images.unsplash.com/photo-1594631252845-29fc4cc8cde9?w=800&h=1200&fit=crop|https://images.unsplash.com/photo-1597318181409-cf64d0b5d8a2?w=800&h=1200&fit=crop",

    ":::POSTCARD_STYLE:::Day 18 — Shangri-La (Zhongdian)|The altitude is starting to bite. At 3,300 meters, the air is thin enough to notice. The landscape has changed completely — alpine meadows, yak pasture, and Tibetan monasteries. The tea changes too. In the lowlands, people drink young sheng puer. Here, they drink shou puer mixed with yak butter and salt. The first time I tried butter tea, I thought it was soup. By the third cup, I understood: at this altitude, this is survival food.|https://images.unsplash.com/photo-1587049352846-4a222e784d38?w=800&h=1200&fit=crop",

    ":::QUOTE_BIG:::The Tea Horse Road was not a road. It was a relationship — between lowland and highland, farmer and herder, leaf and hoof. — Professor Yang Haichao, Yunnan University",

    ":::IMG_FULL_BLEED:::High altitude landscapes of the Tea Horse Road|https://images.unsplash.com/photo-1464982326199-86f32f81b211?w=800&h=1200&fit=crop",

    ":::TEXT_SINGLE_COL:::The most physically demanding section lies between Shangri-La and Markam, where the route crosses the Hengduan Mountains. The trail climbs over passes exceeding 4,500 meters, descends into gorges cut by the Yangtze, Mekong, and Salween rivers running in parallel, then climbs again. I traveled it by bus over four days, stopping at small towns around old caravan rest stations.",

    ":::IMG_WITH_CAPTION_BOTTOM:::The view from Baima Snow Mountain Pass (4,292m)|https://images.unsplash.com/photo-1582793988951-9aed5509eb97?w=800&h=1200&fit=crop",

    ":::NOTE_PAPER:::FIELD NOTES — Day 24 — Markam, Tibet Autonomous Region\n\nCrossed the provincial border today. Everything changes.\n- Language: Mandarin gives way to Kham Tibetan\n- Architecture: Flat-roofed stone houses with prayer flags\n- Tea preparation observed:\n  1. Black brick tea broken from a compressed brick with a knife\n  2. Boiled in water for 15-20 minutes (not steeped — boiled)\n  3. Poured into a dongmo (wooden churn) with yak butter and salt\n  4. Churned vigorously for 2-3 minutes\n  5. Served in wooden bowls, refilled constantly\n- I drank approximately 15 bowls today",

    ":::TEXT_DOUBLE_COL:::The Economics of the Road|The Tea Horse Road was a state-managed monopoly. From the Song dynasty onward, the Tea-Horse Office set exchange rates and punished smuggling. The logic was strategic: China needed horses, Tibet needed tea, and the government needed to control both flows. The porters who carried tea over western Sichuan's passes were among the most exploited workers in Chinese history — carrying loads of 150 kilograms on wooden frames over 4,000-meter passes.\n\nThe Legacy|Today, the Tea Horse Road exists primarily as heritage tourism and branding. The Chinese government has designated significant sections as protected sites. But the actual trail — worn smooth by ten million mule hooves — is disappearing under highways, reservoirs, and vegetation. Within a generation, the physical road will exist only in fragments.",

    ":::IMG_FULL_BLEED:::Prayer flags and compressed tea bricks at a roadside shrine near Chamdo|https://images.unsplash.com/photo-1545579133-99bb5ab189bd?w=800&h=1200&fit=crop",

    ":::EPILOGUE_CENTERED:::The road is gone.\nThe mules are gone.\nThe traders are gone.\n\nBut the tea still travels —\nby truck, by plane, by post —\nfrom the same mountains\nto the same plateau,\nfollowing the same need\nthat built the road\nin the first place.",

    ":::COPYRIGHT_PAGE:::Words and field notes by Chen Wei\nCartography by Teajia Studios\nHistorical consultation: Professor Yang Haichao,\nYunnan University Department of History\n\nTeajia Magazine — Travel Series"
  ],
  author: PEOPLE.chen,
};

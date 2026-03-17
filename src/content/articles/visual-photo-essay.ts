import { ContentType } from '../../types';
import { ReadableStory } from '../../types/read';
import { PEOPLE } from '../people';

export const visualPhotoEssay: ReadableStory = {
  id: 'template-visual-essay',
  type: ContentType.Article,
  status: 'published',
  title: 'Visual Photo Essay',
  subtitle: 'Seasonal Rhythms',
  thumbnailUrl: 'https://picsum.photos/800/1200?random=vpe001',
  durationOrTime: '20 Pages',
  origin: 'In-house',
  description: 'A photo-driven narrative following the four seasons of tea cultivation with transitions between light and dark modes.',
  tags: ['Seasons', 'Photography', 'Culture'],
  content: [
    ":::IMG_FULL_BLEED:::A single tea bush emerges from morning fog, its youngest leaves translucent in the first light of March|https://picsum.photos/800/1200?random=vpe002",

    ":::CHAPTER_SPLIT:::Spring|Awakening",

    ":::TEXT_JUSTIFIED_NARROW:::The tea garden stirs in early March, long before the casual observer would notice anything has changed. Beneath the soil, root systems that spent the winter consolidating energy begin to push moisture upward through woody stems. The first sign is a subtle shift in color at the terminal buds — from dull olive to a luminous jade that seems almost to glow in the weak spring sunlight. Farmers who have tended these gardens for decades say they can smell the change before they see it: a faint green sweetness carried on the morning air, the scent of chlorophyll mobilizing after months of dormancy. In the high-altitude gardens of Fujian and Zhejiang, this moment arrives later than in the lowlands, sometimes not until late March or early April, but the anticipation is all the greater for the waiting. The pre-Qingming harvest — those precious leaves picked before the Clear Brightness festival — commands prices that reflect not just quality but the entire weight of a season's expectation.",

    ":::IMG_FULL_BLEED:::Dew-covered tea buds at dawn, each droplet a tiny lens magnifying the veined architecture of the leaf|https://picsum.photos/800/1200?random=vpe003",

    ":::POEM_CENTERED:::Before the festival of Clear Brightness\nfingers move through silver dew —\neach bud a promise kept\nby roots that never forgot the sun.",

    ":::IMG_SPLIT_VERTICAL:::Left: A picker's hands cradling the first spring flush. Right: Morning mist retreating across terraced hillsides|https://picsum.photos/800/1200?random=vpe004",

    ":::TEXT_CENTER_NARROW:::Spring picking is an act of radical attention. The standard for premium grades demands the bud and one leaf, sometimes the bud and two leaves, but never more. Each pluck takes approximately two seconds in the hands of an experienced picker, and a single kilogram of finished Longjing requires roughly eighty thousand individual hand movements. The speed is meditative rather than mechanical — the picker's eyes and fingers are in constant dialogue with the bush, reading the growth stage of each shoot, bypassing those that are a day too young or a day too old. There is no machine that can replicate this judgment. The finest spring teas are, in the most literal sense, hand-selected, one future cup at a time.",

    ":::IMG_PANORAMIC:::A wide view of terraced tea fields in full spring flush, the geometry of cultivation meeting the chaos of mountain topography|https://picsum.photos/1200/400?random=vpe005",

    ":::IMG_FULL_BLEED:::$$dark$$The same garden at nightfall — fireflies trace arcs above tea rows as summer warmth thickens the air|https://picsum.photos/800/1200?random=vpe006",

    ":::CHAPTER_SPLIT:::$$dark$$Summer|Growth",

    ":::TEXT_JUSTIFIED_NARROW:::$$dark$$Summer transforms the tea garden into something almost unrecognizable to those who only know the delicate spring harvest. The bushes grow with abandon, putting on centimeters of new growth each week, their leaves broadening and darkening as they accumulate the catechins and polyphenols that will define their character. The monsoon rains arrive in waves — sometimes gentle, sometimes violent — and the soil, already rich with organic matter from decades of composting, becomes a dark, fragrant sponge. Farmers shift their attention from harvesting to managing: pruning back excessive growth, monitoring drainage channels, watching for the fungal diseases that thrive in humidity. The teas harvested in summer are considered less refined than their spring counterparts — stronger, more astringent, with a robustness that some markets actually prefer. In Assam and parts of southern China, summer is when the real volume is produced, the workhouse teas that fill the world's teapots every morning.",

    ":::IMG_FULL_BLEED:::$$dark$$Rain cascading through tea canopy, each leaf channeling water like a miniature aqueduct|https://picsum.photos/800/1200?random=vpe007",

    ":::IMG_FILM_STRIP_VERTICAL:::$$dark$$Summer sequence: thunderheads building, first drops on leaves, full downpour, steam rising from warm earth|https://picsum.photos/400/1600?random=vpe008",

    ":::QUOTE_BIG:::$$dark$$The summer leaf does not apologize for its strength. It has drunk deeply of the rain and carries the full voice of the mountain.",

    ":::TEXT_CENTER_NARROW:::$$dark$$Between the monsoon downpours, the garden workers repair stone walls, clear irrigation channels, and tend the shade trees that protect the most delicate cultivars from direct afternoon sun. There is a rhythm to summer work that mirrors the weather itself — bursts of intense activity followed by periods of enforced rest when the rain makes fieldwork impossible. In the processing rooms, the summer harvest moves quickly from leaf to cup. Withering happens faster in the humid heat, oxidation accelerates, and the tea makers must adjust their timings daily, sometimes hourly, to account for conditions that shift with every passing cloud. It is during summer that a tea maker's skill is most severely tested, for the margin between a good tea and a ruined batch narrows considerably when temperature and humidity conspire against control.",

    ":::IMG_FULL_BLEED:::Amber light floods the garden as autumn arrives, transforming green rows into corridors of gold and rust|https://picsum.photos/800/1200?random=vpe009",

    ":::CHAPTER_SPLIT:::Autumn|Harvest",

    ":::TEXT_JUSTIFIED_NARROW:::Autumn in the tea garden carries a quality of poignant beauty that the other seasons lack. The light arrives at a lower angle, painting the hillsides in tones of amber and bronze, and the air takes on a clarity that reveals mountain ridges usually hidden by summer haze. The autumn flush — the final major harvest of the year — produces teas with a character distinct from both spring and summer. Where spring teas are prized for delicacy and freshness, autumn teas offer depth and complexity. The leaves have had an entire growing season to develop their chemical profile, accumulating aromatic compounds that give autumn oolongs, in particular, their legendary fragrance. In Taiwan and Anxi, the autumn Tieguanyin harvest is considered by many connoisseurs to be superior to the spring picking, with a floral intensity and lingering sweetness that the younger leaves cannot match.",

    ":::IMG_FULL_BLEED:::A farmer examining the final flush, holding leaves up to the slanting autumn light to judge their readiness|https://picsum.photos/800/1200?random=vpe010",

    ":::TEXT_SIDEBAR_RIGHT:::The Autumn Advantage|Cooler nights and warm days create a diurnal temperature swing that stresses the tea plant in productive ways. The plant responds by concentrating aromatic oils in its leaves as a form of chemical defense. This natural stress response is precisely what gives autumn teas their remarkable fragrance — a complexity born not from abundance but from the plant's preparation for scarcity.|https://picsum.photos/600/800?random=vpe011",

    ":::IMG_FULL_BLEED:::$$dark$$The garden in December, tea bushes dusted with frost, each branch etched in white against dark earth|https://picsum.photos/800/1200?random=vpe012",

    ":::CHAPTER_SPLIT:::$$dark$$Winter|Dormancy",

    ":::TEXT_JUSTIFIED_NARROW:::$$dark$$Winter is the season that most visitors never see, yet it is arguably the most important in the tea garden's annual cycle. As temperatures drop and daylight hours shorten, the Camellia sinensis plant enters a state of dormancy that is far from passive. Below ground, root systems continue to grow, extending their reach deeper into the subsoil, mining minerals and establishing the nutrient pathways that will fuel the spring flush. The plant's metabolism slows but does not stop — carbohydrates synthesized during the growing season are converted to amino acids and stored in the roots and woody stems, building the reserves of L-theanine that give spring teas their characteristic sweetness and umami depth. Farmers use this quiet season for maintenance: repairing terraces, composting, planning the next year's approach. Some undertake deep pruning, cutting bushes back to stimulate new growth from the base. The garden in winter is a study in patience and the quiet accumulation of potential.",

    ":::IMG_FULL_BLEED:::$$dark$$Snow settling on dormant tea bushes, transforming the orderly rows into abstract sculpture|https://picsum.photos/800/1200?random=vpe013",

    ":::POEM_CENTERED:::$$dark$$Beneath the frost, the roots remember.\nBeneath the silence, sap still moves.\nThe garden sleeps with open eyes —\nwinter is not an ending\nbut a held breath\nbefore the green exhale of spring.",

    ":::IMG_FULL_BLEED:::$$dark$$A single tea bush silhouetted against a winter twilight sky, completing the cycle begun in the first image|https://picsum.photos/800/1200?random=vpe014",

    ":::COPYRIGHT_PAGE:::Photography and text by Li Jun\nTeajia Journal — Seasonal Rhythms"
  ],
  author: PEOPLE.li,
};

import { ContentType } from '../../types';
import { ReadableStory } from '../../types/read';
import { PEOPLE } from '../people';

export const visualPhotoEssay: ReadableStory = {
  id: 'template-visual-essay',
  type: ContentType.Article,
  status: 'vault',
  title: 'Visual Photo Essay',
  subtitle: 'Seasonal Rhythms',
  thumbnailUrl: 'https://images.unsplash.com/photo-1556881286-fc6915169721?w=800&h=1200&fit=crop',
  durationOrTime: '28 Pages',
  origin: 'In-house',
  description: 'A photo-driven narrative following the four seasons of tea cultivation with transitions between light and dark modes.',
  tags: ['Seasons', 'Culture'],
  content: [
    ":::COVER_PHOTO_INSET:::Seasonal Rhythms|A Year in the Tea Garden|https://images.unsplash.com/photo-1556881286-fc6915169721?w=800&h=1200&fit=crop",

    ":::IMG_FULL_BLEED:::A single tea bush emerges from morning fog, its youngest leaves translucent in the first light of March|https://images.unsplash.com/photo-1587049352846-4a222e784d38?w=800&h=1200&fit=crop",

    ":::CHAPTER_SPLIT:::Spring|Awakening",

    ":::TEXT_JUSTIFIED_NARROW:::The tea garden stirs in early March, long before the casual observer would notice. Beneath the soil, root systems begin to push moisture upward through woody stems. The first sign is a subtle shift in color at the terminal buds — from dull olive to a luminous jade that seems to glow in the weak spring sunlight.",

    ":::TEXT_SIDEBAR_IMAGE:::Farmers who have tended these gardens for decades say they can smell the change before they see it: a faint green sweetness carried on the morning air, the scent of chlorophyll mobilizing after months of dormancy. In the high-altitude gardens of Fujian and Zhejiang, this moment arrives later, but the anticipation is all the greater. The pre-Qingming harvest commands prices that reflect not just quality but the weight of a season's expectation.|Spring buds emerging|https://images.unsplash.com/photo-1563911892437-1feda0179e1b?w=800&h=1200&fit=crop",

    ":::IMG_FULL_BLEED:::Dew-covered tea buds at dawn, each droplet a tiny lens magnifying the veined architecture of the leaf|https://images.unsplash.com/photo-1556881286-fc6915169721?w=800&h=1200&fit=crop",

    ":::POEM_CENTERED:::Before the festival of Clear Brightness\nfingers move through silver dew —\neach bud a promise kept\nby roots that never forgot the sun.",

    ":::IMG_SPLIT_VERTICAL:::Left: A picker's hands cradling the first spring flush. Right: Morning mist retreating across terraced hillsides|https://images.unsplash.com/photo-1597318181409-cf64d0b5d8a2?w=800&h=1200&fit=crop|https://images.unsplash.com/photo-1582793988951-9aed5509eb97?w=800&h=1200&fit=crop",

    ":::TEXT_CENTER_NARROW:::Spring picking is an act of radical attention. The standard for premium grades demands the bud and one leaf, sometimes the bud and two leaves, but never more. Each pluck takes approximately two seconds, and a single kilogram of finished Longjing requires roughly eighty thousand individual hand movements.",

    ":::TEXT_JUSTIFIED_NARROW:::The speed is meditative rather than mechanical — the picker's eyes and fingers in constant dialogue with the bush, reading the growth stage of each shoot, bypassing those a day too young or too old. There is no machine that can replicate this judgment. The finest spring teas are hand-selected, one future cup at a time.",

    ":::IMG_PANORAMIC:::A wide view of terraced tea fields in full spring flush|https://images.unsplash.com/photo-1582793988951-9aed5509eb97?w=800&h=1200&fit=crop",

    ":::IMG_FULL_BLEED:::$$dark$$The same garden at nightfall — fireflies trace arcs above tea rows as summer warmth thickens the air|https://images.unsplash.com/photo-1464982326199-86f32f81b211?w=800&h=1200&fit=crop",

    ":::CHAPTER_SPLIT:::$$dark$$Summer|Growth",

    ":::TEXT_SINGLE_COL:::$$dark$$Summer transforms the tea garden into something almost unrecognizable. The bushes grow with abandon, putting on centimeters of new growth each week, their leaves broadening and darkening as they accumulate catechins and polyphenols. The monsoon rains arrive in waves, and the soil becomes a dark, fragrant sponge.",

    ":::TEXT_SIDEBAR_IMAGE:::$$dark$$Farmers shift from harvesting to managing: pruning excessive growth, monitoring drainage, watching for fungal diseases. The teas harvested in summer are considered less refined than spring — stronger, more astringent — but some markets actually prefer this robustness. In Assam and parts of southern China, summer is when the real volume is produced.|Summer rains on tea leaves|https://images.unsplash.com/photo-1571934811356-5cc061b6821f?w=800&h=1200&fit=crop",

    ":::IMG_FULL_BLEED:::$$dark$$Rain cascading through tea canopy|https://images.unsplash.com/photo-1544787219-7f47ccb76574?w=800&h=1200&fit=crop",

    ":::IMG_FILM_STRIP_VERTICAL:::$$dark$$Summer sequence: thunderheads building, first drops on leaves, full downpour, steam rising from warm earth|https://images.unsplash.com/photo-1571934811356-5cc061b6821f?w=800&h=1200&fit=crop",

    ":::QUOTE_BIG:::$$dark$$The summer leaf does not apologize for its strength. It has drunk deeply of the rain and carries the full voice of the mountain.",

    ":::TEXT_CENTER_NARROW:::$$dark$$Between the monsoon downpours, workers repair stone walls, clear irrigation channels, and tend shade trees. There is a rhythm to summer work that mirrors the weather — bursts of intense activity followed by enforced rest. In the processing rooms, the summer harvest moves quickly. Withering happens faster in the humid heat, and tea makers adjust timings hourly to account for shifting conditions.",

    ":::IMG_FULL_BLEED:::Amber light floods the garden as autumn arrives, transforming green rows into corridors of gold and rust|https://images.unsplash.com/photo-1545579133-99bb5ab189bd?w=800&h=1200&fit=crop",

    ":::CHAPTER_SPLIT:::Autumn|Harvest",

    ":::TEXT_SINGLE_COL:::Autumn in the tea garden carries a quality of poignant beauty. The light arrives at a lower angle, painting hillsides in amber and bronze, and the air takes on a clarity that reveals mountain ridges usually hidden by summer haze.",

    ":::TEXT_JUSTIFIED_NARROW:::The autumn flush produces teas with a character distinct from both spring and summer. Where spring teas are prized for delicacy, autumn teas offer depth and complexity. In Taiwan and Anxi, the autumn Tieguanyin harvest is considered by many connoisseurs to be superior to spring, with a floral intensity and lingering sweetness that younger leaves cannot match.",

    ":::IMG_FULL_BLEED:::A farmer examining the final flush, holding leaves up to the slanting autumn light|https://images.unsplash.com/photo-1530968033775-2c92736b131e?w=800&h=1200&fit=crop",

    ":::TEXT_SIDEBAR_RIGHT:::The Autumn Advantage|Cooler nights and warm days create a diurnal temperature swing that stresses the tea plant in productive ways. The plant responds by concentrating aromatic oils in its leaves as a form of chemical defense. This natural stress response is precisely what gives autumn teas their remarkable fragrance — a complexity born not from abundance but from the plant's preparation for scarcity.|https://images.unsplash.com/photo-1563911892437-1feda0179e1b?w=800&h=1200&fit=crop",

    ":::IMG_FULL_BLEED:::$$dark$$The garden in December, tea bushes dusted with frost, each branch etched in white against dark earth|https://images.unsplash.com/photo-1464982326199-86f32f81b211?w=800&h=1200&fit=crop",

    ":::CHAPTER_SPLIT:::$$dark$$Winter|Dormancy",

    ":::TEXT_SINGLE_COL:::$$dark$$Winter is the season most visitors never see, yet it is arguably the most important. As temperatures drop, the Camellia sinensis plant enters a state of dormancy that is far from passive. Below ground, root systems continue to grow, extending deeper into the subsoil, mining minerals.",

    ":::TEXT_JUSTIFIED_NARROW:::$$dark$$The plant's metabolism slows but does not stop — carbohydrates are converted to amino acids and stored, building the reserves of L-theanine that give spring teas their sweetness and umami. Farmers use this quiet season for maintenance: repairing terraces, composting, planning. Some undertake deep pruning, cutting bushes back to stimulate new growth. The garden in winter is a study in patience and the quiet accumulation of potential.",

    ":::IMG_FULL_BLEED:::$$dark$$Snow settling on dormant tea bushes, transforming orderly rows into abstract sculpture|https://images.unsplash.com/photo-1571934811356-5cc061b6821f?w=800&h=1200&fit=crop",

    ":::POEM_CENTERED:::$$dark$$Beneath the frost, the roots remember.\nBeneath the silence, sap still moves.\nThe garden sleeps with open eyes —\nwinter is not an ending\nbut a held breath\nbefore the green exhale of spring.",

    ":::IMG_FULL_BLEED:::$$dark$$A single tea bush silhouetted against a winter twilight sky, completing the cycle begun in the first image|https://images.unsplash.com/photo-1597318181409-cf64d0b5d8a2?w=800&h=1200&fit=crop",

    ":::COPYRIGHT_PAGE:::Photography and text by Li Jun\nTeajia Journal — Seasonal Rhythms"
  ],
  author: PEOPLE.li,
};

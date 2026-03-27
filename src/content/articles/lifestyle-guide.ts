import { ContentType } from '../../types';
import { ReadableStory } from '../../types/read';
import { PEOPLE } from '../people';

export const lifestyleGuide: ReadableStory = {
  id: 'template-lifestyle',
  type: ContentType.Article,
  status: 'vault',
  title: 'Lifestyle Guide',
  subtitle: 'Creating a Tea Space',
  thumbnailUrl: 'https://images.unsplash.com/photo-1545579133-99bb5ab189bd?w=800&h=1200&fit=crop',
  durationOrTime: '17 Pages',
  origin: 'In-house',
  description: 'A lifestyle editorial guiding readers through creating their own tea ritual space at home.',
  tags: ['Space Design', 'Philosophy', 'Seasons'],
  startHere: true,
  content: [
    ":::COVER_SPLIT:::Creating a|Tea Space|https://images.unsplash.com/photo-1545579133-99bb5ab189bd?w=800&h=1200&fit=crop",

    ":::TEXT_DROP_CAP:::A tea space is not a luxury. It is not a Pinterest board come to life, or a status symbol, or something that requires a spare room and a significant budget. A tea space is simply a place where you have decided that tea will happen with intention. It can be a corner of your kitchen counter, a small tray on your desk, a cushion by a window, or an entire room.",

    ":::TEXT_CENTER_NARROW:::When you designate a space for tea, you are making a quiet declaration: this is where I slow down. This is where the kettle's whistle is not an interruption but an invitation. This guide will walk you through the principles, practicalities, and pleasures of creating a tea space that fits your life.",

    ":::IMG_FULL_BLEED:::A serene tea corner bathed in morning light|https://images.unsplash.com/photo-1545579133-99bb5ab189bd?w=800&h=1200&fit=crop",

    ":::TEXT_SINGLE_COL:::The first principle of a good tea space is containment. Your tea practice involves water, heat, fragile vessels, and dry goods that need protection from moisture and light. A defined boundary — even a simple tray — keeps these elements organized and prevents your practice from dissolving into the general chaos of domestic life.",

    ":::TEXT_SIDEBAR_IMAGE:::The traditional Chinese tea tray (cha pan) serves this function beautifully: it contains spills, organizes tools, and creates a visual frame that signals 'tea happens here.' But a wooden cutting board, a stone slab, a piece of linen, or even a clean placemat can serve the same purpose. The boundary does not need to be expensive or exotic. It needs only to exist.|A simple tea tray setup|https://images.unsplash.com/photo-1594631252845-29fc4cc8cde9?w=800&h=1200&fit=crop",

    ":::TEXT_DOUBLE_COL:::Choosing Your Location|The ideal tea space has access to water, a stable surface, and natural light. Proximity to a sink or kettle reduces friction — if you have to walk across the house to fill your kettle, you will brew tea less often. And natural light transforms the experience: watching steam rise through a shaft of morning sunlight, observing the color of your liquor in daylight. If you have a window that catches morning or afternoon light, start there.\n\nThe Counter Corner|If space is limited, a kitchen counter corner is the most practical location. Designate 50cm x 50cm as your tea zone. Place a small tray as your base, keep your most-used teaware within arm's reach, and store dry goods in airtight containers nearby. The advantage is proximity to water and heat. The disadvantage is proximity to cooking smells — invest in airtight storage for your tea.",

    ":::IMG_GRID_MONDRIAN:::Different tea space configurations|https://images.unsplash.com/photo-1545579133-99bb5ab189bd?w=800&h=1200&fit=crop|https://images.unsplash.com/photo-1594631252845-29fc4cc8cde9?w=800&h=1200&fit=crop|https://images.unsplash.com/photo-1530968033775-2c92736b131e?w=800&h=1200&fit=crop|https://images.unsplash.com/photo-1464982326199-86f32f81b211?w=800&h=1200&fit=crop",

    ":::TEXT_SIDEBAR_RIGHT:::Essential vs. Aspirational|The internet will show you tea spaces with handmade Japanese kettles, rare Yixing teapots, and museum-quality ceramics. These are beautiful. They are also unnecessary. Your essential tea space needs exactly five things: a way to heat water, a vessel to brew in, a cup to drink from, a surface to work on, and a place to store your tea. Everything else is accumulated over years of practice and should never be a prerequisite for starting. Begin with the minimum. Let your space grow organically as your practice deepens.|https://images.unsplash.com/photo-1594631252845-29fc4cc8cde9?w=800&h=1200&fit=crop",

    ":::LIST_CHECKLIST:::Tea Space Essentials|A defined surface area — tray, board, mat, or stone slab|An electric kettle (variable temperature if possible)|One versatile brewing vessel — a 100–150ml gaiwan handles everything|Two to three cups you genuinely enjoy drinking from|Airtight storage for your current teas — tins, foil bags, or ceramic jars|A small towel or cloth for spills|A waste water vessel — a bowl or pitcher for discarded rinse water|Good lighting — natural if possible, warm artificial if not",

    ":::CHAPTER_MINIMAL:::The Art of the Surface",

    ":::IMG_SPLIT_VERTICAL:::Natural materials for tea surfaces|https://images.unsplash.com/photo-1530968033775-2c92736b131e?w=800&h=1200&fit=crop|https://images.unsplash.com/photo-1464982326199-86f32f81b211?w=800&h=1200&fit=crop",

    ":::TEXT_SIDEBAR_LEFT:::Material Matters|The surface of your tea space communicates something about your practice. Wood introduces warmth and organic texture. Stone offers coolness, weight, and a sense of permanence. Bamboo provides a middle path: lighter than stone, more refined than raw wood, and deeply associated with Chinese tea culture. Avoid surfaces that are too precious to stain. Tea will spill. Water will drip. Your surface should age gracefully with use, developing a patina that records the history of your practice.|https://images.unsplash.com/photo-1530968033775-2c92736b131e?w=800&h=1200&fit=crop",

    ":::QUOTE_MINIMAL:::The best tea space is the one you actually use. Perfection is the enemy of practice.",

    ":::IMG_WITH_CAPTION_BOTTOM:::A well-used tea tray showing the natural patina developed over years of daily practice|https://images.unsplash.com/photo-1594631252845-29fc4cc8cde9?w=800&h=1200&fit=crop",

    ":::TEXT_HIGHLIGHTED:::$$dark$$Storage is the unglamorous essential that most tea space guides neglect. Tea is fragile — sensitive to light, moisture, oxygen, heat, and odor. A hundred-dollar oolong stored in a glass jar on a sunny windowsill will deteriorate faster than a ten-dollar tea kept properly in an opaque, airtight container in a cool drawer. The rules are simple: keep tea away from light, away from moisture, away from heat, and away from strong odors.",

    ":::TEXT_DOUBLE_COL:::Seasonal Adjustments|A living tea space changes with the seasons. In summer, shift toward lighter teas — cold-brewed greens, floral oolongs, white teas served at room temperature. In autumn, transition to medium-oxidized oolongs and light blacks. In winter, the tea space becomes a refuge — dark oolongs, aged puerh, and robust blacks hold center stage. In spring, simplify again — fresh greens return, the space opens up, and the cycle begins anew.\n\nLighting the Space|Lighting transforms a tea space more dramatically than any other single element. Natural light is ideal — it reveals the true color of tea liquor, illuminates steam, and connects your indoor practice to the rhythm of the day. For evening sessions, choose warm-toned lighting (2700K–3000K) that mimics candlelight. Avoid cool fluorescent light — it makes tea liquor look grey and creates a clinical atmosphere.",

    ":::IMG_FULL_BLEED:::A tea space in winter — warm light, dark oolongs, quiet refuge|https://images.unsplash.com/photo-1571934811356-5cc061b6821f?w=800&h=1200&fit=crop",

    ":::EPILOGUE_CENTERED:::Your tea space does not need to look like anyone else's. It needs only to feel like yours — a place where the world narrows to the width of a cup, where the only deadline is the kettle's whistle, where you are permitted, for a few minutes each day, to do nothing but attend to what is in front of you.",

    ":::COPYRIGHT_PAGE:::Teajia Lifestyle"
  ],
  author: PEOPLE.sarah,
};

import { ContentType } from '../../types';
import { ReadableStory } from '../../types/read';
import { PEOPLE } from '../people';

export const darkModeProcess: ReadableStory = {
  id: 'template-dark-process',
  type: ContentType.Article,
  status: 'published',
  title: 'The Midnight Kiln',
  subtitle: 'Three Nights of Fire',
  thumbnailUrl: 'https://images.unsplash.com/photo-1530968033775-2c92736b131e?w=800&h=1200&fit=crop',
  durationOrTime: '21 Pages',
  origin: 'In-house',
  description: 'Inside a seventy-two-hour anagama firing — where clay, ash, and patience become art.',
  tags: ['Pottery', 'Teaware', 'Brewing'],
  content: [
    ":::COVER_MAIN:::$$dark$$The Midnight Kiln|Three Nights of Fire|https://images.unsplash.com/photo-1530968033775-2c92736b131e?w=800&h=1200&fit=crop",

    ":::TEXT_DROP_CAP:::$$dark$$The fire begins at dusk. Not because tradition demands it — though tradition does — but because the kiln must reach peak temperature in the dead of night, when the air is coolest and the draft pulls strongest through the chamber. Master Lin stands at the mouth of the anagama, a forty-foot tunnel of brick and earth that has been loaded over the past three days with two hundred pieces of raw stoneware.",

    ":::TEXT_SIDEBAR_IMAGE:::$$dark$$The firebox is stacked with split pine, aged for two years in an open shed. He strikes a match, touches it to a twist of newspaper stuffed between the bottom logs, and steps back. The flame catches. A thin column of white smoke rises from the chimney at the far end. The seventy-two-hour firing cycle has begun. For the next three days and three nights, someone must tend this fire without interruption.|The anagama kiln at dusk|https://images.unsplash.com/photo-1530968033775-2c92736b131e?w=800&h=1200&fit=crop",

    ":::IMG_FULL_BLEED:::$$dark$$The anagama kiln at twilight, loaded and sealed|https://images.unsplash.com/photo-1530968033775-2c92736b131e?w=800&h=1200&fit=crop",

    ":::TEXT_DOUBLE_COL:::$$dark$$The Kiln|The anagama is the oldest continuous-chamber kiln design in East Asian ceramics, introduced to Japan from Korea in the fifth century and refined over the following millennium. Unlike modern electric or gas kilns that offer precise temperature control, the anagama is fired entirely with wood — typically pine or oak — and the results are governed by an unpredictable alchemy of flame path, ash fall, and atmospheric chemistry. No two firings produce identical results.\n\n$$dark$$The Clay|Master Lin works exclusively with local clay dug from a deposit on the hillside above his studio. The clay is rich in iron oxide, which gives it a dark reddish-brown color when raw and an extraordinary range of surface effects when fired to high temperature. 'Commercial clay is dead,' he says flatly. 'My clay is alive. It has memory.'",

    ":::CHAPTER_BOLD:::$$dark$$01|The First Night — Ignition to 400°C",

    ":::IMG_VIGNETTE_SOFT:::$$dark$$Flames lick through the firebox grate in the early hours|https://images.unsplash.com/photo-1571934811356-5cc061b6821f?w=800&h=1200&fit=crop",

    ":::TEXT_SIDEBAR_LEFT:::$$dark$$Water Smoking|The first phase of firing is called water smoking — a slow, careful climb from ambient temperature to roughly 400 degrees Celsius. The goal is to drive all remaining moisture from the clay body without causing steam explosions that would shatter the work. Lin feeds small sticks of kindling into the firebox at measured intervals, never allowing the temperature to rise faster than 50 degrees per hour. Through the spy holes in the kiln wall, the interior glows a dull, barely visible red.|https://images.unsplash.com/photo-1571934811356-5cc061b6821f?w=800&h=1200&fit=crop",

    ":::TEXT_SINGLE_COL:::$$dark$$Lin monitors the chimney smoke: white means moisture is still escaping; when it turns clear, the first phase is complete. This typically takes twelve to fourteen hours. Lin and his two assistants rotate in four-hour shifts, one person always awake and feeding the fire.",

    ":::QUOTE_BIG:::$$dark$$Fire does not obey. It negotiates. Every piece of wood is an offer. The kiln decides whether to accept. — Master Lin",

    ":::TEXT_SINGLE_COL:::$$dark$$At two in the morning, the world outside the kiln shed is absolute darkness. The only light comes from the firebox — an orange rectangle that pulses with each new log. Lin's face is lit from below, the shadows carving deep lines around his eyes and mouth. He has not slept. He will not sleep for another sixteen hours.",

    ":::IMG_FULL_BLEED:::$$dark$$The firebox glow at 600 degrees — cherry red visible through the spy holes|https://images.unsplash.com/photo-1571934811356-5cc061b6821f?w=800&h=1200&fit=crop",

    ":::TEXT_JUSTIFIED_NARROW:::$$dark$$The temperature inside the kiln has reached 600 degrees Celsius — cherry red, visible now through the spy holes as a faint, otherworldly glow. At this temperature, the clay is undergoing a fundamental molecular change called quartz inversion: the crystalline structure of the silica in the clay body is rearranging itself, expanding by roughly two percent. If the temperature rises too quickly during this window, the thermal stress will crack every piece in the kiln. Lin knows this not from a textbook but from the firing he lost twelve years ago, when impatience cost him three months of work.",

    ":::IMG_FILM_STRIP_VERTICAL:::$$dark$$The firing cycle: dusk, midnight, dawn, noon|https://images.unsplash.com/photo-1530968033775-2c92736b131e?w=800&h=1200&fit=crop|https://images.unsplash.com/photo-1571934811356-5cc061b6821f?w=800&h=1200&fit=crop|https://images.unsplash.com/photo-1545579133-99bb5ab189bd?w=800&h=1200&fit=crop|https://images.unsplash.com/photo-1530968033775-2c92736b131e?w=800&h=1200&fit=crop",

    ":::CHAPTER_BOLD:::$$dark$$02|The Second Day — Climbing to Peak",

    ":::TEXT_DOUBLE_COL:::$$dark$$Body Reduction|By midday on the second day, the temperature has climbed past 900 degrees. Lin shifts his stoking rhythm — larger pieces of wood, fed more frequently, creating bursts of flame that consume all available oxygen inside the chamber. This is reduction firing: by starving the kiln of air, the fire pulls oxygen molecules from the metal oxides in the clay and glaze. Iron oxide loses an oxygen atom and shifts from red to grey or black.\n\n$$dark$$Ash Glazing|As the temperature climbs above 1100 degrees, a secondary transformation begins. The pine wood, burning to ash, releases fine particles that are carried by the draft through the entire length of the kiln. This fly ash settles on the surfaces of the pottery, and at these extreme temperatures, the ash melts — silica and flux combine to form a natural glass, a glaze applied not by human hand but by the fire itself.",

    ":::IMG_WITH_CAPTION_BOTTOM:::$$dark$$Ash deposits creating natural glazes on stoneware surfaces|https://images.unsplash.com/photo-1530968033775-2c92736b131e?w=800&h=1200&fit=crop",

    ":::TEXT_SINGLE_COL:::$$dark$$The spy holes become windows into another world. Peering through them with welder's goggles, Lin can see the interior of the kiln glowing a blinding white-yellow. The pottery is incandescent, the same color as the air around it, distinguishable only by the shadows they cast.",

    ":::TEXT_JUSTIFIED_NARROW:::$$dark$$Pyrometric cones — small pyramids of ceramic material calibrated to bend at specific temperatures — are placed at intervals throughout the kiln. Through the spy holes, Lin watches them: cone 8 has bent, cone 9 is leaning, cone 10 stands straight. When cone 10 bends — indicating approximately 1300 degrees Celsius — the peak has been reached. But temperature alone is not the measure. What matters is heat work: the combination of temperature and time. Lin will hold the kiln at peak for six to eight hours, stoking every three to four minutes with heavy logs.",

    ":::QUOTE_BIG:::$$dark$$The kiln remembers every firing. The walls absorb the ash, the smoke, the heat. Each firing builds on every firing before it. An old kiln produces grace.",

    ":::IMG_FULL_BLEED:::$$dark$$White heat visible through the spy hole at peak temperature|https://images.unsplash.com/photo-1530968033775-2c92736b131e?w=800&h=1200&fit=crop",

    ":::CHAPTER_BOLD:::$$dark$$03|The Third Night — Descent and Silence",

    ":::TEXT_SINGLE_COL:::$$dark$$The final stoking ends at midnight on the third night. Lin seals the firebox with bricks and clay, plugs the chimney damper, and closes every spy hole with wads of wet newspaper that hiss and steam on contact. The kiln is now a sealed vessel of incandescent air, cooling at its own pace.",

    ":::TEXT_CENTER_NARROW:::$$dark$$This cooling phase is as critical as the heating — too rapid a descent and the thermal shock will crack the glaze. The kiln will take four to five days to cool to a temperature safe for unloading. During this time, there is nothing to do but wait. Lin walks to the farmhouse, drinks a glass of cold water, and sleeps for fourteen hours.",

    ":::TEXT_SIDEBAR_LEFT:::$$dark$$The Unloading|Five days after the final stoking, Lin unseals the kiln door. Even now, the interior is warm — perhaps 50 degrees Celsius. He reaches in and lifts out the first piece: a tea bowl, placed in the path of heaviest ash fall. Its surface is extraordinary — a thick, uneven glaze of olive green and amber, with rivulets of melted ash frozen mid-drip. Lin turns it in his hands, holds it up to the light, runs his thumb across the interior. He says nothing for a long moment. Then: 'This one is good.' Not every piece will earn that verdict. Perhaps sixty percent of the load will meet his standard. The rest will be broken with a hammer and returned to the earth.|https://images.unsplash.com/photo-1530968033775-2c92736b131e?w=800&h=1200&fit=crop",

    ":::IMG_FULL_BLEED:::$$dark$$The first bowl emerges from the cooled kiln|https://images.unsplash.com/photo-1594631252845-29fc4cc8cde9?w=800&h=1200&fit=crop",

    ":::EPILOGUE_CENTERED:::$$dark$$The cycle is complete.\nClay returns to stone.\nAsh becomes glass.\nThe fire's memory lives\nin every surface it touched.\n\nUntil the next firing begins.",

    ":::COPYRIGHT_PAGE:::$$dark$$Words & Photography by Chen Wei\nKiln Master: Lin\n\nTeajia Magazine"
  ],
  author: PEOPLE.chen,
};

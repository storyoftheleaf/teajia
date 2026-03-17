import { ContentType } from '../../types';
import { ReadableStory } from '../../types/read';
import { PEOPLE } from '../people';

export const teaFeatureProcess: ReadableStory = {
  id: 'template-tea-process',
  type: ContentType.Article,
  status: 'published',
  title: 'Tea Feature with Process',
  subtitle: 'Oriental Beauty',
  thumbnailUrl: 'https://images.unsplash.com/photo-1530968033775-2c92736b131e?w=800&h=1200&fit=crop',
  durationOrTime: '19 Pages',
  origin: 'In-house',
  description: 'A tea feature focusing on the unique processing story, including step-by-step manufacturing and the role of natural phenomena.',
  tags: ['Oolong', 'Taiwan', 'Brewing', 'Tasting'],
  featured: true,
  category: 'tea-feature',
  endOfArticleCTA: { type: 'shop', text: 'This tea is in our shop.', linkTarget: 'shop' },
  content: [
    ":::COVER_PHOTO_INSET:::Oriental Beauty|東方美人 — The Bug-Bitten Wonder|https://images.unsplash.com/photo-1530968033775-2c92736b131e?w=800&h=1200&fit=crop",

    ":::TEXT_DROP_CAP:::There is no tea on earth quite like Oriental Beauty. It is the only premium tea whose quality depends on an insect — a tiny green leafhopper called Jacobiasca formosana that most farmers would consider a pest. When this creature bites the young tea leaves, the plant responds with a chemical defense: it floods the wounded tissue with terpenes and volatile compounds that attract the leafhopper's natural predators.",

    ":::TEXT_SIDEBAR_IMAGE:::We humans, arriving late to this ecological drama, discovered that these defense chemicals taste extraordinary — honey, muscatel grape, ripe stone fruit, and a haunting floral sweetness that no amount of processing skill can replicate without the bug's intervention. Oriental Beauty is a tea born from damage, from the plant's pain transformed into our pleasure. It is nature's most eloquent argument against the illusion of human control.|The beauty of damaged leaves|https://images.unsplash.com/photo-1563911892437-1feda0179e1b?w=800&h=1200&fit=crop",

    ":::TEXT_SINGLE_COL:::The story begins in Hsinchu County, in the hilly terrain of northern Taiwan, sometime in the early twentieth century. A farmer discovered that leaves bitten by leafhoppers, which he had assumed were ruined, actually produced a tea of remarkable sweetness and complexity when processed as a heavily oxidized oolong. He brought a batch to a tea competition and won. Other farmers accused him of lying about his methods.",

    ":::IMG_FULL_BLEED:::The characteristic multi-colored dry leaf of Oriental Beauty|https://images.unsplash.com/photo-1530968033775-2c92736b131e?w=800&h=1200&fit=crop",

    ":::TEXT_DOUBLE_COL:::The Leafhopper Partnership|The green leafhopper (Jacobiasca formosana) is barely three millimeters long. It feeds by piercing the surface of young tea leaves, leaving tiny wounds that trigger the plant's immune response. The tea bush releases a cocktail of volatile organic compounds — primarily monoterpene alcohols — that serve as chemical distress signals attracting parasitic wasps.\n\nThe Farmer's Gamble|Producing Oriental Beauty requires a radical act of trust. The farmer must forgo all pesticide use — not as an ideological choice but as a practical necessity. The leafhopper season is unpredictable: in some years the tea is exceptional; in others, the harvest is thin. A good Oriental Beauty farmer must be part ecologist, part gambler.",

    ":::IMG_FILM_STRIP_VERTICAL:::The processing sequence: withering under sun, indoor oxidation, hand-rolling, slow baking|https://images.unsplash.com/photo-1545579133-99bb5ab189bd?w=800&h=1200&fit=crop",

    ":::TEXT_SIDEBAR_RIGHT:::Step 1 — Solar Withering|The bitten leaves are spread on bamboo trays in direct sunlight for one to two hours. This initiates moisture loss and begins oxidation. The sun's heat triggers additional enzymatic reactions in the wounded tissue, amplifying the aromatic compounds. The tea maker monitors the wither by touch and smell, checking flexibility and the emergence of a fruity fragrance.|https://images.unsplash.com/photo-1582793988951-9aed5509eb97?w=800&h=1200&fit=crop",

    ":::DEFINITION_LARGE:::Zuo Qing (做青)|The art of 'making green' — the cyclical process of tossing and resting oolong leaves to control oxidation. In Oriental Beauty, this step is extended to achieve 60-85% oxidation, far higher than most oolongs.",

    ":::IMG_FULL_BLEED:::Bamboo trays of withering leaves|https://images.unsplash.com/photo-1545579133-99bb5ab189bd?w=800&h=1200&fit=crop",

    ":::TEXT_SINGLE_COL:::Step 2 — Indoor Withering and Tossing. After solar withering, the leaves are brought indoors. The leaves are gently agitated in a bamboo drum or by hand-tossing on a cloth, which bruises the leaf edges and accelerates oxidation. After each tossing, the leaves rest for one to two hours.",

    ":::TEXT_JUSTIFIED_NARROW:::This tossing-and-resting cycle is repeated six to eight times over twelve to eighteen hours. The tea maker judges each cycle by the color of the leaf edges, which progress from green to bronze to reddish-brown, and by the evolving aroma, which shifts from grassy to floral to fruity. The target oxidation for premium Oriental Beauty is between 60 and 85 percent.",

    ":::BOTANICAL_SKETCH:::Jacobiasca formosana — the green leafhopper, approximately 3mm in length.",

    ":::TEXT_DOUBLE_COL:::Step 3 — Kill-Green|When oxidation has reached the desired level, the leaves are pan-fired in a large wok. For Oriental Beauty, this requires a gentler touch — the heavily oxidized leaves are more fragile, and excessive heat can destroy the delicate aromatic compounds the entire process has been designed to develop.\n\nStep 4 — Rolling and Shaping|After kill-green, the warm leaves are rolled to shape them and express residual moisture. Oriental Beauty is typically rolled into a loose, slightly twisted form. This loose shape allows the distinctive multi-colored appearance to remain visible — white bud tips, amber middle leaves, and dark twisted older leaves.",

    ":::RECIPE_CARD:::Brewing Guide|5g leaf per 150ml|Water: 90°C (194°F)|First steep: 60 seconds|Add 15 seconds each round|Good for 5-7 infusions|Western style also works beautifully — 3g per 200ml, 3 minutes|Note: Oriental Beauty is forgiving. Even over-steeped, it rarely turns bitter.",

    ":::TASTING_NOTES_GRID:::Aroma: Honey, muscatel grape, rose petal, ripe peach|Flavor: Honey sweetness, stone fruit, dried apricot, hint of mint|Mouthfeel: Silky, medium body, coating, smooth|Finish: Long cooling sensation, almost mentholated, with returning sweetness|Liquor: Deep amber-gold, brilliant clarity|Character: Elegant, complex, feminine, with a wild undertone",

    ":::QUOTE_BIG:::The leafhopper does not know it is making art. The plant does not know it is making tea. Beauty arises at the intersection of accident and attention.",

    ":::IMG_SPLIT_VERTICAL:::Left: The finished dry leaf showing the characteristic five-color appearance. Right: The brilliant amber liquor in a porcelain cup|https://images.unsplash.com/photo-1530968033775-2c92736b131e?w=800&h=1200&fit=crop|https://images.unsplash.com/photo-1544787219-7f47ccb76574?w=800&h=1200&fit=crop",

    ":::TEXT_SIDEBAR_LEFT:::The Queen Victoria Legend|The most famous story associated with Oriental Beauty involves Queen Victoria. According to Taiwanese lore, a batch was sent to England in the late nineteenth century, where the Queen was so impressed she named it 'Oriental Beauty.' While historians have been unable to verify this, it is well documented that Formosan oolongs received high praise from European judges at international expositions.|https://images.unsplash.com/photo-1594631252845-29fc4cc8cde9?w=800&h=1200&fit=crop",

    ":::IMG_WITH_CAPTION_BOTTOM:::The amber glow of Oriental Beauty tea|https://images.unsplash.com/photo-1544787219-7f47ccb76574?w=800&h=1200&fit=crop",

    ":::TEXT_SINGLE_COL:::Step 5 — Slow Baking. The final step is a gentle, extended baking that removes residual moisture and stabilizes the tea for storage. Unlike the aggressive charcoal roasting used for Wuyi Yan Cha, Oriental Beauty's baking is deliberate and restrained — typically six to eight hours at temperatures between 60 and 80 degrees Celsius.",

    ":::TEXT_JUSTIFIED_NARROW:::The goal is not to add roasted flavor but to lock in the floral and fruity aromatics. The tea maker checks progress by tasting every hour, looking for the moment when the honey sweetness peaks and the finish develops its characteristic cooling quality. Over-baking flattens the aromatics; under-baking leaves the tea vulnerable to moisture damage.",

    ":::EPILOGUE_CENTERED:::Oriental Beauty reminds us that the finest things are not always the products of control and mastery. Sometimes greatness emerges from collaboration with forces we cannot command — an insect's hunger, a plant's defense, a farmer's willingness to let nature lead. In a world that prizes optimization and efficiency, this tea stands as a quiet testament to the beauty of surrender.",

    ":::COPYRIGHT_PAGE:::Words by Chen Wei\nBotanical illustration by Li Jun\nTeajia Journal — Tea Feature Series"
  ],
  author: PEOPLE.chen,
};

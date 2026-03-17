import { ContentType } from '../../types';
import { ReadableStory } from '../../types/read';
import { PEOPLE } from '../people';

export const teaFeatureProcess: ReadableStory = {
  id: 'template-tea-process',
  type: ContentType.Article,
  status: 'published',
  title: 'Tea Feature with Process',
  subtitle: 'Oriental Beauty',
  thumbnailUrl: 'https://picsum.photos/800/1200?random=tfp001',
  durationOrTime: '24 Pages',
  origin: 'In-house',
  description: 'A tea feature focusing on the unique processing story, including step-by-step manufacturing and the role of natural phenomena.',
  tags: ['Oolong', 'Taiwan', 'Brewing', 'Tasting'],
  featured: true,
  category: 'tea-feature',
  endOfArticleCTA: { type: 'shop', text: 'This tea is in our shop.', linkTarget: 'shop' },
  content: [
    ":::COVER_PHOTO_INSET:::Oriental Beauty|東方美人 — The Bug-Bitten Wonder|https://picsum.photos/800/1200?random=tfp002",

    ":::TEXT_DROP_CAP:::There is no tea on earth quite like Oriental Beauty. It is the only premium tea whose quality depends on an insect — a tiny green leafhopper called Jacobiasca formosana that most farmers would consider a pest. When this creature bites the young tea leaves, the plant responds with a chemical defense: it floods the wounded tissue with terpenes and other volatile compounds that attract the leafhopper's natural predators. We humans, arriving late to this ecological drama, discovered that these defense chemicals taste extraordinary — honey, muscatel grape, ripe stone fruit, and a haunting floral sweetness that no amount of processing skill can replicate without the bug's intervention. Oriental Beauty is a tea born from damage, from the plant's pain transformed into our pleasure. It is nature's most eloquent argument against the illusion of human control.",

    ":::TEXT_SINGLE_COL:::The story begins in Hsinchu County, in the hilly terrain of northern Taiwan, sometime in the early twentieth century. The details vary with the telling, but the core narrative is consistent: a farmer discovered that leaves bitten by leafhoppers, which he had assumed were ruined, actually produced a tea of remarkable sweetness and complexity when processed as a heavily oxidized oolong. He brought a batch to a tea competition and won. Other farmers accused him of lying about his methods — the story was too improbable. But the proof was in the cup. Word spread, and by the mid-twentieth century, Hsinchu's bug-bitten oolong had become one of Taiwan's signature teas, commanding prices that rivaled the finest high-mountain oolongs despite growing at relatively low elevations.",

    ":::IMG_FULL_BLEED:::The characteristic multi-colored dry leaf of Oriental Beauty — white buds, amber tips, and dark twisted leaves|https://picsum.photos/800/1200?random=tfp003",

    ":::TEXT_DOUBLE_COL:::The Leafhopper Partnership|The green leafhopper (Jacobiasca formosana) is barely three millimeters long. It feeds by piercing the surface of young tea leaves and sucking the cell sap, leaving behind tiny wounds that trigger the plant's immune response. This response is sophisticated: the tea bush releases a cocktail of volatile organic compounds — primarily monoterpene alcohols like linalool, geraniol, and nerol — that serve as chemical distress signals. These signals attract parasitic wasps that prey on the leafhoppers, providing the plant with biological pest control. The concentration of these aromatic compounds in bitten leaves can be three to five times higher than in unbitten leaves from the same bush.\n\nThe Farmer's Gamble|Producing Oriental Beauty requires a radical act of trust. The farmer must forgo all pesticide use — not as an ideological choice but as a practical necessity, since pesticides would kill the very insects the tea depends on. This means accepting significant crop losses from other pests and diseases. The leafhopper season is unpredictable: in some years the population is abundant and the tea is exceptional; in others, drought or heavy rain suppresses the insects and the harvest is thin. A good Oriental Beauty farmer must be part ecologist, part gambler, reading the weather, the insect population, and the bush's response with a sensitivity that no technology can replace.",

    ":::IMG_FILM_STRIP_VERTICAL:::The processing sequence: withering under sun, indoor oxidation, hand-rolling, slow baking|https://picsum.photos/400/1600?random=tfp004",

    ":::TEXT_SIDEBAR_RIGHT:::Step 1 — Solar Withering|The bitten leaves are spread on bamboo trays in direct sunlight for one to two hours, depending on intensity. This initiates moisture loss and begins the oxidation process. The sun's heat also triggers additional enzymatic reactions in the leafhopper-wounded tissue, amplifying the aromatic compounds. The tea maker monitors the wither by touch and smell, checking the leaves' flexibility and the emergence of a distinctive fruity fragrance. Under-withering produces a grassy, thin tea; over-withering can burn the delicate aromatics before they have a chance to develop fully during oxidation.|https://picsum.photos/600/800?random=tfp005",

    ":::DEFINITION_LARGE:::Zuo Qing (做青)|The art of 'making green' — the cyclical process of tossing and resting oolong leaves to control oxidation. In Oriental Beauty, this step is extended to achieve 60-85% oxidation, far higher than most oolongs.",

    ":::TEXT_SINGLE_COL:::Step 2 — Indoor Withering and Tossing. After solar withering, the leaves are brought indoors to a controlled environment. What follows is the most labor-intensive phase of production: the cyclical process of tossing and resting known as zuo qing. The leaves are gently agitated in a bamboo drum or by hand-tossing on a cloth, which bruises the leaf edges and accelerates oxidation. After each tossing, the leaves rest for one to two hours, during which the enzymes activated by bruising transform catechins into theaflavins and thearubigins — the compounds responsible for Oriental Beauty's amber color and honeyed sweetness. This tossing-and-resting cycle is repeated six to eight times over the course of twelve to eighteen hours. The tea maker judges each cycle by the color of the leaf edges, which progress from green to bronze to reddish-brown, and by the evolving aroma, which shifts from grassy to floral to fruity as oxidation deepens. The target oxidation level for premium Oriental Beauty is typically between 60 and 85 percent — significantly higher than most oolongs and approaching the territory of black tea.",

    ":::BOTANICAL_SKETCH:::Jacobiasca formosana — the green leafhopper. Approximately 3mm in length. The tiny puncture wounds it leaves on young tea leaves trigger a chemical defense response that produces Oriental Beauty's signature honey-muscatel flavor.",

    ":::TEXT_DOUBLE_COL:::Step 3 — Kill-Green|When oxidation has reached the desired level, the leaves are pan-fired in a large wok to halt enzymatic activity. For Oriental Beauty, this step requires a gentler touch than for less oxidized oolongs — the heavily oxidized leaves are more fragile, and excessive heat can destroy the delicate aromatic compounds the entire process has been designed to develop. The tea maker uses a lower wok temperature and a shorter firing time, relying on quick, light hand movements to ensure even heat distribution without scorching.\n\nStep 4 — Rolling and Shaping|After kill-green, the warm leaves are rolled by hand or in a small mechanical roller to shape them and express residual moisture. Oriental Beauty is typically rolled into a loose, slightly twisted form rather than the tight balls of high-mountain oolong or the flat press of Longjing. This loose shape allows the distinctive multi-colored appearance to remain visible — the white bud tips, amber middle leaves, and dark twisted older leaves that together create the tea's celebrated visual complexity.",

    ":::RECIPE_CARD:::Brewing Guide|5g leaf per 150ml|Water: 90°C (194°F)|First steep: 60 seconds|Add 15 seconds each round|Good for 5-7 infusions|Western style also works beautifully — 3g per 200ml, 3 minutes|Note: Oriental Beauty is forgiving. Even over-steeped, it rarely turns bitter.",

    ":::TASTING_NOTES_GRID:::Aroma: Honey, muscatel grape, rose petal, ripe peach|Flavor: Honey sweetness, stone fruit, dried apricot, hint of mint|Mouthfeel: Silky, medium body, coating, smooth|Finish: Long cooling sensation, almost mentholated, with returning sweetness|Liquor: Deep amber-gold, brilliant clarity|Character: Elegant, complex, feminine, with a wild undertone",

    ":::QUOTE_BIG:::The leafhopper does not know it is making art. The plant does not know it is making tea. Beauty arises at the intersection of accident and attention.",

    ":::IMG_SPLIT_VERTICAL:::Left: The finished dry leaf showing the characteristic five-color appearance. Right: The brilliant amber liquor in a porcelain cup|https://picsum.photos/800/1200?random=tfp006",

    ":::TEXT_SIDEBAR_LEFT:::The Queen Victoria Legend|The most famous story associated with Oriental Beauty involves Queen Victoria. According to Taiwanese lore, a batch of this tea was sent to England in the late nineteenth century, where it reached the Queen's court. She was so impressed by its honey-sweet flavor and its beautiful multi-colored leaf that she named it 'Oriental Beauty.' While historians have been unable to verify this specific story, it is well documented that Formosan oolongs were exhibited at international expositions in the late 1800s and received high praise from European judges. Whether or not Victoria herself named the tea, the legend speaks to a genuine historical moment: the West's first encounter with Taiwan's remarkable oolong tradition.|https://picsum.photos/600/800?random=tfp007",

    ":::TEXT_SINGLE_COL:::Step 5 — Slow Baking. The final step in Oriental Beauty's production is a gentle, extended baking that removes residual moisture and stabilizes the tea for storage. Unlike the aggressive charcoal roasting used for Wuyi Yan Cha or traditional Dong Ding, Oriental Beauty's baking is deliberate and restrained — typically six to eight hours at temperatures between 60 and 80 degrees Celsius. The goal is not to add roasted flavor but to lock in the floral and fruity aromatics developed during oxidation. Some producers use bamboo baskets over electric elements; the best still use charcoal, which provides a more even and penetrating heat. The tea maker checks progress by tasting every hour or so, looking for the moment when the honey sweetness peaks and the finish develops its characteristic cooling quality. Over-baking flattens the aromatics; under-baking leaves the tea vulnerable to moisture damage during storage.",

    ":::EPILOGUE_CENTERED:::Oriental Beauty reminds us that the finest things are not always the products of control and mastery. Sometimes greatness emerges from collaboration with forces we cannot command — an insect's hunger, a plant's defense, a farmer's willingness to let nature lead. In a world that prizes optimization and efficiency, this tea stands as a quiet testament to the beauty of surrender.",

    ":::COPYRIGHT_PAGE:::Words by Chen Wei\nBotanical illustration by Li Jun\nTeajia Journal — Tea Feature Series"
  ],
  author: PEOPLE.chen,
};

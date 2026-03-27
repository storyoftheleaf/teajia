import { ContentType } from '../../types';
import { ReadableStory } from '../../types/read';
import { PEOPLE } from '../people';

export const technicalAnalysis: ReadableStory = {
  id: 'template-technical',
  type: ContentType.Article,
  status: 'vault',
  title: 'Technical Analysis',
  subtitle: 'Anatomy of a Cup',
  thumbnailUrl: 'https://images.unsplash.com/photo-1544787219-7f47ccb76574?w=800&h=1200&fit=crop',
  durationOrTime: '16 Pages',
  origin: 'In-house',
  description: 'A technical breakdown using scientific diagram aesthetics, labeled illustrations, and systematic analysis.',
  tags: ['Brewing', 'Tasting', 'Health'],
  content: [
    ":::COVER_ABSTRACT:::Anatomy|of a Cup|https://images.unsplash.com/photo-1544787219-7f47ccb76574?w=800&h=1200&fit=crop",

    ":::TEXT_DROP_CAP:::What is a cup of tea? On the surface, it seems almost insultingly simple — dried leaves steeped in hot water. But this simplicity is deceptive. A single cup of well-brewed tea contains over a thousand distinct chemical compounds, each contributing to an experience that engages every sensory system simultaneously.",

    ":::TEXT_SINGLE_COL:::The color that greets your eye, the aroma that rises with the steam, the taste that unfolds across your palate, the texture that coats your mouth, the warmth that spreads through your chest — all are products of precise chemical reactions between water and leaf. In this technical analysis, we deconstruct a cup of tea into its constituent parts.",

    ":::BOTANICAL_SKETCH:::Cross-section diagram of a tea leaf showing cellular structure, vacuoles, and enzyme compartments|https://images.unsplash.com/photo-1563911892437-1feda0179e1b?w=800&h=1200&fit=crop",

    ":::TEXT_DOUBLE_COL:::Layer 1: The Water Matrix|Before a single compound leaves the tea leaf, the water itself sets the stage. Pure H2O is actually a poor tea solvent — it needs dissolved minerals to function optimally. Calcium and magnesium ions act as flavor carriers. Water with a TDS of 50-150 ppm provides the ideal mineral balance. The pH matters too: slightly acidic water extracts catechins more efficiently.\n\nLayer 2: The Amino Acid Foundation|L-theanine constitutes 1-3% of the dry weight and is the compound most responsible for tea's unique calming-yet-alert effect. It dissolves readily at temperatures as low as 50°C, making it one of the first compounds to enter your cup. L-theanine contributes a distinct umami sweetness that forms the foundation of tea's flavor architecture.",

    ":::STAT_BIG_NUMBER:::1,000+|Distinct chemical compounds identified in brewed tea",

    ":::IMG_FULL_BLEED:::The chemistry visible in a cup of tea|https://images.unsplash.com/photo-1544787219-7f47ccb76574?w=800&h=1200&fit=crop",

    ":::DEFINITION_LARGE:::Mouthfeel|The tactile sensation of tea on the palate, independent of taste and aroma. Mouthfeel encompasses viscosity, astringency, smoothness, and coating quality. It is produced primarily by polyphenols interacting with salivary proteins and mucous membranes.",

    ":::TEXT_SIDEBAR_RIGHT:::The Leaf-to-Water Ratio|This seemingly mundane parameter is the second most important variable after temperature. Western-style brewing typically uses 2-3 grams per 200ml, creating a dilute but balanced single infusion. Gongfu brewing uses 5-8 grams per 100ml, producing a concentrated liquor for multiple short infusions. Each approach extracts the same compounds in different proportions.|https://images.unsplash.com/photo-1530968033775-2c92736b131e?w=800&h=1200&fit=crop",

    ":::IMG_WITH_CAPTION_BOTTOM:::A clear glass gaiwan revealing the color gradient of a first-flush Darjeeling infusion|https://images.unsplash.com/photo-1571934811356-5cc061b6821f?w=800&h=1200&fit=crop",

    ":::TEXT_TRIPLE_COL:::The Polyphenol Layer|Polyphenols — particularly catechins in green tea and theaflavins in black tea — are responsible for astringency, bitterness, and much of tea's reputed health benefit. EGCG is the most abundant catechin and the most studied. In the cup, catechins bind to salivary proteins, creating the characteristic astringent sensation.\n\nThe Volatile Aroma Layer|Over 600 volatile compounds have been identified in tea, though only 30-40 contribute meaningfully to aroma. Linalool (floral, citrusy) is the most common. Geraniol (rose-like) dominates heavily oxidized teas. The aromatic profile changes as the cup cools, because different volatiles evaporate at different rates.\n\nThe Pigment Layer|The color of tea liquor comes from dissolved pigments. Chlorophyll produces the bright green of Japanese greens. Theaflavins create the golden-orange of first-flush Darjeeling. Thearubigins generate the deep copper-red of Yunnan black. The color of your cup is a diagnostic tool revealing processing history.",

    ":::IMG_FULL_BLEED:::Tea in its many colors|https://images.unsplash.com/photo-1530968033775-2c92736b131e?w=800&h=1200&fit=crop",

    ":::TEXT_SINGLE_COL:::The phenomenon known as 'hui gan' (回甘) — literally 'returning sweetness' — is one of the most prized qualities in Chinese tea evaluation. After swallowing, a sensation of sweetness develops in the throat and back of the palate, often intensifying over 30-60 seconds.",

    ":::TEXT_JUSTIFIED_NARROW:::The mechanism is believed to involve salivary amylase enzymes interacting with starch residues left by the tea's polysaccharides, combined with a contrast effect: after the initial bitterness of catechins fades, the remaining amino acids and glycosides are perceived as comparatively sweet. The duration of hui gan is considered a primary quality indicator in puerh, oolong, and high-mountain green tea.",

    ":::INDEX_GRID:::Compound Quick Reference|L-Theanine: Umami, calm focus|EGCG: Bitter, astringent, antioxidant|Caffeine: Stimulating, slightly bitter|Linalool: Floral aroma|Theaflavins: Brisk, golden color|Thearubigins: Body, red-brown color|Geraniol: Rose-like aroma|Glutamic acid: Umami depth|Polysaccharides: Sweetness, body|Saponins: Foaming, slight bitterness",

    ":::TEXT_SINGLE_COL:::The temperature of the cup as you drink it is itself a variable that transforms the experience. Most tea is brewed between 70°C and 100°C, but the optimal drinking temperature is 55-65°C — the range where the palate can perceive the full spectrum of flavor without heat interference.",

    ":::TEXT_SIDEBAR_IMAGE:::The journey of a cup from brew temperature to room temperature is a continuously evolving flavor experience. The first sip delivers primarily aroma and heat. The middle sips reveal full complexity of taste, texture, and aftertaste. The final sips, as the cup cools, expose the tea's foundational sweetness and body, stripped of volatile aromatics. Attentive tea drinkers learn to read each temperature stage as a different chapter.|The evolving cup|https://images.unsplash.com/photo-1597318181409-cf64d0b5d8a2?w=800&h=1200&fit=crop",

    ":::TASTING_NOTES_GRID:::Cup Analysis Framework|Appearance: Color, clarity, viscosity|Aroma (wet leaf): Intensity, character, complexity|Aroma (liquor): Top notes, heart notes, base notes|Taste: Sweetness, bitterness, umami, sourness|Mouthfeel: Body, astringency, smoothness, coating|Aftertaste: Duration, hui gan, throat sensation|Overall: Balance, complexity, memorability",

    ":::RECIPE_CARD:::Diagnostic Brewing Protocol|Use 3g leaf per 150ml to standardize|Water: filtered, 80°C for comparison brewing|Steep exactly 3 minutes — no more, no less|Pour into a white evaluation cup for color assessment|Smell wet leaves immediately after pouring|Taste at 55°C for maximum flavor perception|Note aftertaste duration in seconds|Compare across samples using identical parameters",

    ":::QUOTE_MINIMAL:::Every cup of tea is a chemistry experiment. The question is whether you are the scientist or the bystander.",

    ":::COPYRIGHT_PAGE:::Teajia Technical"
  ],
  author: PEOPLE.sarah,
};

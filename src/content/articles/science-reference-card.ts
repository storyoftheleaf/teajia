import { ContentType } from '../../types';
import { ReadableStory } from '../../types/read';
import { PEOPLE } from '../people';

export const scienceReferenceCard: ReadableStory = {
  id: 'template-science-ref',
  type: ContentType.Article,
  status: 'published',
  title: 'Science Reference Card',
  subtitle: 'Water Temperature',
  thumbnailUrl: 'https://picsum.photos/800/1200?random=sr100',
  durationOrTime: '24 Pages',
  origin: 'In-house',
  description: 'A practical science reference featuring temperature charts, brewing parameters, and quick-reference data cards.',
  category: 'science',
  tags: ['Brewing', 'Water', 'Tasting'],
  content: [
    ":::COVER_MAIN:::Water Temperature|The Complete Brewing Reference|https://picsum.photos/800/1200?random=sr101",

    ":::TEXT_DROP_CAP:::Water temperature is the single most controllable variable in tea brewing, and arguably the most consequential. A ten-degree difference can transform a sweet, nuanced green tea into a bitter, astringent disappointment — or coax hidden depth from an oolong that seemed flat at a lower temperature. Yet most tea drinkers treat water temperature as an afterthought, pouring boiling water over everything and hoping for the best. This guide exists to change that. We present the science of extraction as it relates to temperature, provide practical brewing charts for every major tea category, and explain the 'why' behind each recommendation so you can adapt intelligently to any tea you encounter. Temperature is not a rule to follow blindly — it is a tool to wield with understanding.",

    ":::STAT_BIG_NUMBER:::10°C|The difference between a perfect cup and a ruined one",

    ":::RECIPE_CARD:::Japanese Green Tea|Temperature: 60–70°C (140–158°F)|Leaf-to-water: 4g per 100ml|First steep: 60–90 seconds|Second steep: 30 seconds|Third steep: 45 seconds with +5°C|Notes: Lower temperatures emphasize umami and sweetness from L-theanine. Gyokuro can go as low as 50°C for maximum sweetness. Ice-cooled water produces an intensely sweet, almost syrupy brew.",

    ":::RECIPE_CARD:::Chinese Green Tea|Temperature: 75–85°C (167–185°F)|Leaf-to-water: 3g per 150ml (grandpa style) or 5g per 100ml (gaiwan)|First steep: 15–20 seconds (gaiwan) or 3 minutes (grandpa)|Second steep: 10–15 seconds|Third steep: 20 seconds|Notes: Chinese greens tolerate higher temperatures than Japanese greens due to pan-firing during processing. Longjing and Biluochun benefit from 80°C. Mao Feng prefers 75°C.",

    ":::TEXT_DOUBLE_COL:::The Science of Extraction|Tea brewing is fundamentally an extraction process — hot water dissolves soluble compounds from the dry leaf. The rate and selectivity of this extraction depend primarily on three variables: temperature, time, and leaf-to-water ratio. Temperature is the master variable because it determines which compounds dissolve and how quickly. At lower temperatures (50–70°C), amino acids like L-theanine and simple sugars dissolve readily, producing a sweet, umami-rich liquor. Catechins — the compounds responsible for bitterness and astringency — dissolve more slowly at these temperatures, so they remain largely in the leaf. As temperature increases above 80°C, catechin extraction accelerates dramatically, and the balance shifts toward bitterness and body.\n\nWhy Different Teas Need Different Temperatures|The optimal brewing temperature for any tea depends on its chemical composition, which is shaped by processing. Green teas retain high levels of catechins (particularly EGCG) because oxidation has been halted early. These catechins are easily over-extracted at high temperatures, producing unpleasant bitterness. Black teas, by contrast, have had most of their catechins converted to theaflavins and thearubigins during oxidation — compounds that are less bitter and require higher temperatures to extract fully. Oolong teas fall along a spectrum, and their optimal temperature correlates roughly with their oxidation level: lighter oolongs brew better at 85–90°C, while heavily roasted oolongs can handle 95–100°C.",

    ":::TEXT_TRIPLE_COL:::The Amino Acid Window|Between 50°C and 70°C, L-theanine and glutamic acid dissolve freely while catechins remain largely bound in the leaf matrix. This is the 'sweet spot' for umami-forward teas like gyokuro and high-grade sencha. Brewers who never venture below 80°C are missing an entire dimension of tea flavor.\n\nThe Catechin Threshold|Above 80°C, EGCG extraction rates increase by roughly 300% compared to 60°C brewing. This is why over-heated green teas taste bitter — you have extracted a disproportionate amount of catechins relative to the balancing amino acids and sugars. The solution is not to avoid catechins entirely but to control their ratio.\n\nThe Volatiles Peak|Aromatic volatile compounds — the molecules responsible for tea's fragrance — are most effectively released between 85°C and 95°C. This is why aromatic oolongs and high-quality black teas benefit from near-boiling water: you need the heat to liberate linalool, geraniol, and other fragrance molecules from the leaf matrix.",

    ":::LIST_CHECKLIST:::Water Quality Essentials|Use filtered water — chlorine destroys delicate aromas|Total dissolved solids (TDS) should be 50–150 ppm|Avoid distilled water — some minerals are needed for proper extraction|Fresh water contains more dissolved oxygen — reboiled water tastes flat|pH between 6.5 and 7.5 is ideal for most teas|Hard water (high calcium) mutes flavor — use a filter or spring water|Soft water amplifies bitterness — a small amount of mineral content is beneficial",

    ":::TEXT_SIDEBAR_RIGHT:::The Bubble Guide|Ancient Chinese tea masters used visual cues to judge water temperature long before thermometers existed. Their system remains surprisingly useful today. 'Shrimp eyes' — tiny bubbles forming on the bottom of the kettle — indicate approximately 70°C. 'Crab eyes' — slightly larger bubbles beginning to rise — signal 80°C. 'Fish eyes' — large bubbles rising steadily — mean 85°C. 'String of pearls' — continuous streams of bubbles — indicate 90–95°C. A full rolling boil, with vigorous turbulence across the surface, is 100°C. With practice, you can judge temperature within 5°C using these visual cues alone, freeing yourself from the tyranny of the thermometer.|https://picsum.photos/600/800?random=sr108",

    ":::RECIPE_CARD:::White Tea|Temperature: 75–85°C (167–185°F)|Leaf-to-water: 4g per 150ml|First steep: 3–5 minutes (Western) or 20 seconds (gongfu)|Second steep: 15 seconds (gongfu)|Notes: White tea is more forgiving than green but still benefits from temperatures below boiling. Silver Needle opens slowly — longer first steeps are rewarded. Aged white tea (5+ years) can handle 95°C and often improves with it.",

    ":::RECIPE_CARD:::Light Oolong (Taiwanese High Mountain, Tieguanyin)|Temperature: 85–92°C (185–198°F)|Leaf-to-water: 6g per 100ml (gaiwan or small teapot)|First steep: 15–20 seconds|Second steep: 10–15 seconds|Third steep: 15–20 seconds|Fourth–eighth steep: +5 seconds each|Notes: Light oolongs are ball-rolled and need heat to unfurl. The first steep is often a 'wake-up' pour. Peak flavor typically arrives at steeps 3–5. Water should be just off the boil — pour from a height to cool slightly.",

    ":::RECIPE_CARD:::Dark Oolong (Da Hong Pao, Shui Xian, Aged Oolong)|Temperature: 95–100°C (203–212°F)|Leaf-to-water: 7g per 100ml|First steep: 10–15 seconds (rinse first)|Second steep: 10 seconds|Third–sixth steep: +5 seconds each|Notes: Heavily roasted oolongs demand full boiling water. The roasting process has stabilized the leaf chemistry, making over-extraction far less likely. These teas can yield 8–12 steeps with proper technique.",

    ":::IMG_FULL_BLEED:::Steam rising from a clay kettle on a charcoal brazier|https://picsum.photos/800/1200?random=sr112",

    ":::DEFINITION_LARGE:::Extraction Curve|The relationship between brewing time and the concentration of dissolved compounds in the liquor. The curve is not linear — most extraction occurs in the first 30 seconds, with diminishing returns thereafter. Temperature shifts the entire curve upward (more extraction per unit time) and also changes which compounds are preferentially extracted.",

    ":::RECIPE_CARD:::Black Tea (Orthodox)|Temperature: 90–95°C (194–203°F)|Leaf-to-water: 3g per 200ml (Western) or 5g per 100ml (gongfu)|First steep: 3–4 minutes (Western) or 10 seconds (gongfu)|Notes: Orthodox black teas — Darjeeling, Keemun, Dian Hong — often perform best slightly below full boil. The extra 5–10°C headroom prevents over-extraction of tannins while still liberating the complex aromatics that make these teas special.",

    ":::RECIPE_CARD:::Puerh (Sheng and Shou)|Temperature: 95–100°C (203–212°F)|Leaf-to-water: 7–8g per 100ml|Rinse: 5 seconds (essential for compressed tea)|First steep: 10 seconds|Subsequent steeps: +5 seconds per round|Notes: Puerh demands the hottest water you can provide. Compressed cakes need boiling water to open the leaves. Shou puerh benefits from a rinse to remove any musty flavors from the fermentation process. Good puerh can yield 15–20 steeps.",

    ":::TEXT_SINGLE_COL:::Cold brewing deserves special mention as a temperature extreme that produces an entirely different extraction profile. When tea is steeped in refrigerator-temperature water (4–8°C) for 6–12 hours, the result is a naturally sweet, almost entirely non-bitter liquor. At these temperatures, catechins extract at negligible rates, while amino acids, simple sugars, and certain aromatic compounds dissolve slowly but steadily. The result is a tea that emphasizes sweetness and body while suppressing astringency. Cold-brewed gyokuro is a revelation — thick, sweet, intensely umami, with almost no bitterness whatsoever. Cold brewing also extracts significantly less caffeine (roughly 50–70% less than hot brewing), making it an excellent option for evening drinking. The trade-off is time: cold brewing requires patience and planning that hot brewing does not.",

    ":::INDEX_GRID:::Quick Temperature Reference|Green (Japanese): 60–70°C|Green (Chinese): 75–85°C|White: 75–85°C|Yellow: 75–80°C|Light Oolong: 85–92°C|Dark Oolong: 95–100°C|Black (Orthodox): 90–95°C|Black (CTC): 100°C|Sheng Puerh: 95–100°C|Shou Puerh: 100°C|Herbal: 100°C|Cold Brew: 4–8°C",

    ":::TASTING_NOTES_GRID:::Temperature Effects on Flavor|Below 70°C: Sweet, umami, smooth, delicate|70–80°C: Balanced, floral, clean, nuanced|80–90°C: Aromatic, structured, moderate body|90–95°C: Full-bodied, brisk, malty, rich|100°C: Bold, tannic, robust, deeply extracted",

    ":::COPYRIGHT_PAGE:::Teajia Science"
  ],
  author: PEOPLE.sarah,
};

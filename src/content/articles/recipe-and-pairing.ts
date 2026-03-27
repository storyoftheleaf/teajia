import { ContentType } from '../../types';
import { ReadableStory } from '../../types/read';
import { PEOPLE } from '../people';

export const recipeAndPairing: ReadableStory = {
  id: 'template-recipe',
  type: ContentType.Article,
  status: 'published',
  title: 'Tea in the Kitchen',
  subtitle: 'Recipes & Pairings',
  thumbnailUrl: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&h=1200&fit=crop',
  durationOrTime: '18 Pages',
  origin: 'In-house',
  description: 'Lapsang-smoked duck, hojicha panna cotta, and a jasmine gimlet — tea belongs in the kitchen.',
  tags: ['Tasting'],
  content: [
    ":::COVER_MASTHEAD:::Tea in the Kitchen|Recipes & Pairings|https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&h=1200&fit=crop",

    ":::TEXT_DROP_CAP:::For most of its four-thousand-year history, tea was food before it was beverage. The earliest records from Yunnan describe tea leaves pounded with garlic, salt, and chili into a paste eaten with rice — a practice that survives today in the lahpet thoke of Myanmar and the miang of northern Thailand. Tang dynasty preparation involved grinding compressed tea cakes into powder and boiling the result with salt, dried orange peel, and ginger.",

    ":::TEXT_SIDEBAR_IMAGE:::This method would horrify modern purists but understood something essential: tea is a culinary ingredient of extraordinary versatility. Its bitterness balances fat. Its tannins cut richness. Its aromatics — floral, fruity, smoky, marine — can complement or contrast with virtually any flavor profile. The recipes that follow are explorations of tea's oldest identity: as something you eat, drink, cook with, and share at a table where the line between food and tea dissolves entirely.|Tea leaves and aromatics|https://images.unsplash.com/photo-1563911892437-1feda0179e1b?w=800&h=1200&fit=crop",

    ":::IMG_FULL_BLEED:::Mise en place: tea leaves, aromatics, and seasonal ingredients|https://images.unsplash.com/photo-1564890369478-c89ca6d9cde9?w=800&h=1200&fit=crop",

    ":::TEXT_DOUBLE_COL:::The Principles|Cooking with tea requires understanding a few fundamental principles. First, extraction time matters enormously. Tea releases its compounds in a predictable sequence: amino acids and light aromatics in the first thirty seconds, catechins and body in the next two minutes, heavy tannins and bitterness after three minutes. A broth steeped for sixty seconds will taste completely different from one steeped for five minutes.\n\nFat and Heat|Second, fat is tea's best friend. The aromatic compounds in tea are largely fat-soluble, meaning they bind more readily to butter, oil, and cream than to water. Infusing tea into a fat produces flavors of startling intensity. Third, heat destroys delicacy. The most nuanced aromatics in a fine tea are volatile compounds that evaporate at high temperatures. For dishes where subtlety matters, add tea at the end of cooking or use it in cold preparations.",

    ":::TEXT_SIDEBAR_IMAGE:::Building a tea cooking pantry starts with five essential teas, each chosen for a distinct culinary role. Lapsang Souchong provides deep, piney smoke that works with red meat and dark chocolate. Hojicha offers nuttiness without astringency — perfect for baking and custards. Jasmine pearl tea brings floral perfume to seafood and light desserts. Aged shou puer contributes earthiness that elevates braises. And ceremonial-grade matcha delivers vivid color and umami.|The tea pantry essentials|https://images.unsplash.com/photo-1530968033775-2c92736b131e?w=800&h=1200&fit=crop",

    ":::RECIPE_CARD:::Lapsang-Smoked Duck Breast|1. Score skin of 2 duck breasts in crosshatch pattern, season generously with salt.|2. Line a wok with foil. Combine 50g Lapsang Souchong, 50g raw rice, 30g brown sugar.|3. Place mixture in wok, set a wire rack above it.|4. Heat on high until mixture begins to smoke heavily.|5. Place duck breasts skin-side up on rack. Cover tightly.|6. Smoke for 12 minutes. Remove duck, rest 5 minutes.|7. Sear skin-side down in a cold pan, render fat on medium heat for 8-10 minutes until deeply golden.|8. Flip, cook 2 minutes for medium-rare. Rest 5 minutes, slice thin.",

    ":::TASTING_NOTES_GRID:::Pairing: Lapsang Souchong|Smoke|Pine|Dried Longan|Campfire|Leather|Caramel",

    ":::IMG_FULL_BLEED:::The art of tea-smoked duck|https://images.unsplash.com/photo-1571934811356-5cc061b6821f?w=800&h=1200&fit=crop",

    ":::TEXT_SIDEBAR_RIGHT:::Why This Works|The smoking step uses a technique borrowed from Chinese tea-smoked duck but simplifies it for home kitchens. The Lapsang Souchong leaves release a concentrated pine-tar aroma when heated. The raw rice provides bulk smoke and distributes heat evenly. The brown sugar caramelizes, adding a sweet glaze. The key insight is that the duck is not cooked during the smoking phase — it is only flavored. The actual cooking happens in the pan afterward, where the rendered fat carries the smoke flavor throughout the meat.|https://images.unsplash.com/photo-1545579133-99bb5ab189bd?w=800&h=1200&fit=crop",

    ":::TEXT_SINGLE_COL:::The result is a duck breast with the depth of a twelve-hour barbecue achieved in under thirty minutes. Serve with wilted greens dressed in sesame oil and a scatter of toasted pine nuts to echo the piney smoke of the tea.",

    ":::IMG_GRID_2x2:::Clockwise from top left: scoring the skin, the smoking setup, rendering in the pan, the finished slice|https://images.unsplash.com/photo-1563911892437-1feda0179e1b?w=800&h=1200&fit=crop|https://images.unsplash.com/photo-1530968033775-2c92736b131e?w=800&h=1200&fit=crop|https://images.unsplash.com/photo-1544432415-6f4ee803d572?w=800&h=1200&fit=crop|https://images.unsplash.com/photo-1571934811356-5cc061b6821f?w=800&h=1200&fit=crop",

    ":::RECIPE_CARD:::Hojicha Panna Cotta with Yuzu Curd|Panna Cotta:|1. Heat 400ml heavy cream to just below simmer.|2. Remove from heat, add 20g loose hojicha leaves. Steep 7 minutes.|3. Strain, return to pan. Add 60g sugar, stir to dissolve.|4. Bloom 5g gelatin in 30ml cold water, then stir into warm cream until dissolved.|5. Pour into 4 ramekins. Refrigerate at least 4 hours.|Yuzu Curd:|1. Whisk 3 egg yolks, 80g sugar, 60ml yuzu juice, zest of 2 yuzu.|2. Cook over double boiler, stirring constantly, until thick enough to coat spoon.|3. Remove from heat, whisk in 40g cold butter.|4. Cool, then spoon over set panna cotta.",

    ":::TEXT_SINGLE_COL:::The marriage of hojicha and yuzu is one of those pairings that feels inevitable once you taste it. Hojicha's roasting process eliminates the grassy astringency of green tea and replaces it with a toasty, almost chocolatey warmth — think caramelized sugar, roasted barley, and a hint of tobacco.",

    ":::TEXT_SIDEBAR_IMAGE:::Yuzu, with its electric citrus acidity and floral complexity, cuts through the richness of the cream while amplifying the tea's aromatic depth. The panna cotta itself should tremble on the spoon — just barely set, so that the first touch of the tongue causes it to collapse into silk. The hojicha flavor should be present but not aggressive: a warm background note that emerges more fully as the cream warms to body temperature. If the tea flavor is too faint, increase steeping to ten minutes. If too bitter, reduce to five.|Hojicha and yuzu — a natural pairing|https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&h=1200&fit=crop",

    ":::LIST_CHECKLIST:::Tea Dessert Pantry Essentials|Ceremonial-grade matcha (for vivid color and clean bitterness)|Hojicha powder (for baking — more forgiving than leaf)|Jasmine pearls (for infusing into cream and syrup)|Lapsang Souchong (for chocolate pairings and smoking)|Aged shou puer (for caramel and dark fruit desserts)|Osmanthus oolong (for stone fruit and honey desserts)|White peony (for delicate custards and ice cream)",

    ":::RECIPE_CARD:::Jasmine Gimlet|1. Prepare jasmine tea syrup: steep 15g jasmine pearl tea in 200ml hot water (80°C) for 3 minutes. Strain. Dissolve 200g sugar into the warm tea. Cool completely.|2. In a shaker with ice: 60ml London dry gin, 30ml fresh lime juice, 20ml jasmine tea syrup.|3. Shake hard for 15 seconds.|4. Double strain into a chilled coupe glass.|5. Garnish with a single jasmine pearl floated on the surface.",

    ":::IMG_WITH_CAPTION_BOTTOM:::The jasmine gimlet — where the cocktail hour meets the tea ceremony|https://images.unsplash.com/photo-1544432415-6f4ee803d572?w=800&h=1200&fit=crop",

    ":::QUOTE_MINIMAL:::The best tea pairing is the one that makes you forget you are drinking tea and eating food separately. — Chen Wei",

    ":::TEXT_DOUBLE_COL:::The Cocktail Connection|Tea and spirits share more chemistry than most bartenders realize. Both are complex infusions — water passing through plant material to extract flavor. The flavor compounds in tea interact with ethanol in ways that can amplify, mute, or transform both ingredients. Gin, with its botanical backbone, is the most natural spirit partner for tea.\n\nBeyond the Gimlet|Lapsang Souchong makes a remarkable substitute for liquid smoke in whiskey cocktails. Aged puer, cold-brewed and mixed with dark rum and coconut cream, produces something like a tea-inflected Mai Tai. And matcha, whisked into a paste then shaken with vodka and elderflower liqueur, yields a vivid green drink that tastes like a garden in a glass. Treat the tea not as a novelty but as a botanical component on par with herbs and spices.",

    ":::IMG_FULL_BLEED:::The beauty of tea-infused cocktails|https://images.unsplash.com/photo-1594631252845-29fc4cc8cde9?w=800&h=1200&fit=crop",

    ":::TASTING_NOTES_GRID:::Pairing: Jasmine Pearl|Jasmine Flower|Honeysuckle|Chestnut|Sweet Cream|Citrus Peel|Green Grape",

    ":::TEXT_SINGLE_COL:::The deeper principle behind all tea cooking and pairing is this: tea is not a single flavor but a spectrum. Within the six major categories — green, white, yellow, oolong, red, and dark — there are thousands of distinct flavor profiles, each the product of cultivar, terroir, season, and processing.",

    ":::TEXT_JUSTIFIED_NARROW:::Learning to cook with tea means learning to navigate this spectrum with the same fluency that a chef applies to their spice rack. It means understanding that a delicate Silver Needle and a heavily roasted Wuyi rock oolong have almost nothing in common except their botanical origin. Start with the five essential teas outlined in this article, learn how each behaves, then begin to explore the vast territory beyond.",

    ":::COPYRIGHT_PAGE:::Recipes and text by Chen Wei\nFood photography by Teajia Studios\nCocktail development with Taipei Mixology Lab\n\nTeajia Magazine — Kitchen Series"
  ],
  author: PEOPLE.chen,
};

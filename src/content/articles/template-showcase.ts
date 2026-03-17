import { ContentType } from '../../types';
import { ReadableStory } from '../../types/read';
import { PEOPLE } from '../people';

export const templateShowcase: ReadableStory = {
  id: 'template-showcase',
  type: ContentType.Article,
  status: 'published',
  title: 'Layout Template Showcase',
  subtitle: 'Every layout variant, demonstrated',
  thumbnailUrl: 'https://images.unsplash.com/photo-1556881286-fc6915169721?w=800&h=1200&fit=crop',
  durationOrTime: '94 Pages',
  origin: 'In-house',
  description: 'A visual reference guide showcasing every available layout template in the Teajia magazine reader.',
  tags: ['Teaching', 'Culture', 'Brewing'],
  content: [
    // =============================================
    // GROUP 1: COVER VARIANTS
    // =============================================

    ":::COVER_MAIN:::Layout Template Showcase|Every variant, demonstrated|https://images.unsplash.com/photo-1556881286-fc6915169721?w=800&h=1200&fit=crop",

    ":::COVER_MINIMAL:::Layout Template Showcase|A Complete Reference",

    ":::COVER_TYPOGRAPHIC:::Layout Template Showcase|Every variant demonstrated",

    ":::COVER_PHOTO_INSET:::Layout Template Showcase|Visual Reference Guide|https://images.unsplash.com/photo-1544787219-7f47ccb76574?w=800&h=1200&fit=crop",

    ":::COVER_SPLIT:::Layout Template Showcase|All Layouts in One Place|https://images.unsplash.com/photo-1563911892437-1feda0179e1b?w=800&h=1200&fit=crop",

    ":::COVER_MASTHEAD:::Layout Template Showcase|The Definitive Teajia Design Reference|https://images.unsplash.com/photo-1545579133-99bb5ab189bd?w=800&h=1200&fit=crop",

    ":::COVER_ABSTRACT:::Layout Template Showcase|Geometric Elegance",

    // =============================================
    // CHAPTER: TEXT LAYOUTS
    // =============================================

    ":::CHAPTER_BOLD:::01|Text Layouts",

    ":::TEXT_SINGLE_COL:::TEXT_SINGLE_COL — The workhorse single-column layout. Best for standard body text, introductions, and narrative paragraphs. Provides clean reading flow with generous margins. Use this when your content needs to breathe and the reader should focus on the prose without distraction.",

    ":::TEXT_DOUBLE_COL:::TEXT_DOUBLE_COL — Two-column justified layout with column rules. Ideal for dense informational content, reference material, and longer passages that benefit from newspaper-style presentation. The text flows naturally from the first column to the second, maximizing use of the page while maintaining readability.",

    ":::TEXT_TRIPLE_COL:::TEXT_TRIPLE_COL — Three-column layout for maximum density. Best suited for glossaries, indexes, quick-reference material, or any content where space efficiency matters more than leisurely reading. The narrower columns create a distinctly editorial feel reminiscent of broadsheet newspapers and reference guides.",

    ":::TEXT_DROP_CAP:::TEXT_DROP_CAP — Opens with a large decorative initial letter. Perfect for chapter openings, essay beginnings, and any passage that deserves a stately entrance. The oversized first character draws the eye and signals the start of something significant, a tradition dating back to illuminated manuscripts.",

    ":::TEXT_JUSTIFIED_NARROW:::TEXT_JUSTIFIED_NARROW — Centered narrow column with justified text. Creates an intimate, focused reading experience. Best for contemplative passages, author's notes, or any text that benefits from a meditative pace. The generous white space surrounding the text column encourages slow, thoughtful reading.",

    ":::TEXT_VERTICAL_CJK:::TEXT_VERTICAL_CJK — Vertical right-to-left text layout for Chinese, Japanese, and Korean scripts. Honors traditional East Asian typographic conventions. Use for poetry, classical quotations, or any CJK content that deserves its traditional presentation direction.",

    ":::TEXT_SIDEBAR_RIGHT:::TEXT_SIDEBAR_RIGHT — Main text occupies two-thirds of the page, with a sidebar on the right for annotations, pull quotes, or supplementary notes. The sidebar is visually distinct with a subtle background tint.|This is the sidebar area. Perfect for marginalia, editor's notes, or cross-references that complement the main text.",

    ":::TEXT_SIDEBAR_LEFT:::TEXT_SIDEBAR_LEFT — The mirror of SIDEBAR_RIGHT. Main body text sits on the right two-thirds, with the sidebar note panel on the left. Useful for alternating sidebar placement across spreads to create visual rhythm.|Left sidebar note: ideal for definitions, translations, or contextual annotations that the reader may want to reference.",

    ":::TEXT_ASYMMETRIC_LEFT:::TEXT_ASYMMETRIC_LEFT — A wide body column paired with a narrower margin note on the left. The margin note uses a different typographic style, creating an academic or scholarly feel. Best for annotated texts and critical editions.|Marginal note: this narrow column is perfect for scholarly annotations, source citations, and editorial commentary.",

    ":::TEXT_ASYMMETRIC_RIGHT:::TEXT_ASYMMETRIC_RIGHT — Wide body column with a narrow margin note on the right. The asymmetry creates dynamic visual tension on the page. Use for essays with running commentary, teaching materials, or any text that benefits from parallel notation.|Right margin: works well for vocabulary definitions, date references, and brief supplementary context.",

    ":::TEXT_BLOCKQUOTE_CENTER:::The opening paragraph introduces the context for the quote that follows. This layout sandwiches a prominent blockquote between body text above and below.|The centered blockquote stands apart from the body text, elevated in both size and visual weight. It commands attention in the middle of the page.|The closing paragraph resumes the narrative flow after the quoted passage. TEXT_BLOCKQUOTE_CENTER is ideal for essays that weave quotations into their argument.",

    ":::TEXT_BLOCKQUOTE_LEFT:::A prominent quote occupies the left third of the page, set in italic serif type. It acts as a visual anchor.|TEXT_BLOCKQUOTE_LEFT — The quote sits on the left while body text fills the right two-thirds. This creates a dramatic pull-quote effect common in magazine feature articles. Best when the quote is short and the body text provides extended commentary.",

    ":::TEXT_INVERTED:::TEXT_INVERTED — Flips the color scheme, placing light text on a dark background (or vice versa in dark mode). Use sparingly for dramatic emphasis, important callouts, or to signal a tonal shift in the narrative. The radial gradient adds depth and prevents the inverted panel from feeling flat.",

    ":::TEXT_TYPEWRITER:::TEXT_TYPEWRITER — Monospaced font on a warm paper-like background, evoking field notes, draft manuscripts, or archival documents. Includes a revision marker in the header. Best for behind-the-scenes content, raw transcripts, processing notes, or any text that should feel unpolished and authentic.",

    ":::TEXT_HIGHLIGHTED:::$$dark$$TEXT_HIGHLIGHTED — Body text with highlighted passages rendered in a warm tint. The $$dark$$ prefix activates a darker background treatment. Use for study guides, annotated passages, or any content where key phrases deserve visual emphasis. Supports the same markup as standard text layouts.",

    ":::TEXT_CENTER_NARROW:::TEXT_CENTER_NARROW — A very narrow centered column with generous leading. Creates a meditative, poem-like reading experience even for prose. Best for brief reflections, dedications, philosophical passages, or any text under 100 words that deserves maximum white space.",

    ":::TEXT_SIDEBAR_IMAGE:::TEXT_SIDEBAR_IMAGE — Body text fills the left two-thirds while a full-height image occupies the right third. Ideal for descriptive passages about a specific place, person, or object where the image provides direct visual context. The caption overlays the bottom of the image.|https://images.unsplash.com/photo-1530968033775-2c92736b131e?w=800&h=1200&fit=crop",

    ":::TEXT_OVERLAPPING_IMAGES:::TEXT_OVERLAPPING_IMAGES — Body text with two slightly rotated, overlapping photographs in the upper right corner. Creates an informal, scrapbook-like feel. Best for personal essays, travel writing, or memoir-style content where the images feel like keepsakes rather than formal illustrations.|https://images.unsplash.com/photo-1556881286-fc6915169721?w=800&h=1200&fit=crop|https://images.unsplash.com/photo-1544787219-7f47ccb76574?w=800&h=1200&fit=crop",

    ":::TEXT_WITH_VIDEO:::TEXT_WITH_VIDEO — Text above and below a horizontal 16:9 video embed. The video placeholder appears when no videoId is provided. Best for articles that reference documentary footage, tutorials, or any horizontal video content.|Additional context below the video area. This layout gracefully handles missing video by showing a placeholder with play icon.",

    ":::TEXT_WITH_VIDEO_VERTICAL:::TEXT_WITH_VIDEO_VERTICAL — Text surrounding a vertical 9:16 video embed, sized for mobile-first content like Reels or TikTok. The narrower video frame sits centered on the page.|Below the vertical video. Use for social media embeds, vertical documentaries, or behind-the-scenes clips shot on phone.",

    // =============================================
    // CHAPTER: INTERVIEW LAYOUTS
    // =============================================

    ":::CHAPTER_MINIMAL:::02|Interview Layouts",

    ":::MAGAZINE_INTERVIEW_Q_A:::Q: What makes the MAGAZINE_INTERVIEW_Q_A layout special?\n\nA: It formats content as a question-and-answer exchange. Lines starting with Q: appear bold, while answers get a subtle warm background tint. It creates clear visual distinction between interviewer and subject.\n\nQ: When should I use this versus INTERVIEW_STANDARD?\n\nA: They render identically. MAGAZINE_INTERVIEW_Q_A is the preferred name for editorial interviews, while INTERVIEW_STANDARD works for any Q&A format.",

    ":::INTERVIEW_STANDARD:::Q: How does INTERVIEW_STANDARD differ from the magazine variant?\n\nA: Functionally they are the same layout. Both parse content by double newlines, alternating between question and answer styling. Use whichever name feels more natural for your content type.\n\nQ: What content formats work best here?\n\nA: Short exchanges with clear turns. For long-form interviews, break across multiple pages.",

    // =============================================
    // CHAPTER: IMAGE LAYOUTS
    // =============================================

    ":::CHAPTER_BOLD:::03|Image Layouts",

    ":::IMG_FULL_BLEED:::IMG_FULL_BLEED — Edge-to-edge photograph with a translucent caption bar at the bottom. The image fills every pixel of the page.|https://images.unsplash.com/photo-1544787219-7f47ccb76574?w=800&h=1200&fit=crop",

    ":::IMG_FULL_BLEED_TITLE:::IMG_FULL_BLEED_TITLE — Full-bleed image with a large title overlay at the bottom. A dark gradient ensures text readability.|https://images.unsplash.com/photo-1563911892437-1feda0179e1b?w=800&h=1200&fit=crop",

    ":::IMG_SPLIT_VERTICAL:::IMG_SPLIT_VERTICAL — Image occupies the top 55%, text fills the bottom 45%. A clean division for pairing a single strong photograph with descriptive body text. Use when the image sets the scene and the text provides the story.|https://images.unsplash.com/photo-1545579133-99bb5ab189bd?w=800&h=1200&fit=crop",

    ":::IMG_SPLIT_HORIZONTAL:::IMG_SPLIT_HORIZONTAL — A 50/50 horizontal split: image on top, text on bottom with a warm background tint. Similar to SPLIT_VERTICAL but with equal proportions, creating a more balanced composition.|https://images.unsplash.com/photo-1530968033775-2c92736b131e?w=800&h=1200&fit=crop",

    ":::IMG_DIAGONAL_SPLIT:::IMG_DIAGONAL_SPLIT — Two images split along a diagonal line, with a floating caption in the center. Creates dramatic visual tension. Best for comparing two subjects, showing before/after, or juxtaposing contrasting scenes.|https://images.unsplash.com/photo-1587049352846-4a222e784d38?w=800&h=1200&fit=crop|https://images.unsplash.com/photo-1571934811356-5cc061b6821f?w=800&h=1200&fit=crop",

    ":::IMG_GRID_2x2:::IMG_GRID_2x2 — Four equal images with a caption strip below|https://images.unsplash.com/photo-1556881286-fc6915169721?w=800&h=1200&fit=crop|https://images.unsplash.com/photo-1544787219-7f47ccb76574?w=800&h=1200&fit=crop|https://images.unsplash.com/photo-1563911892437-1feda0179e1b?w=800&h=1200&fit=crop|https://images.unsplash.com/photo-1545579133-99bb5ab189bd?w=800&h=1200&fit=crop",

    ":::IMG_GRID_3x3:::IMG_GRID_3x3 — Nine-image contact sheet with numbered overlays|https://images.unsplash.com/photo-1556881286-fc6915169721?w=800&h=1200&fit=crop|https://images.unsplash.com/photo-1544787219-7f47ccb76574?w=800&h=1200&fit=crop|https://images.unsplash.com/photo-1563911892437-1feda0179e1b?w=800&h=1200&fit=crop|https://images.unsplash.com/photo-1545579133-99bb5ab189bd?w=800&h=1200&fit=crop|https://images.unsplash.com/photo-1530968033775-2c92736b131e?w=800&h=1200&fit=crop|https://images.unsplash.com/photo-1587049352846-4a222e784d38?w=800&h=1200&fit=crop|https://images.unsplash.com/photo-1571934811356-5cc061b6821f?w=800&h=1200&fit=crop|https://images.unsplash.com/photo-1464982326199-86f32f81b211?w=800&h=1200&fit=crop|https://images.unsplash.com/photo-1597318181409-cf64d0b5d8a2?w=800&h=1200&fit=crop",

    ":::IMG_GRID_MONDRIAN:::IMG_GRID_MONDRIAN — Asymmetric two-image grid inspired by Mondrian compositions. One large image spans the left, two smaller panels on the right. Caption text occupies the bottom-right cell.|https://images.unsplash.com/photo-1587049352846-4a222e784d38?w=800&h=1200&fit=crop|https://images.unsplash.com/photo-1571934811356-5cc061b6821f?w=800&h=1200&fit=crop",

    ":::IMG_QUAD_GRID:::IMG_QUAD_GRID — Weighted four-image grid with one dominant image at top-left. Creates hierarchy among multiple photographs.|https://images.unsplash.com/photo-1556881286-fc6915169721?w=800&h=1200&fit=crop|https://images.unsplash.com/photo-1597318181409-cf64d0b5d8a2?w=800&h=1200&fit=crop|https://images.unsplash.com/photo-1594631252845-29fc4cc8cde9?w=800&h=1200&fit=crop|https://images.unsplash.com/photo-1582793988951-9aed5509eb97?w=800&h=1200&fit=crop",

    ":::IMG_CIRCLE_MASK:::IMG_CIRCLE_MASK — Image cropped into a large circle with italic caption below. Creates a portrait-like, intimate feel. Best for headshots, detail studies, or any image that benefits from a soft, focused presentation.|https://images.unsplash.com/photo-1597318181409-cf64d0b5d8a2?w=800&h=1200&fit=crop",

    ":::IMG_ARCH_MASK:::IMG_ARCH_MASK — Image cropped with an architectural arch shape at the top. Evokes doorways, windows, and classical proportions. Best for architectural photography, garden views, or any image where the arch frame adds narrative meaning.|https://images.unsplash.com/photo-1464982326199-86f32f81b211?w=800&h=1200&fit=crop",

    ":::IMG_OVAL_VIGNETTE:::IMG_OVAL_VIGNETTE — Image displayed with a soft oval vignette mask that fades to the background at the edges. Creates a vintage, daguerreotype-like quality. Best for portraits, still lifes, and heritage imagery.|https://images.unsplash.com/photo-1594631252845-29fc4cc8cde9?w=800&h=1200&fit=crop",

    ":::IMG_POLAROID_SCATTER:::IMG_POLAROID_SCATTER — Three images presented as scattered Polaroid-style prints with white borders and subtle rotation. Creates a casual, memory-like collage. Best for behind-the-scenes content, personal essays, or travel journals.|https://images.unsplash.com/photo-1556881286-fc6915169721?w=800&h=1200&fit=crop|https://images.unsplash.com/photo-1544787219-7f47ccb76574?w=800&h=1200&fit=crop|https://images.unsplash.com/photo-1563911892437-1feda0179e1b?w=800&h=1200&fit=crop",

    ":::IMG_FILM_STRIP_VERTICAL:::IMG_FILM_STRIP_VERTICAL — Three images stacked vertically with black borders resembling a film strip. Evokes analogue photography. Best for sequential images, process documentation, or any series that tells a story in three frames.|https://images.unsplash.com/photo-1545579133-99bb5ab189bd?w=800&h=1200&fit=crop|https://images.unsplash.com/photo-1530968033775-2c92736b131e?w=800&h=1200&fit=crop|https://images.unsplash.com/photo-1587049352846-4a222e784d38?w=800&h=1200&fit=crop",

    ":::IMG_WITH_CAPTION_BOTTOM:::IMG_WITH_CAPTION_BOTTOM — Large image occupies the top 70% of the page, with a generous caption area below in italic serif. Best for hero images that need extended captions or photographer credits.|https://images.unsplash.com/photo-1571934811356-5cc061b6821f?w=800&h=1200&fit=crop",

    ":::IMG_OVERLAY_TEXT:::IMG_OVERLAY_TEXT — Full-page image with a translucent text panel overlaid. The dark backdrop ensures readability over any photograph. Use for combining narrative text with atmospheric imagery, or for dramatic editorial spreads.|https://images.unsplash.com/photo-1464982326199-86f32f81b211?w=800&h=1200&fit=crop",

    ":::IMG_GALLERY_MOSAIC:::IMG_GALLERY_MOSAIC — Five images arranged in an asymmetric mosaic grid. One large image anchors the left, with four smaller images filling the right and bottom. Best for photo essays, gallery previews, or any collection that needs varied sizing.|https://images.unsplash.com/photo-1556881286-fc6915169721?w=800&h=1200&fit=crop|https://images.unsplash.com/photo-1544787219-7f47ccb76574?w=800&h=1200&fit=crop|https://images.unsplash.com/photo-1563911892437-1feda0179e1b?w=800&h=1200&fit=crop|https://images.unsplash.com/photo-1545579133-99bb5ab189bd?w=800&h=1200&fit=crop|https://images.unsplash.com/photo-1530968033775-2c92736b131e?w=800&h=1200&fit=crop",

    ":::IMG_DUOTONE:::IMG_DUOTONE — Full-page image rendered in duotone using grayscale plus a gold tint overlay via CSS blend modes. Creates a distinctive editorial look. Best for mood pieces, abstract compositions, or when you want the image to feel more like illustration than photography.|https://images.unsplash.com/photo-1587049352846-4a222e784d38?w=800&h=1200&fit=crop",

    ":::IMG_PANORAMIC:::IMG_PANORAMIC — A wide, cinematic 3:1 aspect ratio image centered on the page with a caption below. Best for landscape photography, cityscapes, or any image shot in panoramic format. The generous vertical white space creates a gallery-like presentation.|https://images.unsplash.com/photo-1515823064-d6e0c04616a7?w=800&h=1200&fit=crop",

    ":::IMG_VIGNETTE_SOFT:::IMG_VIGNETTE_SOFT — Full-page image with a heavy inner shadow vignette that darkens the edges. Creates a cinematic, moody atmosphere. A subtle caption sits at the bottom center. Best for dramatic landscapes and atmospheric scenes.|https://images.unsplash.com/photo-1582793988951-9aed5509eb97?w=800&h=1200&fit=crop",

    // =============================================
    // CHAPTER: QUOTE & POETRY LAYOUTS
    // =============================================

    ":::CHAPTER_MINIMAL:::04|Quotes and Poetry",

    ":::QUOTE_BIG:::QUOTE_BIG — A large, centered quotation with thin horizontal rules above and below. The text is set in italic Vollkorn with generous tracking. Use for powerful standalone quotes that deserve an entire page to themselves.",

    ":::QUOTE_MINIMAL:::QUOTE_MINIMAL — A left-aligned quotation with a subtle gold border on the left edge. More restrained than QUOTE_BIG, this layout works for shorter quotes, epigraphs, or transitional moments between sections.",

    ":::QUOTE_IMAGE_BG:::The best tea is the one you share with someone you love. QUOTE_IMAGE_BG places white italic text over a darkened photograph. Use for inspirational quotes paired with atmospheric imagery.|https://images.unsplash.com/photo-1545579133-99bb5ab189bd?w=800&h=1200&fit=crop",

    ":::POEM_CENTERED:::POEM_CENTERED\nEach line centered\non the vertical axis\nwith generous leading\nbetween the lines\nfor a serene\nmeditative rhythm",

    ":::POEM_LEFT_ALIGN:::POEM_LEFT_ALIGN\nLines begin at the left margin\nindented from the page edge\nwith an author attribution below\nBest for formal verse\nand structured poetry",

    ":::POEM_SCATTERED:::POEM_SCATTERED scatters individual words across the page at computed positions creating an experimental concrete poetry effect where meaning emerges from spatial arrangement rather than linear reading",

    ":::POEM_VISUAL:::POEM_VISUAL arranges text along a circular SVG path creating a visual poem where words flow in an endless loop around the page center",

    ":::POEM_HAIKU_MINIMAL:::Steam rises softly / Porcelain meets weathered hands / Time dissolves in warmth",

    // =============================================
    // CHAPTER: CHAPTER & STRUCTURE LAYOUTS
    // =============================================

    ":::CHAPTER_BOLD:::05|Chapter and Structure Layouts",

    ":::CHAPTER_MARKER:::CHAPTER_MARKER — A non-visual marker used only for table-of-contents navigation. It is never rendered on the page itself. Include it in your content array to define chapter boundaries that the TOC can reference without creating a visible page.",

    ":::CHAPTER_BOLD:::05|CHAPTER_BOLD — Massive background number with bold title and gold accent bar. Use for major section openings.",

    ":::CHAPTER_MINIMAL:::06|CHAPTER_MINIMAL — Centered number with a thin horizontal rule and understated title below. For quieter transitions.",

    ":::CHAPTER_CENTERED_SMALL:::07|CHAPTER_CENTERED_SMALL — Number and title centered between two extending horizontal rules. Compact and elegant.",

    ":::CHAPTER_SPLIT:::CHAPTER_SPLIT|A two-zone chapter page: the title sits in a textured upper panel, with the subtitle below a vertical gold accent line. Best for dramatic act breaks.",

    ":::CHAPTER_IMAGE_BG:::CHAPTER_IMAGE_BG — Chapter number or title overlaid on a full-bleed photograph with heavy vignette. Cinematic and immersive.|https://images.unsplash.com/photo-1587049352846-4a222e784d38?w=800&h=1200&fit=crop",

    ":::CHAPTER_LARGE_NUMBER:::08|CHAPTER_LARGE_NUMBER — An enormous translucent number fills the background while a modest title and gold rule sit near the bottom. For chapters that need gravitas.",

    ":::TOC_MINIMAL:::Covers and Front Matter|Text Layouts|Image Layouts|Quotes and Poetry|Chapter Markers|Data and Lists|Special Layouts|Closing Pages",

    ":::TOC_IMAGE:::Covers and Front Matter|Text Layouts|Image Layouts|Quotes and Poetry|Chapter Markers|https://images.unsplash.com/photo-1556881286-fc6915169721?w=800&h=1200&fit=crop|https://images.unsplash.com/photo-1544787219-7f47ccb76574?w=800&h=1200&fit=crop|https://images.unsplash.com/photo-1563911892437-1feda0179e1b?w=800&h=1200&fit=crop|https://images.unsplash.com/photo-1545579133-99bb5ab189bd?w=800&h=1200&fit=crop|https://images.unsplash.com/photo-1530968033775-2c92736b131e?w=800&h=1200&fit=crop",

    ":::DEDICATION_SIMPLE:::For every maker, taster, and wanderer who believes that beauty lives in the details — and that a single leaf can hold a universe of meaning.",

    // =============================================
    // CHAPTER: DATA LAYOUTS
    // =============================================

    ":::CHAPTER_CENTERED_SMALL:::09|Data and List Layouts",

    ":::STAT_BIG_NUMBER:::6,000|STAT_BIG_NUMBER — An enormous translucent number dominates the page with a label beneath. Use for striking statistics, milestone counts, or any single number that deserves maximum visual impact.",

    ":::STAT_CHART_MINIMAL:::Green Tea: 85|Oolong: 72|Black Tea: 60|White Tea: 45|Puerh: 38",

    ":::DATA_BAR_CHART:::Fujian Province: 92|Yunnan Province: 78|Zhejiang: 65|Taiwan: 58|Sichuan: 42|Anhui: 35",

    ":::LIST_TIMELINE:::2737 BCE — Shen Nong discovers tea when leaves blow into his boiling water|350 CE — First botanical description of tea by Guo Pu|760 CE — Lu Yu publishes the Chajing, the Classic of Tea|1610 — Dutch traders bring tea to Europe|1773 — Boston Tea Party reshapes colonial politics|1823 — Wild tea plants discovered in Assam, India|2024 — Teajia Journal launches its first digital issue",

    ":::LIST_CHECKLIST:::Source leaf from a reputable vendor|[x] Store tea in airtight, opaque containers|Preheat your brewing vessel|[x] Use filtered or spring water|Measure leaf by weight, not volume|Time your steeps carefully|Record tasting notes after each session",

    ":::RECIPE_CARD:::Traditional Gongfu Cha|Equipment: Gaiwan (100ml), fairness pitcher, tasting cups|Leaf: 5-7g of oolong or puerh|Water: 95-100°C for dark teas, 80-85°C for greens|Rinse: Pour water over leaves and discard within 3 seconds|First steep: 10-15 seconds|Subsequent steeps: Add 5 seconds per round|Continue for 6-10 infusions, noting how the flavor evolves",

    ":::INDEX_GRID:::Longjing|Tieguanyin|Da Hong Pao|Silver Needle|Gyokuro|Jin Jun Mei|Bi Luo Chun|Dian Hong|Aged Sheng",

    ":::TASTING_NOTES_GRID:::Honey|Orchid|Roasted Chestnut|Wet Stone|Cedar|Dried Apricot|Marine|Camphor|Brown Sugar|Gardenia|Muscatel|Forest Floor",

    ":::MAP_CARTOGRAPHY:::Wuyi Mountains, Fujian Province",

    // =============================================
    // CHAPTER: SPECIAL LAYOUTS
    // =============================================

    ":::CHAPTER_BOLD:::10|Special Layouts",

    ":::DEFINITION_LARGE:::Terroir|The complete natural environment in which a tea is produced, including soil composition, altitude, rainfall, surrounding vegetation, and microclimate. Terroir is the reason why the same cultivar grown in different mountains can produce dramatically different cups.",

    ":::NOTE_PAPER:::NOTE_PAPER — Ruled notebook paper with a red margin line.\n\nField notes from Wuyi Mountain, March 2024:\n- Visited the original Da Hong Pao mother bushes\n- Talked with Master Chen about traditional charcoal roasting\n- The mist was so thick we could taste it\n- Must return in autumn for the harvest season",

    ":::POSTCARD_STYLE:::Dear fellow tea traveler, greetings from the high mountains of Alishan. The fog rolls through the tea gardens each morning like a slow tide, and the oolong here tastes of butter and gardenias. Wish you could taste this cup.|https://images.unsplash.com/photo-1582793988951-9aed5509eb97?w=800&h=1200&fit=crop",

    ":::BOTANICAL_SKETCH:::Camellia sinensis var. sinensis|The Chinese small-leaf varietal, native to Yunnan Province. Produces the majority of the world's fine teas.|https://images.unsplash.com/photo-1563911892437-1feda0179e1b?w=800&h=1200&fit=crop",

    ":::CURATED_LINKS:::The History of Tea in Five Cups|https://example.com/tea-history|Eater|A sweeping overview of how tea shaped civilizations from China to Britain,How to Taste Tea Like a Professional|https://example.com/tasting-guide|Serious Eats|Practical techniques for developing your palate and identifying flavor compounds,The Science of Water Temperature|https://example.com/water-temp|Tea Nerd|Why different teas demand different temperatures and what happens at the molecular level",

    ":::NEXT_READS:::NEXT_READS — Displays a journal index of other stories in the collection. This layout is auto-populated from the recommendations prop, not from the content string. It renders as a numbered list of clickable story titles.",

    // =============================================
    // CLOSING
    // =============================================

    ":::CHAPTER_MINIMAL:::11|Closing Layouts",

    ":::EPILOGUE_CENTERED:::Every layout tells a story differently. Some whisper; some shout. The art is in matching the vessel to the tea — or in this case, matching the template to the content. May this guide serve you well.",

    ":::CREDITS_PAGE:::Layout Template Showcase\nConceived and designed by the Teajia Editorial Team\nAll layouts rendered by SinglePageRenderer\nPhotography from Unsplash\nTypeset in Vollkorn, system serif, and system mono\n\n© 2024 Teajia Journal",

    ":::BACK_COVER:::BACK_COVER — The final page. Displays the Teajia monogram, issue number, and year. A quiet, dignified close.",

    ":::COPYRIGHT_PAGE:::Teajia Editorial — All Rights Reserved"
  ],
  author: PEOPLE.chen,
};

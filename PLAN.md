# The 70-Point Article Template Overhaul

## Executive Summary

A complete redesign of the article template system in `SinglePageRenderer.tsx`, treating it as if we're art-directing a hybrid print/digital magazine. The goal: every page should feel like it was designed by a skilled magazine art director — with classic editorial backbone and selective experimental moments.

**Key principle:** With placeholder images, **typography IS the design.** Every layout must look intentional and beautiful even with grey rectangles where photos will be.

---

## SECTION A: TYPOGRAPHY & READABILITY (Changes 1–12)

These are foundation-level changes that affect nearly every template.

### 1. Establish a Proper Type Scale
**Current:** Random font sizes (text-3xl, text-4xl, text-8xl) with no consistent hierarchy.
**Change:** Implement a modular type scale across all templates:
- Display: `text-[96px]` / `text-[72px]`
- Headline: `text-[48px]` / `text-[36px]`
- Subhead: `text-[28px]`
- Body: `text-[22px]` (currently too large at text-3xl/text-4xl for body)
- Caption: `text-[14px]`
- Micro: `text-[11px]` (page numbers, attributions)

All scaled for the 800px-wide page canvas.

### 2. Body Text Size Reduction
**Current:** Body text at text-3xl/text-4xl is far too large for editorial reading. It feels like a children's book.
**Change:** Bring body text down to `text-[22px]` or `text-[20px]` with `leading-[1.65]`. This gives proper line density — ~45-55 characters per line in single column — the sweet spot for readability.

### 3. Letter-spacing & Tracking Discipline
**Current:** Sporadic `tracking-[0.3em]` on some elements, none on others.
**Change:** Apply consistent rules:
- ALL-CAPS text always gets `tracking-[0.12em]` minimum
- Display serif gets `tracking-tight` or `tracking-[-0.02em]`
- Body serif: normal tracking
- Captions/labels: `tracking-[0.08em]` with uppercase

### 4. Paragraph Spacing & Indentation
**Current:** `indent-20` on TEXT_SINGLE_COL only. No other paragraphs have indentation or proper spacing.
**Change:** Adopt a proper editorial convention: first paragraph after heading = no indent, subsequent paragraphs = `indent-[2em]`. OR: no indent anywhere, use `mb-[1.2em]` between paragraphs. Be consistent.

### 5. Drop Cap Redesign (3 Styles)
**Current:** Single drop cap style using a `<span>` float with oversized text. Looks crude.
**Change:** Create three drop cap variants:
- **Classic raised cap:** 3 lines tall, serif, same color as text, baseline-aligned with line 3
- **Inset cap:** Background-filled square, contrasting color, letter centered
- **Marginal cap:** Sits in the left margin, doesn't intrude into text block

### 6. Proper Baseline Grid Alignment
**Current:** Text floats freely — adjacent columns don't align baselines.
**Change:** In TEXT_DOUBLE_COL and TEXT_TRIPLE_COL, ensure both columns share the same line-height so baselines lock across columns. Use `leading-[32px]` (a fixed value) rather than relative leading.

### 7. Caption Typography System
**Current:** Captions are inconsistent — some use `text-2xl uppercase tracking`, others use italic serif.
**Change:** Define ONE caption style used everywhere: `text-[13px] uppercase tracking-[0.1em] font-sans opacity-60`. This creates the familiar editorial caption voice — quiet, authoritative, consistent.

### 8. Byline & Attribution Block
**Current:** No proper byline treatment in any template.
**Change:** Add a reusable byline pattern that can appear on cover pages and opening text pages: author name in small caps, role/date in lighter weight below.

### 9. Pull Quote vs Block Quote Distinction
**Current:** QUOTE_BIG and QUOTE_MINIMAL look similar. No real visual distinction.
**Change:**
- **Pull Quote** (QUOTE_BIG): Oversized italic type, generous vertical space, no quotation marks — the SIZE is the emphasis
- **Block Quote** (QUOTE_MINIMAL): Indented, smaller than body text, with a thin left border or subtle background tint — this is an aside, not a highlight

### 10. Hanging Punctuation
**Current:** Opening quotes and bullet points push text rightward.
**Change:** On QUOTE templates and lists, use `text-indent: -0.4em` or CSS `hanging-punctuation: first` so quotation marks hang outside the text block margin. This is a hallmark of professional typesetting.

### 11. CJK Vertical Text Refinement
**Current:** TEXT_VERTICAL_CJK exists but feels like an afterthought — basic vertical writing mode.
**Change:** Add proper ruby annotation support, wider character spacing (`letter-spacing: 0.25em`), and a subtle vertical rule between columns. Use `writing-mode: vertical-rl` with proper `text-orientation: mixed` for mixed CJK/Latin.

### 12. Ligature & OpenType Feature Activation
**Current:** No OpenType features enabled.
**Change:** Add `font-feature-settings: 'liga' 1, 'kern' 1, 'calt' 1` to all body text. If fonts with swash alternates are used, enable `'swsh' 1` on display-size quotes. This costs nothing and improves every text block.

---

## SECTION B: COVER TEMPLATES (Changes 13–19)

Covers are the first impression. They should be instantly striking.

### 13. COVER_MAIN Overhaul — Cinematic Full Bleed
**Current:** Has gradient overlay and title at bottom. Functional but generic.
**Change:** Redesign with a more cinematic feel:
- Move title to upper-left, breaking the expected centered convention
- Add a thin horizontal rule across the full width at ~40% height
- Place issue number/date in a corner position with monospace type
- Reduce gradient subtlety — rely on text placement over dark image areas
- Add a `mix-blend-mode: difference` option for title text over bright images

### 14. COVER_TYPOGRAPHIC Redesign — Bold & Structural
**Current:** Huge text filling the page. Too simple.
**Change:**
- Split the title into individual words, each on its own line at different sizes
- Add a geometric accent element (circle, line, rectangle) positioned asymmetrically
- Alternate weight: first word BOLD, second word LIGHT, creating rhythm
- Add a discreet folio line at the bottom: "Issue No. 03 — Spring 2024"

### 15. COVER_MINIMAL Redesign — Breathe
**Current:** Centered text with decorative line and heavy border.
**Change:**
- Remove the border — it's a crutch
- Title at exact center, subtitle significantly below with extreme tracking
- Use an ultra-thin rule (0.5px) instead of the 2px line
- Add generous negative space — the emptiness IS the design
- Micro-label in bottom corner: "A Teajia Publication"

### 16. NEW: Cover — Photo Inset
**Type:** New variant: `COVER_PHOTO_INSET`
**Design:** A mostly white/cream page with a smaller photo (60% width) centered, like a book cover. Title above the photo in clean serif, author below. Think hardcover book rather than glossy magazine.

### 17. NEW: Cover — Split Composition
**Type:** New variant: `COVER_SPLIT`
**Design:** Left half is solid color (tea-gold or dark), right half is photo. Title spans across both halves, breaking the boundary. Creates tension and visual interest.

### 18. NEW: Cover — Masthead Newspaper
**Type:** New variant: `COVER_MASTHEAD`
**Design:** Designed like a broadsheet front page — masthead at top with decorative rules, large photo below, headline overlapping the photo slightly, columns of teaser text at bottom. Old-world gravitas.

### 19. NEW: Cover — Abstract
**Type:** New variant: `COVER_ABSTRACT`
**Design:** No photo. CSS-generated abstract shapes (circles, lines, rectangles) positioned using absolute positioning with blend modes. Title cut through the composition. For articles that are conceptual rather than photo-driven.

---

## SECTION C: TEXT FLOW & COMPOSITION (Changes 20–32)

The body text templates need to feel like pages in a real publication.

### 20. TEXT_SINGLE_COL — Proper Measure & Margins
**Current:** Full-width text with `p-16` padding. The line length is too long for comfortable reading.
**Change:** Constrain text to `max-w-[520px]` centered, with wider page margins. Add a subtle header line at top (page number + article title in micro type). This immediately says "designed" rather than "dumped."

### 21. TEXT_DOUBLE_COL — Column Rules & Headers
**Current:** CSS columns with gap-12. Just split text.
**Change:**
- Add a thin column rule: `column-rule: 0.5px solid currentColor/10`
- Add a running header at top with article title and page number
- Use justified text with proper hyphenation (`hyphens: auto`)
- Ensure first paragraph has no indent, subsequent paragraphs indent

### 22. Implement TEXT_TRIPLE_COL
**Current:** Falls through to default fallback — broken.
**Change:** Three-column layout best for shorter content blocks (lists, brief items). Columns of equal width with thin rules. Header spanning all three columns. Good for ingredient lists, reference pages, glossaries.

### 23. Implement TEXT_SIDEBAR_LEFT (Mirror of RIGHT)
**Current:** Falls through to default.
**Change:** Mirror the TEXT_SIDEBAR_RIGHT layout: main text on the right 2/3, sidebar on the left 1/3. Sidebar has a softer background tint and italic text. The image sits in the sidebar.

### 24. Implement TEXT_ASYMMETRIC_LEFT & RIGHT
**Current:** Falls through to default.
**Change:** Wide column (65%) for body text, narrow column (35%) for marginal notes in a different typeface (sans vs serif). Like academic book marginalia. The narrow column holds captions, cross-references, or secondary commentary.

### 25. Implement TEXT_BLOCKQUOTE_CENTER
**Current:** Falls through to default.
**Change:** A page centered around a single powerful quote with body text above and below. The quote sits in a recessed band that spans the full page width with a slightly tinted background. Text above and below is regular body text.

### 26. Implement TEXT_BLOCKQUOTE_LEFT
**Current:** Falls through to default.
**Change:** Body text on the right 2/3 of the page, with a large indented quote on the left 1/3 set in italic serif at a larger size. The quote acts as a visual anchor for the page.

### 27. Implement TEXT_TYPEWRITER
**Current:** Falls through to default.
**Change:** Monospace font, slightly uneven letter-spacing, paper texture more prominent, wider margins. Mimics a typed manuscript page. Include a "revision number" at top right in red. Perfect for journal entries, field notes, or personal reflections.

### 28. Implement TEXT_HIGHLIGHTED
**Current:** Falls through to default.
**Change:** Body text with certain phrases wrapped in a CSS highlight effect — a yellow-ish `background: linear-gradient(to bottom, transparent 55%, tea-gold/15 55%)` underline that looks like a highlighter pen. Use `<mark>` elements in the content.

### 29. Implement TEXT_CENTER_NARROW
**Current:** Falls through to default.
**Change:** Text centered in a very narrow column (~380px), like a poem or meditation. Large line-height (`leading-[2.2]`). No justification. Each sentence breathes. Good for introductions, philosophical passages.

### 30. Implement TEXT_SIDEBAR_IMAGE
**Current:** Falls through to default.
**Change:** Two-thirds text, one-third a tall image that runs the full height of the page. Text wraps around the image at the top and bottom. The image is inset with a thin border and caption below.

### 31. Implement TEXT_OVERLAPPING_IMAGES
**Current:** Falls through to default.
**Change:** Body text with 2-3 small images that overlap each other and slightly overlap the text, creating a collage feel. Images are rotated 1-3 degrees. Text flows around them. This is the "experimental" layout — messy but intentional.

### 32. Implement MAGAZINE_INTERVIEW_Q_A / INTERVIEW_STANDARD
**Current:** Falls through to default.
**Change:** Proper interview layout:
- Questions in **bold sans-serif** with the interviewer label
- Answers in regular serif, indented
- Interviewee's name highlighted on first answer
- Optional: small avatar/photo next to each speaker
- Alternating subtle background tints for readability

---

## SECTION D: IMAGE PRESENTATION (Changes 33–45)

Photos should feel curated and presented, not just "placed."

### 33. IMG_FULL_BLEED Refinement
**Current:** Image fills page with gradient overlay at bottom for caption.
**Change:**
- Remove the heavy bottom gradient — captions should be outside the image or very subtly overlaid
- Add a very thin white border (2px inset from edges) — the "gallery frame" effect
- Caption in micro type at bottom-left, not full-width gradient

### 34. IMG_FULL_BLEED_TITLE Refinement
**Current:** Centered frosted glass box over image.
**Change:** Replace the frosted box with clean typography directly on the image using `text-shadow` for legibility. Or: title at bottom-left on a small opaque strip. The frosted box is a dated UI pattern.

### 35. Implement IMG_DIAGONAL_SPLIT
**Current:** Falls through to default.
**Change:** Two images split by a diagonal line (CSS `clip-path: polygon()`). One image fills the upper-left triangle, the other fills the lower-right. Dramatic and unexpected. Caption centered at the intersection.

### 36. Implement IMG_GRID_2x2
**Current:** Falls through to default.
**Change:** Four equal images in a 2x2 grid with thin (2px) gaps. No captions inside — a single caption below the grid. Clean and systematic.

### 37. Implement IMG_GRID_3x3
**Current:** Falls through to default.
**Change:** Nine images in a contact-sheet arrangement. Each image small. Good for showing process steps or variations. Numbered 1-9 in the corner of each cell.

### 38. Implement IMG_QUAD_GRID
**Current:** Falls through to default.
**Change:** Four images, but NOT equal. Layout: one large (top-left, 60% × 60%), one tall (top-right, 40% × 100%), two small (bottom-left, each 30% × 40%). Creates visual hierarchy within the grid.

### 39. IMG_GRID_MONDRIAN Refinement
**Current:** Basic 2x2 grid with one cell for text. Functional.
**Change:** Make the proportions more dramatic — the large cell should be truly dominant (70% width). Add a thin gold accent line between cells. Text cell gets a different background tone. The asymmetry should feel designed, not default.

### 40. Implement IMG_OVAL_VIGNETTE
**Current:** Falls through to default.
**Change:** Image with a CSS `mask-image: radial-gradient(ellipse 70% 80%, black 50%, transparent 80%)` creating a soft oval vignette. Very classic, very editorial. Image appears to float on the page.

### 41. Implement IMG_POLAROID_SCATTER
**Current:** Falls through to default.
**Change:** 3-4 images styled as polaroid snapshots (white border, slight shadow, small caption below each in handwriting-style font). Each slightly rotated (`rotate-[-2deg]`, `rotate-[3deg]`). Overlapping slightly. Nostalgic and warm.

### 42. Implement IMG_WITH_CAPTION_BOTTOM
**Current:** Falls through to default.
**Change:** Photo occupies top 70%, bottom 30% is a white strip with a generous caption in proper editorial format: italic text, photographer credit, location. Like a gallery exhibition label.

### 43. Implement IMG_OVERLAY_TEXT
**Current:** Falls through to default.
**Change:** Full-page image with a large text block overlaid using `mix-blend-mode: difference` or a semi-transparent panel. Text reads directly on the image. High impact, editorial feel.

### 44. Implement IMG_GALLERY_MOSAIC
**Current:** Falls through to default.
**Change:** 5+ images in an organic masonry-like arrangement with varying sizes. Some images larger, some smaller, arranged to fill the page without rigid grid lines. Like a mood board.

### 45. Implement IMG_DUOTONE
**Current:** Falls through to default.
**Change:** Apply a CSS duotone effect: `filter: grayscale(100%)` with a `mix-blend-mode: multiply` colored overlay. Two color channels only (e.g., dark brown + gold). Creates striking, unified color palette from any photo. Perfect for placeholder images.

---

## SECTION E: VISUAL EFFECTS & ATMOSPHERE (Changes 46–52)

The texture layer that gives pages personality.

### 46. Paper Texture Refinement
**Current:** A single `stardust.png` transparent texture at 5% opacity on ALL pages.
**Change:**
- Make texture conditional: some pages should be clean (photo pages, dark pages)
- Use a more appropriate texture — fine linen or aged paper grain
- Increase to 8% on text-heavy pages, reduce to 0% on full-bleed images
- Add a subtle warm color cast (`bg-[#faf6f0]`) for cream paper feel in light mode

### 47. Implement IMG_VIGNETTE_SOFT
**Current:** Falls through to default.
**Change:** Full-page image with heavy CSS vignette (`box-shadow: inset 0 0 150px rgba(0,0,0,0.5)`). Creates a moody, tunnel-vision effect. Caption centered at bottom in light text.

### 48. Dark Mode Template Refinement
**Current:** `$$dark$$` prefix flips to dark mode. Implementation is basic.
**Change:**
- Dark mode should feel like a different magazine, not just inverted colors
- Dark pages: near-black background (`#0d0d0d`), ivory text, gold accents warmer
- Add subtle radial gradient from center (slightly lighter) to edges (darker)
- Borders become lighter and more subtle

### 49. Page Edge & Margin Decoration
**Current:** No margin decoration. Pages are flat rectangles.
**Change:** Add optional margin ornaments:
- Thin rule at top with folio (page number, article title)
- Bottom rule with section name
- Corner marks (crop marks) for print feel — thin L-shapes in corners at 5% opacity

### 50. Gradient Accent Strips
**Current:** No gradient elements.
**Change:** Add horizontal gradient strips (3px tall) in tea-gold at top or bottom of text-heavy pages. Creates a subtle warmth and visual anchor. Different from a solid rule — the gradient fades to transparent at the edges.

### 51. Implement NOTE_PAPER
**Current:** Falls through to default.
**Change:** Mimics a handwritten note on ruled paper:
- Light horizontal lines (every ~32px)
- Left margin line in red/pink at ~15% from left
- Slightly off-white background
- Text in a handwriting-influenced font or monospace
- Maybe a slight rotation (0.5deg) for that "placed on desk" feel

### 52. Implement POSTCARD_STYLE
**Current:** Falls through to default.
**Change:** Page divided vertically: left half for image, right half for "written" text with:
- Stamp decoration in upper-right corner
- "AIR MAIL" stripe across top
- Address lines at bottom-right
- Message text with wider line spacing
- Worn edge effect around the border

---

## SECTION F: CHAPTER & SECTION DESIGN (Changes 53–60)

Pacing matters. Chapter breaks and section markers control rhythm.

### 53. CHAPTER_BOLD Redesign
**Current:** Basic large number with "Chapter" label and gold bar.
**Change:**
- Number should be MASSIVE (250px+) and semi-transparent (10% opacity), acting as a background element
- Chapter title overlays the number at normal size
- Thin horizontal rule below
- Subtitle in tracked small caps
- Remove the word "Chapter" — the number speaks for itself

### 54. Implement CHAPTER_MINIMAL
**Current:** Falls through to default.
**Change:** The quietest chapter break: just a centered number in light weight, a thin rule, and the chapter title. Maximum white space. For meditative, slow-paced articles.

### 55. Implement CHAPTER_CENTERED_SMALL
**Current:** Falls through to default.
**Change:** Small chapter number and title centered vertically and horizontally. Flanked by thin horizontal rules extending to page edges. Clean and balanced.

### 56. Implement CHAPTER_IMAGE_BG
**Current:** Falls through to default.
**Change:** Full-page background image with centered chapter number and title in white. Similar to a movie title card. Heavy vignette around edges. Text uses `text-shadow` for legibility.

### 57. Implement CHAPTER_LARGE_NUMBER
**Current:** Falls through to default.
**Change:** The number fills the ENTIRE page as a background element at 5% opacity. It's a graphic element. The chapter title sits in the lower-third, small and precise. The contrast between the monumental number and small title creates tension.

### 58. CHAPTER_SPLIT Refinement
**Current:** Top half background, bottom half white with subtitle. Basic.
**Change:**
- Top half: dramatic — use a pattern or texture fill instead of flat color
- Title: positioned at the boundary between halves, straddling the line
- Add a vertical accent line descending from the title
- Bottom half: chapter description in smaller text

### 59. Implement DEDICATION_SIMPLE
**Current:** Falls through to default.
**Change:** Centered italic text, small, positioned at exact vertical center. Maximum restraint. Perhaps just:
*"For those who take the time to steep."*
Ultra-minimal. No ornaments except a thin rule above and below.

### 60. Implement TOC_IMAGE
**Current:** Falls through to default.
**Change:** Table of contents with small thumbnail images next to each entry. Left column: chapter images (small, square). Right column: chapter title and page number connected by dot leaders (`...........`). Classic magazine TOC.

---

## SECTION G: POETRY, QUOTES & SPECIAL CONTENT (Changes 61–70)

These are the pages that provide emotional punctuation.

### 61. Implement POEM_LEFT_ALIGN
**Current:** Falls through to default.
**Change:** Poem left-aligned with generous left margin (~35%). Each line on its own. No justify. Large line-height. Author attribution right-aligned below. The wide left margin creates a runway of white space.

### 62. Implement POEM_SCATTERED
**Current:** Falls through to default.
**Change:** Words/phrases positioned absolutely around the page using CSS positioning. Each word at a different location, different size. The reader's eye must travel. Experimental and artistic. Works for short poems (under 20 words).

### 63. Implement POEM_VISUAL (Concrete Poetry)
**Current:** Falls through to default.
**Change:** Text arranged in a shape — circular, spiral, or custom path using CSS. The form of the text IS the content. Implementation via SVG `<textPath>` or careful absolute positioning.

### 64. Implement POEM_HAIKU_MINIMAL
**Current:** Falls through to default.
**Change:** Extreme minimalism: three lines centered, generous vertical spacing between them. Page is 90% white space. Small season word (kigo) at bottom in micro type. Perhaps a single thin ink-brush stroke decoration.

### 65. Implement QUOTE_IMAGE_BG
**Current:** Falls through to default.
**Change:** Full-page image with a large quote overlaid. Different from IMG_OVERLAY_TEXT in that the quote is the HERO — it's bigger, centered, and the image is darkened more aggressively. Attribution below in small caps.

### 66. Implement LIST_TIMELINE
**Current:** Falls through to default.
**Change:** Vertical timeline running down the page center with events/dates branching left and right alternately. Connected by a thin vertical line with small circles at each node. Dates in monospace, descriptions in serif.

### 67. Implement LIST_CHECKLIST
**Current:** Falls through to default.
**Change:** Styled checklist with custom checkbox icons (drawn circles, not browser checkboxes). Each item well-spaced. Checked items get a strikethrough with reduced opacity. Good for brewing guides, travel packing lists.

### 68. Implement BOTANICAL_SKETCH
**Current:** Falls through to default.
**Change:** Page designed like a botanical illustration plate:
- Centered image with thin border
- Numbered callout lines pointing to features
- Scientific name in italic Latin
- Common name below
- Grid/measurement marks at edges
- Caption in micro type

### 69. Implement EPILOGUE_CENTERED
**Current:** Falls through to default.
**Change:** Short closing text centered on page. Preceded by a decorative end-mark (■ or ❧ or a custom SVG). Large vertical spacing above. Author name and date below. The page says "this is the end" with quiet authority.

### 70. Implement BACK_COVER
**Current:** Falls through to default.
**Change:** The final page of every article:
- Clean, mostly empty
- Small Teajia logo/monogram centered
- Issue number and date in micro type
- Optional barcode/QR decoration at bottom (decorative, not functional)
- A single-sentence teaser for the next article: "Next: [title]"

---

## Implementation Strategy

### Phase 1: Foundation (Changes 1–12)
Modify the shared constants, base classes, and typography helpers in SinglePageRenderer. These affect ALL templates and should be done first.

### Phase 2: Fix Existing (Changes 13–15, 20–21, 33–34, 39, 46–50, 53, 58)
Improve the ~30 templates that already have implementations. Focus on polish: margins, type sizes, spacing, texture.

### Phase 3: Implement Missing (Everything else)
Build out the ~30 layout variants that currently fall through to the generic default. Each should be distinct and purposeful.

### File Changes
- **Primary:** `src/components/SinglePageRenderer.tsx` — all 70 changes touch this file
- **Types:** `src/types.ts` — add any new LayoutVariant enum entries (covers: ~4 new)
- **Articles:** Update 2-3 article files to showcase new templates
- **Styles:** Potentially add CSS classes to `src/styles/card-utilities.css` for reusable patterns

### Constraints
- All changes must work within the existing page-based system (fixed 3:4 aspect ratio)
- Must respect the `$$dark$$` mode toggle
- Must work with placeholder images (picsum.photos)
- Must follow COLOR_RULES.md (tea-text, tea-surface, tea-bg, tea-gold, tea-border tokens only)
- Must preserve the editable/readOnly mode for the editor

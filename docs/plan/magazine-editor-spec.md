# Magazine Admin Editor — Specification

*Feature plan. Read VISION.md first.*

Last updated: April 2026

---

## What This Is

An admin-side article creation and editing system that lets Adrian:
1. Paste in raw interview transcripts (translated from Chinese or other sources)
2. Use an AI assistant to transform raw text into structured, formatted article blocks
3. Choose a print-quality layout template from the existing design system
4. Add photos, pull quotes, captions
5. Preview the article as it will appear in the magazine (page-by-page, print-quality)
6. Publish directly — no code required

This replaces the current workflow where articles must be written as TypeScript files in `src/content/articles/`. Everything moves to the database.

---

## The Three Layers

### Layer 1 — Article Storage (D1)
Articles move from code files to D1. A `articles` table stores each article as:
- Metadata: title, subtitle, author_id, published_at, status (draft/published), cover image URL, tags, category
- Content: `blocks` JSON column — array of content blocks (same shape as the existing `Story` type blocks)
- Layout: `layout_template` — which of the existing layout variants to use
- SEO: slug, description

The existing magazine renderer already knows how to render `Story` blocks. The migration is: articles come from the API instead of being imported from TypeScript.

### Layer 2 — Admin Article Editor
A rich admin interface at `/admin/magazine/new` and `/admin/magazine/:id/edit`:

**Step 1 — Raw Input**
A full-screen textarea where Adrian pastes:
- Raw interview transcript (translated)
- Or rough notes / existing text
- Or structured content he's already written

**Step 2 — AI Processing**
One button: "Structure with AI"
The raw text is sent to Claude (via Cloudflare Worker → Anthropic API). Claude returns a structured article draft:
- Extracted headline suggestion
- Intro paragraph
- Organized sections with headers
- Identified pull quotes
- Suggested captions for any photo descriptions in the text
- Tags/category suggestions

Adrian reviews the AI output in a side-by-side view. He can accept, reject, or edit any block.

**Step 3 — Block Editor**
A visual block editor where each content block can be:
- Paragraph
- Pull quote
- Subheading
- Image (with caption)
- Divider
- Lore/sidebar block

Blocks can be reordered (drag or up/down arrows). Each block has an "AI rewrite" button — highlight a block, click, and Claude rewrites it.

**Step 4 — Layout + Design**
Choose a layout template from the existing ~20 print-quality templates (not all 150+ — a curated subset of the best ones that are print-appropriate). Preview updates live.

**Step 5 — Photos**
Upload or paste image URLs. Assign to image blocks. The existing article image system handles the rendering.

**Step 6 — Preview + Publish**
Full-screen preview at magazine quality — exactly what readers will see. Print button exports to PDF (browser print, the layout CSS handles it). Publish button sets status to 'published' and the article appears in the magazine feed.

### Layer 3 — Smart Paste (no API tokens)

Adrian structures articles externally via his Claude.ai subscription, then pastes the result into the editor. The editor auto-parses the pasted text into blocks using a simple, defined format.

**The paste format** (Adrian instructs Claude to output this):
```
TITLE: The Art of Roasting Oolong
SUBTITLE: A conversation with Master Chen in Wuyi
AUTHOR: barry

---

INTRO
The first thing you notice about Master Chen's roasting room...

---

SECTION: Finding the Right Heat
Paragraph text here. More text.

---

QUOTE: "The fire talks to the tea. You listen for what it says."

---

IMAGE: [photo description or URL]
CAPTION: Master Chen adjusting the charcoal bed, late afternoon.

---

SECTION: The Second Roast
...
```

The "Smart Paste" button in the editor parses this format into typed blocks automatically — no external API call, no cost. Adrian then edits block by block, picks a layout, previews, and publishes. Multiple article directions can be explored by asking Claude for different angles before pasting.

**Prompt Adrian gives Claude.ai:**
> "Structure this interview transcript as a Teajia magazine article. Output in the Teajia paste format: TITLE, SUBTITLE (optional), AUTHOR (if known), then sections using INTRO / SECTION: heading / QUOTE: 'text' / IMAGE: description / CAPTION: text, each separated by ---. Tone: elevated but grounded, not pretentious. Preserve quotes exactly. 600–1200 words."

---

## Migration Plan

**Phase A — Parallel existence (build first)**
- New articles go to D1
- Existing code-based articles remain (`src/content/articles/`) and are still rendered
- The magazine feed shows both sources, DB articles sorted above code articles
- No existing content is touched

**Phase B — Migration (later)**
- Code-based articles (currently all template showcases / demo content) are either:
  a. Migrated to DB as real articles when real content is ready
  b. Archived / removed when real content replaces them

**Phase C — Code cleanup**
- Remove `src/content/articles/` once all real content is in D1

---

## Editorial Voice (AI System Prompt Core)

The AI editor must know Teajia's voice. System prompt guidelines:
- Tone: elevated but not pretentious. Grounded depth. The reader is intelligent and curious, not a beginner.
- No marketing language. No hyperbole. Tea is not "magical" or "transformative" — it's complex, cultural, worth understanding.
- Preserve the interview subject's authentic voice in all quotes. Never paraphrase quotes.
- Structure: articles should have a clear beginning (who, where, context), middle (what they said, what it means), and end (why it matters, what it connects to).
- Length guide: 600–1200 words for a standard article. Photo essays can be shorter. Long-form interviews can go to 2000 words.

---

## What We're NOT Building

- A general-purpose CMS (this is Teajia-specific)
- A collaborative editor (Adrian is the only publisher)
- Real-time autosave (manual save is fine, draft state persists)
- Comment systems on articles
- Subscriber paywall

---

## Open Questions Before Building

1. **Photo storage**: Where do article photos live? Options:
   - Cloudinary (already used for product images — check if Cloudflare config exists)
   - R2 (Cloudflare's S3-compatible storage — natural fit for Workers)
   - URL references only (paste in hosted image URLs, no upload)
   For the first version: URL references is fastest. Upload can come in Phase B.

2. **Anthropic API key**: The Worker needs `ANTHROPIC_API_KEY` as a Cloudflare secret. This needs to be set via `wrangler secret put ANTHROPIC_API_KEY`.

---

## Build Sequence

1. D1 articles table + Worker API routes (CRUD: create, read, update, publish)
2. Admin routes `/admin/magazine` (list), `/admin/magazine/new`, `/admin/magazine/:id/edit`
3. Block editor UI (no AI yet — just structured editing)
4. Magazine feed updated to pull from DB (parallel with code articles)
5. AI structuring endpoint in Worker + Claude API integration
6. AI assistant UI in the editor (the "Structure with AI" + per-block rewrite buttons)
7. Layout template picker + live preview
8. Print/PDF export via browser print CSS

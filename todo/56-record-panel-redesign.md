# Record Panel — Senior Design Review & Refinement

## What's Actually Wrong (Beyond "too bright")

Looking at this panel the way a senior designer would audit a properties panel at Linear, Notion, or Figma:

### The obvious problems (original request)
- **Contrast assault**: Every value at full cream `#ede4d4` — no hierarchy, everything screams equally
- **Border noise**: Horizontal lines on every row = spreadsheet, not editorial tool
- **Textarea boxes**: Visible outlined rectangles feel like a form, not integrated content
- **Text too small to read**: 4-row fixed textareas bury the most valuable content

### The structural problems (what a senior would also flag)

1. **No image management**: Products without images show nothing. The current hero strip (only visible when imageUrl is set) is a passive display with no upload/manage capability. The new thumbnail manager (section M) replaces it.

2. **7 toggle pills with no grouping**: Featured, Public, Curated, Personal are *metadata*. Reorder, Recheck are *operational*. QR is an *action*. They're all presented identically. Group by purpose or move operational ones elsewhere.

3. **Status buried as a text field**: Status (Draft/Active/Archived/Sold Out) is the single most important operational field — it determines if a tea is visible, sellable, or retired. It's buried as an editable text input identical to "Form" or "Year". It should be a prominent, colored badge/selector near the header.

4. **Collapsible sections**: You have 6+ sections. Identity and Origin rarely change after initial setup. A power user editing stock/pricing or enriching wisdom doesn't want to scroll past 12 static fields every time. Collapsible sections with memory (stay collapsed/expanded across products) is table-stakes for this kind of panel.

5. **"Wisdom & Sensory" is 6 subsections crammed into one**: Experience, Mood, Tasting Notes, Terroir, Processing Notes, Lore — each deserves visual breathing room. Currently they blur together.

6. **Pricing inputs vs. outputs aren't visually distinct**: Editable fields (Batch Cost, Weight) and calculated read-only values (Source Cost/g, Exchange Rate, True Cost) use nearly identical styling. The relationship between inputs → outputs should be instantly visible.

## Design Principles

1. **Only the product name deserves full brightness** — everything else recedes
2. **Spacing replaces borders** — row borders removed, section dividers become warm inset shadows
3. **Invisible until focused** — textareas and inputs show no borders at rest
4. **Gold section labels** — match the left sidebar's `text-tea-gold/40` pattern
5. **Collapsible by default** — Identity/Origin collapse after first setup; Wisdom stays open for enrichment work
6. **Status is king** — promote it to the header area as a colored badge

## Files to Modify

- `src/admin/components/InventoryView.tsx` — the panel (lines 1858-2252) and Ghost components (lines 121-198)
- `worker/src/index.ts` — implement `handleUploadImage` (line 1199, currently returns 501)
- `src/lib/api.ts` — `api.uploadImage()` already exists (line 402), no changes needed

## Changes

### A. GhostInput & GhostTextarea (lines 121-198)

**GhostTextarea (line 144):** Make border invisible at rest, softer on focus
- `border border-tea-border/50 focus:border-tea-accent focus:bg-tea-surface/50` → `border border-transparent focus:border-tea-border focus:bg-tea-surface/30`

**GhostInput (line 195):** Soften focus state
- `focus:border-tea-accent focus:bg-tea-surface/50` → `focus:border-tea-border focus:bg-tea-surface/30`

### B. Panel Container & Header (lines 1863-1897)

**Panel container (line 1868):**
- Remove `border-l border-tea-border`
- Update boxShadow: `'-12px 0 40px -8px rgba(0,0,0,0.35), inset 1px 0 0 var(--tea-accent-sub)'`

**Header bg (line 1872):** `bg-tea-surface/50` → `bg-tea-surface/30`

**Header subtitle (line 1876):** `text-tea-text-sec` → `text-tea-text-dim`

### C. Text Hierarchy (throughout panel)

| Element | Before | After |
|---|---|---|
| Section headings (IDENTITY, ORIGIN, etc.) | `text-tea-text-sec/40` | `text-tea-gold/40` |
| Field labels (Name, Country, etc.) | `text-tea-text-sec` | `text-tea-text-dim` |
| Field values (GhostInput) | `text-tea-text` | `text-tea-text-sec` |
| Textarea body text | `text-tea-text/80` or `/70` | `text-tea-text-sec` |
| Sub-labels (Experience, Mood, etc.) | `text-tea-text-sec/50` | `text-tea-text-dim` |
| Calculated read-only values | `text-tea-text-sec` | `text-tea-text-dim` |
| Calculated labels | `text-tea-text-sec/60` | `text-tea-text-dim` |
| Product name, Retail gold, True Cost gold | unchanged | unchanged |

### D. Border Strategy

**Remove all intra-section row borders:**
- Lines 1958, 1986, 2013, 2044: Remove `border-b border-tea-border last:border-0` / `border-b border-tea-border` from field rows
- Line 2083 (retail override): Remove `border-t border-tea-border`, replace with `pt-3 mt-2`

**Section dividers — replace hard borders with warm inset shadows:**

| After Section | Divider |
|---|---|
| Header | Keep `border-b border-tea-border` (firm edge is correct here) |
| Image | Remove border |
| Toggle Pills | Replace with `style={{ boxShadow: 'inset 0 -1px 0 var(--tea-accent-sub)' }}` |
| Identity | Same inset shadow |
| Origin & Source | Remove entirely (Stock heading provides separation) |
| Stock & Pricing | Same inset shadow |
| Image URL | Remove entirely |
| Description | Same inset shadow |
| Wisdom & Sensory | Remove (last section) |

### E. Section Rhythm

- Data sections (Identity, Origin, Stock): `py-3` → `py-4`, section heading `mb-2` → `mb-3`
- Toggle pills: `py-3` → `py-2.5`
- Description: `py-3` → `py-4`
- Wisdom & Sensory: `py-3 space-y-4` → `py-5 space-y-5`

### F. Small Refinements

**Inactive toggle pills (line 1930):**
- `text-tea-text-sec/50 border-tea-border` → `text-tea-text-dim border-transparent hover:border-tea-border`

**Tasting note pills (line 2176):**
- `text-tea-text-sec bg-tea-surface px-2 py-0.5 rounded-full border border-tea-border` → `text-tea-text-dim bg-tea-surface/50 px-2 py-0.5 rounded-full`

### G. Collapsible Sections

Add a `CollapsibleSection` wrapper used by each section in the panel. Each section heading becomes clickable with a chevron.

```tsx
const CollapsibleSection = ({ title, defaultOpen = true, children }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ boxShadow: open ? 'inset 0 -1px 0 var(--tea-accent-sub)' : 'none' }}>
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between px-5 py-3">
        <span className="text-[9px] text-tea-gold/40 uppercase tracking-[0.2em]">{title}</span>
        <ChevronRight size={12} className={`text-tea-text-dim transition-transform ${open ? 'rotate-90' : ''}`} />
      </button>
      {open && <div className="px-5 pb-4">{children}</div>}
    </div>
  );
};
```

Default states (based on Adrian's workflow — AI generates Lore/Terroir/Processing, he refines Experience/Mood/Tasting):
- **Identity**: collapsed (set once, rarely changed)
- **Origin & Source**: collapsed
- **Stock & Pricing**: open (frequently edited)
- **Images**: open (need to see/manage photos)
- **Introduction** (renamed from Description): open — Adrian's personal note about the tea (how he got it, why it's special). Rename label from "Description" to "My Introduction" in the panel to clarify its purpose vs. Lore.
- **Wisdom & Sensory subsections** — break the mega-section into individual CollapsibleSections:
  - **Experience**: open (actively reviewed and personalized)
  - **Mood & Tasting Notes**: open (actively edited, tag selectors)
  - **Terroir**: collapsed (AI-generated, review-only)
  - **Processing Notes**: collapsed (AI-generated, review-only)
  - **Lore / History**: collapsed (AI-generated, review-only)

### H. Status Badge in Header

Move Status out of the Identity section and into the panel header as a colored dropdown badge:

```tsx
// In the header, after the subtitle line:
<select value={panelProduct.status}
  onChange={e => { handleProductUpdate(panelProduct.id, 'status', e.target.value); ... }}
  className="text-[9px] uppercase tracking-[0.12em] px-2 py-0.5 rounded-md border bg-transparent appearance-none cursor-pointer ..."
  style={{ borderColor: statusColor, color: statusColor }}
>
  {['Active', 'Draft', 'Archived', 'Sold Out'].map(s => <option key={s}>{s}</option>)}
</select>
```

Status colors: Active = `tea-gold`, Draft = `tea-text-dim`, Archived = `tea-text-sec/50`, Sold Out = `text-red-400/70`

Remove Status from the Identity fields list.

### I. Remove Passive Hero Image Strip

The current hero image (lines 1902-1906) is a passive 40px strip that only shows when `imageUrl` is set. Remove it — the new Image management section (M) with uploadable thumbnails replaces its purpose and is interactive. This saves vertical space and eliminates the confusing "sometimes there, sometimes not" behavior.

### J. Toggle Pills Regrouping

Split the 7 toggles into two rows by purpose:

Row 1 — **Visibility** (metadata): Featured, Public, Curated, Personal
Row 2 — **Operations**: Reorder, Recheck | QR (action, aligned right)

Add a subtle `gap-y-1` between rows. This makes it instantly clear which toggles affect visibility vs. operational state.

### K. Pricing Visual Separation

In the Stock & Pricing section, visually separate inputs from calculated outputs:

- Editable fields (Batch Cost, Weight, Currency): same styling as other field rows
- Calculated area: wrap in a `bg-tea-surface/30 rounded-md px-3 py-2 mt-2` panel to visually nest it as "derived from above"
- This makes the input→output relationship obvious at a glance

### L. Textarea Readability — Auto-expanding Height

Textareas are too small at 4-5 fixed rows. Content gets buried.

**Fix:** Make GhostTextarea auto-expand to fit content:
- Add `useEffect` + `useRef` that sets `textarea.style.height = textarea.scrollHeight + 'px'` on value change
- `min-h-[80px]` baseline, `max-h-[300px] overflow-y-auto` cap
- Keep `resize-none` — auto-expand handles it
- Empty fields stay compact, filled fields show everything

### M. Image Section Redesign (replaces current Image URL input)

The current Image section is a single `GhostInput` for pasting a URL. Replace it with a proper image manager supporting up to 3 images with upload + thumbnails.

**Infrastructure already in place:**
- `Product.additionalImages?: string[]` in types (up to 3 total with primary)
- `additional_images TEXT DEFAULT '[]'` column in D1 schema
- `api.uploadImage(filename, filetype)` client method exists in `src/lib/api.ts:402`
- R2 bucket `teajia-media` configured in `worker/wrangler.toml`
- Working upload pattern in `handleUploadFlyer` (worker line 2035) — direct R2 put, returns public URL

**Step 1: Fix the worker endpoint** (`worker/src/index.ts` line 1199)

Replace the 501 stub with a working implementation modeled on `handleUploadFlyer`:
- Accept `multipart/form-data` with a file (simpler than presigned URLs)
- Generate key: `products/${crypto.randomUUID()}.${ext}`
- Put to `env.MEDIA_BUCKET`
- Return `{ url: 'https://media.teajia.co/${key}' }`
- Require admin auth

Also update `api.uploadImage()` in `src/lib/api.ts` to send FormData (matching the flyer pattern) instead of the current JSON body.

**Step 2: Build the Image section UI** (replaces lines 2101-2113 in InventoryView.tsx)

Replace the GhostInput URL field with:
```
IMAGE section:
- Section heading "Images" (styled like other headings with tea-gold/40)
- A row of up to 3 thumbnail slots (64x64px each, rounded-md)
  - Filled slots: show thumbnail with a subtle X overlay on hover to remove
  - Empty slots: show a dashed border placeholder with a + icon
  - Clicking an empty slot opens a hidden file input
- First image = panelProduct.imageUrl (primary)
- Images 2-3 = panelProduct.additionalImages[0] and [1]
- Upload flow: file input → api.uploadImage() → update product via handleProductUpdate
- Remove flow: clear the URL → update product
```

Thumbnail styling:
- Container: `flex gap-2`
- Filled: `w-16 h-16 rounded-md overflow-hidden relative group`
- Image: `w-full h-full object-cover`
- Remove overlay: `absolute inset-0 bg-tea-bg/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center` with X icon in `text-tea-text-sec`
- Empty slot: `w-16 h-16 rounded-md border border-dashed border-tea-border hover:border-tea-text-dim transition-colors flex items-center justify-center cursor-pointer`
- Plus icon: `text-tea-text-dim` using `Plus` from lucide-react

The existing top-of-panel image banner (lines 1902-1906) stays as-is — it shows the primary image large. The new thumbnails in the Image section below serve as the management UI.

### N. Bug Fix: "no such column: updated_at" (BLOCKS ALL EDITS)

Every product update fails because `worker/src/index.ts` line 678 injects `body.updated_at = new Date().toISOString()` into the update payload. The `products` table in the deployed D1 database doesn't have this column (it's in `schema.sql` but was added after initial deployment).

**Two-part fix:**

1. **Worker code** (`worker/src/index.ts` line 678): Remove the `body.updated_at` injection line entirely, OR wrap it in a try-catch. Safest: just remove it — the schema already has a default, and we can add it back once the column exists in prod.

2. **Run the migration** on the deployed D1 database:
   ```sql
   ALTER TABLE products ADD COLUMN updated_at TEXT DEFAULT (datetime('now'));
   ```
   This can be done via `npx wrangler d1 execute teajia-db --command "ALTER TABLE products ADD COLUMN updated_at TEXT DEFAULT (datetime('now'));"` or through the Cloudflare dashboard.

   **Recommended approach:** Do both — add the column AND keep the code. But since we can't run the migration from here, **remove the line from code first** so edits work immediately, then Adrian can run the migration at his convenience.

### O. Bug Fix: QR Code Encodes JSON Instead of URL

`src/admin/components/QrCodeModal.tsx` line 15 encodes `JSON.stringify({ id, name, type })` — phones can't open that. Fix: encode the public product page URL instead.

```typescript
const qrValue = `https://teajia.co/shop/${product.id}`;
```

### P. Mood & Tasting Notes → Tag Selectors

Currently both are free-text inputs. Convert them to tag-style selectors that pull suggestions from existing values across all products.

**Tasting Notes** (already partially there — pills render below the input):
- Compute `allTastingNotes` by collecting unique notes from all products: `[...new Set(products.flatMap(p => p.tastingNotes || []))]`
- Replace the free-text GhostInput with a combobox-style component:
  - Text input for typing/filtering
  - Dropdown of matching existing tags from `allTastingNotes`
  - Clicking a suggestion adds it as a tag
  - Existing tags shown as removable pills below
  - Still allows typing brand-new notes (not limited to existing)

**Mood** (currently single text field):
- Compute `allMoods` by collecting unique mood values from all products: `[...new Set(products.map(p => p.mood).filter(Boolean))]`
- Same combobox pattern: type to filter existing moods, click to select, or type a new one
- Mood is a single value (not array), so selecting replaces rather than appends

**Implementation approach:** Build a small `TagInput` component inline in InventoryView (or extract to a shared component) that:
- Takes `suggestions: string[]`, `value: string[] | string`, `onSave`, `multiple: boolean`
- Renders a text input + filtered dropdown + tag pills
- Reuses the existing tasting-note pill styling (`text-tea-text-dim bg-tea-surface/50 rounded-full`)
- Dropdown: `absolute z-10 bg-tea-surface border border-tea-border rounded-md shadow-lg max-h-32 overflow-y-auto`
- Items: `px-3 py-1.5 text-xs text-tea-text-sec hover:bg-tea-elevated cursor-pointer`

The `products` prop is already available in `InventoryView` to compute suggestions from.

### Q. Rename Description → "My Introduction"

In the admin panel, rename the section heading from "Description" to "My Introduction" — this makes it clear it's Adrian's personal curator's note, distinct from AI-generated Lore.

On the public site, update the display priority: show Introduction *alongside* Lore (not as a fallback). Currently `const mainStory = item.lore || item.description` means only one shows. Change to show both when present — Introduction as a personal preface, Lore as the historical/cultural story below it.

Files: `src/admin/components/InventoryView.tsx` (section label), `src/pages/ProductPage.tsx` and `src/components/shop/AlcoveCard.tsx` (display logic).

### R. Typography Fixes (across site)

Issues found during audit:

**Critical:**
1. **AlcoveCard subtitle lineHeight: 1 on 18px italic** — too tight, characters clip. Fix: `lineHeight: 1.3`
2. **Missing whitespace-pre-line on Experience** in both AlcoveCard (line ~490) and ProductPage (line ~283). Multiline experience text collapses into a single paragraph. Fix: add `whiteSpace: "pre-line"` to match Lore/Terroir/Processing which already have it.

**High:**
3. **GhostTextarea in admin panel** lacks `whitespace-pre-line` — multiline descriptions entered in the admin won't display line breaks visually while editing. Fix: add `whitespace-pre-line` to the textarea className.
4. **Admin label font size (10px)** — `text-[10px]` is used extensively for labels. Borderline accessible. Not changing now (it's a design choice for information density) but worth noting.

**Medium:**
5. **Inconsistent line-heights in AlcoveCard**: Story body = 1.75, Terroir = 1.65, Experience = 1.6. Normalize to 1.7 for all body prose sections.
6. **ProductPage title leading-tight on text-3xl/4xl** — tight on large serif text. Fix: `leading-snug` instead.

Files to fix:
- `src/components/shop/AlcoveCard.tsx` — subtitle lineHeight, Experience whitespace, normalize line-heights
- `src/pages/ProductPage.tsx` — Experience whitespace, title leading
- `src/admin/components/InventoryView.tsx` — GhostTextarea whitespace

## Verification

1. `npm run dev` → open admin inventory → click any product
2. **Styling**: values muted, no row borders, gold section headings, borderless textareas at rest
3. **Toggles work**: click Featured/Public/Curated/Personal/Reorder/Recheck — no SQLITE_ERROR
4. **Collapsible**: click section headings to collapse/expand; Identity/Origin default collapsed
5. **Status badge**: colored badge in header, dropdown to change status
6. **Auto-expand textareas**: Description/Experience/Terroir expand to show all content
7. **QR**: scan → opens `https://teajia.co/shop/{id}`
8. **Tags**: tasting notes & mood show suggestions from existing products, add/remove as pills
9. **Images**: 3-slot thumbnails, upload works (requires worker deploy)
10. **Pricing**: calculated values visually nested in a subtle panel below editable inputs
11. **Toggle grouping**: visibility toggles (row 1) vs. operational (row 2)
12. **Typography**: AlcoveCard subtitles not clipped, Experience text preserves line breaks, consistent line-heights
13. Light mode — all tokens adapt

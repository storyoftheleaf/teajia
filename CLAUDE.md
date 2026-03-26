# CLAUDE.md — Teajia Unified Project

## MANDATORY: Color & Styling Rules

**Before writing ANY component styling, read `COLOR_RULES.md`.** It defines:
- The 10 safe semantic tokens (tea-text, tea-surface, tea-bg, tea-gold, tea-border, etc.)
- Legacy aliases that MUST NOT be used (tea-ink, tea-paper, tea-seal, tea-charcoal — they lie about their behavior)
- The ban on hardcoded `rgba()` in inline styles (they don't adapt to theme)
- The ban on `border-white` and `border-black` (use `border-tea-border`)
- Required card/panel, text contrast, and hover state patterns

**Quick rule:** If your color class doesn't start with `tea-text`, `tea-surface`, `tea-bg`, `tea-elevated`, `tea-gold`, `tea-gold-lt`, `tea-border`, `tea-accent-sub`, `tea-text-sec`, or `tea-text-dim` — you're probably using the wrong token.

## MANDATORY: Bottom Navigation Clearance

**No modal, overlay, drawer, or floating element may overlap the bottom navigation bar.** The bottom tab bar is `h-[44px]` plus `env(safe-area-inset-bottom)`. Any full-screen or bottom-anchored UI must account for this:
- Use `calc(100dvh - 44px - env(safe-area-inset-bottom, 0px))` for full-height modals on mobile
- Use `bottom-[44px]` or equivalent for sticky/fixed bottom elements on mobile (below `lg:` breakpoint)
- The bottom nav only renders below `lg:` — on desktop (`lg:` and up) this clearance is not needed

## MANDATORY: Centralized Component Styles

**All reusable UI element styles live in `src/styles/card-utilities.css`.** This is the single source of truth. When you need to style a pill, badge, tag, card, or any recurring UI pattern — use the CSS classes defined there. **NEVER** inline border/background/color styles for these elements in individual components.

### Available CSS classes (defined in card-utilities.css):

| Class | Use for |
|---|---|
| `.pill` / `.pill-active` | Toggle buttons, filter chips, boolean flags |
| `.pill-active-amber` | Amber-colored active pill (warnings, alerts) |
| `.badge-status` + variant | Order/attendee/notification status labels |
| `.badge-role` + variant | User role badges (owner, admin, user) |
| `.badge-format` + variant | Media type badges (book, podcast, article, etc.) |
| `.tag` | Selected item display (tasting notes, profile tags) |
| `.tag-selectable` / `.tag-selectable-active` | Clickable tags in grids (tasting picker) |
| `.pill-action` | Small action buttons (FILL, etc.) |
| `.card-grid-item` | Product cards in grid layout |
| `.nav-control` | Circular nav/close buttons |
| `.inset-panel` | Recessed panels with warm texture |

### The No-Border Rule

**NEVER add visible `border` to pills, badges, or tags.** Differentiation comes from background tint + text color only. No `border-tea-accent/30`, no `border-amber-400/30`, no `border-white`, no `border-black`. If you find yourself writing a border on a pill or badge, use a CSS class from card-utilities.css instead.

## Project Overview

This is the unified Teajia application combining two previously separate repos:

1. **Teajia Grid** (magazine/journal/public site) — the customer-facing editorial experience
2. **Teajia Inventory** (admin/inventory/sales) — the private inventory management and invoicing system

Both are merged into a single React + TypeScript + Vite app deployed to **Cloudflare Pages** (frontend) and **Cloudflare Workers** (API) under one domain.

## Architecture Decision

- The **Grid** project is the base/shell. It provides the public-facing pages: Home, Magazine, Learn, Shop, Consult, About.
- The **Inventory** project becomes the `/admin` route, accessible only after JWT authentication.
- Both share one Cloudflare D1 database, one set of product data, one deployment.
- The public shop fetches from `/api/products/public` (no auth, sensitive fields stripped).
- The admin fetches from `/api/products` (requires admin auth, full product data).

## Source Repos

The developer (Adrian) has both repos cloned locally. When working on this project:
- Copy the **Grid** project's full source as the starting foundation into this repo
- The **Inventory** project's components go into `src/admin/`
- Do NOT delete the original repos — they stay as references

## Tech Stack (Unified)

| Concern | Choice | Notes |
|---|---|---|
| Framework | React 19 | Grid was 19, Inventory was 18. Use 19. |
| Build | Vite 6 | Grid was 6, Inventory was 5. Use 6. |
| Language | TypeScript | Both used TS |
| Routing | react-router-dom v7 | Inventory had it. Grid used manual state. Add router to Grid. |
| Server State | @tanstack/react-query v5 | From Inventory |
| Client State | zustand v5 | From Inventory. Grid used Context — migrate gradually. |
| Backend | Cloudflare Workers + D1 | REST API with JWT auth, SQLite database |
| Animation | framer-motion | From Inventory. Grid used CSS animations. |
| Styling | Tailwind (CDN in dev, build for prod) | Both used Tailwind |
| Search | fuse.js | From Inventory |
| PDF | @react-pdf/renderer | From Inventory (invoices) |
| Charts | recharts | From Inventory (admin dashboards) |
| CSV | papaparse | From Inventory (import) |
| QR | qrcode.react | From Inventory (invoices) |
| Command Palette | cmdk | From Inventory |
| Icons | lucide-react | Both used it (align on one version) |
| Deploy | Cloudflare Pages + Workers | Pages for frontend, Workers for API |

## Folder Structure (Target)

```
teajia-unified/
├── CLAUDE.md              ← This file
├── package.json
├── vite.config.ts
├── tsconfig.json
├── index.html
├── _redirects             ← Cloudflare SPA fallback
├── .env.local             ← Local env vars (not committed)
├── public/
│   └── (static assets, images, og-image.png)
├── src/
│   ├── index.tsx          ← App entry, providers, router
│   ├── App.tsx            ← Root layout with router outlet
│   ├── types.ts           ← Merged type definitions
│   ├── constants.ts       ← Merged constants
│   │
│   ├── lib/
│   │   ├── api.ts             ← Cloudflare Worker API client
│   │   ├── utils.ts           ← Currency formatting, pricing calc
│   │   ├── themeUtils.ts      ← Tea type color mapping
│   │   └── store.ts           ← Zustand store (cart, currency, auth state)
│   │
│   ├── hooks/
│   │   ├── useAdminData.ts    ← React Query hooks (useProducts, useRates)
│   │   ├── usePullToRefresh.ts
│   │   └── ...
│   │
│   ├── context/
│   │   ├── ThemeContext.tsx
│   │   ├── StoryContext.tsx
│   │   ├── InventoryContext.tsx
│   │   └── ImagePreloaderContext.tsx
│   │
│   ├── components/            ← PUBLIC site components (from Grid)
│   │   ├── HomePage.tsx
│   │   ├── MagazineTabbed.tsx
│   │   ├── Shop.tsx
│   │   ├── LearnHub.tsx
│   │   ├── ConsultPage.tsx
│   │   ├── Reader.tsx
│   │   ├── MediaViewer.tsx
│   │   ├── CartDrawer.tsx
│   │   ├── LeftSidebar.tsx
│   │   ├── BottomTabBar.tsx
│   │   ├── Icons.tsx
│   │   ├── shared/
│   │   │   ├── Footer.tsx
│   │   │   ├── SectionSkeleton.tsx
│   │   │   └── ...
│   │   ├── PhotoEssay/
│   │   │   └── VisualFeatureViewer.tsx
│   │   └── ...
│   │
│   ├── admin/                 ← ADMIN components (from Inventory)
│   │   ├── AdminLayout.tsx    ← Wrapper with dark theme + admin sidebar
│   │   ├── components/
│   │   │   ├── Sidebar.tsx
│   │   │   ├── TeaTable.tsx
│   │   │   ├── TeawareCatalog.tsx
│   │   │   ├── InventoryView.tsx
│   │   │   ├── InvoiceBuilder.tsx
│   │   │   ├── SoldItemsView.tsx
│   │   │   ├── OrdersView.tsx
│   │   │   ├── PersonalCollectionView.tsx
│   │   │   ├── SettingsView.tsx
│   │   │   ├── CommandPalette.tsx
│   │   │   ├── AuthModal.tsx
│   │   │   ├── CsvImportModal.tsx
│   │   │   ├── AddToCartModal.tsx
│   │   │   ├── AddProductModal.tsx
│   │   │   ├── Toast.tsx
│   │   │   ├── ErrorBoundary.tsx
│   │   │   └── TeaCardNewLayouts.tsx  ← The Alcove card component
│   │   └── AdminApp.tsx       ← Admin root (adapted from Inventory App.tsx)
│   │
│   ├── data/                  ← Static data files (from Grid)
│   │   ├── communityMembers.ts
│   │   ├── teaInspire.ts
│   │   └── ...
│   │
│   ├── pages/                 ← Route-level page components
│   │   ├── AboutPage.tsx
│   │   └── ...
│   │
│   └── styles/
│       └── card-utilities.css
```

## Migration Phases

### Phase 1: Foundation
- Create this repo with the unified package.json
- Copy Grid source as the base
- Verify it builds and runs with `npm run dev`

### Phase 2: Add React Router
- Replace Grid's manual `activeSection` state with react-router-dom
- Map sections to routes: `/`, `/magazine`, `/learn`, `/shop`, `/consult`, `/about`
- Remove the popstate/history.pushState manual handling
- The Grid's `setActiveSection('MAGAZINE')` calls become `navigate('/magazine')`

### Phase 3: Mount Admin
- Copy Inventory components into `src/admin/`
- Create `AdminLayout.tsx` that wraps admin pages in dark theme
- Add admin routes: `/admin`, `/admin/inventory`, `/admin/personal`, `/admin/orders`, `/admin/records`, `/admin/settings`
- Protect admin routes with auth check (JWT token or dev bypass)

### Phase 4: Unify Design System
- Merge Tailwind configs into one
- Grid tokens (public): `tea-paper`, `tea-ink`, `tea-seal`, `tea-beige`, `tea-moss`, `tea-green`
- Inventory tokens (admin): `tea-bg`, `tea-surface`, `tea-border`, `tea-text`, `tea-muted`, `tea-accent`
- Keep BOTH sets in the config. Public pages use Grid tokens, admin uses Inventory tokens.
- Admin layout applies dark background via wrapper class.

### Phase 5: Connect D1 Data (DONE)
- Cloudflare Worker API serves product data from D1 database
- Public Shop pulls from `/api/products/public` (active, public products only, sensitive fields stripped)
- Admin pulls from `/api/products` (all products, requires auth)
- InventoryContext is now a thin wrapper over `usePublicProducts` hook

### Phase 6: Deploy
- Cloudflare Pages: build command `npm run build`, output `dist`
- `_redirects` file: `/* /index.html 200`
- Environment vars in Cloudflare dashboard

## Environment Variables

```
VITE_API_URL=https://teajia-api.lightcodes.workers.dev
VITE_GEMINI_API_KEY=optional-for-ai-features
VITE_EXCHANGE_RATE_API_KEY=optional-for-live-rates
```

## Key Type Definitions (from Inventory)

The Inventory app has a well-defined Product type that should become the source of truth:

```typescript
type ProductType = 'Green' | 'Yellow' | 'White' | 'Oolong' | 'Red' | 'Dark' | 'Sheng' | 'Shou' | 'Herbal' | 'Matcha' | 'Flower' | 'Teaware' | 'Misc';
type Currency = 'USD' | 'NT' | 'Yuan' | 'IDR' | 'JPY' | 'MYR' | 'UNK';

interface Product {
  id: string;
  type: ProductType;
  givenName: string;
  chineseName?: string;
  productName: string;
  year?: number;
  originCountry: string;
  originRegion: string;
  pricePerGramUSD: number;
  costPerGramUSD: number;      // ADMIN ONLY — never expose publicly
  costAmount: number;           // ADMIN ONLY
  stockGrams: number;
  description: string;
  tastingNotes: string[];
  imageUrl: string;
  vendor?: string;              // ADMIN ONLY
  status: 'Active' | 'Archived' | 'Sold Out' | 'Draft';
  costCurrency: Currency;       // ADMIN ONLY
  isPersonal: boolean;
  canReorder: boolean;
  isPublic: boolean;            // Controls visibility on public shop
  isFeatured?: boolean;
  lore?: string;
  processingNotes?: string;
  mood?: string;
  experience?: string;
  liquorColor?: string;
}
```

## Important Notes

- Adrian prefers natural/organic aesthetic. The Grid's editorial quality is high — preserve it.
- The Alcove tea card component (`TeaCardNewLayouts.tsx`) is a premium display piece. It should eventually be used on the public shop as well.
- The Inventory app has a dev admin bypass (`isDevAdmin` toggle) for development without auth. Keep this.
- Both public and admin carts use the shared Zustand store (`src/lib/store.ts`) with persist middleware.
- Currency conversion logic in the admin's `utils.ts` is production-ready. Use it everywhere.
- The 139+ tea inventory lives in Cloudflare D1. The Grid's static markdown data has been replaced.
- Both apps use Tailwind via CDN (`<script src="https://cdn.tailwindcss.com">`). For production, consider switching to PostCSS Tailwind for proper tree-shaking, but CDN works fine for now.

## Adding New Inventory: Receipt-to-Database Workflow

When Adrian acquires new teas or teaware, new stock enters the system through this workflow. **Do not skip steps or assume the in-app AI generation is available — it is not configured yet.**

### Step 1: Receipt → CSV (in Claude conversation)

Adrian provides receipts (photos, text, or pasted breakdowns) from tea vendors. Claude parses them into a CSV matching the import format.

**Required columns from the receipt:**
- `Type` — Green, Oolong, Sheng, Shou, Dark, Red, White, Yellow, Herbal, Matcha, Flower, Teaware, Misc
- `Given Name` — Short English name
- `Chinese Name` — Hanzi characters
- `Product Name` — Full descriptive name
- `Form` — Cake, Brick, Tuo, Loose Leaf, Ball, Rolled, Powder, Bag, Other
- `Year` — Harvest/production year if known
- `Origin Country`, `Origin Region`
- `Grams` — Amount purchased
- `Stock` — Current stock (usually same as Grams for new purchases)
- `Cost Amount`, `Cost Currency` — What was paid (USD, NT, Yuan, MYR, IDR, JPY)
- `Vendor` — Source/shop name
- `Restockable`, `Personal Collection` — Yes/No
- `Status` — Active or Draft (use Draft for incoming/unreceived shipments)

For teaware add: `Teaware Category` (pot, cup, filter, etc.), `Material`, `Capacity` (ml), `Units`

### Step 2: Generate Wisdom Content (in Claude conversation)

Claude generates the rich content fields for each tea, matching the voice and depth of existing entries in `Teajia_Tea_Complete.csv`. These fields go directly into the same CSV before import:

- `Lore` — 2-3 short paragraphs: origin story, terroir significance, cultural context
- `Tasting Notes` — 3-5 comma-separated sensory descriptors
- `Processing Notes` — How the tea was made (roasting, fermentation, pressing, aging)
- `Terroir` — Growing environment (altitude, soil, climate, region character)
- `Mood` — Short phrase (e.g., "quiet persistence", "steady ground")
- `Experience` — 1-2 sentences on what drinking it feels like

**Reference file for voice/style:** `Spread Sheets/Teajia_Tea_Complete.csv` — read existing entries to match tone. Poetic but grounded. No pretension.

### Step 3: Save the CSV

Save the completed CSV to: `../1 Projects/TeaJia/Spread Sheets/Import_YYYY_Month.csv`

This file serves as both the import payload and a permanent record of that acquisition batch.

### Step 4: Import via Admin UI

Adrian imports manually: Admin → Inventory → ⋮ menu → **Import CSV** → select file. The `CsvImportModal` validates, previews, and batch-uploads to D1.

### Important Notes

- **No in-app AI generation** — the "Generate Wisdom" and "Enrich all teas" features in the admin require an API key that is not yet configured. All content generation happens in Claude conversations for now.
- **CSV is the master format** — multi-paragraph lore works fine in CSV with quoted fields. No per-tea markdown files exist.
- **Teaware skips wisdom** — teapots, cups, etc. don't need lore/mood/experience fields.
- **Group discounts** — when a vendor gives a bulk discount across multiple items, store list prices in Cost Amount and note the discount in Description, OR store actual paid amounts. Ask Adrian which he prefers.
- **Incoming stock** — mark as Status: Draft with "INCOMING" in the description until received.

## Commands

```bash
npm install          # Install dependencies
npm run dev          # Start dev server (port 3000)
npm run build        # Production build to dist/
npm run preview      # Preview production build
```

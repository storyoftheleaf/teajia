# CLAUDE.md — Teajia Unified Project

## MANDATORY: Color & Styling Rules

**Before writing ANY component styling, read `COLOR_RULES.md`.** It defines:
- The 10 safe semantic tokens (tea-text, tea-surface, tea-bg, tea-gold, tea-border, etc.)
- Legacy aliases that MUST NOT be used (tea-ink, tea-paper, tea-seal, tea-charcoal — they lie about their behavior)
- The ban on hardcoded `rgba()` in inline styles (they don't adapt to theme)
- The ban on `border-white` and `border-black` (use `border-tea-border`)
- Required card/panel, text contrast, and hover state patterns

**Quick rule:** If your color class doesn't start with `tea-text`, `tea-surface`, `tea-bg`, `tea-elevated`, `tea-gold`, `tea-gold-lt`, `tea-border`, `tea-accent-sub`, `tea-text-sec`, or `tea-text-dim` — you're probably using the wrong token.

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

## Commands

```bash
npm install          # Install dependencies
npm run dev          # Start dev server (port 3000)
npm run build        # Production build to dist/
npm run preview      # Preview production build
```

# Audit — Read section, Curate surfaces, China reachability (2026-07-01)

Three-track audit run while Adrian is in mainland China: (1) the public **Read** section,
(2) the two **Curate** surfaces (curator Collections nav + `/admin/compass` cluster),
(3) **China/GFW** reachability of everything the app touches. Findings verified against
code at commit `0f3f384`. `tsc --noEmit` and `npm run build` both pass clean.

Severity: **critical** = user-visible breakage on a live path · **high** = feature doesn't
work as advertised · **medium** = wrong behavior in a real but narrower path · **low** =
dead code / polish / latent risk.

---

## 1. China (GFW) — what's broken from mainland China

### Already working (verified — the earlier fixes hold)
- Fonts fully self-hosted (`/fonts/*.woff2`, `index.html:69-74`); no runtime Google Fonts request. CSP `font-src 'self'`.
- API is same-origin in prod (`src/lib/api.ts:159`) via the Pages Function proxy `functions/api/[[path]].ts` — sign-in, saves, uploads ride `teajia.com/api/*`.
- Email/password auth works on customer + admin surfaces → **admin sign-in from China works** (Google OAuth does not; see below).
- Worker→Google fetches (OAuth token exchange, Gemini) are edge-side, unaffected.
- PWA service worker caches `/api/` NetworkFirst — helps on jumpy connections.

### Blockers
| # | What fails | Where | Fix |
|---|---|---|---|
| C1 | **Uploaded imagery (product photos, flyers, story photos) served from `media.teajia.co`** — a different-apex subdomain, the exact pattern that got `api.teajia.com` filtered. High risk all uploads are dead in China. **Separate CSP bug affecting everyone:** `public/_headers:7` does not list `media.teajia.co` in `img-src`/`media-src` — verify on the live site; browsers may be blocking these images globally. | `worker/src/index.ts:5611,5858,7429`; `public/_headers:7` | Serve media same-origin (`teajia.com/media/*` Pages Function → R2) and fix CSP. |
| C2 | **172 `images.unsplash.com` refs (22 files) + 62 `picsum.photos` refs** — both blocked. Live hits: Read photo-essays (`src/content/photo-essays/*`), `ReadPage` thumbnails, AboutPage hero, many `src/data/*` files, `src/constants.ts`. | throughout | Mirror the ~30 distinct photos into `public/` or R2-behind-same-origin and rewrite URLs. |
| C3 | **PDF export (Invoice / Purchase Order / Compass Ledger) fetches its font from `fonts.gstatic.com` client-side** → PDF rendering breaks in China. | `src/admin/components/InvoicePdf.tsx:8`, `PurchaseOrderPdf.tsx:7`, `src/components/TeaCompass/LedgerPdf.tsx:8` | Bundle the Plus Jakarta Sans TTF in `public/fonts/` and register the local URL. |
| C4 | **`BriefingPage` hardcodes `https://api.teajia.com`** (GFW-blocked; also violates CSP `connect-src` for every visitor) → feature-status load/save fails. `McpPage` displays the same host. | `src/pages/BriefingPage.tsx:20-23`, `src/pages/McpPage.tsx:5-8` | Use `window.location.origin` like `api.ts`. |
| C5 | **MCP (`/mcp`, `/mcp/public`) unreachable from China** — the proxy only forwards `/api/*`; MCP lives only on the blocked hosts. Voice-agent control fails there. `public/llms.txt:11` still advertises the workers.dev URL. | `functions/api/[[path]].ts` | Add `functions/mcp/[[path]].ts` proxy (manual redirects for OAuth); update llms.txt. |
| C6 | **Google OAuth** — `accounts.google.com` blocked in the browser; all five "Continue with Google" surfaces fail. Google-linked accounts with no password are locked out (no OTP fallback — `/api/verify/*` delivery isn't built). | five surfaces per CLAUDE.md | Offer a "set a password" path / China hint; longer-term email OTP. |
| C7 | **`wa.me` checkout blocked in China** (intentional design; ~40 files build wa.me links). A customer physically in China cannot complete checkout. | `src/lib/whatsapp.ts:132` | Decide: WeChat/email fallback or an explicit notice for CN visitors. |

### Degraded (not blocking)
- YouTube embeds + `img.youtube.com` thumbnails (SinglePageRenderer, MediaViewer, EventRecapPage, ArticlePage video pages) → dead frames.
- Instagram reels, Spotify embeds/playlists → dead frames/links.
- Exchange-rate APIs (`exchangerate.host`, `exchangerate-api.com`, `open.er-api.com`) flaky from CN — falls back to stored rates (stale, not crashed).
- Cloudinary hero on AdvisePage intermittently reachable.
- `maps.google.com` link-outs (VendorInfoPanel, SourcesView) — prefer OSM/amap.

### Cosmetic
- `index.html:73` preconnect to dead `workers.dev` host — remove.
- `vite.config.ts:58` SW cache rule for Google Fonts — dead config.

---

## 2. Read section — broken flows

| # | Sev | Finding |
|---|---|---|
| R1 | **critical** | **Clicking any legacy Article-type story blanks the whole app.** `handleCardClick` (`src/App.tsx:536`) and the `openArticle` event listener (`App.tsx:406`) still set `viewState='PAGE_READER'`, but the PAGE_READER overlay was removed (`App.tsx:1084`) and routes render only when `viewState==='BROWSE'` (`App.tsx:791`). Live entry points: GlobalSearch journal hits (`GlobalSearch.tsx:239`), product-alcove "From the journal" cards (`AlcoveJournalSection.tsx:44`), Craft curriculum article lessons (`LearnCurriculum.tsx:312`). Screen goes blank with no recovery except tapping Craft/Advise/Shop. |
| R2 | high | **Reading History is permanently empty.** `/account/history` reads `teajia_progress_*` keys (`ReadingHistoryPage.tsx:26`) that only the unreachable legacy `Reader.tsx` writes; the real reader saves under `teajia_article_${id}`. |
| R3 | high | **Saved Stories can never be filled.** Empty state says "tap the leaf icon while reading" but no reachable reading surface has a save control; the only wired `toggleSave` saves legacy ids that the page filters out (`SavedStoriesPage.tsx:60-113`). |
| R4 | high | `/account/saved` + `/account/history` are **orphaned routes** — `MEMBER_MEMORY_LINKS` (`AccountPanel/workflows.ts:44`) is never rendered; no UI links to them. R2+R3+R4 = the whole "reading memory" feature is dead. |
| R5 | medium | **Owner edit pill missing on cold loads of `/read/porcelain-and-tea`** — `selectIsOwnerTier` reads `platformRole`, which public routes never hydrate (`storyEdit.tsx:73`, `store.ts` partialize). ReadIndex already works around this via JWT claims (`ReadIndex.tsx:302-326`); the story-edit engine didn't get the fix. Explains "edit sometimes not there" symptoms. |
| R6 | medium | **Live pages link into unpublished drafts**: Atlas → `/read/history`; Porcelain → `/read/earth-water-fire`, `/read/craft`. Drafts render fully at their URLs; `live` only hides them from the index. |
| R7 | medium | ReadIndex owner/draft gate checks only `role==='owner'` membership (admins see visitor view), and token claims memoized so a sign-in in another tab doesn't refresh until remount (`ReadIndex.tsx:315`). |
| R8 | low | `ReadingStreak.tsx` (banned by DO-NOT-BUILD) is dead code, never rendered — delete it along with ~10 unused sibling reader components, `Reader.tsx`/`SinglePageRenderer.tsx` (unreachable), `ReadPage.tsx`, `read/EndOfArticle|ReadableCard|TagFilter` (no importers). |
| R9 | low | ArticlePage: restored page index not clamped after republish (`:2463`); `qa_pair` iterates `block.items` unguarded (`:207`); ReadIndex fetches 40 articles then discards them (`:331`); "Leaf to Liquor" missing from index contents; worker `handleGetPublicArticles` never selects `blocks_preview` so excerpts fall back silently. |

Verified OK: all 17 `/read*` routes + every index/footer link resolve; `/article/:slug` end-to-end (shapes, 404 handling, immersive branching); no-vertical-scroll pagination holds (splitting now happens at authoring time — the `MAX_CHARS_PER_PAGE=600` constant in CLAUDE.md no longer exists in src); SharePanel full fallback chain; story inline-edit engine wired end-to-end incl. autosave/publish/versions; JSON.parse everywhere guarded.

---

## 3. Curate surfaces — broken flows

### Collections (curator nav → `/admin/collections`, public `/c/:slug`)
| # | Sev | Finding |
|---|---|---|
| K1 | **critical** | **Confirm-picks writes ~quantity×-inflated invoices.** `handleConfirmCollectionPicks` stores the line TOTAL in `price_at_sale` with `quantity` = grams (`worker/src/index.ts:16043-16049`); every admin surface computes `quantity × price_at_sale` (`OrdersView.tsx:847`, `EditOrderModal.tsx:99`, `AdminCart.tsx:417`, `SplitOrderModal.tsx:112`). A 100 g pick quoted at $30 shows as **$3,000**. Fix: store per-unit price (`lineTotal/quantity`) like every other invoice path. |
| K2 | high | **Curator flag ≠ publish bundle.** Sidebar shows "Curate" for `canCreateCollections` (`LeftSidebar.tsx:647`), but the route and every worker handler require the `publish` bundle (`AdminApp.tsx:760`, `requireBundle('publish')`). A member flagged curator without that bundle gets "Access Restricted". |
| K3 | low | "New Collection" button shows for publish-bundle staff the worker still 403s (needs owner OR the flag) (`CollectionsView.tsx:114` vs `index.ts:14722`). |
| K4 | low | Out-of-stock "notify me" picks get invoiced as normal priced lines — waitlist intent lost outside the WhatsApp path (`PublicCollectionPage.tsx:314`, `index.ts:16016`). |

### `/admin/compass` cluster (Curate / Quick Capture / Sources / Collection / Carry)
| # | Sev | Finding |
|---|---|---|
| P1 | high | **"Sources" and "Collection" nav children are dead ends.** `/admin/sources` redirects to `/admin/people` without `?tab=sources` → lands on Customers; non-owner admins can't reach Sources at all (`AdminApp.tsx:773`, `PeopleView.tsx:25,44`). `/admin/personal` redirects to `/admin/stock` — same place as the parent link; the personal-collection view doesn't exist (`AdminApp.tsx:771`). |
| P2 | medium | **"Carry as sample only" is fake** — renders the identical CarryForm as full carry; no sample flag anywhere client or worker (`CatalogBrowse.tsx:335`, `index.ts:16398`). Partner gets a full retail listing. |
| P3 | medium | **Compass localStorage not partitioned per account/user** (`teaCompassStore.ts:304`) — after account switch, unsynced captures sync into the WRONG account (`index.ts:8843` rebinds to current account); hydration merges so account A entries show in B; store survives logout on shared devices. `useCompassSync.ts:16` documents the risk as unhandled. |
| P4 | medium | **Failed draft promotion is silent** — `useCommitAndPromote.ts:44` captures `promotionError` but nothing renders it; "saved" toast shows, tea never reaches `/admin/capture` drafts. Likely a direct cause of "captures disappearing" on flaky China connections. |
| P5 | medium | **Carry price currency fallback hardcoded AUD** (`CatalogBrowse.tsx:506,75`) — a TWD store carrying a reference-less tea at "800" creates an 800 AUD listing. |
| P6 | medium | "Carried ✓" flash written to `localStorage['teajia_carried_flash']` but **no reader exists** (`CatalogBrowse.tsx:656`) — no confirmation after a carry; key never cleared. |
| P7 | low | Duplicate `path="activity"` route makes `AccountActivityView` unreachable (`AdminApp.tsx:701` vs `:755`); sidebar "Settings" → `/admin/settings` lands on People. |
| P8 | low | Silent-failure buttons: feedback QR (`CompassShareModal.tsx:337`), co-tasting Start (`TeaCompass/index.tsx:1017,1407`), scanner photo dropped when upload fails but extraction succeeds (`PhotoCapture.tsx:196`). |
| P9 | low | CatalogBrowse error copy claims cached data that doesn't exist (`:583`); DraftsView bulk-approve `Promise.all` gives no error UI and skips refetch on partial failure (`DraftsView.tsx:50`). |

Verified OK: all compass/capture routes + gating; carry API end-to-end incl. self/double-carry rejection; all `api.compass.*` and `api.collections.*` calls match worker routes/shapes; multi-tenancy header injection + server-side scoping; share/invite/table links point at real routes; photo upload gallery path (compress → upload → real URL, retry UI); collections CRUD, drag reorder with server resync, publish idempotency.

---

## 4. Suggested fix order

1. **K1** invoice inflation (data-corrupting: every confirmed pick creates a wrong draft invoice).
2. **R1** PAGE_READER blank screen (map Article clicks to `/article/:slug` or drop the legacy path).
3. **C1** media.teajia.co same-origin proxy + CSP img-src (unblocks all uploaded imagery in China; CSP part may affect everyone).
4. **C3** local PDF font, **C4** BriefingPage origin — small, unblock owner workflows in China.
5. **P1** Sources/Collection nav dead ends, **K2** curator gate mismatch.
6. **P3/P4** compass account bleed + silent promotion failure (likely behind "captures vanish" while traveling).
7. **C2** mirror Unsplash/picsum images; **C5** `/mcp` proxy.
8. Cleanups: R8 dead reader components (incl. banned ReadingStreak), stale preconnect, P6 flash reader or removal.

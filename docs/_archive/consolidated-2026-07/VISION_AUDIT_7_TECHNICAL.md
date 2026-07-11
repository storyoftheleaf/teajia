# Teajia Vision Audit — Part 7: Technical Architecture & Infrastructure

## Current State

Solid foundation: React 19, Vite 6, TypeScript, Zustand for state, React Query for server data, Cloudflare Workers + D1 for backend, R2 for media. The API layer is well-organized (892 lines, 10+ domains). Auth is JWT-based with proper expiry handling. Offline sync is scaffolded but incomplete.

The biggest technical debt: **data isolation between features** and **missing service worker**.

---

## Architecture Change 1: The Unified Activity Stream

### Problem

User activity is scattered across 6 unconnected stores:
- Favorites → Zustand + server sync
- Tasting journal → localStorage only
- Recently viewed → Zustand (10-item ring buffer)
- Compass entries → separate API endpoint
- Event attendance → events API
- Reading history → localStorage

### Solution: Activity Log Table

```sql
CREATE TABLE user_activity (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  activity_type TEXT NOT NULL,  -- 'purchase', 'tasting', 'event', 'favorite', 'compass', 'article_read'
  entity_type TEXT,              -- 'product', 'event', 'article', 'compass_entry'
  entity_id TEXT,
  metadata TEXT,                 -- JSON blob for type-specific data
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE INDEX idx_user_activity_user ON user_activity(user_id, created_at DESC);
CREATE INDEX idx_user_activity_entity ON user_activity(entity_type, entity_id);
```

**One table. One API endpoint. Every feature writes here.** The "My Tea Life" timeline from Part 1 becomes a single query.

API: `GET /api/activity?user_id=X&type=tasting&limit=20&offset=0`

Frontend: `useActivity(filters)` hook with React Query. Paginated, filterable, cacheable.

---

## Architecture Change 2: Product Relationships

### Problem

Products exist in isolation. No "similar products," no "pairs with," no "from the same vendor." The data for all of these relationships exists but isn't queryable.

### Solution: Relationship Tables + Pre-computed Similarity

```sql
-- Explicit relationships (admin-curated)
CREATE TABLE product_relationships (
  product_id TEXT NOT NULL,
  related_product_id TEXT NOT NULL,
  relationship_type TEXT NOT NULL,  -- 'pairs_with', 'similar', 'upgrade', 'same_series'
  sort_order INTEGER DEFAULT 0,
  PRIMARY KEY (product_id, related_product_id, relationship_type)
);

-- Pre-computed similarity (from tasting notes)
CREATE TABLE product_similarity (
  product_a TEXT NOT NULL,
  product_b TEXT NOT NULL,
  score REAL NOT NULL,  -- 0.0 to 1.0 Jaccard similarity
  PRIMARY KEY (product_a, product_b)
);
```

**Similarity computation:** Run nightly (or on product update) as a Worker Cron:
1. For each product pair, compute Jaccard similarity of `tastingNotes[]` arrays
2. Store top 10 most similar products per product
3. Frontend fetches `GET /api/products/:id/similar` — instant recommendations

Admin can also manually curate relationships (teaware with tea types, upgrades, etc.).

---

## Architecture Change 3: Tasting Data Normalization

### Problem

Tasting data lives in 3 places:
1. Product `tasting` JSON blob in D1 (admin-authored)
2. Customer journal entries in localStorage (user-authored, may sync offline)
3. Event tasting notes submitted via RSVP (guest-authored)

None of these are queryable, aggregatable, or connected.

### Solution: Normalized Tasting Table

```sql
CREATE TABLE tasting_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT,                    -- NULL for anonymous/guest
  product_id TEXT,                 -- links to products table
  event_id TEXT,                   -- links to events table (if from event)
  source TEXT NOT NULL,            -- 'compass', 'event', 'journal', 'admin'
  rating INTEGER,                  -- 1-5
  flavor_notes TEXT,               -- JSON array
  body_notes TEXT,                 -- JSON array
  finish_notes TEXT,               -- JSON array
  feeling_notes TEXT,              -- JSON array
  liquor_color TEXT,
  brewing_method TEXT,
  water_temp INTEGER,
  steep_time_seconds INTEGER,
  leaf_grams REAL,
  personal_note TEXT,
  impression TEXT,
  is_public BOOLEAN DEFAULT FALSE, -- opt-in for community aggregation
  photo_url TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_tasting_product ON tasting_sessions(product_id, created_at DESC);
CREATE INDEX idx_tasting_user ON tasting_sessions(user_id, created_at DESC);
```

**What this unlocks:**
- Community tasting aggregation on product pages (Part 2)
- Personal taste evolution tracking (Part 3)
- Event tasting archives (Part 5)
- "Most popular teas" ranking by session count
- Flavor profile search ("show me teas people describe as mineral")

---

## Architecture Change 4: True Offline-First

### Problem

PWA manifest exists but no service worker. Offline sync is a localStorage queue with basic retry. This isn't production-grade offline support.

### Solution: Workbox Service Worker + IndexedDB

**Service Worker Strategy:**
```
Shell (HTML, JS, CSS, fonts)  → CacheFirst (update on deploy)
API responses                 → NetworkFirst (fallback to cache)
Product images                → CacheFirst (long TTL)
User data                     → NetworkFirst (always try fresh)
```

**IndexedDB for Offline Writes:**
Replace the localStorage queue with IndexedDB:
- Larger storage quota (hundreds of MB vs 5-10MB)
- Structured queries (find all pending syncs of type X)
- Transaction support (atomic reads/writes)
- Better for binary data (photos taken offline)

**Sync Protocol:**
1. All writes go to IndexedDB first (optimistic)
2. Background sync attempts to push to server
3. Conflict resolution: server wins for shared data, client wins for personal data
4. Sync status visible in UI: "All synced" / "3 changes pending" / "Offline"

**Implementation:** Workbox + idb library. Vite plugin `vite-plugin-pwa` handles most of the build configuration.

---

## Architecture Change 5: Search Infrastructure

### Problem

Search is client-side Fuse.js on the full product list. Works for 139 products, won't scale, and can't search across content types (articles, products, glossary, events).

### Solution: Unified Search Index

**Option A: Cloudflare Workers + D1 Full-Text Search**
D1 supports SQLite FTS5:
```sql
CREATE VIRTUAL TABLE search_index USING fts5(
  entity_type,
  entity_id,
  title,
  body,
  tags,
  content='',
  tokenize='porter unicode61'
);
```

Populate with products, articles, glossary entries, events. Query from a single `/api/search` endpoint. Return typed results: `{ type: 'product' | 'article' | 'event' | 'glossary', id, title, snippet }`.

**Option B: Keep Fuse.js but expand scope**
Load a combined search index on first Cmd+K press:
- Products (name, type, tasting notes, lore)
- Articles (title, description, tags)
- Glossary terms (term, definition)
- Events (name, description, tea menu)

Either option makes global search actually useful across the entire platform.

---

## Architecture Change 6: Analytics & Telemetry

### Problem

No analytics. Can't answer: Which products are viewed most? Where do users drop off? Which articles drive purchases? What's the conversion rate?

### Solution: Lightweight Event Tracking

**Not Google Analytics.** A simple, privacy-respecting event logger:

```sql
CREATE TABLE analytics_events (
  id TEXT PRIMARY KEY,
  session_id TEXT,
  user_id TEXT,
  event_type TEXT NOT NULL,  -- 'page_view', 'product_view', 'add_to_cart', 'order', 'article_read'
  entity_type TEXT,
  entity_id TEXT,
  metadata TEXT,             -- JSON: referrer, duration, scroll depth, etc.
  created_at TEXT DEFAULT (datetime('now'))
);
```

**Key events to track:**
- Product page views (which products get attention)
- Add to cart (conversion step 1)
- Order completion (conversion step 2)
- Article read completion (scroll depth > 80%)
- Search queries (what are people looking for)
- Tea Compass session logged (engagement metric)

**Dashboard queries:**
- "Top 10 most viewed products this week"
- "Products viewed but never purchased" (opportunity)
- "Articles that lead to purchases" (content ROI)
- "Search terms with no results" (catalog gaps)

All stored in D1. Queried in the admin dashboard. No third-party scripts. No cookie banners needed.

---

## Architecture Change 7: Content Management

### Problem

All magazine content, learn modules, and glossary entries are hardcoded in TypeScript data files (28 files in `src/data/`). Adding an article requires a code change and deploy.

### Solution: Gradual CMS Migration

**Phase 1:** Move content to D1 tables
```sql
CREATE TABLE content (
  id TEXT PRIMARY KEY,
  content_type TEXT NOT NULL,  -- 'article', 'learn_module', 'glossary', 'reading_list'
  title TEXT NOT NULL,
  slug TEXT UNIQUE,
  body TEXT,                   -- JSON structure matching current layout format
  metadata TEXT,               -- JSON: author, tags, season, tea_types, publish_date
  status TEXT DEFAULT 'draft', -- draft, published, archived
  created_at TEXT,
  updated_at TEXT
);
```

**Phase 2:** Admin content editor
- Rich text editor for articles (not full WYSIWYG — structured blocks matching the 50+ layout types)
- Preview mode
- Publish/schedule/archive workflow

**Phase 3:** API-driven content on the frontend
- Replace hardcoded `STORIES` constant with `useContent('article')` hook
- Cache aggressively (content changes rarely)
- Keep the current rendering engine — it's excellent

This doesn't need to happen all at once. Start with articles, then learn modules, then glossary.

---

## Performance Optimizations

### Image Pipeline
- **WebP/AVIF conversion** — Cloudflare Images or a Worker that transforms on-the-fly
- **Responsive srcset** — Serve appropriate sizes for mobile vs desktop
- **Blur placeholder** — Generate tiny base64 blur-up previews for smooth loading
- **Lazy loading** — Already partially done. Ensure all below-fold images use `loading="lazy"`

### Bundle Size
- **Route-based code splitting** — Already using lazy imports. Verify admin bundle doesn't load on public pages.
- **Tree-shake the CDN Tailwind** — Move to PostCSS Tailwind for production. CDN loads the entire framework.
- **Dynamic imports for heavy deps** — recharts, @react-pdf/renderer, papaparse should only load when needed

### API Performance
- **Edge caching** — Public product list can be cached at Cloudflare's edge for 5 minutes
- **Stale-while-revalidate** — React Query already supports this. Ensure `staleTime` is set appropriately.
- **Batch API calls** — Dashboard currently makes multiple requests. Add a `/api/admin/dashboard` endpoint that returns everything in one call.

---

## Security Hardening

1. **Rate limiting** on auth endpoints (login, signup, password reset)
2. **CSRF protection** for state-changing requests
3. **Input sanitization** — check all user-submitted content (tasting notes, inquiries) for XSS
4. **Image upload validation** — verify MIME types, max file size, strip EXIF data
5. **JWT rotation** — refresh tokens before expiry rather than forcing re-login
6. **Admin audit log** — immutable log of all admin actions (already partially exists in activity_logs)

---

## Quick Wins (< 1 day each)

1. **Add Workbox service worker** — `vite-plugin-pwa` handles 90% of setup
2. **Move Tailwind to PostCSS** — Remove CDN script, add PostCSS config. Saves ~300KB in production.
3. **Add staleTime to React Query** — Prevent unnecessary refetches. 30s for products, 5min for rates.
4. **Compress product images** — One-time batch optimization of existing images in R2
5. **Add error tracking** — Simple `window.onerror` handler that POSTs to `/api/errors` for visibility
6. **Database indexes** — Verify all frequent queries have supporting indexes in D1

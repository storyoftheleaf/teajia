# Compass · Sharing · Command Center — Full Build Plan

_Generated from design session April 2026. All three phases, dependency map, and agent strategy in one place._

---

## Vision recap

**Compass** — the active working tool. Capture, source, edit, co-taste. Nothing passive.
**Command Center (`/me`)** — your personal hub. Overview, queue, history, identity. Navigated to by the LogoIcon in the bottom nav.
**Sharing** — teas flow between people. The compass is how you interact with them. The command center is where you see the state of everything.

---

## What's already built (this session)

- [x] `LogoIcon` component — 8-pointed compass star, nav-optimised
- [x] `LogoIcon` in `BottomTabBar` replacing person silhouette
- [x] `CompassPage` height fix — proper viewport height, anchors above bottom nav
- [x] Floating button changed from `fixed` to `absolute`
- [x] Excessive scroll padding removed from Compass content area

---

## Phase 1 — Foundation (ready to code now)

### 1A. Compass action bar removal

**Goal**: Strip the static bottom bar. Each action moves to where it's contextually needed.

| Action | Current location | New location |
|---|---|---|
| Mic | Action bar | Inside `CaptureCard` next to notes field |
| Done | Action bar | Full-width button at bottom of `CaptureCard` |
| Batch | Action bar | Small toggle in Sourcing tab header |
| Share | Action bar | Icon on committed entry cards in Library (`BrowseCard`) |

Files touched:
- `src/components/TeaCompass/index.tsx` — remove action bar block, add batch toggle to header
- `src/components/TeaCompass/CaptureCard.tsx` — add mic near notes, add Done button
- `src/components/TeaCompass/BrowseCard.tsx` — add share icon + handler

Dependencies: none. Do this first, it unblocks everything.

---

### 1B. Compass tab restructure

**Goal**: Tasting tab becomes the shared working space. Adapts by role.

Tab visibility by role:
- Platform admin / store admin / staff: Sourcing + Tasting + Buying
- Member: Sourcing (simplified) + Tasting
- Guest: Tasting only (read-only)

Member Sourcing strips: batch mode, vendor fields, price/quantity, buying notes.
Just: name, type, origin, notes, photo, verdict.

Tasting tab new structure (replacing current browse + incoming queue):
```
Tasting
├── Active Sessions          ← co-tasting in progress (Phase 2)
├── My Queue                 ← has sample, ready to taste
├── Want to Try              ← no sample, Get Sample CTA
└── My Record                ← completed tastings, browseable
```

Incoming shares no longer sit at the top as a notification queue.
They route into Queue or Want to Try on arrival.

Files touched:
- `src/components/TeaCompass/index.tsx` — tab visibility logic, Tasting tab restructure
- `src/components/TeaCompass/BrowseView.tsx` — becomes "My Record" section

New components (can be parallelised with agents):
- `src/components/TeaCompass/TastingQueueSection.tsx`
- `src/components/TeaCompass/TastingQueueCard.tsx`
- `src/components/TeaCompass/WishlistCard.tsx`

---

### 1C. Command Center page — `/me`

**Goal**: Replace the account panel entirely. Full-page command center.

Route: `/me`
Navigation: LogoIcon in BottomTabBar navigates to `/me` (currently opens panel — change this)
Account panel: removed. `onAccountClick` handler replaced with `navigate('/me')`.

Page structure:
```
/me
├── PassportCard             ← identity, tier, location, stat
├── QuickActionsRow          ← contextual live counts
├── MyTeasSection            ← queue + wishlist + unreviewed shares
├── MyRecord                 ← last 5 tastings, "See all" expands journal
└── PreferencesSection       ← currency, location, theme — bottom only
```

Membership tiers (stored on user profile, computed from activity):
| # | Name | Criteria |
|---|---|---|
| 1 | Guest | Just joined |
| 2 | Taster | First tasting logged |
| 3 | Enthusiast | 10+ tastings + event attended or sample purchased |
| 4 | Connoisseur | 50+ tastings + article contributed or co-tasting session completed |
| 5 | Fellow | Manually granted by platform admin |

Tier updates silently — no notification, no progress bar. Appears on next open.

Quick actions — only render if count > 0 or event is real:
- Teas in queue (→ Compass Tasting)
- Active co-tasting session (→ session view)
- Upcoming event you're registered for
- Unreviewed shares

Files touched:
- `src/App.tsx` — add `/me` route, change LogoIcon click from panel open to navigate
- `src/components/AccountPanel/index.tsx` — remove or gut to navigation hub only
- `src/components/BottomTabBar.tsx` — `onAccountClick` becomes `navigate('/me')`

New files (can be parallelised):
- `src/pages/CenterPage.tsx`
- `src/components/Center/PassportCard.tsx`
- `src/components/Center/QuickActionsRow.tsx`
- `src/components/Center/MyTeasSection.tsx`
- `src/components/Center/PreferencesSection.tsx`

---

### 1D. Share picker — member list

**Goal**: Replace the account-slug text input with a searchable member picker.

Picker shows:
- Connected members first (from Phase 3 — stub with event attendees for now)
- Search covers all members in the account
- Sharing to unconnected member queues a pending invite (Phase 3 handles acceptance)

Worker endpoint needed:
```
GET /api/members/search?q=&limit=20
```
Returns: id, name, avatar_url, membership_tier, last_active

Files touched:
- `src/components/TeaCompass/CompassShareModal.tsx` — replace slug input with picker
- `worker/src/index.ts` — add member search endpoint

New component:
- `src/components/shared/MemberPicker.tsx`

---

### 1E. DB + Worker — Phase 1

Migrations needed:
```sql
-- 018_has_sample_flag.sql
ALTER TABLE compass_shares ADD COLUMN has_sample INTEGER DEFAULT 0;
ALTER TABLE tea_compass_entries ADD COLUMN source_entry_id TEXT REFERENCES tea_compass_entries(id);
```

Worker endpoints needed:
```
GET  /api/members/search          member picker
GET  /api/me/queue                has-sample queue for current user
GET  /api/me/wishlist             want-to-try list for current user
```

---

## Phase 2 — Co-tasting, Orders, Feedback

### 2A. Co-tasting sessions

**Flow**:
1. Creator picks 2–5 teas from their Library
2. Names the session (optional)
3. Generates a shareable link → `/session/:id`
4. Sends via WhatsApp/iMessage/wherever
5. Recipient taps → logs in → joins
6. Both see the tea list
7. Each evaluates independently — other verdict hidden until you submit yours
8. After both submit on a tea → side-by-side view unlocks
9. Session complete when all teas evaluated or manually closed

**No-peek rule**: Per-tea verdict reveal. You see theirs only after submitting yours on that tea. Prevents anchoring bias.

**Sync**: 30-second auto-refresh via React Query. No WebSockets needed. On a call, the notes catching up is fine.

**DB migration** (`019_tasting_sessions.sql`):
```sql
CREATE TABLE tasting_sessions (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id),
  created_by_user_id TEXT NOT NULL,
  title TEXT,
  status TEXT NOT NULL DEFAULT 'active', -- active | completed
  invite_token TEXT UNIQUE,
  created_at TEXT NOT NULL,
  completed_at TEXT
);

CREATE TABLE tasting_session_teas (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES tasting_sessions(id),
  compass_entry_id TEXT REFERENCES tea_compass_entries(id),
  tea_name TEXT NOT NULL,
  tea_key TEXT,
  tea_metadata TEXT, -- JSON snapshot
  position INTEGER NOT NULL
);

CREATE TABLE tasting_session_members (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES tasting_sessions(id),
  user_id TEXT NOT NULL,
  joined_at TEXT NOT NULL,
  completed_at TEXT,
  UNIQUE(session_id, user_id)
);

CREATE TABLE tasting_session_verdicts (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES tasting_sessions(id),
  session_tea_id TEXT NOT NULL REFERENCES tasting_session_teas(id),
  user_id TEXT NOT NULL,
  verdict TEXT, -- love | like | neutral | pass
  tasting_data TEXT, -- JSON
  notes TEXT,
  submitted_at TEXT NOT NULL,
  UNIQUE(session_tea_id, user_id)
);
```

**Worker endpoints**:
```
POST  /api/sessions                   create session, pick teas, get invite link
GET   /api/sessions/:id               session state + teas + member list
POST  /api/sessions/:id/join          join via invite token
POST  /api/sessions/:id/verdicts      submit verdict on a tea
GET   /api/sessions/:id/verdicts      poll — called every 30s
POST  /api/sessions/:id/complete      close session
GET   /api/session/:token             public — resolve invite token (no auth)
```

**New frontend components** (can be parallelised):
- `src/components/TeaCompass/SessionView.tsx` — full session UI
- `src/components/TeaCompass/SessionTeaCard.tsx` — per-tea input
- `src/components/TeaCompass/VerdictReveal.tsx` — side-by-side after submit
- `src/components/TeaCompass/CreateSessionSheet.tsx` — pick teas, name, generate link
- `src/pages/SessionPage.tsx` — `/session/:token` public landing

**Files touched**:
- `src/components/TeaCompass/index.tsx` — Sessions section in Tasting tab
- `src/App.tsx` — add `/session/:token` route

---

### 2B. Order → queue auto-population

**Goal**: When a sample pack order is fulfilled, those teas appear in the buyer's compass queue as `available_to_taste`.

**Trigger**: Order status changes to `fulfilled` or `shipped` (whichever is the final confirmed state in the current order system — check `ORDER_SYSTEM_PLAN.md`).

**Product → compass entry mapping**: Products need a `compass_source_entry_id` field. Admin links a product to a compass entry in the product edit modal. This is the bridge.

**DB migration** (`020_product_compass_link.sql`):
```sql
ALTER TABLE products ADD COLUMN compass_source_entry_id TEXT REFERENCES tea_compass_entries(id);
ALTER TABLE tea_compass_entries ADD COLUMN status TEXT DEFAULT 'noted';
-- status values: noted | available_to_taste | tasted | passed
```

**Worker change**: In the order fulfillment handler, after marking order fulfilled:
1. Query order line items
2. For each product with `compass_source_entry_id`
3. Fetch source entry metadata
4. INSERT into `tea_compass_entries` for buyer's account with status `available_to_taste`
   and `source_entry_id` pointing back to original

**In-person gift samples**:
Admin creates a $0 "Gift" order directly from a member's profile or from any compass entry.
- Order type: `gift` — skips Requested/Confirmed/Payment steps, goes straight to Dispatched
- Dispatched status triggers the same queue population as a purchase
- Visible in order history alongside purchases, labelled Gift
- Auto-creates `member_connections` entry with `source = 'gift'` if not already connected

**Admin UI change**:
- `src/admin/components/AddProductModal.tsx` — add compass entry picker field
  (search existing compass entries, link one to the product)
- `src/admin/components/CustomersView.tsx` — "Gift sample" button on member detail

**Files touched**:
- `worker/src/index.ts` — order fulfillment handler + new product field
- `src/admin/components/AddProductModal.tsx` — compass entry link field

---

### 2C. Aggregate feedback on admin Library entries

**Goal**: Admin sees verdict distribution + taste notes on any compass entry that has been shared or distributed.

**What shows**:
- "N tasted" count on the BrowseCard in Library
- Expanded view: verdict distribution (love/like/neutral/pass bar)
- Top 3 recurring taste notes from member verdicts
- "Add to order" button → links to admin order creation

**Worker endpoint**:
```
GET /api/compass/entries/:id/feedback
→ { total: 12, verdicts: { love: 8, like: 3, neutral: 1, pass: 0 }, topNotes: [...] }
```

Queries `tasting_session_verdicts` and member tasting entries linked via `source_entry_id`.

**New component** (standalone, can be agent):
- `src/components/TeaCompass/FeedbackStrip.tsx`

**Files touched**:
- `src/components/TeaCompass/BrowseCard.tsx` — add FeedbackStrip
- `worker/src/index.ts` — feedback aggregation endpoint

---

### 2D. Member taste profile capture

**Goal**: Every tasting verdict silently updates the member's taste profile. No UI yet — just capture correctly now for future recommendations.

**DB migration** (`021_taste_profile.sql`):
```sql
CREATE TABLE user_taste_profile (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE,
  account_id TEXT NOT NULL,
  preferred_types TEXT DEFAULT '{}',    -- JSON: { puerh: 12, oolong: 5, ... }
  preferred_notes TEXT DEFAULT '{}',   -- JSON: { floral: 8, earthy: 14, ... }
  preferred_regions TEXT DEFAULT '{}', -- JSON: { yunnan: 9, fujian: 3, ... }
  verdict_counts TEXT DEFAULT '{}',    -- JSON: { love: 15, like: 8, neutral: 2, pass: 1 }
  total_tastings INTEGER DEFAULT 0,
  last_updated TEXT
);
```

**Worker**: After any verdict is submitted (session or standalone), fire a background update to `user_taste_profile`. Merge counts, update totals.

**No frontend** in Phase 2. Data captured, used manually by admin. Phase 3 surfaces it.

**Files touched**:
- `worker/src/index.ts` — append taste profile update to verdict handlers

---

## Phase 3 — Connections, QR, Recommendations

### 3A. Formal connection system

**Goal**: Replace the stub connections (event/store auto-links) with a real social graph. Enables member-to-member sharing with meaning.

**How connections form**:
- Shared event attendance → auto-connected on event completion
- Same store location → auto-connected on join
- First share to unconnected member → pending invite, acceptance creates connection
- Manual: search + add from picker

**DB migration** (`022_member_connections.sql`):
```sql
CREATE TABLE member_connections (
  id TEXT PRIMARY KEY,
  user_id_a TEXT NOT NULL,  -- always stored as a < b (UUID sort)
  user_id_b TEXT NOT NULL,
  source TEXT NOT NULL,     -- event | store | share | manual
  source_ref TEXT,          -- event_id or share_id that triggered it
  created_at TEXT NOT NULL,
  UNIQUE(user_id_a, user_id_b)
);

CREATE TABLE connection_invites (
  id TEXT PRIMARY KEY,
  from_user_id TEXT NOT NULL,
  to_user_id TEXT NOT NULL,
  pending_share_id TEXT,    -- the share waiting for acceptance
  created_at TEXT NOT NULL,
  accepted_at TEXT,
  declined_at TEXT
);
```

**Auto-connection triggers**:
- Event completion handler → query attendees → bulk insert connections with `source = 'event'`
- New member join → query same-account members → bulk insert with `source = 'store'`
- Gift sample created → insert connection with `source = 'gift'`
- First share to unconnected member → pending invite, acceptance inserts with `source = 'share'`

**Worker endpoints**:
```
GET  /api/connections                  my connections (for picker)
POST /api/connections/invite           share to unconnected → creates invite
POST /api/connections/invite/:id/accept
POST /api/connections/invite/:id/decline
```

**MemberPicker upgrade**: Now queries `/api/connections` first. Unconnected search still available, routes through invite flow.

---

### 3B. QR table-share

**Goal**: At a tea session, show a QR code guests can scan to see what they're drinking and optionally log an impression.

**Two entry points**:
1. Committed compass entry → share icon → "Table" mode → QR full-screen
2. Product page → "Table" button → same flow

**Guest-facing page** (`/t/:token`):
- Read-only tea card: name, origin, season, Adrian's notes, photo
- "I tasted this" CTA → if logged in, opens simplified tasting capture pre-loaded with this tea
- If not logged in → continue as guest, verdict stored against session token + browser token
- After submitting → soft prompt "Want to keep your tasting history? Join Teajia"
- On signup: if browser token matches anonymous verdict → verdicts transfer to new account retroactively

**Worker endpoints**:
```
POST /api/compass/entries/:id/table-share   generate short-lived table token
GET  /api/t/:token                          public — resolve token, return tea card data
POST /api/t/:token/taste                    submit guest tasting (linked to user if authed)
```

**New files**:
- `src/pages/TableCardPage.tsx` — `/t/:token` public page
- `src/components/TeaCompass/TableShareSheet.tsx` — QR display + copy link

---

### 3C. Recommendation surfacing

**Goal**: Use accumulated taste profile data to surface relevant teas.

**Recommendation expiry**: Recommendations that sit in Want to Try with no action for 60 days quietly archive. Still in history, not in active list.

**Recommendation display**: Silent — no "because you liked X." Curatorial voice. The taste profile is the engine, invisible to the member.

**Phase 3a — Manual curation tools for admin**:
- On any member's profile (admin view), see their taste profile summary
- "Recommend to this member" button → opens compass share flow pre-filtered to teas matching their profile
- Profile summary: top types, top notes, total tastings, verdict breakdown

**Phase 3b — Surfaced in command center**:
- "You might like" section in `/me` — teas from catalog matching your taste profile
- Algorithm: score each catalog tea against user_taste_profile → surface top matches
- Starts simple: if user loves puerh + floral notes, surface puerh with floral tags

**Phase 3c — In shop**:
- Personalised ordering within tea type pages
- "Based on your tastings" label on matched teas

**Files touched (3a)**:
- `src/admin/components/CustomersView.tsx` — taste profile summary on member detail
- New: `src/admin/components/MemberTasteProfile.tsx`

**Files touched (3b)**:
- `src/components/Center/RecommendationsSection.tsx` — new component
- `src/pages/CenterPage.tsx` — add section
- `worker/src/index.ts` — GET /api/me/recommendations

---

## Dependency map

```
Phase 1A (action bar)          → no deps, do first
Phase 1B (tab restructure)     → needs 1A
Phase 1C (command center page) → no deps, parallel with 1A/1B
Phase 1D (member picker)       → needs worker search endpoint
Phase 1E (migrations + worker) → do alongside 1D

Phase 2A (sessions)            → needs Phase 1 complete
Phase 2B (order → queue)       → needs compass status field from 1E
Phase 2C (feedback)            → needs 2A verdicts flowing
Phase 2D (taste profile)       → needs 2A + 2C verdict data

Phase 3A (connections)         → needs 1D picker in place
Phase 3B (QR)                  → independent, can run parallel to 3A
Phase 3C (recommendations)     → needs 2D taste profile data
```

---

## Agent strategy

**The worker file is 7,998 lines.** Agents touching it simultaneously will conflict. All worker changes are sequential, in the main conversation.

**Migrations are sequential** by nature — numbered files, order matters.

**Existing component modifications** need full codebase context — sequential.

**New standalone component files** are safe to parallelise with agents.

### What agents CAN do in parallel

Each agent gets: CLAUDE.md + COLOR_RULES.md as mandatory context. No agent touches worker, migrations, or existing files.

**Phase 1 agents** (run simultaneously after 1A is done):

| Agent | Files to create | Context needed |
|---|---|---|
| A1 | `CenterPage.tsx`, `PassportCard.tsx`, `QuickActionsRow.tsx` | Tier system, membership data shape |
| A2 | `MyTeasSection.tsx`, `TastingQueueCard.tsx`, `WishlistCard.tsx` | Queue data shape, Get Sample CTA |
| A3 | `MemberPicker.tsx` | Member search API shape |
| A4 | `TastingQueueSection.tsx` (Compass Tasting tab sections) | Compass entry data shape |

**Phase 2 agents** (after Phase 1 ships):

| Agent | Files to create | Context needed |
|---|---|---|
| B1 | `SessionView.tsx`, `SessionTeaCard.tsx`, `VerdictReveal.tsx` | Session data model |
| B2 | `CreateSessionSheet.tsx`, `SessionPage.tsx` | Session invite flow |
| B3 | `FeedbackStrip.tsx` | Feedback API response shape |

**Phase 3 agents**:

| Agent | Files to create | Context needed |
|---|---|---|
| C1 | `TableCardPage.tsx`, `TableShareSheet.tsx` | Table token API shape |
| C2 | `MemberTasteProfile.tsx`, `RecommendationsSection.tsx` | Taste profile data shape |

### What stays sequential (main conversation)

- All `worker/src/index.ts` changes
- All SQL migration files
- `src/App.tsx` route additions
- `src/components/TeaCompass/index.tsx` modifications
- `src/components/TeaCompass/CaptureCard.tsx` modifications
- `src/components/TeaCompass/BrowseCard.tsx` modifications
- `src/components/AccountPanel/index.tsx` removal/gutting
- `src/components/BottomTabBar.tsx` click handler change

---

## Build order for Phase 1 (this push)

1. **Sequential** — remove action bar, integrate mic + Done into CaptureCard, add batch toggle to header
2. **Sequential** — worker: member search endpoint + Phase 1 migrations
3. **Parallel agents** — A1, A2, A3, A4 simultaneously (new component files only)
4. **Sequential** — wire agents' output into App.tsx routes + existing component imports
5. **Sequential** — gut AccountPanel, point LogoIcon to `/me`
6. **Sequential** — restructure Tasting tab in TeaCompass/index.tsx

---

## Confirmed decisions

All decisions locked. No open items.

### Phase 2

**Q1 — Order trigger**: `Dispatched` status triggers queue population.
- Edge case: international orders show "arriving soon" state on queue card — Taste action disabled until member toggles ready.

**Q2 — Has sample default**: Defaults to **Want to Try** (no sample assumed).
- One tap moves to Queue if they already have it.
- Preserves the Get Sample sales moment.

**Q3 — Session size**: Cap at **4 participants**. Primary use case is 2.
- Data model supports N (already designed that way).
- Verdict reveal triggers when ALL participants in the session have submitted on that tea.
- Members CAN create sessions. Tea picker limited to their own compass entries + queue — not Adrian's full sourcing library.
- After session completes: **auto-create compass entries** for each participant for each tea tasted. Entry carries `session_id` as context. Feeds personal catalogue and taste profile.

**Q4 — Member sessions**: Confirmed. Members create and join sessions.

**Q5 — QR anonymous verdict**: Anonymous verdict allowed, soft account prompt after.
- Verdict stored against QR session token, linked to source compass entry regardless of auth.
- **Retroactive linking (Option A)**: browser/device token stored on anonymous verdict. On signup, if token matches, anonymous verdicts transfer to new account. Tasting history begins the night they sat at the table.

### Phase 3

**In-person gift samples**: **Gift order type (Option A)** — $0 order, skips straight to Dispatched status, triggers queue population identically to a purchase. Tracked in order history. Admin sees gifted vs. purchased.
- Gift act auto-creates member connection with source `gift` if not already connected.

**QR anonymous → account linking**: **Option A confirmed** — retroactive via browser token on signup.

**Recommendation expiry**: **Option B** — soft 60-day archive if no action taken on a Want to Try recommendation. Still accessible in history. Keeps active list current.

**Recommendation display**: **Silent** — no "because you liked X" explanation. Curatorial voice, not algorithmic. The taste profile is the engine, invisible to the member.

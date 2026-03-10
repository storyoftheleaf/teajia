# Event RSVP & Capacity Engine — UX Review & Implementation Plan

## Context

Adrian wants to add a private tea session RSVP system to Teajia. The system handles tiered capacity (80/20 standard/golden split), magic-link-based guest management, waitlist reallocation, and post-session archival.

**Key decisions from review:**
- Events are one-at-a-time, 12-30 guests
- Golden access is **automatic** — tied to existing customer records (matched by phone/WhatsApp number). No codes, no special URLs. The guest never knows.
- Event URLs use **custom slugs** (`/event/spring-ceremony`) set by admin
- Flyer images uploaded **directly to R2** (Cloudflare R2 bucket)
- WhatsApp API deferred — start with shareable links + copy-paste message templates
- No WebSockets — use polling (Durable Objects are overkill)
- Stay on D1 — no PostgreSQL/Supabase
- Use `db.batch()` for atomic operations (D1 doesn't support traditional transactions in Workers)

---

## Part 1: UX Critique — What's Strong

- **Magic links as identity** — no passwords, no friction. Perfect for a tea session audience.
- **The 80/20 capacity split** — elegant. Rewards your inner circle without making the standard tier feel second-class.
- **Post-session archive** — the sleeper hit. A tea session becomes a *memory*, not just an event.

---

## Part 2: UX Critique — Gaps, Risks & Recommendations

### A. Critical Functional Gaps

**1. Lost Magic Link Recovery**
No recovery path. If someone loses their WhatsApp message, they're locked out.

→ Add "Find My RSVP" on event page — enter phone number, see magic link on-screen (later: send via WhatsApp API).

**2. The +1 Is a Ghost**
+1 consumes a seat but has no name. If primary cancels, +1 vanishes silently.

→ When +1 toggled ON, require guest's first name. Show "You + [Name]" on management page. If primary cancels, prompt: "This will also cancel [Name]'s spot."

**3. No Admin Event Management Interface**
The spec has no admin interface for creating events, viewing attendees, or managing waitlists.

→ Add `/admin/events` with: event CRUD, attendee list with filters, manual status override, shareable link copy buttons, capacity bar, and one-click WhatsApp message templates.

**4. Race Conditions on RSVP**
Two simultaneous RSVPs at the last spot.

→ Use `db.batch()` for atomic count-check + insert. If capacity exceeded, return waitlist status with a warm message: "The table is full, but you're on the list."

**5. Claim Link Expiration**
Undefined behavior when claim window expires.

→ Default 60 min (configurable). After expiry: auto-pass to next waitlisted person. After 3 unclaimed passes: alert admin. Show countdown timer on claim page.

**6. Duplicate RSVP Prevention**
What if someone RSVPs twice with the same phone number?

→ Check phone_number + event_id uniqueness. If duplicate found, redirect to their existing management page.

### B. Clarity Issues

**7. Tier Visibility — Never Expose**
Golden/standard distinction is invisible to guests. They see identical experiences — golden guests just have a higher chance of confirming. Admin sees tiers.

**8. Waitlist Position — Vague Indicator**
Position 1-3: "You're near the front." Position 4+: "You're on the waitlist." Never show exact numbers.

**9. Status Change Notifications (Manual Phase)**
When admin promotes someone: generate pre-formatted WhatsApp message with magic link. Admin sends manually. Management page updates on refresh.

### C. Friction Points

**10. RSVP Flow — Above the Fold**
Restructure landing page:
1. Above fold: Flyer, title, date/time, location, "RSVP" button
2. RSVP button → bottom sheet modal (Name, Phone, +1 toggle). Two taps to RSVP.
3. Below fold: Guidelines, logistics, map. Reference material, not a gate.

**11. Phone Field — Future-Proof**
Label as "WhatsApp / Phone", store as phone number. Add optional email for calendar invites.

### D. Delight & Experience

**12. Tea Ceremony Aesthetic**
- Landing: Full-bleed flyer with subtle parallax, serif date typography, minimal location line
- Confirmation: Beautiful animation — "Your seat has been set." (not "RSVP Confirmed!")
- Management page: Gold-foil border card for confirmed; muted tones + "awaiting your seat" for waitlisted
- Post-session: Magazine spread — Alcove card aesthetic for tea ledger, embedded playlist, polaroid gallery

**13. Countdown & Anticipation**
Between RSVP and event: countdown timer, "what to expect" tips at intervals, day-of "getting there" card with map link.

**14. Social Proof (Gentle)**
Landing: "X seats confirmed" (no names). Management: "You're joining X others."

### E. Architecture

**15. Polling Over WebSockets**
Landing page polls `/api/events/:slug/availability` every 30s. Management page polls `/api/rsvp/:token/status` every 15s. Simple, works on Workers without Durable Objects.

**16. D1 for Everything**
Use D1. RSVP schema is simple. Use `db.batch()` for atomic multi-statement operations.

**17. Cron Triggers for Reminders**
Worker Cron Trigger at 9AM daily. Generates notification records. Admin sends manually until WhatsApp API is added.

**18. R2 for Flyer Upload**
Add R2 bucket binding to wrangler.toml. Presigned upload from admin, store URL in events table.

### F. Things You Didn't Think About

**19. Calendar Integration (.ics)** — "Add to Calendar" button after RSVP. Prevents no-shows better than any reminder.

**20. No-Show Tracking** — Post-event: mark attendance. Chronic no-shows deprioritized on future waitlists.

**21. Event Templates** — "Duplicate Event" button in admin. Copies everything except date.

**22. Photo Consent** — Toggle in RSVP form: "I'm okay with photos being shared." Default OFF.

**23. Dietary / Accessibility Notes** — Optional "Anything we should know?" free-text field.

**24. OG Image for Social Sharing** — Use flyer as og:image. Beautiful WhatsApp preview cards = free marketing.

**25. Event Status Lifecycle** — draft → active → closed → archived. Draft events not visible publicly.

**26. WhatsApp Deep Links** — Admin "Share Event" generates `https://wa.me/?text=` prefilled with event URL.

**27. Offline/Error Handling** — If API is down during RSVP, save to localStorage and retry. Show "We'll confirm your spot shortly."

### G. Golden Tier — Admin-Granted, Not Automatic

Golden access is NOT automatic for all customers. The admin explicitly grants golden status by adding the `"golden"` tag to a customer's `tags` JSON array (existing field: `customers.tags TEXT DEFAULT '[]'`).

**RSVP flow:**
1. Guest submits phone number
2. Backend: `SELECT id, tags FROM customers WHERE phone = ? OR whatsapp = ?`
3. If match found AND `tags` contains `"golden"` → `access_tier = 'golden'`
4. Otherwise → `access_tier = 'standard'`
5. Guest never knows. Completely silent.

**Admin UX:** In the Customers view, add a quick-toggle to grant/revoke golden status. Show a small gold badge next to golden customers.

### H. Venue Guide — Rich Directions with Photos & Video

The directions section is NOT just a map link. It's a curated visual walkthrough — a "last mile" guide for private venues that are hard to find.

**Data model addition to events table:**
```sql
venue_guide TEXT  -- JSON: { steps: [{ description, image_url?, video_url? }], parking_notes, transit_notes, arrival_notes }
```

**Venue Guide structure:**
```json
{
  "steps": [
    { "description": "From the main road, look for the red gate on your left", "image_url": "https://r2.../step1.jpg" },
    { "description": "Walk through the courtyard, past the bamboo garden", "image_url": "https://r2.../step2.jpg" },
    { "description": "The tea room is the second door on the right", "image_url": "https://r2.../step3.jpg", "video_url": "https://r2.../walkthrough.mp4" }
  ],
  "parking_notes": "Street parking available on Xinyi Road. No dedicated lot.",
  "transit_notes": "MRT Dongmen Station, Exit 5. 8 minute walk.",
  "arrival_notes": "Ring the bell marked 'Tea Room'. We'll come get you."
}
```

**Guest UX:**
- On the management page, a "How to Get There" section with:
  - Step-by-step visual guide (numbered steps with photos, swipeable on mobile)
  - Optional 30s walkthrough video (autoplay muted, tap to unmute)
  - Parking / transit cards
  - "Open in Maps" button for the general area
  - Arrival instructions (buzzer, which door, what to do when you arrive)
- Day-of: This section promotes to the TOP of the management page

**Admin UX:**
- In EventForm, a "Venue Guide" section with:
  - Repeatable "Add Step" rows (description + image upload + optional video upload)
  - Text fields for parking, transit, arrival notes
  - Preview button to see how it looks to guests

### I. Tea Master Features — Beyond Basic RSVP

These features transform the system from "event RSVP" into "tea session companion" — deeply specific to what a tea master hosting intimate gatherings needs.

**28. Tea Menu Preview (Pre-Session Anticipation Builder)**
Before the session, the host can add teas to a "Session Menu" — the teas planned for the event. On the guest management page, these reveal over time:
- 3 days before: "A special oolong from Wuyi mountains awaits..."
- 1 day before: "We'll explore 5 teas including a 1998 aged sheng..."
- Day-of: Full menu revealed

This builds anticipation like a restaurant's tasting menu preview. Uses existing product data — the admin picks from their inventory, linking event teas to `products` table entries.

**Data model:**
```sql
CREATE TABLE IF NOT EXISTS event_tea_menu (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  event_id TEXT NOT NULL REFERENCES events(id),
  product_id TEXT REFERENCES products(id),  -- link to existing inventory
  custom_name TEXT,                          -- or a custom tea name if not in inventory
  custom_description TEXT,
  reveal_date TEXT,                          -- when this tea becomes visible to guests
  brew_order INTEGER,                        -- order in the session
  created_at TEXT DEFAULT (datetime('now'))
);
```

**29. Guest Tea Preferences (RSVP Enhancement)**
Optional field in the RSVP form: "What kind of tea do you enjoy?" with quick-select chips:
- Light & Floral | Rich & Roasted | Aged & Earthy | Anything — surprise me!

This helps the tea master curate the session for the group. Shown in admin attendee view as icons/badges.

**30. Session Flow / Agenda**
Not a rigid schedule, but a gentle flow the host can define:
- Arrival & settling (15 min)
- Opening tea: [tea name] (20 min)
- Main exploration: [3 teas] (45 min)
- Conversation & free brewing (30 min)
- Closing tea (15 min)

Shown on the management page day-of as an elegant timeline. Not shown pre-event (maintains mystery).

**31. Post-Session Tasting Notes Collection**
After the session, guests can submit their impressions on each tea via their magic link:
- Simple rating (1-5 leaves instead of stars)
- One-line impression ("reminded me of autumn forest walks")
- Favorite tea of the session

This data feeds into:
- The post-session archive (anonymous group impressions)
- The tea master's product records (helps understand how people respond to each tea)

**32. Tea Passport / Session History**
Guests who attend multiple sessions build a history. Their magic links accumulate into a personal tea journey:
- "Sessions attended: 4"
- "Teas experienced: 23"
- "Your favorites: [list]"

Implemented by linking `event_attendees.phone_number` across events. Shown on the management page under a "Your Tea Journey" section.

**33. Weather-Aware Session Notes**
Show weather forecast for the event date on the management page. Tea masters consider weather when selecting teas — humidity, temperature, season all matter. This also helps guests dress appropriately.

Simple integration: fetch weather API for event location + date, display as a minimal card.

**34. Session Playlist (Pre-Assignment)**
The host assigns a playlist URL before the event (Spotify, Apple Music, YouTube Music). Shown on the management page as "Today's atmosphere" with an embedded mini-player. After the session, it becomes part of the archive.

**35. Contribution / Tea Offering Tracker**
For sessions where guests bring tea to share or contribute financially:
- "Bring a tea to share" toggle in RSVP (with description field: "What will you bring?")
- Post-session: admin logs what each guest contributed
- Builds reciprocity data over time

**36. Host Notes Per Guest (Admin Only)**
Private notes the tea master keeps per attendee — not visible to guests:
- "Prefers lighter brews"
- "New to aged pu'erh — introduce gently"
- "Brought an amazing dancong last time"

These notes persist across events (tied to phone number / customer record).

### J. Summary of New Feature Categories

| Category | Features | Priority |
|----------|----------|----------|
| **Core RSVP** | Capacity engine, magic links, waitlist, +1, cancellation | P0 — Must have |
| **Venue & Logistics** | Rich venue guide with photos/video, map, transit/parking | P0 — Must have |
| **Admin Management** | Event CRUD, attendee table, notifications, golden management | P0 — Must have |
| **Tea Master Tools** | Tea menu preview, session flow, host notes, contribution tracker | P1 — High value |
| **Guest Experience** | Countdown, calendar, tasting notes, tea passport, preferences | P1 — High value |
| **Post-Session** | Archive, gallery, tea ledger cards, playlist, group impressions | P1 — High value |
| **Automation** | Cron reminders, waitlist cascade, WhatsApp message templates | P2 — Important |
| **Polish** | Confirmation animation, OG tags, weather, social proof | P3 — Nice to have |

---

## Part 3: Data Model (D1/SQLite)

### Golden Tier Detection
Golden access is determined by matching the RSVP phone number against the existing `customers` table:
```sql
-- Existing table (worker/schema.sql:49)
-- customers.phone and customers.whatsapp fields
-- Match: SELECT id FROM customers WHERE phone = ? OR whatsapp = ?
-- If match found → access_tier = 'golden' (silent, guest never knows)
```

### New Tables

```sql
-- Events (with custom slug for pretty URLs)
CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  slug TEXT UNIQUE NOT NULL,            -- custom URL slug, set by admin
  title TEXT NOT NULL,
  subtitle TEXT,
  description TEXT,
  flyer_image_url TEXT,
  event_date TEXT NOT NULL,             -- ISO 8601
  event_end_date TEXT,
  location_name TEXT,
  address_text TEXT,
  map_link TEXT,
  guidelines_text TEXT,
  venue_guide TEXT,                      -- JSON: { steps: [], parking_notes, transit_notes, arrival_notes }
  total_capacity INTEGER NOT NULL DEFAULT 12,
  claim_window_minutes INTEGER DEFAULT 60,
  timezone TEXT DEFAULT 'Asia/Taipei',
  status TEXT DEFAULT 'draft' CHECK(status IN ('draft', 'active', 'closed', 'archived')),
  session_flow TEXT,                     -- JSON: [{ title, description, duration_minutes }]
  playlist_url TEXT,                     -- pre-assigned session playlist
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Attendees
CREATE TABLE IF NOT EXISTS event_attendees (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  event_id TEXT NOT NULL REFERENCES events(id),
  customer_id TEXT REFERENCES customers(id),  -- linked if recognized
  full_name TEXT NOT NULL,
  phone_number TEXT NOT NULL,
  email TEXT,
  plus_one INTEGER DEFAULT 0,
  plus_one_name TEXT,
  access_tier TEXT DEFAULT 'standard' CHECK(access_tier IN ('standard', 'golden')),
  status TEXT DEFAULT 'confirmed' CHECK(status IN ('confirmed', 'waitlist', 'cancelled')),
  magic_token TEXT UNIQUE NOT NULL,
  photo_consent INTEGER DEFAULT 0,
  notes TEXT,                             -- dietary/accessibility
  tea_preference TEXT,                    -- 'light_floral' | 'rich_roasted' | 'aged_earthy' | 'surprise_me'
  bringing_tea TEXT,                      -- what tea they're bringing to share (optional)
  waitlist_position INTEGER,
  claimed_at TEXT,
  claim_expires_at TEXT,
  attended INTEGER,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(event_id, phone_number)          -- prevent duplicate RSVPs
);

-- Tea menu for session (links events to products)
CREATE TABLE IF NOT EXISTS event_tea_menu (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  event_id TEXT NOT NULL REFERENCES events(id),
  product_id TEXT REFERENCES products(id),
  custom_name TEXT,
  custom_description TEXT,
  reveal_date TEXT,                        -- when visible to guests (null = always visible)
  brew_order INTEGER,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Guest tasting notes (post-session feedback)
CREATE TABLE IF NOT EXISTS event_tasting_notes (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  event_id TEXT NOT NULL REFERENCES events(id),
  attendee_id TEXT NOT NULL REFERENCES event_attendees(id),
  tea_menu_id TEXT REFERENCES event_tea_menu(id),
  rating INTEGER CHECK(rating BETWEEN 1 AND 5),  -- 1-5 leaves
  impression TEXT,
  is_favorite INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Post-session data
CREATE TABLE IF NOT EXISTS event_post_session (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  event_id TEXT UNIQUE NOT NULL REFERENCES events(id),
  tea_ledger TEXT,                         -- JSON string
  playlist_url TEXT,
  gallery_images TEXT,                     -- JSON array of URLs
  session_notes TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Notification log
CREATE TABLE IF NOT EXISTS event_notifications (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  event_id TEXT NOT NULL REFERENCES events(id),
  attendee_id TEXT REFERENCES event_attendees(id),
  type TEXT NOT NULL CHECK(type IN ('checkin_reminder', 'waitlist_promotion', 'spot_claimed', 'event_update')),
  message_template TEXT,
  status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'sent', 'failed')),
  created_at TEXT DEFAULT (datetime('now')),
  sent_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_events_slug ON events(slug);
CREATE INDEX IF NOT EXISTS idx_events_status ON events(status);
CREATE INDEX IF NOT EXISTS idx_attendees_event ON event_attendees(event_id);
CREATE INDEX IF NOT EXISTS idx_attendees_token ON event_attendees(magic_token);
CREATE INDEX IF NOT EXISTS idx_attendees_status ON event_attendees(event_id, status);
CREATE INDEX IF NOT EXISTS idx_attendees_phone ON event_attendees(event_id, phone_number);
```

---

## Part 4: API Endpoints

### Public (No Auth)
```
GET  /api/events/:slug/public        -- Event details + availability (by slug)
POST /api/events/:slug/rsvp          -- Submit RSVP (returns magic_token + redirect URL)
GET  /api/events/:slug/availability  -- Polling endpoint (seats remaining, confirmed count)
GET  /api/rsvp/:token                -- Management page data (event + attendee + status + venue guide + tea menu)
PUT  /api/rsvp/:token                -- Update +1, cancel, re-confirm
POST /api/rsvp/:token/claim          -- Claim waitlist spot (with expiry check)
GET  /api/rsvp/:token/post-session   -- Post-session archive data (tea ledger, playlist, gallery, group notes)
POST /api/rsvp/:token/tasting-notes  -- Submit tasting notes for each tea (post-session)
POST /api/events/:slug/find-rsvp     -- "Find My RSVP" — input phone, get magic link
```

### Admin (Requires Auth)
```
GET    /api/admin/events                          -- List all events (with counts)
POST   /api/admin/events                          -- Create event
PUT    /api/admin/events/:id                      -- Update event
DELETE /api/admin/events/:id                      -- Soft delete (→ archived)
GET    /api/admin/events/:id/attendees            -- Full attendee list with tier info
PUT    /api/admin/attendees/:id                   -- Update status, manual promote/cancel
POST   /api/admin/events/:id/notifications        -- Generate check-in reminders
GET    /api/admin/events/:id/notifications        -- View notification log
POST   /api/admin/events/:id/post-session         -- Add/update post-session content
POST   /api/admin/events/:id/duplicate            -- Duplicate as template
POST   /api/admin/events/:id/attendance           -- Batch mark attendance (post-event)
GET    /api/admin/events/:id/tea-menu             -- Get tea menu
POST   /api/admin/events/:id/tea-menu             -- Add/update tea menu items
DELETE /api/admin/events/:id/tea-menu/:itemId     -- Remove tea from menu
GET    /api/admin/events/:id/tasting-notes        -- View all guest tasting notes
POST   /api/upload-flyer                          -- R2 upload for flyer/venue images
```

---

## Part 5: Frontend Components & Routes

### Public Routes
```
/event/:slug               -- Event landing page (resolve slug → event data)
/m/:magicToken             -- Guest management page (digital ticket)
```

### Admin Routes
```
/admin/events              -- Event list + create
/admin/events/:id          -- Event detail + attendee management + post-session editor
```

### New Components
```
src/
  components/
    events/
      EventLanding.tsx          -- Public event page (flyer, info, RSVP button)
      RSVPFormSheet.tsx         -- Bottom sheet RSVP form (name, phone, +1, notes, photo consent)
      GuestManagement.tsx       -- Magic link page (/m/:token) — ticket, countdown, status, guidelines
      PostSessionArchive.tsx    -- Post-event content (tea ledger cards, playlist, gallery)
      AvailabilityBadge.tsx     -- "X seats left" / "Waitlisted" indicator with polling
      EventCountdown.tsx        -- Days/hours countdown to event
      CalendarDownload.tsx      -- .ics file generation + download button
      FindRSVPSheet.tsx         -- "Find My RSVP" bottom sheet (enter phone → get link)
  admin/
    components/
      EventsManager.tsx         -- Event list with status badges, create button
      EventDetail.tsx           -- Tabs: Attendees | Notifications | Post-Session
      EventForm.tsx             -- Create/edit modal (slug, title, date, capacity, flyer upload, etc.)
      AttendeeTable.tsx         -- Sortable table with status chips, promote/cancel actions
      NotificationPanel.tsx     -- Message templates, "Copy All" button, send log
      PostSessionEditor.tsx     -- Tea ledger JSON editor, playlist URL, gallery upload
    hooks/
      useEventData.ts           -- React Query hooks: useEvents, useEvent, useAttendees
```

### Existing Patterns to Reuse
| Pattern | Source File | Reuse For |
|---------|------------|-----------|
| Bottom sheet + mobile drag | `src/components/consult/InquiryForm.tsx` | RSVPFormSheet, FindRSVPSheet |
| Button variants | `src/components/shared/Button.tsx` | All CTAs |
| Toast notifications | `src/admin/components/Toast.tsx` | RSVP confirmation, errors |
| Two-column form modal | `src/admin/components/AddProductModal.tsx` | EventForm |
| Data table + GhostInput | `src/admin/components/InventoryView.tsx` | AttendeeTable |
| Scroll lock + focus trap | `src/hooks/useScrollLock.ts`, `src/hooks/useFocusTrap.ts` | All modals |
| Page transitions | `src/admin/AdminApp.tsx` (PageTransition) | Admin event pages |
| API client pattern | `src/lib/api.ts` (fetchWithTimeout, authHeaders) | Event API calls |
| React Query hooks | `src/admin/hooks/useAdminData.ts` | useEventData hooks |
| Capacity charts | `src/admin/components/DashboardView.tsx` | Capacity visualization |

---

## Part 6: Core User Flows

### Flow 1: Guest RSVPs (Happy Path)
1. Guest receives event link (`/event/spring-ceremony`) via WhatsApp/social
2. Sees full-bleed flyer, title, date, location, "X seats left" → taps "RSVP"
3. Bottom sheet slides up: Name, Phone, +1 toggle (+1 name if toggled), optional notes, photo consent
4. Taps "Confirm My Seat"
5. Backend:
   - Check for duplicate (phone + event_id) → if exists, redirect to existing magic link
   - Match phone against `customers.phone` / `customers.whatsapp` → if match, set `access_tier = 'golden'` + link `customer_id`
   - Atomic capacity check via `db.batch()`:
     - Count confirmed seats (including +1s)
     - If golden tier: confirm up to 100% capacity
     - If standard tier: confirm up to 80% capacity
     - Otherwise: waitlist
6. Redirect to `/m/:magicToken`
7. Beautiful confirmation card: status, event details, countdown, "Add to Calendar"
8. Guidelines & logistics as expandable sections

### Flow 2: Waitlist Promotion
1. Confirmed guest cancels → backend sets next waitlisted guest's `claim_expires_at`
2. Admin sees notification: "Spot opened — [Name] is next"
3. Admin taps "Copy Message" → sends WhatsApp manually
4. Guest visits management page, sees "A seat has opened! Claim by [time]"
5. Taps "Claim" → confirmed. If expired → cascades to next person.

### Flow 3: Day-Before Check-in
1. Cron trigger at 9AM, day before event
2. Creates notification records for all confirmed attendees
3. Admin sees "Send 12 reminders" → copies formatted WhatsApp messages
4. Guests confirm/cancel via their management page

### Flow 4: Post-Session
1. After event_date passes, management page transitions: hide RSVP, show "Session Complete"
2. Admin adds tea ledger, playlist, gallery via PostSessionEditor
3. Guests revisit magic link anytime as a keepsake

---

## Part 7: Parallel Execution Strategy

The implementation is split into **4 independent worktree agents** that run simultaneously, followed by a **merge + integration wave**. Each agent gets the full type contract as input context so they can build against the same interfaces.

### Wave 1: Four Parallel Agents (Worktrees)

**Agent 1 — Backend API & Database**
Scope: Everything in `worker/`
- `worker/migrations/003_events.sql` — all tables (events, attendees, post_session, notifications, tea_menu, tasting_notes)
- `worker/src/index.ts` — all event/RSVP route handlers + route registration:
  - Public: event by slug, RSVP with golden detection, management CRUD, claim, find-rsvp, availability polling, post-session, tasting notes submission
  - Admin: event CRUD, attendee management, notifications, post-session editor, tea menu CRUD, attendance marking, event duplication, flyer upload to R2
- `worker/wrangler.toml` — add R2 bucket binding + cron trigger
- Capacity check logic with `db.batch()`
- Golden tier detection: match phone against `customers` table, check for `"golden"` in tags JSON

**Agent 2 — Types, API Client & Hooks**
Scope: Shared infrastructure (all new files, plus extending `api.ts`)
- `src/types/events.ts` — TypeScript interfaces: Event, Attendee, PostSession, TeaMenuItem, TastingNote, VenueGuide, SessionFlow, Notification
- `src/lib/api.ts` — add `api.events.*` and `api.rsvp.*` method namespaces
- `src/admin/hooks/useEventData.ts` — React Query hooks: useEvents, useEvent, useAttendees, useEventNotifications, useTeaMenu
- `src/hooks/useEventPolling.ts` — polling hook for availability + status updates

**Agent 3 — Public Frontend**
Scope: Guest-facing components + public routing (all new files except App.tsx)
- `src/components/events/EventLanding.tsx` — full-bleed flyer, title, date, availability, RSVP trigger
- `src/components/events/RSVPFormSheet.tsx` — bottom sheet: name, phone, +1, tea preference chips, photo consent, notes
- `src/components/events/GuestManagement.tsx` — digital ticket: status card, countdown, venue guide, session flow (day-of), tea menu preview, guidelines
- `src/components/events/PostSessionArchive.tsx` — magazine-spread: tea ledger cards, playlist embed, gallery, tasting notes submission
- `src/components/events/VenueGuide.tsx` — step-by-step visual walkthrough with photos/video, parking, transit, arrival notes
- `src/components/events/AvailabilityBadge.tsx` — "X seats left" with polling
- `src/components/events/EventCountdown.tsx` — days/hours countdown
- `src/components/events/CalendarDownload.tsx` — .ics generation
- `src/components/events/FindRSVPSheet.tsx` — "Find My RSVP" bottom sheet
- `src/components/events/TeaMenuPreview.tsx` — timed reveal of session teas
- `src/components/events/TastingNotesForm.tsx` — post-session: rate teas, write impressions, pick favorite
- `src/App.tsx` — add `/event/:slug` and `/m/:magicToken` routes

**Agent 4 — Admin Frontend**
Scope: Admin components + admin routing
- `src/admin/components/EventsManager.tsx` — event list with status badges, capacity bars, create/duplicate buttons
- `src/admin/components/EventDetail.tsx` — tabs: Attendees | Tea Menu | Notifications | Post-Session
- `src/admin/components/EventForm.tsx` — create/edit: slug, title, date, capacity, flyer R2 upload, guidelines, venue guide builder (repeatable steps with image upload), session flow editor, playlist URL
- `src/admin/components/AttendeeTable.tsx` — sortable table with status chips, tier badges, tea preference icons, promote/cancel actions, attendance toggle
- `src/admin/components/TeaMenuEditor.tsx` — pick from inventory or add custom, set reveal dates, drag-reorder brew sequence
- `src/admin/components/NotificationPanel.tsx` — message templates with WhatsApp deep links, "Copy All" button, send log
- `src/admin/components/PostSessionEditor.tsx` — tea ledger JSON editor, playlist URL, gallery multi-upload, view submitted tasting notes
- `src/admin/AdminApp.tsx` — add event routes
- `src/admin/components/Sidebar.tsx` — add Events nav item with Calendar icon

### Wave 2: Integration & Polish (After merge)
- Resolve any merge conflicts (minimal — each agent touches different files)
- Wire up real API calls (agents 3 & 4 use the API client from agent 2)
- End-to-end flow testing
- RSVP confirmation animation (ink wash / tea leaf settling)
- OG meta tags for social sharing (use flyer as og:image)
- WhatsApp deep link sharing buttons in admin
- Weather card on management page (simple API fetch)
- Tea Passport / session history view (query across events by phone number)

### Why This Split Works
- **No file conflicts**: Agent 1 = `worker/`. Agent 2 = `src/lib/` + `src/types/` + `src/hooks/`. Agent 3 = `src/components/events/` + 2 lines in `App.tsx`. Agent 4 = `src/admin/components/Events*` + admin routing.
- **Shared contract**: All agents receive the type definitions as input context. They build against the same interfaces even though Agent 2 creates the actual type file.
- **Merge order**: Agent 1 → Agent 2 → Agents 3 & 4 (parallel, no conflicts between them).

---

## Part 8: Verification Plan

### Core RSVP Flow
1. **DB migration** — Run migration, verify all 6 tables exist with correct schema
2. **Create event** via admin → verify slug, capacity, flyer R2 upload, venue guide, session flow
3. **Public event page** (`/event/:slug`) → verify flyer, info, availability badge
4. **RSVP (standard guest)** → verify confirmed status, magic link redirect, calendar download, tea preference saved
5. **RSVP (golden customer)** → verify golden tier assigned silently when phone matches customer with "golden" tag
6. **Duplicate RSVP** → verify redirect to existing management page (not double-registration)
7. **Capacity: fill to 80%** → verify next standard RSVP gets waitlisted
8. **Capacity: golden at 85%** → verify golden RSVP still confirms (up to 100%)
9. **+1 toggle** → verify capacity recalculates, +1 name displayed
10. **Cancel** → verify waitlist cascade, claim link with expiry
11. **Claim link** → verify claim works within window, expired claim cascades to next person
12. **Find My RSVP** → verify phone lookup returns correct magic link
13. **Race condition** → concurrent RSVP attempts at capacity boundary

### Tea Master Features
14. **Tea menu** — Admin adds teas from inventory, sets reveal dates → guest sees timed reveals on management page
15. **Venue guide** — Admin adds step-by-step photos/video → guest sees visual walkthrough
16. **Session flow** — Admin defines flow → guest sees timeline on day-of management page
17. **Post-session tasting notes** — After event, guest submits ratings + impressions via magic link
18. **Post-session archive** — Admin adds tea ledger, playlist, gallery → guest sees magazine-spread archive

### Admin & Management
19. **Attendee table** — Filters by status, shows tier badges, tea preferences, promote/cancel actions
20. **Notification panel** — Generate check-in reminders, copy WhatsApp messages, view send log
21. **Event duplication** — Duplicate event as template, verify slug/date cleared
22. **Attendance marking** — Post-event batch mark who attended

### Mobile & Polish
23. **Mobile test** → bottom sheet RSVP, swipe dismiss, venue guide photo swipe, responsive layout
24. **OG tags** → share event link on WhatsApp/social, verify flyer preview card appears

---

## Key Files to Modify (by Agent)

**Agent 1 (Backend):**
- `worker/src/index.ts` — Add ~20 route handlers + route registration
- `worker/migrations/003_events.sql` — New file (6 tables + indexes)
- `worker/wrangler.toml` — Add R2 bucket binding + cron trigger

**Agent 2 (Types & API):**
- `src/types/events.ts` — New file (all TypeScript interfaces)
- `src/lib/api.ts` — Extend api object with events/rsvp namespaces
- `src/admin/hooks/useEventData.ts` — New file (React Query hooks)
- `src/hooks/useEventPolling.ts` — New file (availability + status polling)

**Agent 3 (Public Frontend):**
- `src/components/events/*.tsx` — 11 new files (EventLanding, RSVPFormSheet, GuestManagement, PostSessionArchive, VenueGuide, AvailabilityBadge, EventCountdown, CalendarDownload, FindRSVPSheet, TeaMenuPreview, TastingNotesForm)
- `src/App.tsx` — Add 2 routes (`/event/:slug`, `/m/:magicToken`)

**Agent 4 (Admin Frontend):**
- `src/admin/components/Events*.tsx` + `AttendeeTable.tsx` + `TeaMenuEditor.tsx` + `NotificationPanel.tsx` + `PostSessionEditor.tsx` — 7 new files
- `src/admin/AdminApp.tsx` — Add 2 routes + imports
- `src/admin/components/Sidebar.tsx` — Add Events nav item with Calendar icon

# Event RSVP & Capacity Engine — UX Review & Implementation Plan

## Context

Adrian wants to add a private tea session RSVP system to Teajia. The system handles tiered capacity (80/20 standard/golden split), magic-link-based guest management, waitlist reallocation, and post-session archival. Events are typically one-at-a-time, 12-30 guests, intimate gatherings. Golden access is distributed via both manual link sharing and secret codes. WhatsApp integration is deferred — start with shareable links and manual follow-up.

---

## Part 1: UX Critique — What's Strong

The core concept is solid:
- **Magic links as identity** — no passwords, no friction. Perfect for a tea session audience that skews toward experience-seekers, not power users.
- **The 80/20 capacity split** — elegant. Rewards your inner circle without making the standard tier feel second-class (they don't even know about the golden tier).
- **Post-session archive** — this is the sleeper hit. A tea session becomes a *memory*, not just an event. The tea ledger + playlist + gallery transforms a one-time RSVP page into a keepsake.

---

## Part 2: UX Critique — Gaps, Risks & Recommendations

### A. Critical Functional Gaps

**1. Lost Magic Link Recovery**
Your spec has no recovery path. If someone clears their browser history or loses the WhatsApp message, they're locked out of their ticket.

**Recommendation:** Add a "Find My RSVP" flow on the event page — enter WhatsApp number, receive a link to your management page. Since there's no WhatsApp API yet, show the magic link on-screen after lookup (secured by matching the number). Later, when WhatsApp API is added, send it via message instead.

**2. The +1 Is a Ghost**
The +1 toggle creates a phantom attendee — they consume a seat but have no name, no way to be contacted, no independent management. If the primary cancels, the +1 vanishes silently.

**Recommendation:**
- When +1 is toggled ON, require the guest's first name (not full registration — keep it light).
- The +1 does NOT get their own magic link. They're managed through the primary's page.
- On the primary's management page, show: "You + [Guest Name]" clearly.
- If primary cancels, prompt: "This will also cancel [Guest Name]'s spot. Continue?"

**3. No Admin Event Management Interface**
The spec describes the guest-facing flow in detail but says nothing about how YOU (Adrian) create events, view attendees, manage the waitlist, or trigger notifications. This is half the system.

**Recommendation:** Add an admin route at `/admin/events` with:
- Event creation form (title, date, capacity, flyer upload, guidelines, location)
- Attendee list view with status filters (confirmed/waitlist/cancelled)
- Manual status override (promote from waitlist, cancel someone)
- Quick-copy shareable links (standard + golden)
- Capacity bar visualization (X/N confirmed, Y waitlisted)
- One-click "send check-in reminders" (generates WhatsApp message templates you can copy-paste until API is ready)

**4. Race Conditions on RSVP**
Two people hitting "Confirm" at the same instant when one spot remains. Your spec doesn't address this.

**Recommendation:** Use D1's transaction support. The capacity check + status assignment must be atomic. If the transaction finds capacity exceeded, return waitlist status. On the frontend, handle the "you were waitlisted" response gracefully — don't show an error, show a warm message: "The table is full, but you're on the list. We'll reach out if a seat opens."

**5. Claim Link Expiration**
When a waitlisted person gets a "claim your spot" notification, what happens when it expires? Your spec says "[X] minutes" but doesn't define X or the fallback.

**Recommendation:**
- Default claim window: 60 minutes (configurable per event in admin).
- After expiration: auto-pass to next waitlisted person.
- After 3 unclaimed passes: alert admin to manually intervene.
- On the claim page: show a countdown timer. After expiry, show "This spot has been offered to another guest."

### B. Clarity Issues

**6. Tier Visibility — Don't Expose the System**
The golden/standard distinction should be *invisible* to guests. If someone sees "Standard Access" anywhere, they'll wonder what they're missing. The tier is a backend concern only.

**Recommendation:**
- Never show tier labels to guests. Their experience is identical: RSVP → Confirmed or Waitlisted.
- Golden links simply have a higher chance of confirming. Standard guests don't know the 80% threshold exists.
- In admin, show the tier clearly so Adrian can track it.

**7. Waitlist Position**
Should users see "You are #3 on the waitlist"? This cuts both ways — transparency builds trust, but "#12 of 12" is demoralizing.

**Recommendation:** Show a vague but honest indicator:
- "You're near the front of the waitlist" (position 1-3)
- "You're on the waitlist" (position 4+)
- Never show exact numbers. This is a tea gathering, not a concert queue.

**8. Status Change Notifications (Without WhatsApp API)**
Without API automation, how does a waitlisted person know they've been promoted?

**Recommendation (Phase 1 — no API):**
- When admin promotes someone, generate a pre-formatted WhatsApp message (with the guest's magic link) that Adrian can send with one tap from admin.
- The management page (`/m/[token]`) should also update in real-time (or on refresh) — if someone checks back, they see their new status immediately.
- Add a subtle "Check for updates" pull-to-refresh on the management page.

### C. Friction Points

**9. RSVP Flow Length**
Your spec has: Landing → Scroll guidelines → Scroll logistics → Form → Confirm. That's a lot of scrolling before the action.

**Recommendation:** Restructure the landing page:
1. **Above the fold:** Flyer image, event title, date/time, location one-liner, and a prominent "RSVP" button.
2. **RSVP button opens a bottom sheet/modal** with the form (Name, WhatsApp, +1 toggle). Two taps to RSVP.
3. **Below the fold (scrollable):** Guidelines, logistics, map link. This is reference material — important but not a gate.
4. On the management page (after RSVP), show guidelines and logistics again as expandable sections — they'll need it closer to the event.

**10. WhatsApp-Only Contact**
Not everyone uses WhatsApp. Some markets prefer Telegram, Line, or plain SMS.

**Recommendation:** For now, keep WhatsApp as primary (it's your community's channel). But label the field "WhatsApp / Phone" and store it as a phone number. This future-proofs for SMS or other messaging. Add an optional email field for calendar invite delivery.

### D. Delight & Experience Opportunities

**11. The Tea Ceremony Aesthetic**
The RSVP experience should feel like receiving a calligraphy invitation, not filling out a Google Form. Every interaction should reinforce the ritual nature of the gathering.

**Recommendations:**
- **Event landing page:** Full-bleed flyer image with a subtle parallax. Date rendered in a serif font, like a printed invitation. Location as a minimal, elegant line — not a chunky Google Maps embed.
- **RSVP confirmation moment:** Don't just flash a toast. Show a brief, beautiful animation — a tea leaf settling into a cup, or a gentle ink wash transition. The message: "Your seat has been set." (not "RSVP Confirmed!")
- **Management page header:** Show the event flyer as a card with a gold-foil border for confirmed guests. For waitlisted guests, a softer treatment — same card, muted tones, with "awaiting your seat" language.
- **Post-session archive:** This is the crown jewel. Design it like a magazine spread — the tea ledger as a tasting card layout (use the Alcove card component aesthetic), playlist as an embedded player, gallery as a polaroid-scatter or masonry grid.

**12. Countdown & Anticipation**
Between RSVP and the event, the management page is dead. Use this window.

**Recommendations:**
- Show a countdown to the event (days/hours).
- Optional: "What to expect" tips that appear at intervals (3 days before: "Wear comfortable clothes", 1 day before: "Arrive 10 minutes early").
- Day-of: Show a simplified "getting there" card with the map link prominently displayed.

**13. Social Proof (Gentle)**
For a private tea session, you don't want a full attendee list. But a sense of community helps.

**Recommendation:** On the landing page, show: "X seats confirmed" (not names). On the management page, show: "You're joining X others." This creates warmth without exposing personal info.

### E. Architecture Concerns

**14. WebSockets Are Overkill**
Your spec calls for WebSockets so the "Waitlist" button instantly turns to "RSVP" when a spot opens. Cloudflare Workers support WebSockets only via Durable Objects — that's a significant complexity jump for a feature that fires rarely (only when someone cancels).

**Recommendation:** Use polling instead. The event landing page polls `/api/events/:id/availability` every 30 seconds. The management page polls `/api/rsvp/:token/status` every 15 seconds. This is simple, works on Workers without Durable Objects, and the latency is perfectly acceptable for an event that's days away.

**15. Stay on D1 — Don't Add PostgreSQL/Supabase**
Your spec mentions PostgreSQL/Supabase, but the entire app runs on Cloudflare D1. Adding a second database creates deployment complexity, data sync issues, and breaks the unified architecture.

**Recommendation:** Use D1 for everything. The RSVP schema is simple (two tables + a couple of indexes). D1 handles this easily. The capacity check transaction is supported. Keep the stack unified.

**16. Cron Jobs on Cloudflare**
Cloudflare Workers support Cron Triggers natively. The 9AM check-in reminder is a perfect fit.

**Recommendation:** Add a Cron Trigger to the Worker for daily 9AM checks. Since there's no WhatsApp API yet, the cron job should:
- Flag events needing check-in reminders.
- Generate notification records in a `notifications` table.
- Admin sees pending notifications in the dashboard and can send them manually.
- When WhatsApp API is added later, the cron sends automatically.

### F. Things You Didn't Think About

**17. Calendar Integration**
After RSVP confirmation, offer an "Add to Calendar" button that downloads an .ics file. This is the #1 missed feature in event RSVP systems. It takes 20 lines of code and prevents no-shows more than any reminder.

**18. No-Show Tracking**
After the event, mark who actually attended vs. who confirmed but didn't show. Over time, this data helps you manage future waitlists (chronic no-shows could be deprioritized).

**19. Event Series / Templates**
If you host monthly sessions, creating each event from scratch is tedious. Add a "Duplicate Event" button in admin that copies everything except the date.

**20. Photo Consent**
If the post-session gallery includes photos of guests, you need consent. Add a simple toggle in the RSVP form: "I'm okay with photos from the session being shared." Default OFF.

**21. Dietary / Accessibility Notes**
For a tea session this may be minimal, but an optional "Anything we should know?" free-text field catches allergies, mobility needs, or dietary restrictions without making it feel clinical.

**22. Shareable Event Link with OG Image**
When someone shares the event link on WhatsApp/social media, it should show a beautiful preview card (Open Graph tags). Use the flyer image as the og:image. This is free marketing.

---

## Part 3: Recommended Data Model (D1/SQLite)

### New Tables

```sql
-- Events
CREATE TABLE events (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  title TEXT NOT NULL,
  subtitle TEXT,
  description TEXT,
  flyer_image_url TEXT,
  event_date TEXT NOT NULL,          -- ISO 8601
  event_end_date TEXT,
  location_name TEXT,
  address_text TEXT,
  map_link TEXT,
  guidelines_text TEXT,
  total_capacity INTEGER NOT NULL DEFAULT 12,
  golden_code TEXT,                   -- secret code for golden access
  claim_window_minutes INTEGER DEFAULT 60,
  timezone TEXT DEFAULT 'Asia/Taipei',
  is_archived INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Attendees
CREATE TABLE event_attendees (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  event_id TEXT NOT NULL REFERENCES events(id),
  full_name TEXT NOT NULL,
  phone_number TEXT NOT NULL,         -- WhatsApp / phone
  email TEXT,                         -- optional, for calendar invite
  plus_one INTEGER DEFAULT 0,         -- boolean
  plus_one_name TEXT,                 -- guest's first name
  access_tier TEXT DEFAULT 'standard' CHECK(access_tier IN ('standard', 'golden')),
  status TEXT DEFAULT 'confirmed' CHECK(status IN ('confirmed', 'waitlist', 'cancelled')),
  magic_token TEXT UNIQUE NOT NULL,
  photo_consent INTEGER DEFAULT 0,
  notes TEXT,                         -- dietary/accessibility
  waitlist_position INTEGER,          -- for ordering
  claimed_at TEXT,                    -- when waitlist spot was claimed
  claim_expires_at TEXT,              -- deadline for claiming
  attended INTEGER,                   -- post-event: did they show up?
  created_at TEXT DEFAULT (datetime('now'))
);

-- Post-session data
CREATE TABLE event_post_session (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  event_id TEXT UNIQUE NOT NULL REFERENCES events(id),
  tea_ledger TEXT,                    -- JSON string
  playlist_url TEXT,
  gallery_images TEXT,                -- JSON array of URLs
  session_notes TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Notification log (for manual + future automated sending)
CREATE TABLE event_notifications (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  event_id TEXT NOT NULL REFERENCES events(id),
  attendee_id TEXT REFERENCES event_attendees(id),
  type TEXT NOT NULL,                 -- 'checkin_reminder', 'waitlist_promotion', 'spot_claimed', etc.
  message_template TEXT,
  status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'sent', 'failed')),
  created_at TEXT DEFAULT (datetime('now')),
  sent_at TEXT
);

CREATE INDEX idx_attendees_event ON event_attendees(event_id);
CREATE INDEX idx_attendees_token ON event_attendees(magic_token);
CREATE INDEX idx_attendees_status ON event_attendees(event_id, status);
```

---

## Part 4: API Endpoints (Cloudflare Worker)

### Public (No Auth)
```
GET  /api/events/:id/public          -- Event details + availability count
POST /api/events/:id/rsvp            -- Submit RSVP (returns magic_token)
GET  /api/rsvp/:token                -- Management page data
PUT  /api/rsvp/:token                -- Update +1, cancel
POST /api/rsvp/:token/claim          -- Claim waitlist spot
GET  /api/rsvp/:token/post-session   -- Post-session archive data
GET  /api/events/:id/availability    -- Polling endpoint (seats remaining)
```

### Admin (Requires Auth)
```
GET    /api/admin/events             -- List all events
POST   /api/admin/events             -- Create event
PUT    /api/admin/events/:id         -- Update event
DELETE /api/admin/events/:id         -- Delete/archive event
GET    /api/admin/events/:id/attendees   -- Full attendee list
PUT    /api/admin/attendees/:id      -- Update attendee status
POST   /api/admin/events/:id/notifications  -- Trigger check-in reminders
GET    /api/admin/events/:id/notifications  -- View notification log
POST   /api/admin/events/:id/post-session   -- Add post-session content
POST   /api/admin/events/:id/duplicate      -- Duplicate event as template
```

---

## Part 5: Frontend Components & Routes

### Public Routes
```
/event/:eventId                -- Event landing page
/event/:eventId?access=golden  -- Golden access landing (same page, backend flag)
/m/:magicToken                 -- Guest management page (digital ticket)
```

### Admin Routes (under existing `/admin`)
```
/admin/events                  -- Event list + create
/admin/events/:id              -- Event detail + attendee management
```

### New Components
```
src/
  components/
    events/
      EventLanding.tsx          -- Public event page (flyer, info, RSVP button)
      RSVPFormSheet.tsx         -- Bottom sheet/modal RSVP form
      GuestManagement.tsx       -- Magic link management page (/m/:token)
      PostSessionArchive.tsx    -- Post-event content display
      AvailabilityBadge.tsx     -- "X seats left" / "Waitlisted" indicator
      EventCountdown.tsx        -- Days/hours countdown
      CalendarDownload.tsx      -- .ics generation button
  admin/
    components/
      EventsManager.tsx         -- Admin event list
      EventDetail.tsx           -- Admin attendee list + controls
      EventForm.tsx             -- Create/edit event form
      AttendeeTable.tsx         -- Attendee table with status management
      NotificationPanel.tsx     -- Check-in reminder management
      PostSessionEditor.tsx     -- Upload tea ledger, playlist, gallery
```

### Reusable Patterns from Existing Codebase
- `Button.tsx` — primary/secondary/ghost variants for all CTAs
- `Toast.tsx` — confirmation feedback after RSVP
- `InquiryForm.tsx` pattern — bottom sheet on mobile, modal on desktop
- `AlcoveModal.tsx` — swipe-to-dismiss for the management page on mobile
- `LoadingSpinner.tsx` — loading states during RSVP submission
- `AddProductModal.tsx` layout — two-column form for event creation in admin
- `InventoryView.tsx` GhostInput pattern — inline editing in attendee table
- `DashboardView.tsx` — capacity visualization charts

---

## Part 6: Core User Flows

### Flow 1: Guest RSVPs (Happy Path)
1. Guest receives event link via WhatsApp/social
2. Sees full-bleed flyer, event title, date, location → taps "RSVP"
3. Bottom sheet slides up: Name, WhatsApp/Phone, +1 toggle (if +1: guest name field appears)
4. Taps "Confirm My Seat"
5. Backend checks capacity (atomic transaction):
   - If tier allows: status = confirmed
   - If full: status = waitlist
6. Redirected to `/m/:magicToken`
7. Sees beautiful confirmation card with status, event details, countdown
8. "Add to Calendar" button available
9. Guidelines & logistics as expandable sections below

### Flow 2: Waitlist Promotion (Manual Phase)
1. Confirmed guest cancels via their management page
2. Backend: next waitlisted guest (by created_at) gets `claim_expires_at` set
3. Admin sees notification in dashboard: "Spot opened — [Name] is next in line"
4. Admin copies pre-formatted WhatsApp message and sends manually
5. Guest opens their management page (or claim link), sees "A seat has opened! Claim by [time]"
6. Guest taps "Claim My Seat" → status = confirmed
7. If they don't claim in time → next person in waitlist gets the offer

### Flow 3: Day-Before Check-in (Manual Phase)
1. Cron trigger fires at 9AM, day before event
2. Creates notification records for all confirmed attendees
3. Admin sees "12 check-in reminders ready to send" in events dashboard
4. Admin taps "Copy All Messages" → gets formatted WhatsApp messages
5. Sends manually via WhatsApp
6. Guests respond by visiting their management page and confirming or cancelling

### Flow 4: Post-Session Archive
1. After event_date passes, management page transitions automatically
2. RSVP/Cancel buttons hidden, countdown gone
3. "Session Complete" state shows
4. When admin adds post-session data (tea ledger, playlist, gallery), it appears
5. Guests can revisit their magic link anytime to relive the session

---

## Part 7: Implementation Phases

### Phase 1: Database & API (Backend)
- Add migration SQL for new tables
- Implement public API endpoints (event details, RSVP, management, availability polling)
- Implement admin API endpoints (CRUD events, attendees, notifications)
- Capacity check with D1 transaction
- Magic token generation (crypto.randomUUID())

### Phase 2: Public Event Pages (Frontend)
- `EventLanding.tsx` — flyer display, event info, RSVP trigger
- `RSVPFormSheet.tsx` — bottom sheet form with validation
- `GuestManagement.tsx` — digital ticket with status, countdown, guidelines
- `AvailabilityBadge.tsx` — polling-based seat availability
- `CalendarDownload.tsx` — .ics file generation
- Route setup: `/event/:eventId` and `/m/:magicToken`

### Phase 3: Admin Event Management
- `EventsManager.tsx` — list view with create button
- `EventForm.tsx` — create/edit modal (reuse AddProductModal layout pattern)
- `EventDetail.tsx` — attendee table with filters
- `AttendeeTable.tsx` — status management, manual promotion
- `NotificationPanel.tsx` — message templates, copy-to-clipboard
- Route setup: `/admin/events` and `/admin/events/:id`
- Add "Events" to admin sidebar

### Phase 4: Waitlist & Automation
- Claim link flow with expiration
- Auto-cascade to next waitlisted person on expiry
- Cron trigger for day-before reminders
- Notification logging

### Phase 5: Post-Session Archive
- `PostSessionEditor.tsx` — admin form to add tea ledger, playlist, gallery
- `PostSessionArchive.tsx` — guest-facing archive display
- State transition logic (event_date comparison)
- Gallery display (masonry/polaroid layout)
- Tea ledger display (tasting card aesthetic)

### Phase 6: Polish & Delight
- RSVP confirmation animation
- Countdown component
- OG meta tags for social sharing
- "Find My RSVP" recovery flow
- No-show tracking post-event
- Event duplication in admin

---

## Part 8: Verification Plan

1. **Create a test event** via admin → verify it appears in event list
2. **Visit public event page** → verify flyer, info, availability badge
3. **Submit RSVP** → verify magic token redirect, confirmed status
4. **Fill to 80% capacity** → verify next standard RSVP gets waitlisted
5. **Use golden code** → verify golden RSVP still confirms up to 100%
6. **Toggle +1** on management page → verify capacity recalculates
7. **Cancel a confirmed guest** → verify waitlist cascade triggers
8. **Test claim link** → verify claim + expiration behavior
9. **Check post-event state** → verify archive display, hidden RSVP buttons
10. **Mobile test** → verify bottom sheet form, swipe interactions, responsive layout
11. **Race condition test** → simultaneous RSVP attempts at capacity boundary

---

## Key Files to Modify

- `worker/src/index.ts` — Add event/RSVP API routes and handlers
- `src/App.tsx` — Add public event routes
- `src/admin/AdminApp.tsx` — Add admin event routes
- `src/admin/components/Sidebar.tsx` — Add Events nav item
- New migration file for D1 schema
- All new components listed in Part 5

# Event System V2 — Redesigned Flow

## Design Philosophy
Every touchpoint feels like a handcrafted invitation, not a tech platform. Restraint, warmth, materiality. The flyer IS the event. The UI is the frame, the photo is the art.

---

## Core Flow Changes from V1

### 1. Approval-Based RSVP (was: auto-confirm)
- Guest **requests** a seat (status: `requested`)
- Admin **approves/denies/waitlists** each request
- Location hidden until approved — only general area shown publicly
- Each +guest gets their own claimable invite link (single-use)

### 2. Flyer-First Event Creation (was: dense form)
- Step 1: Upload flyer image
- Step 2: Title, Date, Seats — three fields only
- Step 3: Done (draft created)
- All other fields (description, venue guide, session flow, briefing cards) added later inside EventDetail

### 3. Share Sheet (new)
- WhatsApp: pre-formatted message with event link, "Copy Message" for broadcast list
- Email: bulk send to selected customers via Resend (free tier)
- QR code: downloadable for physical flyers
- Copy link: for anywhere else
- OG meta tags on event pages for beautiful link previews

### 4. Story Cards Briefing (new)
- On first visit after approval, guest sees full-screen card sequence
- Each card: one message + optional photo (the space, what to bring, the rhythm)
- Not rules — an introduction to the atmosphere
- Only shown once; guidelines available as expandable section after

### 5. Guest Requests (was: +1 integer)
- Guest adds people by description: "my partner", "a friend new to tea"
- Admin can partially approve (approve 2 of 3 requested guests)
- Each approved guest gets a unique single-use invite link
- +guest claims invite → enters name + phone → gets own magic token

### 6. Quiet Account / Identity (new)
- Phone OR email required (not both)
- No passwords — 6-digit verification code via WhatsApp/email
- Customer record created/matched automatically on RSVP
- Journey page accessible via verify flow
- Guest controls: contact preference, notification opt-in, delete data

### 7. Journey System (new)
- Session seals (stamps per event, not badges)
- Tea map (types experienced, visual breadth)
- "Your Words" (tasting impressions collected over time)
- Quiet milestone marks (Chinese characters, no fanfare)
- Admin sees journey summary per customer

### 8. Reminder Timeline (new)
- Pre-written messages at 3d/1d/2h milestones
- Admin taps "Send via WhatsApp" for each, or "Copy All"
- Guest's ticket page evolves: mood hints → venue guide → map only

### 9. Post-Session Enhancements
- Host private debrief notes + energy tag
- Guest tasting notes: leaf rating + one-line impression + favorite
- "Notify me of the next one" captures interest for future events
- Tea menu is post-session record (optional pre-session mood hints)

---

## Database Migration (004_events_v2.sql)

### events table — ADD COLUMNS:
- `briefing_cards TEXT` — JSON: BriefingCard[]
- `interested_list TEXT` — JSON: [{phone, name, email, created_at}]
- `area_hint TEXT` — General area shown before approval (e.g., "Da'an District, Taipei")
- `mood_hints TEXT` — JSON: string[] (pre-session mood hints, optional)

### event_attendees table — CHANGES:
- ADD `guest_requests TEXT` — JSON: GuestRequest[] (replaces plus_one/plus_one_name)
- ADD `guest_invite_tokens TEXT` — JSON: GuestInviteToken[]
- ADD `first_visit_briefed INTEGER DEFAULT 0`
- ADD `cancellation_note TEXT`
- ADD `source TEXT DEFAULT 'direct'` — 'direct' | 'waitlist_notify' | 'public_page' | 'guest_invite'
- ADD `contact_method TEXT DEFAULT 'whatsapp'` — 'whatsapp' | 'email'
- ALTER status CHECK to include 'requested': ('requested', 'confirmed', 'waitlist', 'cancelled', 'denied')
- KEEP plus_one/plus_one_name for backwards compat (deprecated)

### event_post_session table — ADD COLUMNS:
- `host_notes TEXT`
- `energy TEXT` — 'intimate_warm' | 'lively' | 'contemplative' | etc.
- `host_changes TEXT`

### customers table — ADD COLUMNS:
- `contact_preference TEXT DEFAULT 'whatsapp'`
- `notification_prefs TEXT DEFAULT '["sessions"]'`
- `tea_preferences TEXT DEFAULT '[]'`
- `verification_code TEXT`
- `verification_expires TEXT`

### New table: guest_invites
```sql
CREATE TABLE IF NOT EXISTS guest_invites (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  event_id TEXT NOT NULL REFERENCES events(id),
  parent_attendee_id TEXT NOT NULL REFERENCES event_attendees(id),
  invite_token TEXT UNIQUE NOT NULL,
  name_hint TEXT,
  claimed_by_name TEXT,
  claimed_by_phone TEXT,
  claimed_by_email TEXT,
  claimed_attendee_id TEXT REFERENCES event_attendees(id),
  status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'claimed', 'expired')),
  created_at TEXT DEFAULT (datetime('now')),
  claimed_at TEXT
);
```

---

## New TypeScript Types

```typescript
export type AttendeeStatus = 'requested' | 'confirmed' | 'waitlist' | 'cancelled' | 'denied';

export interface BriefingCard {
  text: string;
  imageUrl?: string;
  order: number;
}

export interface GuestRequest {
  nameHint: string; // "my partner", "a friend new to tea"
  approved: boolean | null; // null = pending
}

export interface GuestInvite {
  id: string;
  eventId: string;
  parentAttendeeId: string;
  inviteToken: string;
  nameHint?: string;
  claimedByName?: string;
  claimedByPhone?: string;
  claimedByEmail?: string;
  claimedAttendeeId?: string;
  status: 'pending' | 'claimed' | 'expired';
  createdAt: string;
  claimedAt?: string;
}

export interface MoodHint {
  text: string; // "aged and grounding", "high mountain lightness"
}

export interface JourneyData {
  sessionsAttended: number;
  totalTeas: number;
  teaTypeMap: Record<string, number>; // { "Sheng": 4, "Oolong": 3 }
  favorites: string[];
  impressions: { text: string; teaName: string; eventTitle: string; date: string }[];
  milestones: string[]; // ['初', '七', etc.]
  seals: { eventId: string; title: string; date: string; flyerUrl?: string }[];
}

export interface ShareMessage {
  whatsappText: string;
  emailSubject: string;
  emailHtml: string;
  eventUrl: string;
  qrDataUrl?: string;
}
```

---

## New/Modified API Endpoints

### Admin:
- `PUT /api/admin/attendees/:id/approve` — approve with optional guest adjustment
- `PUT /api/admin/attendees/:id/deny` — deny with optional message
- `PUT /api/admin/attendees/:id/waitlist` — move to waitlist
- `POST /api/admin/events/:id/approve-batch` — batch approve selected requests
- `GET /api/admin/events/:id/share` — get pre-formatted share messages
- `POST /api/admin/events/:id/send-emails` — bulk email invites
- `GET /api/admin/customers/:id/journey` — customer journey summary

### Public:
- `POST /api/events/:slug/rsvp` — UPDATED: now creates 'requested' status
- `POST /api/events/:slug/interest` — "notify me of next one"
- `POST /api/verify/request` — request 6-digit code (phone or email)
- `POST /api/verify/confirm` — confirm code, return session token
- `GET /api/journey/:token` — guest journey data (after verify)
- `POST /api/guest-invite/:token/claim` — claim a +guest invite link
- `GET /api/rsvp/:token` — UPDATED: includes briefingCards, guestInvites, areaHint

---

## Component Changes

### Admin — Modified:
- `EventForm.tsx` → Rewrite as 3-step wizard (Flyer → Details → Done)
- `EventDetail.tsx` → Add "Requests" tab, share button, enrichment cards, reminder timeline
- `AttendeeTable.tsx` → Approval cards with swipe, partial +guest approval, journey preview
- `EventsManager.tsx` → Add request count badges

### Admin — New:
- `ShareSheet.tsx` — WhatsApp message builder, email blast, QR, copy link
- `BriefingCardsEditor.tsx` — Create/edit story cards with photo upload
- `ReminderTimeline.tsx` — 3d/1d/2h pre-written message milestones
- `ApprovalCard.tsx` — Individual request card with approve/deny/waitlist + guest adjustment

### Public — Modified:
- `EventLanding.tsx` → "Request Your Seat" (not "RSVP"), area hint, "Notify me" on closed events
- `RSVPFormSheet.tsx` → Add guests by description (not +1 dropdown), phone OR email
- `GuestManagement.tsx` → Story cards on first visit, location gating, +guest invite links, journey link

### Public — New:
- `StoryCardsBriefing.tsx` — Full-screen card sequence (guidelines as experience)
- `JourneyPage.tsx` — Seal collection, tea map, "Your Words", milestones
- `VerifySheet.tsx` — Phone/email → 6-digit code → access journey
- `GuestInviteClaim.tsx` — +guest claims their invite link
- `InterestCapture.tsx` — "Notify me of the next session"
- `TicketCard.tsx` — Downloadable/saveable ticket image with QR

---

## Visual Principles

### Typography:
- Event title: serif, 28-32px, letter-spacing: -0.02em
- Date/location: small caps sans, 13-14px, letter-spacing: 0.05em
- Body: sans-serif, 16px, line-height: 1.6
- Accent: serif italic for mood hints, pull quotes

### Color:
- 90% monochrome: tea-text on tea-surface
- Gold ONLY for: confirmed status seal, journey stamps, primary action active state
- Flyer image provides all color personality

### Animation:
- Slow fades (300-400ms), gentle opacity
- Cards settle into place (no bounce/spring)
- Story cards crossfade
- Seals fade in on journey page
- No parallax on everything, no elastic overshoots

### Spacing:
- 48-64px between major sections
- 24-32px card padding
- max-width: 480px for text blocks on desktop

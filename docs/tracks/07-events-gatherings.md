# Track 7: Events & Gatherings

> The arc is built: invite, approve, gather, remember. Close the delivery gaps and the one loop that feeds the magazine, event to recap to photo essay.

Status: launch-program event scope implemented and locally verified; optional follow-on event features remain queued.

Part of [Consolidated Direction](../CONSOLIDATED_DIRECTION.md).

## Build queue

### Core build

- [x] **Verification code delivery, email leg.** Event/guest and sign-in verification share the implemented purpose-aware challenge lifecycle and Resend delivery abstraction. Secure generation/storage, retryable failure handling, and local Worker/UI coverage are complete. A real deployed Resend receipt remains a launch-validation gate; WhatsApp Business delivery remains separate and out of this release.
- [ ] **Post-session summary email.** Confirmed unbuilt: `event_notifications.type` only has `checkin_reminder`, `waitlist_promotion`, `spot_claimed` rows anywhere in the worker (`worker/src/index.ts:6149`, `6714`, `7267`, `18910`) — no `post_session_summary` type, no composer, not even a copy-paste template like the reminder timeline has. Add a fourth notification type + template (teas tasted, personal notes, purchase links, "rate this session") and a trigger point (manual "Send Summaries" button in `EventDetail.tsx`'s Post-Session tab is enough for v1, cron can come later). (day)
- [x] **Post-session editor to article-draft composer.** Event gallery, host notes, energy, shared notes, and tea ledger now save/reload and build an idempotently associated D1 article draft that opens in the existing editor. Creation remains draft-only and publication is deliberate. The event-switch upload race is fixed, including unmount and overlapping-upload coverage.
- [ ] **Event map preview.** `mapLink` today is a plain text URL field (`src/admin/components/EventForm/sections/LocationSection.tsx:271-277`) rendered client-side as a bare "Open in Maps" link (`src/components/events/GuestManagement/ConfirmedView.tsx:148-155`, `src/components/events/VenueGuide.tsx:163-172`) — no embedded static map or interactive preview anywhere. Blocked on Adrian obtaining a Google Maps (or Mapbox) API key and adding it as a Cloudflare Pages/Worker secret via Infisical. Once the key exists, an agent adds the static map image / embed on the guest management page. (10 min Adrian, then hours of agent work)
- [ ] **TicketCard with QR.** Spec'd in `event-rsvp-capacity-engine.md`, still unbuilt: `ConfirmedView.tsx:84-109` renders an inline ticket block (flyer + title + name + date) but it has no QR code and isn't a standalone downloadable/shareable image. `qrcode.react` is already a project dependency (used in the admin `ShareSheet.tsx:3,231`), so the QR piece is cheap — the save-as-image piece (canvas export) is the real work. Judge priority after the first real-guest events; likely not launch-blocking. (day)

### Polish

- [ ] **Reminder milestones stay manual by design** (`src/admin/components/ReminderTimeline.tsx` — 3d/1d/2h templates with WhatsApp deep links, "Copy All"). Not a gap to close now; revisit only once WhatsApp Business API delivery exists (see item 1's sibling), at which point "Copy" buttons could become "Send" buttons with one shared send path.

## Gated on launch decision

- None. Every open item in this track is a code/schema build task Adrian or an agent can do solo pre-launch; nothing here depends on onboarding a real operator or guest. (The WhatsApp delivery leg needs Adrian to set up WhatsApp Business API credentials first, similar in shape to the Maps API key item, but that is account/credential setup, not a "wait for a real user" gate.)

## Already shipped

- Event System V2 end to end: approval-based RSVP (`requested` -> approve/deny/waitlist), flyer-first 3-step creation wizard, share sheet (WhatsApp/email/QR/copy link), story-cards briefing, guest-request + single-use guest invite links, quiet phone-or-email identity, journey page.
- Gathering type + guest list visibility controls.
- Tasting events end to end: join codes (`worker/migrations/059_tasting_join_codes.sql`), passwordless guest auth, host Share/Live control room (`src/admin/components/tasting/TastingControlRoom.tsx`, `ShareScreen.tsx`, `LiveMatrix.tsx`), journal bridge writing every verdict into `customer_tasting_journal`.
- Post-session recap: public reader at `/event/:slug/recap` (`src/pages/EventRecapPage.tsx`), admin editor for tea ledger / playlist / gallery / session notes (`src/admin/components/PostSessionEditor.tsx`).
- RSVP friction audit: all 17 items closed, including the 3d/1d/2h reminder timeline with pre-written WhatsApp templates.
- Venue guide with step-by-step photos, parking/transit/arrival notes, "Open in Maps" link.

## Not building (killed)

- Event series with completion certificates — series gamification, Duolingo thinking.
- Virtual events with shared timers — phones stay in pockets; the app doesn't work during a session.
- Weather cards — analytics/decoration theater at one store's scale.
- Live guided-tasting modes — same phones-in-pockets principle.
- Attendee discussion threads — social feature, contradicts no-social-feed vision.

## Sources

- `docs/plan/event-system-v2.md` (live)
- `docs/_archive/consolidated-2026-07/event-rsvp-capacity-engine.md` (archived)
- `docs/_archive/consolidated-2026-07/VISION_AUDIT_5_EVENTS.md` (archived)
- `docs/_archive/consolidated-2026-07/TASTING_EVENT_PLAN.md` (archived, shipped)

## Cross-track dependencies

- Verification-code delivery is shared with Track 1 and is implemented once for sign-in and event/guest verification. Local tests pass; deployed Resend receipt evidence remains pending.
- The photo essay composer feeds Track 3's editorial engine (Magazine/Journal article pipeline) — coordinate on the target article schema before building the composer so drafts land in the same place Adrian already publishes from.

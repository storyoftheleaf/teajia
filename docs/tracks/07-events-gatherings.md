# Track 7: Events & Gatherings

> The arc is built: invite, approve, gather, remember. Close the delivery gaps and the one loop that feeds the magazine, event to recap to photo essay.

Status: launch-program event scope implemented and locally verified; remaining items are post-launch or optional follow-ons. External/manual evidence is tracked in [Launch Validation](../LAUNCH_VALIDATION.md).

Part of [Consolidated Direction](../CONSOLIDATED_DIRECTION.md).

## Post-launch / optional queue

### Core build

- [x] **Verification code delivery, email leg.** Event/guest and sign-in verification share the implemented purpose-aware challenge lifecycle and Resend delivery abstraction. Secure generation/storage, retryable failure handling, and local Worker/UI coverage are complete. Deployed receipt evidence belongs in [Launch Validation](../LAUNCH_VALIDATION.md).
- [ ] **Post-session summary email (post-launch).** Confirmed unbuilt: `event_notifications.type` has no `post_session_summary` type or composer. Add a manual send action only after real event use confirms the recap page and existing follow-up are insufficient. (day)
- [x] **Post-session editor to article-draft composer.** Event gallery, host notes, energy, shared notes, and tea ledger now save/reload and build an idempotently associated D1 article draft that opens in the existing editor. Creation remains draft-only and publication is deliberate. The event-switch upload race is fixed, including unmount and overlapping-upload coverage.
- [ ] **Event map preview (optional).** `mapLink` is currently rendered as an “Open in Maps” link; there is no embedded preview. Build only if real guests need it. Any provider-key setup belongs in [Launch Validation](../LAUNCH_VALIDATION.md). (hours after approval/configuration)
- [ ] **TicketCard with QR (optional).** The existing confirmed ticket block has no QR or downloadable/shareable image. Judge priority after real-guest events; this is not launch-blocking. (day)

### Polish

- [ ] **Reminder milestones stay manual by design** (`src/admin/components/ReminderTimeline.tsx` — 3d/1d/2h templates with WhatsApp deep links, "Copy All"). Not a gap to close now; revisit only once WhatsApp Business API delivery exists (see item 1's sibling), at which point "Copy" buttons could become "Send" buttons with one shared send path.

## External and manual validation

Deployed OTP receipt, real-guest event checks, and any optional provider credential setup are maintained in [Launch Validation](../LAUNCH_VALIDATION.md).

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

- Verification-code delivery is one shared implementation owned by the launch trust floor; external receipt evidence is not duplicated here.
- The event photo-essay composer already reuses Track 3's D1 article engine and editor; no parallel event-content system remains to coordinate.

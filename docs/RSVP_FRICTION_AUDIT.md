# RSVP Friction Audit — 2026-04-27

## TL;DR
The RSVP flow is structurally solid — the happy path works and most copy
is warm and human. Three issues need fixing before invites go out: the
success screen gives no guidance on what happens next (approval required
vs instant), the sheet on iPhone swallows most of the phone screen and
the submit button can be hidden below the keyboard, and `text-white` is
used on the FindRSVP submit button which violates the token rules and
risks a contrast failure on some themes.

---

## Critical (fix before sending invites)

**1. Success screen has no "what happens next" message**
`RSVPFormSheet.tsx` lines 214-223. After submit, the guest sees:
"Request received. We'll be in touch shortly to confirm your seat."
This is fine if all RSVPs are manually approved, but the guest has no
idea whether they're auto-confirmed or awaiting a decision, how long to
wait, or how they'll be contacted. If Adrian approves manually via
WhatsApp, the guest doesn't know that. A first-time guest who RSVP'd
via email will wonder whether to expect a reply on WhatsApp or email.

Fix scope: one additional sentence keyed off the contactMethod, e.g.
"We'll send you a WhatsApp message once your spot is confirmed." (or
"...an email..."). No server change needed.

**2. RSVPFormSheet height — submit button can be buried below keyboard on iPhone**
The sheet is `h-[calc(100dvh-44px-env(safe-area-inset-bottom,0px))]`,
which fills nearly the whole screen. The scrollable content area has
bottom padding `pb-[calc(1.25rem+44px+env(safe-area-inset-bottom,0px))]`
to account for the nav bar. However, when the software keyboard is open
on iOS (390x844), the keyboard shrinks the visual viewport but `100dvh`
does not shrink with it in all iOS versions — the sheet can extend
behind the keyboard, making the submit button unreachable without
deliberately scrolling. The `Notes` textarea directly above the submit
button triggers the keyboard.

Fix scope: add `env(keyboard-inset-height, 0px)` to the padding, or
use the `visualViewport` resize listener pattern to shift content up.
This is the single hardest fix in this list but also the most likely to
cause an abandoned RSVP.

**3. `text-white` in FindRSVPSheet submit button**
`FindRSVPSheet.tsx` line 170:
`className="... bg-tea-gold text-white ..."`
Rules ban `text-white` everywhere — use `text-tea-bg`. Likely a copy/paste
from an older component before the rule was established. Minor risk that
it also looks subtly wrong (cooler white vs. the warm `tea-bg` tone).

Fix scope: one character swap, one file.

---

## Friction (worth fixing soon)

**4. No area hint shown when neither `areaHint` nor `locationName` is set**
`EventLanding.tsx` lines 384-389. If the host hasn't filled in either
field, the location row is completely absent. A first-time guest has no
idea what neighbourhood they're going to. The DB stores `area_hint` as
a separate field specifically for this use case — but if the event
record was created before the field existed, it will be null.

Fix scope: check existing events have `area_hint` populated. Admin-side
nudge or form validation; no frontend change needed.

**5. "Request Your Seat" vs "Request My Seat" inconsistency**
The CTA on the landing page (`EventLanding.tsx` line 485) says
"Request Your Seat". The same button inside the sheet header says
"Request Your Seat" (line 202), but the submit button inside the form
says "Request My Seat" (line 510). The inconsistency is subtle but
slightly disorienting on re-read.

Fix scope: standardise to "Request My Seat" throughout — it's warmer
and matches first-person voice.

**6. Country code field is a freetext input, not a picker**
`RSVPFormSheet.tsx` lines 355-375. Guests who RSVP'd from a WhatsApp
link are phone-native but the country code field is a plain `<input>`
with placeholder "+1". A first-time guest from Taiwan will need to know
to type "+886". This is especially awkward because the local number field
strips non-digits (`replace(/\D/g, '')`), but the country code field
doesn't validate format. If someone types "886" (no +) the combined
number will be wrong and they won't be reachable via WhatsApp.

Fix scope: a minimal country picker (dial code + flag) would be ideal,
but at minimum: validate the country code starts with "+" before the
form is submittable, and show a hint "include the +" below the field.

**7. "Bringing anyone?" section always shows as a labelled section — even when empty**
`RSVPFormSheet.tsx` lines 400-455. The label "Bringing anyone?" plus the
"Add a guest" link appear for every guest. This is fine. But the label
reads like a required field header rather than an optional invitation.
Adding "(optional)" sub-text like the Notes field has would reduce any
anxiety that guests are expected to bring someone.

Fix scope: add `(optional)` sub-text below the label, same pattern as
Notes.

**8. Guest contact field placeholder is developer-ambiguous**
`RSVPFormSheet.tsx` line 435:
placeholder `"Their WhatsApp or email — we'll send them an invite"`
This implies Teajia will automatically message the guest's contact. If
that's not true (i.e. it's just metadata for the host), the copy is
misleading. Confirm the actual behaviour. If no auto-invite is sent,
change to: "Their WhatsApp or email (so we can reach them)".

Fix scope: copy change only if behaviour is confirmed.

**9. FindRSVPSheet — error message is generic**
`FindRSVPSheet.tsx` line 161:
`findMutation.error?.message || 'No reservation found.'`
The worker returns `{ error: 'RSVP not found' }` on a 404 (line 5002).
`handleResponse` likely converts that to an Error whose `.message` is
the raw JSON string or "RSVP not found". Either way it reads as dev
copy. A guest who enters their number slightly differently (with vs
without country code) will see this and give up rather than trying the
email tab.

Fix scope: friendlier message + a hint to try the other method:
"We couldn't find your reservation with that number. Try searching by
email, or contact the host."

**10. FindRSVPSheet — phone lookup is exact match only**
Worker `handleFindRSVP` line 4998-5000: `WHERE event_id = ? AND phone_number = ?`
No suffix-matching like `handleRSVP` has. If the guest registered with
"+886 912345678" but types "+886912345678" into FindRSVP, it won't find
them. The RSVP handler has the 9-digit suffix fallback logic (lines
4502-4510); FindRSVP doesn't.

Fix scope: add the same suffix-matching logic to `handleFindRSVP`.

**11. "Already registered?" link is easy to miss**
`EventLanding.tsx` lines 489-496. The "Already registered? Find my RSVP"
link sits below the CTA in `text-tea-text-dim` with 11px text. On a
phone screen at arm's length this is invisible. If a returning guest
taps "Request Your Seat" by mistake, the duplicate-detection in
`handleRSVP` will return their existing token silently (line 4512-4518)
but the UI treats it as a success and shows the submission confirmation,
not the magic-token view. So it works, but it's confusing and the guest
doesn't know their RSVP was already found.

Fix scope: either increase the font size of the "Already registered?"
link, or add a note in the success screen: "If you've already registered,
you'll receive your confirmation link via WhatsApp/email."

**12. No explicit capacity display in the hero block**
The AvailabilityBadge is positioned `absolute bottom-0 left-1/2 -translate-x-1/2`
hanging off the hero image. On first glance it may not register as
interactive or relevant. The seats-remaining count is computed but only
shown when `confirmedCount > 0`. If it's early and no one has RSVPed
yet, the badge shows nothing actionable about how many seats are available
— a guest doesn't know if it's 8 people or 80.

Fix scope: design question (see "Surfaced for design discussion" below).

---

## Nice-to-have (later)

**13. Back button navigates to /events, not back in history**
`EventLanding.tsx` line 309: `onClick={() => navigate('/events')}`.
For a first-time guest who arrived via a direct WhatsApp link, `/events`
is the Teajia events listing — a page they've never seen and that won't
mean much. Browser back would be more intuitive, but since this is a
SPA and they may have arrived directly, `navigate(-1)` would sometimes
go to `about:blank`. Consider hiding the back button entirely for guests
arriving from an external link, or changing the destination to `/`.

**14. No `tap-target` class on "Find my RSVP" link**
`EventLanding.tsx` line 493: the "Find my RSVP" button is a `<button>`
styled as an inline text link with `text-tea-gold`. Tap target is
approximately 11px tall — well under 44px. Surround with at least
`py-2` or wrap in a `block` element with min-height.

**15. Guest list opt-in checkbox uses `accent-tea-gold` which relies on browser default styling**
`RSVPFormSheet.tsx` line 482. The native checkbox with `accent-` is
fine for modern browsers, but the render is inconsistent across iOS
WebKit versions. For a polished experience, a custom toggle that matches
the design system would be preferable. Low priority — it works.

**16. Loading state has no timeout fallback**
If the public event API call hangs (Cloudflare Worker cold start, etc.),
the pulsing skeleton at lines 211-218 shows indefinitely. React Query's
default `staleTime: 0` and no `retry: false` means it retries 3 times.
A 10-second timeout with a human-friendly "Taking a moment — please
refresh" message would prevent confusion.

**17. "Hosted by Teajia" footer copy**
`EventLanding.tsx` line 618. For Adrian's personal events, "Hosted by
Teajia" is correct for now but as multi-tenancy rolls out this will
surface account names. Low priority until then.

---

## What's already solid

- Warm, non-transactional copy throughout ("Request Your Seat", "Anything we should know?", "We'll be in touch shortly").
- Duplicate-RSVP detection on the server (returns existing token instead of creating a duplicate — silent but functional).
- Already-registered state detected via `findByAccount` and shown with "You're confirmed / on the waitlist" + correct actions (lines 419-479).
- Drag-to-dismiss gesture on both sheets — works naturally on mobile.
- Scroll lock applied when sheets are open — background page doesn't scroll under the sheet.
- Country code + local number split correctly combines on submit.
- `show_in_guest_list` opt-in is unchecked by default (correct) and clearly labelled.
- Keyboard `Escape` closes both sheets.
- OG/Twitter meta tags set correctly from event data — WhatsApp link previews will show the flyer image.
- Waitlist path is clearly branched — guests see "Join the Waitlist" with a secondary interest-capture option.
- Cancelled / completed states handled gracefully with distinct UI.
- `canRSVP` / `showWaitlist` / `showInterestOnly` flags are logically clean.
- The guest list (confirmed names) renders correctly with `+N more` overflow.
- Error boundary on submit shows human copy, not raw HTTP status codes.

---

## Surfaced for design discussion

**A. What should happen immediately after submit?**
Currently the form stays open and shows "Request received." Should the
sheet auto-close and the landing page update to show "You're requested"
state? Or does staying in the sheet feel more contained? The current
state (sheet stays open, no redirect) means the guest has to manually
close it and may feel uncertain whether the page "knows" about their RSVP.

**B. Capacity transparency: how much to show?**
Should the event page show total capacity (e.g. "12 seats")? Showing
scarcity can drive RSVPs, but for a private event it may feel clinical
or pressure the host. Adrian's call.

**C. Approval model language**
"Request Your Seat" correctly implies approval is needed. But if some
events are auto-confirmed, the copy is wrong. Consider a flag on the
event (`requires_approval: bool`) that switches the CTA copy and success
message — or standardise on always-manual-approval for now.

**D. Guest contact field: does Teajia actually send the guest an invite?**
The placeholder "we'll send them an invite" (RSVPFormSheet line 435)
implies an automated outreach. If this is manual (host copies the
contact and messages them separately), update the copy to avoid
disappointed guests wondering why they never got an invite.

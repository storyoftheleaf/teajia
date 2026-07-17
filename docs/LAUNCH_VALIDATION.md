# Launch Validation

> **This is the only canonical checklist for Adrian/manual work, operator validation, editorial work, deployed-environment checks, and external decisions.** Implementation tracks and reference docs may explain procedures, but they must not maintain duplicate completion status.

**Created:** 2026-07-13  
**Launch status:** Incomplete

## Technical closure precondition

Before the technical program can honestly be called closed, the reading-memory/saved-story system must be **wired into a real durable user flow or removed completely**, with focused route/state coverage. This is implementation work owned by Track 1, not a manual validation checkbox.

## A. Launch-required validation

These checks are required before claiming a real-world launch. Fixtures, local mocks, and code inspection cannot complete them.

- [ ] **Deploy and verify the production boundary.** Publish the implementation branch through the normal `teajiafinal` path. On the deployed site, verify same-origin browser API access, CSP behavior, service-worker registration/update behavior, and absence of retired stock-media or prohibited hardcoded-origin requests.
- [ ] **Receive a real Resend OTP.** Request a sign-in code in the deployed environment, receive it in a real inbox, complete verification, and confirm failures/retries remain explicit without exposing the code in logs. Check the guest/event verification path through the same delivery abstraction.
- [ ] **Decide the production invoice repair.** Run the read-only repair preview against production business data, review every proposed invoice/line change, and record Adrian's explicit decision to apply or decline. If approved, apply through the confirmation-protected endpoint and verify the reported changes and resulting totals. Never mutate first and inspect afterward.
- [ ] **Run the Australia/Jesse operator flow.** Jesse claims the real owner access, confirms the active Australia account, completes the account/contact profile, loads and checks opening stock, verifies staff access, and reviews the storefront on desktop and mobile.
- [ ] **Make the public-empty storefront decision.** Before enabling or sharing the Australia storefront, Adrian and Jesse explicitly choose whether an empty or minimally stocked storefront stays private, receives a deliberate quiet state, or is ready to be public. Record the decision; do not let `public_enabled` drift by accident.
- [ ] **Rehearse the two-account wholesale lifecycle.** Using two controlled accounts, create and submit a wholesale order, reply or confirm it, ship it, receive it, and verify supplier stock decrement, buyer stock creation or increment, bilateral invoices, account isolation, and the visible timeline at every transition.
- [ ] **Complete one real inquiry → order → fulfillment loop.** A real customer starts through WhatsApp or email; Jesse confirms quantities, prices, and delivery/pickup; the order is recorded and fulfilled; stock movement and customer-visible detail are checked; customer and operator feedback is captured.
- [ ] **Test from actual mainland China.** On a mainland network, test public pages, Read, Shop/contact fallback, sign-in OTP, Curate capture/sync, uploads, and service-worker behavior. Include real voice capture/transcription through the configured Groq path; a non-mainland VPN simulation does not close this item. Afterward, read recent `incident_ledger` rows to correlate any transport, timeout, server, or chunk-recovery failures with the observed flow.
- [ ] **Approve Barry's real material.** Adrian supplies or approves Barry's contributor profile, article attribution, pull quotes, and personal voice. Exercise the real contributor → article → public profile path without inventing or silently rewriting Barry's words.
- [ ] **Perform the manual editorial-boundary and smoke walkthrough.** On the deployed build, walk commerce, authentication, account switching, Read, Curate, events, Journal/Favorites/Cellar, contributor publishing, public bylines, and contact fallback. Confirm drafts do not leak, legacy author fallback remains readable, account boundaries hold in visible behavior, mobile bottom navigation does not cover actions, and the inquiry model has not become automated checkout.

## B. Editorial decisions and work

These are real launch-quality inputs, not engineering substitutions.

- [ ] **Choose editorial references and keeper templates.** Adrian selects 1–3 reference magazines, curates roughly 20 keeper templates, and approves the final editorial layout language before broad publication.
- [ ] **Prepare and publish the interview archive.** Review the existing interviews and imagery, preserve quoted voice, assign contributors/subjects, select pull quotes deliberately, and publish only material that meets the approved editorial standard.
- [ ] **Supply Advise photography.** Select or create approved, owned photographs for the Advise work/portfolio surfaces; do not reintroduce stock-media runtime dependencies or invent documentary imagery.

## C. Optional decisions

These do not block launch unless Adrian explicitly promotes one into section A.

- [ ] **Homepage CTA:** decide whether the homepage needs a persistent explore-the-shop action above the fold while preserving the grounding lines' editorial voice.
- [ ] **Route grammar and `/start`:** decide whether account-route nouns and orphaned `/start` entry points need one explicit linking/renaming pass. Any navigation-label or route change requires confirmation before implementation.
- [ ] **iPhone MCP OAuth:** verify the connected-app OAuth flow on a real iPhone if mobile MCP operation matters for the first operator cohort.
- [ ] **Maps key:** provide and configure a maps API key only if the event map preview is worth activating now.

## Recording evidence

When an item closes, append a short indented evidence note beneath it containing the date, environment/person, and observable result. Link a deployment, screenshot, log, or business record when appropriate, but never paste secrets, OTP values, private customer details, or personal contributor material into this file.

If a check fails, leave it unchecked and record the failure in the owning active track. Do not create another launch checklist.

# Teajia — Top 30 Development Priorities
## Easiest → Hardest

*Derived from OFFER_AND_STRATEGY.md, VISION.md, and ROADMAP.md. These are ranked by implementation effort, not importance — read the tier labels for business weight.*

Last updated: April 2026

---

## Tier 1 — Hours (broken things and copy changes)

These are not small items — several of them are actively destroying trust with every visitor right now. They just happen to be fast.

---

### 1. Fix the newsletter signup
**What:** Wire the email capture form to an actual backend (Resend, Mailchimp, or Cloudflare Email). Currently stores to localStorage and logs to console. Every person who "subscribed" thinks they're connected. They are not.
**Why it matters:** This is your only direct line to every curious visitor. It's silently broken at the highest-traffic touchpoint on the public site.
**Effort:** 2–4 hours.

---

### 2. Rename "Checkout" → "Send Inquiry" + add personal service framing
**What:** Rename the button, add a visible note early in the flow: "We confirm every order personally." This is a copy and framing change, not a flow rebuild.
**Why it matters:** "Checkout" implies a transaction. "Send Inquiry" signals a relationship. The WhatsApp model is the brand — stop apologizing for it with the wrong label.
**Effort:** 1–2 hours.

---

### 3. Remove or connect the dead share button on AlcoveCard
**What:** Either connect it to the ShareModal or remove it. Currently renders and does nothing.
**Why it matters:** A button that doesn't work destroys interface trust instantly. Every product card has one.
**Effort:** 1–2 hours.

---

### 4. Add network/offline error indicator
**What:** A toast or banner when API calls fail. Currently fails silently — the user sees nothing and assumes the app is broken.
**Why it matters:** Silent failure is worse than visible failure. Users retry, refresh, leave. A clear message gives them something to act on.
**Effort:** 2–4 hours.

---

### 5. Stock level indicators on shop cards
**What:** "In Stock" / "Low Stock" / "Limited" badges on product cards. The thresholds already exist in admin. Expose them publicly.
**Why it matters:** Scarcity is accurate, not manufactured — specialty tea is genuinely limited. Showing it creates honest urgency and sets correct expectations before inquiry.
**Effort:** 2–4 hours.

---

### 6. Price-per-gram display on product cards
**What:** Show $/g alongside the total price on every product. Specialty tea buyers compare on a per-gram basis universally.
**Why it matters:** Without this, a knowledgeable buyer can't evaluate value at a glance. You lose them before they even open the product.
**Effort:** 2–4 hours.

---

### 7. Gathering type label on event pages
**What:** A simple visible label on every event page — "Gongfu Session," "Silent Meditation," "Open Tasting," "Tea Shopping." Not an optional field. Core context.
**Why it matters:** A guest receiving a shared event link needs to know what kind of gathering they're joining before committing. Showing up to a silent meditation expecting a social tasting is a bad experience for everyone.
**Effort:** 3–5 hours (if type field exists in the event model, this is a display change).

---

## Tier 2 — Days (small features, contained scope)

---

### 8. Handle JWT expiration gracefully
**What:** When a JWT expires, show a "Session expired — tap to sign back in" notification and prompt re-authentication. Currently fails silently on the next API call.
**Why it matters:** Silent auth failure is one of the most disorienting experiences in a web app. Users think their data is gone or the app is broken.
**Effort:** Half a day.

---

### 9. Make product modals URL-backed
**What:** Add URL params when a product modal opens (e.g., `/shop?product=tie-guan-yin`). Browser back button works. Links to specific products are shareable and bookmarkable.
**Why it matters:** Currently no one can share a link to a specific tea. This kills word-of-mouth product discovery — someone can't send a friend "look at this one." Also breaks standard navigation expectations.
**Effort:** 1 day.

---

### 10. Guest list visibility on event RSVP pages
**What:** Show confirmed guests (names, opt-in visibility) on the event page. When someone receives a shared link they want to know if the right people are attending.
**Why it matters:** This is function, not social. "Is my friend coming?" is a practical question. Without it, guests can't make an informed decision about attending.
**Effort:** 1 day.

---

### 11. Brewing guide per product
**What:** A lookup table of ~20 brewing profiles covering the full catalog — water temp, steep time, leaf ratio, vessel type, infusion count. Accessible from each product page.
**Why it matters:** A customer who just received their tea and can't brew it correctly will be disappointed even if the tea is excellent. This is the most practical post-purchase support you can offer.
**Effort:** 1–2 days (profiles are knowledge, not engineering — the display component is straightforward).

---

### 12. Events simple mode
**What:** A creation path where the only required fields are: title, date, seat count, gathering type, share link. All approval workflows, briefing cards, tea menus, and progressive location disclosure remain available as opt-in layers — but nothing is required beyond those five things.
**Why it matters:** Home practitioners and casual hosts are locked out of the event system by its current complexity. The professional mode is excellent for Adrian. It's overwhelming for someone hosting a dinner party.
**Effort:** 1–2 days.

---

### 13. B2B / corporate inquiry landing page
**What:** A dedicated page for corporate clients, hotels, cultural institutions — "Bring Tea to Your Organization." Clear description of what a tea program looks like: private sessions, team events, ongoing supply. One inquiry form. No platform features required.
**Why it matters:** These clients have budget and intent. Currently they land on a general site with no obvious door for them. This is a page + a form — it costs almost nothing and connects directly to high-value consulting revenue.
**Effort:** 1 day.

---

### 14. Post-session guest experience
**What:** Enhance the existing PostSessionArchive component to be guest-facing. After a session: teas that were served, their tasting notes (if submitted), direct purchase links, a single prompt ("what stayed with you?").
**Why it matters:** This is the highest-conversion moment in the entire platform and it's currently admin-only. A guest who just experienced a beautiful tea session and can buy it with one tap is the entire commercial loop in miniature. The component exists — this is a matter of making it guest-accessible.
**Effort:** 1–2 days.

---

## Tier 3 — One to Two Weeks (meaningful features)

---

### 15. Fix font loading
**What:** Implement `font-display: swap` on all Google Fonts. Subset Chinese fonts with `unicode-range`. Remove unused fonts from the loading stack. Currently 8 Google Fonts are loaded in a single blocking request.
**Why it matters:** This is a render-blocking performance issue on every page load. It also affects the feel of the magazine — text appearing late or flashing unstyled undermines the editorial quality before a reader even processes a word.
**Effort:** 1–2 days.

---

### 16. Design system token cleanup
**What:** Migrate the 328 instances of hardcoded `rgba()` to semantic tokens. Replace the 49 files still using banned legacy tokens (`tea-ink`, `tea-paper`, `tea-seal`, `tea-charcoal`). Run `lint:colors` to zero violations.
**Why it matters:** Hardcoded colors don't adapt to theme changes and they indicate a design system that's diverging from itself. This is technical debt that compounds — each new component built against the wrong system adds to the cleanup cost.
**Effort:** 2–3 days (systematic, mechanical work — good for a focused session).

---

### 17. "Start here" path for new visitors
**What:** A guided entry for someone who just found Teajia and doesn't know where to begin. Three or four questions ("Are you new to tea? Do you have a practice? Are you looking to open a space?") that route them to the right starting point. Could be a landing page flow or a prominent homepage element.
**Why it matters:** The Curious Reader / Online Learner is your largest top-of-funnel group and currently they land with no orientation. A clear entry path turns a single visit into an ongoing relationship.
**Effort:** 3–5 days.

---

### 18. Gift sets + gifting framing in shop
**What:** 3–4 curated gift sets (e.g., "First Gongfu," "The Oolong Edit," "Aged & Rare"). A gift message field at checkout. Framing copy on the shop that acknowledges gifting as a valid use case.
**Why it matters:** Gift buyers are high-value discovery vehicles — the person who receives the gift is a potential long-term customer. Currently there's nothing for them. This requires no new infrastructure, just curation and copy.
**Effort:** 3–5 days.

---

### 19. Brewing guide QR / printable card system
**What:** Each brewing guide gets a QR code linking to its page on the Learn Hub. Printable card format (postcard size) that can be included in tea orders or posted in tea spaces. Template for operators to use on their packages.
**Why it matters:** This takes the platform off-screen and onto the tea table — which is exactly where Teajia should be during a session. Physical presence in every order and every tea space is brand-building that no ad can replicate.
**Effort:** 3–5 days.

---

### 20. Contributor profile page
**What:** A profile page for tea masters and writers who contribute to the platform — name, background, photo, link to their articles, sourcing specialties if relevant. The first version can be built manually (static content per contributor) before a full contribution workflow exists.
**Why it matters:** Recognition is what pulls serious tea people into the platform. A well-respected master with a visible profile here tells every other master: this is a place worth being. You don't need 50 contributors — you need 3 good ones to start.
**Effort:** 3–5 days for the first template and 1–2 profiles.

---

### 21. Magazine template quality overhaul
**What:** The 70-point template overhaul documented in PLAN.md. Consistent type scale (Display, Headline, Subhead, Body, Caption, Micro), improved layout quality across the 150+ variants, editorial art direction that matches the standard of a real magazine.
**Why it matters:** This is the stated blocker for public launch. Everything that depends on the magazine — contributing writers, editorial authority, the curious reader pipeline — waits on this. It's the front door and it's currently below Adrian's standard.
**Effort:** 1–2 weeks.

---

## Tier 4 — Weeks (significant features)

---

### 22. Load real magazine content
**What:** Publish Adrian's existing interviews, origin reports, and editorial content once templates reach quality. This is population, not engineering — but it requires photography, editorial editing, layout work, and publishing discipline.
**Why it matters:** The moment real content is live, the platform stops being "Adrian's app in development" and becomes a real editorial destination. This is the single most important public-facing milestone.
**Effort:** 1–2 weeks (content work, layout, editorial polish — not primarily engineering).

---

### 23. Personal tea journal
**What:** A persistent personal archive per user — tasting logs (date, tea, notes), events attended, purchases made, teas favorited. Not social. Private by default. Accumulates quietly over time.
**Why it matters:** This is the retention mechanism the platform currently lacks entirely. Once someone has a year of their tea life recorded here, they don't leave. Serves every persona from home practitioner to aspiring operator. Without it, people visit and forget.
**Effort:** 1–2 weeks.

---

### 24. Collection tracking for home practitioners
**What:** A personal inventory layer separate from the professional admin suite — "what teas do I have at home," quantities, purchase dates, tasting notes, source links. Intentionally simpler than the full inventory management system.
**Why it matters:** Home practitioners and collectors currently have no home in the platform. This gives them a reason to log in regularly and a growing record of their practice. Works alongside the journal.
**Effort:** 1–2 weeks (can share data model with inventory, different UI).

---

### 25. Event discovery feed
**What:** A simple, non-algorithmic listing of upcoming events across the network. Filterable by location (city/country) and gathering type. Not a social feed — a directory. Replaces the current direct-link-only sharing model.
**Why it matters:** Right now, the only way to find an event is to already know about it. A discovery feed is the moment the platform becomes findable to people outside Adrian's direct network. Even with 10 events listed, the signal changes entirely.
**Effort:** 1–2 weeks.

---

### 26. Magazine contribution pipeline
**What:** A structured workflow for community members and tea masters to submit content — form submission, editorial review queue, approval/feedback flow, publishing, contributor attribution. With editorial standards enforced: no advertorial, no commercial selling disguised as articles.
**Why it matters:** Adrian can't write everything. But the platform's authority scales only through the quality of its voices. A clear, dignified contribution pathway is how tea masters become invested in the platform without running a business on it.
**Effort:** 2–3 weeks.

---

### 27. Network map
**What:** A minimal, beautiful map or grid showing Teajia-connected spaces and sessions worldwide. Manually curated initially (even 5–8 locations). Transitions to data-driven as the multi-account infrastructure ships.
**Why it matters:** The moment people can see the community geographically, the platform stops feeling like "one person's app" and starts feeling like a living network. This is the single biggest emotional shift available — and the manually curated version can ship before multi-account is complete.
**Effort:** 2–3 weeks for a polished first version.

---

## Tier 5 — Months (platform infrastructure)

---

### 28. Integrator starter path ("Tea for Your Space")
**What:** A distinct, simplified entry for yoga studios, boutique hotels, meditation centers, galleries — businesses that want to add tea without becoming tea professionals. Includes: a curated selection of 4–6 teas suited to hospitality, a simple ordering flow, a one-page foundational education guide, a contact pathway for ongoing support. Does not require the full admin suite.
**Why it matters:** This is an underserved persona with recurring revenue potential. A yoga studio that restocks quarterly is more valuable than a one-time buyer. But they need a door sized for them, not the door built for a dedicated tea house.
**Effort:** 3–4 weeks (new product surface, separate onboarding, curated catalog subset).

---

### 29. Complete multi-account infrastructure
**What:** Finish the Phase 1 work on the `claude/multi-store-collaboration` branch. Accounts table, `account_id` FK on all entity tables, scoped API queries, account-scoped roles, staff invitation flow, feature-flagged code paths, reversible migration scripts.
**Why it matters:** Nothing in Phase 2–4 (wholesale, operator onboarding, network directory, guest portability) works without this. It's the unsexy foundation that enables everything that follows.
**Effort:** 4–6 weeks of focused backend work.

---

### 30. Wholesale catalog + operator onboarding + public location pages
**What:** Phase 2–3 from the roadmap as a unit. Wholesale catalog with trust-gated access, sourcing-to-shelf import pipeline, self-serve account creation, guided setup wizard, operator public page template (events, featured teas, about, location). The moment this ships, Teajia is a network and not just Adrian's platform.
**Why it matters:** This is the business model. Operators sign up for access to tea they can't source elsewhere and stay for the tools. Every other feature serves existing users — this is the one that opens the doors to everyone else.
**Effort:** 2–3 months, building on #29.

---

## Quick Reference

| # | Item | Effort | Tier |
|---|---|---|---|
| 1 | Fix newsletter signup | 2–4 hrs | Broken |
| 2 | "Send Inquiry" framing | 1–2 hrs | Broken |
| 3 | Fix dead share button | 1–2 hrs | Broken |
| 4 | Network error toast | 2–4 hrs | Broken |
| 5 | Stock level indicators | 2–4 hrs | Broken |
| 6 | Price-per-gram display | 2–4 hrs | Broken |
| 7 | Gathering type label | 3–5 hrs | Broken |
| 8 | JWT expiration handling | ½ day | Small |
| 9 | URL-backed product modals | 1 day | Small |
| 10 | Guest list visibility | 1 day | Small |
| 11 | Brewing guide per product | 1–2 days | Small |
| 12 | Events simple mode | 1–2 days | Small |
| 13 | B2B inquiry landing page | 1 day | Small |
| 14 | Post-session guest experience | 1–2 days | Small |
| 15 | Fix font loading | 1–2 days | Medium |
| 16 | Design system token cleanup | 2–3 days | Medium |
| 17 | "Start here" visitor path | 3–5 days | Medium |
| 18 | Gift sets + gifting framing | 3–5 days | Medium |
| 19 | Brewing guide QR / print cards | 3–5 days | Medium |
| 20 | Contributor profile page | 3–5 days | Medium |
| 21 | Magazine template overhaul | 1–2 wks | Medium |
| 22 | Load real magazine content | 1–2 wks | Significant |
| 23 | Personal tea journal | 1–2 wks | Significant |
| 24 | Collection tracking | 1–2 wks | Significant |
| 25 | Event discovery feed | 1–2 wks | Significant |
| 26 | Magazine contribution pipeline | 2–3 wks | Significant |
| 27 | Network map | 2–3 wks | Significant |
| 28 | Integrator starter path | 3–4 wks | Infrastructure |
| 29 | Multi-account infrastructure | 4–6 wks | Infrastructure |
| 30 | Wholesale + operator onboarding | 2–3 mos | Infrastructure |

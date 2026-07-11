# Post-Audit Roadmap

> What comes after the April 2026 audit. Three bodies of work, ordered by what unlocks what. Use this when deciding what to pick up next.

**Created:** 2026-04-27
**Last updated:** 2026-04-27

---

## Where we are

The April 2026 audit catalogued 37 findings across 240 user flows. As of 2026-04-27, **36 are closed** and 1 remains scoped (#36, the design system, which is itself a multi-phase project — see `DESIGN_SYSTEM_PHASING.md`).

The site works. Every flow is wired end-to-end. Authorization is consistent. Documentation matches reality. Someone could walk into this codebase tomorrow and ship.

The roadmap below is **what makes the site multiply in value**, not what makes it functional.

---

## Body A — Foundation (closes the audit cleanly)

| Project | Doc | Effort | Status |
|---|---|---|---|
| Design system phasing (#36) | `DESIGN_SYSTEM_PHASING.md` | 6–10 days | Planned |
| Information architecture review | `IA_REVIEW.md` | 1.5 days planning + variable implementation | Planned |

**Order:** Design system Phase A + B first (build foundation + token migration). Then IA can begin without fighting the build system.

**Why this body comes first:** Both are quality-debt projects. They don't add features; they make the platform's existing surface area solid enough to build on. If you skip them and start adding features, every feature inherits the existing drift.

---

## Body B — Coherence (the platform-feel pass)

This is the body that turns Teajia from "six tools sharing a navbar" into "one Tea Practice OS." None of these are net-new features in the marketing sense — they connect what already exists into a single experience.

### B1. Cross-section connective tissue

The audit explicitly flagged this as the largest architectural gap.

- **Magazine ↔ Shop:** add `productReferences` to articles; render "Teas mentioned in this piece" footer on Reader.
- **Learn ↔ Shop:** add `relatedProducts` to LearnModule; render "Explore these in the collection" at module end.
- **Consult ↔ Shop:** add `featuredProducts` to ConsultProject; render "Vessels and teas featured in this space" editorially.
- **Glossary ↔ Shop:** terms describing tea types note "We carry [N] of this type" with link to filtered Shop view.
- **Events ↔ Magazine:** post-session data (gallery, host notes, energy) feeds into photo essays for editorial cycle.

**New tables:** `article_products`, `module_products`, `project_products` (junction tables).

**Effort:** 3–5 days. Tables are small, UI additions are small, but every section needs the new component.

**Why it matters:** This is the single most leveraged change post-audit. Every existing piece of content + every existing product becomes more valuable because they finally point at each other.

### B2. Personal timeline ("My Tea Life" spine)

Right now a member's history is scattered across six places:
- Tasting journal (D1)
- Favorites / collection (Zustand + D1)
- Compass entries (Zustand + D1)
- Orders (D1)
- Reading history (localStorage)
- Reading saved articles (localStorage)

There is no unified "what have I been doing with tea?" view.

**Proposal:** A `personal_timeline` table (or unified query view) and a `/me` or `/account/timeline` page that pulls everything in chronological order. Frontpage widget on `/account` shows the latest entry.

**Effort:** 3–4 days. The hard part is the query that unions six sources cleanly.

**Why it matters:** This is what makes Teajia sticky for power users and what justifies "Tea Practice OS" as a positioning. A user who has logged 50 tastings, attended 4 events, and read 12 articles wants to see that arc.

### B3. Events ↔ Magazine content loop

Events generate photos and notes, but those don't become content. A simple post-session editor that turns event records into Magazine photo essays would close a content production loop. Adrian runs an event → photos and tasting aggregates flow into a draft photo essay → he polishes and publishes → readers see it → some of them attend the next event.

**Effort:** 2–3 days.

**Why it matters:** Content production becomes a side-effect of operating the platform, not a separate workstream.

---

## Body C — Growth (individual projects, picked one at a time)

These are the items that *might* matter. Don't pre-commit. Let users tell you which one is next.

| Project | Effort | Trigger to pick it up |
|---|---|---|
| Knowledge graph / contextual surfacing | 1–2 weeks | Once Body B1 ships, you'll see which surfaces want intelligence |
| Tea Circles (lightweight social) | 1–2 weeks | Members start asking "can I see what others are tasting?" |
| Voice-to-structured-notes for Compass | 3–5 days | Compass usage volume justifies it |
| Tasting note similarity engine | 3–5 days | You have enough tasting data for the model to be useful |
| Receipt → Quick Capture → Shelf pipeline | 3–5 days | You're routinely processing >5 receipts/week |
| Content CMS migration (articles → D1) | 1 week | Magazine production rate exceeds what code-constants can handle |
| Public read-only API | 1–2 weeks | A network partner asks to embed inventory on their own site |
| Mobile-native refinements (touch, swipe, theme) | 3–5 days | Mobile traffic exceeds desktop or App Store distribution becomes a goal |
| Operator analytics (cohorts, LTV, turnover) | 1 week | Operating decisions start needing data instead of intuition |
| Multi-language / CJK refinement | 1–2 weeks | Asian-market expansion becomes a serious thread |

**Rule of thumb:** Don't build any Body C project until either (a) a real user has asked twice, or (b) operating the platform without it has become genuinely painful. Body B is the last "predictive" build. After that, follow signal.

---

## What is explicitly NOT on this roadmap

These are out of scope, per /CLAUDE.md:
- Streak trackers, gamification, engagement notifications
- Algorithmic recommendations (Body C #1 is contextual surfacing, not "for you" feeds)
- Social feeds / likes / followers (Body C #2 is small-group circles, not public networks)
- Auto-replenish subscriptions
- Anything that would make the app something you'd check during a tea session

---

## Cadence

- **Body A**: focused work over 1–2 weeks, since it's prerequisite.
- **Body B**: each project is its own multi-day push. B1 first (highest leverage), then B2 or B3 based on which gap feels louder.
- **Body C**: rolling. One project at a time. Done is better than parallel.

---

## See also

- `DESIGN_SYSTEM_PHASING.md` — Body A, design system project
- `IA_REVIEW.md` — Body A, information architecture project
- `OPERATIONAL_NOTES.md` — tradeoffs and revisit-if flags
- `_audit/FINDINGS.md` — closed audit findings (paper trail)
- `STATE_OF_THE_SITE.md` — what works / what's gappy in the current platform
- `VISION.md` — the product thesis these bodies serve

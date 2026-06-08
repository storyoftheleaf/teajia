# Tea Discovery — onboarding profile & integration schema

> **Status:** Phase 1 (flow + local profile + Your Table), Phase 2 (server persistence, tea-master
> visibility, recommendations), **and** the evolution loop (observed palate + an opt-in,
> behaviour-suggested disposition) shipped. Remaining: reflecting drift in the Journey/Passport and
> per-article/per-product deep links (see "Remaining" below).
>
> **Frontend:** `src/pages/DiscoverPage.tsx`, `src/components/TeaDiscovery/*`, route `/discover`.
> **State:** `teaDiscoveryProfile` in `src/lib/store.ts` (persisted to `teajia-storage`).
> **Sync:** `src/lib/teaDiscoverySync.ts` + `src/hooks/useTeaDiscoverySync.ts` (load/adopt/push on login).
> **Worker:** `migrations/082_tea_discovery_profiles.sql`, `GET|PUT /api/tea-discovery` in
> `worker/src/index.ts`; disposition joined into the customer journey + `find_customer` MCP.
> **Your Table:** a `discover` tile in `AccountPanel/LaunchpadView.tsx` shows the member's
> disposition; signed-out guests get a "Discover your tea" link via `READER_EXPLORE_LINKS`.
> **Tea master:** Tea Profile panel in `src/admin/components/CustomerProfilePage.tsx`.

## What it is
A mobile-first, screen-by-screen question flow that helps people *discover the way they drink tea for
themselves*, then hands back a **Tea Profile**: an experience `level`, a named **disposition** (the
mirror), and the raw answers. It is the front door for newcomers and the connective tissue between
every surface of Teajia.

It is **not** an analytics grab. The output is a *gift, not a form* — see "Value exchange" below.

## The five questions
One decision per screen, ~5 taps. Config lives in `src/components/TeaDiscovery/questions.ts`.

| # | Question | id | Shape | Powers |
|---|---|---|---|---|
| 1 | Where are you with tea right now? | `experience` | single, text | `level` (curious / practicing / devoted) → content depth |
| 2 | How do you like to brew? | `brew` | single, **picture + tap-to-learn** | vessel literacy; teaware recs; the education layer |
| 3 | What flavors pull you in? | `flavor` | single, **color swatch** | tea-family recs |
| 4 | How do you like to take your tea? | `temperament` | single, text | disposition; session/event fit |
| 5 | What does tea give you? | `motivation` | **multi**, text | disposition; maps to the taster "Effect" zone |

Brewing options ladder from familiar to advanced — mug & teabag, bowl (grandpa style), teapot,
gaiwan, Yixing clay — each with a non-blocking **"What's this?"** explainer. The Yixing copy gently
corrects the common misconception (people own one without knowing what it's for).

## Disposition (the mirror)
`deriveDisposition(answers)` (`src/components/TeaDiscovery/dispositions.ts`) resolves a named
disposition from temperament ⨯ motivation, nuanced by experience. Current set: **The Quiet Steeper ·
The Host · The Flavor Seeker · The Daily Drinker · The Curious Beginner · The Deep Diver**. These are
mirrors, not horoscopes — every line is traceable to the answers that produce it.

## Integration schema

```mermaid
graph TD
    Q[Tea Discovery flow<br/>/discover] --> P[Tea Profile<br/>level · disposition · answers]

    P --> R[Read / Craft<br/>article & curriculum depth by level]
    P --> S[Shop<br/>tea & teaware by flavor + vessel + level]
    P --> T[Taster / Tasting Journal<br/>effect & flavor seed the TastingFlow zones]
    P --> A[Advise / Tea Master<br/>profile as a pre-recommendation brief]
    P --> Y[Your Table / Account<br/>home · re-take · keep across devices]

    T -.observed behavior.-> P
    S -.purchases.-> P
    E[Events] -.attendance.-> P

    A --> W[WhatsApp conversation<br/>'you're already known']
    P --> J[Journey / Passport<br/>a visible record of becoming]
```

### Field-by-field map
| Profile field | Read/Craft | Shop | Taster | Tea master |
|---|---|---|---|---|
| `level` | curriculum module / article depth | starter vs advanced teas | `simplified` TastingFlow for beginners | how much to explain |
| `answers.flavor` | flavor-origin articles | tea family filter | pre-highlight flavor families | what to pour first |
| `answers.brew` | brewing lessons | teaware (gaiwan, Yixing…) | default vessel | gear-readiness |
| `answers.motivation` (effect) | "why tea" pieces | mood-led collections | seeds the "Effect" zone | the *why* behind a recommendation |
| `disposition` | tone of voice | curated set framing | — | the human read at a glance |

## Value exchange & psychology
The reason people will *want* to fill this out — and feel served, not mined:

1. **Immediate self-insight.** The disposition mirror is the reward, delivered the instant they
   finish. It's about them, not us. (Why people share personality-quiz results and never share
   surveys.)
2. **Education *during* the flow.** The tap-to-learn layer means even answering gives something back
   — value on every screen, not gated behind the result.
3. **Belonging.** Naming a disposition places someone in a living tradition (a bowl-drinker, a
   grandpa-style person), which beats points and badges.
4. **Attunement, not analytics.** The honest stance, said plainly in the UI: *"We don't use this to
   sell you more. We use it so the right tea finds you — and so when you message us, you're already
   known."* This is the opposite of retargeting: a mass retailer profiles you to chase you with ads;
   a tea master remembers you drink for stillness and reach for a gaiwan.

**No gamification** (honors `CLAUDE.md`'s DO NOT list — no streaks/points/badges).

## Evolution path
The profile is a *living document*, and the "upgrade" is **deepening attunement earned through
practice**, never tiers:

- **Stated preference** (the quiz) → **observed behavior** (Tasting Journal entries, purchases, event
  attendance) → a **truer, self-correcting profile**.
- That growth is made visible through the existing **Journey / Passport** surfaces
  (`/account/journey`, `/passport/:token`) — a record of becoming, not a leaderboard.
- The incentive to keep it current is the same as keeping a journal: to witness your own palate
  change. Sharper recommendations and a tea master who knows you better follow naturally.

The results screen plants this seed (a line linking to the tasting journal); the automated loop is
listed under "Remaining" below.

## Phase 2 (shipped)
1. **Server persistence.** `customer_tea_discovery` (migration 082) keyed per-person by email — like
   the tasting journal, **not** account-scoped, so plain members need no store membership. Routes
   `GET|PUT /api/tea-discovery` use `requireAuth` + `getUserEmail`. The client syncs in
   `teaDiscoverySync.ts`: on login it adopts a newer server profile or pushes a newer local one
   (last-write-wins by `completedAt`) — so a profile taken **while anonymous gets persisted the moment
   the member signs in**. Completion pushes directly from `DiscoverPage`.
2. **Tea-master visibility.** `handleGetCustomerJourney` joins the disposition by the customer's email
   and returns `teaDiscoveryProfile`; `CustomerProfilePage` renders a **Tea Profile** panel (stated
   preference, beside the observed Portrait). `find_customer` (MCP) returns `tea_disposition` +
   `tea_level` per match — the brief a tea master reads before the WhatsApp conversation.
3. **Recommendations.** `recommendations.ts` turns `level` + `flavor` + `brew` into tailored next
   steps with a plain "why this" line on the results screen (replacing the generic next-step links).
4. **Evolution loop (observed palate).** `evolution.ts` derives an *observed palate* from the synced
   tasting journal (top tea types + which flavor family they lean to). The chosen disposition is
   **never overwritten** — instead the observed layer (a) replaces the static "deepens with practice"
   seed with real data once there are ≥3 tastings, (b) re-leads the shop recommendation with what they
   actually drink ("Based on what you've been drinking lately"), and (c) shows a gentle **drift nudge**
   to refresh the profile when their cups have turned away from their stated answer. No streaks/points.
   The tea master's symmetric observed layer already exists as the journey **Portrait** (from
   invoices/events).
5. **Learned disposition (opt-in).** `suggestEvolution()` re-derives level + disposition from practice
   depth (tasting volume) and, when it has clearly outgrown the stated profile, the result screen
   offers an **"Adopt this"** card — *suggests, never silently rewrites*. Adopting updates the store
   and persists via `pushTeaDiscoveryProfile`; the original answers are kept. Honesty guardrail: only
   depth is observable from the journal, so the re-derivation only moves level (and surfaces "The Deep
   Diver" at the top) — temperament/motivation-driven dispositions are never fabricated from behavior.

## Remaining
- **Drift in Journey/Passport.** The learned disposition is opt-in on the discovery screen; it is not
   yet visualized as a trajectory in the Journey/Passport surfaces.
- **Deep-link recommendations.** `recommendations.ts` routes to section surfaces (`/craft`, `/shop`);
   swap in per-article (`/article/:slug`) and per-product targets behind the same `Recommendation`
   shape once curriculum/article routing is confirmed.
- **Real photography.** `DiscoveryOption.image` is a reserved slot — drop vessel photos in to replace
   the line illustrations with no schema change.

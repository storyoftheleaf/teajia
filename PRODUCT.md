# Teajia — Design Context

This file is the source of truth for design decisions on Teajia. It is loaded by `/impeccable` and should be consulted before any visual work. Functional and code conventions live in `CLAUDE.md` and `src/designTokens.ts` — this file covers the *why* and the *feel*.

---

## Users

Teajia serves a spectrum of tea practitioners, not a single persona. Design decisions must hold for both ends of the spectrum simultaneously — the same product surface adapts by role rather than splitting into two products.

**The spectrum:**
- **Adrian + Tea Masters / Collectors** — Use Teajia daily as professional infrastructure: sourcing, inventory, tasting provenance, event hosting, CRM. Often manage private collections that may never be sold publicly. Need density, precision, and trust.
- **Tea House Operators + Staff** — Run a space carrying the Teajia name or sourcing through it. Need operational tools without complexity overhead.
- **Home Practitioners + Guests** — Discover, attend events, buy what they tasted, read the magazine, eventually maybe host. Light touch, ceremonial, never pushed.

**Design implication (the "Your Table" model):** The AccountPanel is role-adaptive — Reader / Member / Operator / Staff surfaces are not separate apps, they are different views of the same toolkit. The aesthetic must feel coherent whether someone is editing a wholesale invoice or reading an article on a Sunday morning. Density adapts; voice does not.

**Context of use:** Never at the tea table. Teajia works *before* (source, prepare, invite) and *after* (capture, remember, reconnect). Design for unhurried moments — phone-in-pocket, laptop-on-a-quiet-desk — not for split-attention scrolling.

---

## Brand Personality

Three-word anchor: **Well-built. Ancient. Future.**

Extended register: refined, thoughtful, educative, welcoming, deliberate, generous.

**The feeling within 5 seconds of landing:** *"Someone who actually knows tea built this, and they built it carefully. I am being invited in, not sold to."*

**The unforgettable thing:** Not a single visual flourish. The memory should be the *cohesion* — every element fits, every interaction is finessed, the whole thing reads as the ultimate toolkit for a tea lover at any point on the journey. The grain texture, the bronze, the character reveal, the editorial pacing — all of these serve the same impression: this was assembled by hand by someone who cares.

**Voice:** Editorial calm. Nothing shouts. Everything hums. Sentences over labels. Silence over noise.

---

## Aesthetic Direction

### Theme
**Dark "Espresso" is the canonical Teajia.** The brand lives at `#18130e` with warm cream type and bronze accents. Light "Parchment" mode exists as a respectful alternate — it must feel like a true second face of the brand, not a stripped-down fallback — but every primary marketing surface, hero, and showcase moment is designed in dark first.

### The Bronze, Not The Gold
This is the most important calibration on the project, and the easiest one to drift on.

The accent is **aged bronze, not gold.** Adrian has flagged repeatedly that "the gold feels too gold" — when bronze starts reading as shiny / yellow / metallic / decorative, it has crossed the line.

Practical rules:
- Canonical accent is `#a8874d` (`--tea-gold`). Treat the name as legacy — think of it as **bronze**.
- Use it sparingly. Bronze gains its power from rarity. If two elements on a screen are bronze, one of them is wrong.
- Prefer bronze at low opacity (8–20%) for atmosphere — borders, glows, tag backgrounds, focus rings. Full-saturation bronze is reserved for genuine moments of focus: a single CTA, an active nav item, a price after the user has chosen.
- The lighter variant `#bfa06a` reads noticeably more golden — restrict it to hover/focus transitions, not resting states.
- Never combine bronze with bright saturated colors. Bronze sits next to muted greens, espresso browns, parchment creams.
- If a surface feels "too gold," the fix is almost always: reduce opacity, reduce frequency, or remove the bronze element entirely. Do not switch to a different gold hex.

### The Quiet Aesthetic
Teajia is high-end but not flashy. Editorial, not gamified. Specifically NOT:
- Pills, chips, or rounded badges with colored fills
- Gradient text, glowing accents, neon edges
- Bright saturated brand colors
- SaaS dashboard tropes (KPI cards, stat tiles, sparklines as decoration)
- Mobile-banking-app icon-heavy navigation
- Startup-uppercase tracked-out labels used decoratively (uppercase labels are reserved for true metadata only)
- Templated card grids where every card is the same size
- "Modern" sans-serif uniformity

Specifically YES:
- Long-form serif typography setting the pace
- Asymmetric, editorial layouts with intentional whitespace
- Grain, paper, fabric textures at low opacity
- Underlines, dividers, em-of-space — typographic punctuation over UI chrome
- Text-based navigation with serifs
- Chinese characters (家佳嘉) as identity, not decoration — sized and spaced with care
- Lengthy generous spacing on marketing surfaces; precise tighter rhythm in admin / pro tools

### Typography (already established, do not redecide)
- **Display** — Cormorant Garamond (300/400/500). Old-style serif with warmth.
- **Body** — Lora (300/400 + 400 italic). Calligraphic, optimized for screen reading.
- **UI / Sans** — Plus Jakarta Sans (300–600). Geometric but soft. Used sparingly — not the dominant voice.
- **Mono** — IBM Plex Mono (400/500). Prices, weights, technical metadata only.
- **Chinese** — Noto Serif SC (body), Ma Shan Zheng (calligraphic accents).

Use `TYPOGRAPHY_CLASSES` from `src/designTokens.ts` for new headings and body. Do not invent new sizes.

### Color (already established, do not redecide)
The Espresso + Gold token system is canonical. See `src/designTokens.ts` and `src/styles/tailwind.css`. The "gold is too gold" rule above governs *use*, not the underlying tokens.

Banned: pure white, pure black, white borders/glows/spinners, legacy tokens (`tea-ink`, `tea-paper`, `tea-seal`, `tea-charcoal`).

---

## Design Principles

These five principles override individual taste calls. When a decision is unclear, return to these.

1. **Editorial calm over UI chrome.** Reach for typography, spacing, and dividers before reaching for borders, boxes, and badges. If a piece of UI can be expressed as well-set type, set it as well-set type.

2. **Bronze is rare.** Aged bronze is the only accent. It earns its presence by being scarce and never shouting. When in doubt: less of it, lower opacity, smaller surface.

3. **One toolkit, two registers.** Public-facing surfaces (homepage, magazine, shop, event pages) breathe — generous space, slow rhythm, ceremonial pacing. Pro surfaces (admin, inventory, tasting) are dense and precise. The voice, type system, color, and texture are the same in both — only spacing and information density change.

4. **The phone is in the pocket during tea.** Design for the moments around tea, never during. Avoid features that ask for split attention, gamify behavior, or notify. Reward unhurried use.

5. **Cohesion is the memorable detail.** No single flourish carries the brand. The character reveal, the bronze, the grain, the typography — none of these are the point. The point is that they all fit. A new element earns its place by deepening the existing system, not by introducing a new one.

---

## Anti-references

What Teajia is **not**:
- SaaS dashboards (Linear, Notion, Stripe-style admin)
- Mobile banking / fintech apps (icon-heavy nav, pill buttons, KPI cards)
- Wellness / mindfulness apps (Calm, Headspace — too soft, too rounded, too app-like)
- Tea e-commerce competitors that look like generic Shopify stores
- "Designy" startup landing pages with gradient hero text and feature grids
- Anything that could pass as AI-generated UI in 2024–2025

The closest references in spirit are well-printed editorial objects: a serious cookbook, a museum exhibit caption card, the inside cover of a literary quarterly, a hand-set wine list. Not other websites.

---

## Quick checks before shipping a design

- Does any element feel "too gold"? If yes, reduce opacity or remove.
- Is there a pill, chip, or rounded-rectangle badge? Replace with type + space.
- Is there an icon doing work that a word would do better? Replace with the word.
- Could this be mistaken for a Shopify theme, a SaaS dashboard, or a wellness app? If yes, the aesthetic has drifted.
- Does the spacing have rhythm, or is everything the same padding? Vary deliberately.
- Run `npm run lint:colors` before commit (mandatory).

# Teajia Vision Audit — Part 1: Overview & Philosophy

## What Teajia Already Does Right

Before tearing anything apart: this app is genuinely impressive. 139+ products in D1, a magazine-quality Reader with 50+ layout variants, a full admin inventory system, events with RSVP, a Tea Compass logging tool, multi-currency support, offline sync scaffolding, and an editorial voice that no competitor in the tea space comes close to. This is not a Shopify store with a blog. This is a platform.

But it's a platform that hasn't yet found its **rhythm**. The pieces are all here — commerce, education, community, logging, events — but they operate as separate rooms in the same building. The hallways between them are missing.

---

## The Core Thesis: Teajia Should Be the Tea Practice OS

Right now Teajia is: a shop + a magazine + a learning hub + an event system + a logging tool + an admin dashboard. Six products sharing a navbar.

What it should be: **a single integrated environment where a tea practitioner's entire relationship with tea lives.** Every cup logged in Tea Compass should surface relevant products. Every product purchased should appear in the journal. Every article read should unlock deeper understanding of what's already in the collection. Every event attended should leave a trace in the personal timeline.

The metaphor: Teajia shouldn't feel like visiting six different websites. It should feel like opening a well-loved tea journal — everything is connected, everything builds on what came before.

---

## The Three Missing Layers

### 1. The Personal Timeline (The Spine)

There is no unified view of "my tea life." The tasting journal is in localStorage. Favorites are in Zustand + server. Event attendance is in the events system. Purchase history is in orders. Tea Compass entries are in their own store. Reading history is in localStorage.

**What's needed:** A single chronological feed — "My Tea Life" — that weaves together:
- Teas purchased
- Tasting notes written
- Events attended
- Articles read
- Compass entries logged
- Favorites added

This isn't a social feed. It's a personal archive. Think of it like a GitHub contribution graph for tea practice. When someone opens their account, they should see the shape of their tea journey.

### 2. The Knowledge Graph (The Brain)

The app has extraordinary content — lore, terroir, processing notes, tasting taxonomy, 150+ magazine articles, structured learning curricula. But none of it is connected to the user's actual experience.

**What's needed:** Contextual intelligence that surfaces the right knowledge at the right moment:
- Viewing a Sheng puerh? Show the relevant Learn module on puerh aging.
- Logged a gongfu session? Surface the brewing mastery track.
- Bought a yixing pot? Link to the vessels curriculum module.
- Tasting notes mention "mineral"? Show other teas in the catalog with similar profiles.

The content already exists. The connections don't.

### 3. The Social Layer (The Community)

Teajia has community infrastructure (events, RSVP, contributors directory, shared collections) but no actual community space. Tea culture is inherently social — gongcha (shared tea) is fundamental. A tea practitioner alone is half a practitioner.

**What's needed:** Lightweight social features that respect the contemplative nature of tea:
- Shared tasting sessions (two people logging the same tea simultaneously)
- A "tea circle" — small group of friends who can see each other's recent sessions
- Event attendee connections ("you both attended the March oolong tasting")
- Community tasting notes aggregated on product pages (already suggested in AUDIT.md #12)

Not a social network. A tea table with chairs for friends.

---

## How to Read This Audit

The remaining parts go deep into specific areas:

- **Part 2: The Shop Experience** — How to make buying tea feel like discovering tea
- **Part 3: Tea Compass & Personal Practice** — Making the daily logging tool indispensable
- **Part 4: Learning & Content** — Connecting education to lived experience
- **Part 5: Events & Community** — From RSVP tool to community platform
- **Part 6: Admin & Operations** — Making Adrian's daily workflow effortless
- **Part 7: Technical Architecture** — Infrastructure changes that unlock everything else

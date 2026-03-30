# Teajia Vision Audit — Part 5: Events & Community

## Current State

The events system is robust: 11 components covering landing pages, RSVP, guest management, tea menus, tasting notes forms, venue guides, countdown timers, post-session archives. The admin side has full event CRUD, capacity/waitlist management, attendee tracking, and notification system.

What's missing: the before and after. Events currently exist as isolated moments — you RSVP, you attend, it's over. But a tea tasting event should be the start of a relationship, not a transaction.

---

## Transformation 1: The Event Lifecycle

### Pre-Event: Building Anticipation

**Tea Menu Preview → Education Bridge**
- The tea menu for an event lists which teas will be tasted. For each tea, link to:
  - The product page (if in catalog) — so attendees can pre-read lore, terroir, tasting notes
  - A "prepare your palate" mini-guide — what flavors to expect, what to pay attention to
  - The relevant Learn module — if it's a puerh tasting, link to puerh education

**Attendee Preparation Email**
- 48 hours before event: automated email with:
  - Tea menu with brief descriptions
  - "What to bring" (if applicable)
  - Venue guide link
  - Calendar file (already exists via CalendarDownload)
  - A single prompt: "What are you most curious about for this tasting?"

**Pre-Event Discussion**
- Simple comment thread on the event page for registered attendees
- "Anyone tried [tea X] before? What should I expect?"
- Builds community before people even meet

### During Event: Structured Tasting

**Live Tasting Mode**
The TastingNotesForm exists. Enhance it for live use:
- **Guided flow**: Admin advances through the tea menu, attendees see the current tea with prompts
- **Real-time prompt**: "We're now tasting Tea #3: 2019 Lao Ban Zhang Sheng. Take a moment with the dry leaf first."
- **Quick capture**: Large tap targets for flavor notes, body, finish — designed for one-handed use while holding a cup
- **Photo prompt**: "Capture the liquor color of this steep" — auto-tagged to the specific tea

**Comparison View During Tasting**
- If tasting 4 teas, show a side-by-side grid of the user's notes so far
- "How does Tea #3 compare to Tea #1?" — structured comparison prompt
- End-of-session: "Rank your favorites" — simple drag to reorder

### Post-Event: The Lasting Connection

**Session Summary Email (AUDIT.md #16)**
Within 24 hours:
- Beautiful HTML email with:
  - All teas tasted with photos and key facts
  - The attendee's personal tasting notes (from their form submissions)
  - Links to purchase any teas that are available in the shop
  - "Rate this event" — simple 1-5 feedback
  - "Want to attend more events like this?" — preference capture
  - Photos from the session (if uploaded by admin)

**Post-Session Archive**
The PostSessionArchive component exists. Make it richer:
- Aggregated tasting data from all attendees (anonymized)
- "The group's favorite was Tea #2 with an average rating of 4.6"
- Community tasting radar chart — what did the group collectively taste?
- This becomes a permanent record of the event — valuable content

**Attendee Connections**
- After an event, show a "People at this event" list (opt-in)
- "Connect" button — adds someone to your tea circle (see below)
- "You and [name] both rated [tea] as your favorite"

---

## Transformation 2: Tea Circles (Community Layer)

### What is a Tea Circle?

A small, private group (2-8 people) who share their tea practice. Not a public social network. More like a group chat for tea nerds.

**Features:**
- **Shared session feed** — See when circle members log a Tea Compass session
- **Tea recommendations** — "I just tried this, you'd love it" — push a product to circle members
- **Shared tasting** — Two people brew the same tea simultaneously, log notes, compare after
- **Group purchases** — "Want to split a cake of this puerh? 4 people × 100g each"
- **Event coordination** — "Who wants to attend the March tasting?"

**Implementation:** Lightweight. A `tea_circles` table in D1, a `circle_members` junction table, and a simple activity feed that filters Tea Compass entries by circle membership. No real-time needed — polling or refresh-on-open is fine.

### Community Tasting Notes (AUDIT.md #12)

On product pages, alongside the official tasting profile:
- **"What the community tastes"** — aggregated radar chart from all user sessions of this tea
- **Notable quotes** — best one-line tasting impressions (opt-in, curated)
- **Session count** — "47 sessions logged by 12 practitioners"
- This makes product pages more trustworthy and richer over time

### Contributor Profiles

The contributors directory exists. Expand it:
- Each contributor has a public profile with:
  - Their curated tea picks
  - Articles they've written
  - Events they've hosted
  - Their tasting style (aggregated from their logged sessions)
- This is the "tea master" profile — aspirational for community members

---

## Transformation 3: Event Types Beyond Tastings

### Workshop Mode

Not just tasting — structured learning events:
- **Brewing workshop** — step-by-step guided brewing with checkpoints
- **Blending workshop** — participants create custom blends, log recipes
- **Ceramics appreciation** — teaware-focused sessions with the teaware catalog integrated

### Virtual Events

COVID proved remote tea sessions work. Support them:
- **Virtual tasting kit** — Pre-ship sample sets to registered attendees
- **Shared timer** — Everyone steeps together, guided by the host
- **Live tasting notes** — Real-time view of all participants' notes
- **Video embed** — Zoom/Meet link in the event page, or native WebRTC if ambitious

### Pop-Up / Collaboration Events

- **Co-hosted events** — Partner with local tea shops, restaurants, ceramic studios
- **Venue as content** — The venue guide already exists. Make venues a first-class entity with photos, directions, atmosphere description
- **Cross-promotion** — Event at partner venue → partner's teas featured alongside Teajia's

---

## Transformation 4: The Event Content Engine

### Every Event Generates Content

Each event should produce:
1. **A Magazine article** — Recap with photos, tasting notes, highlights
2. **Product page enrichment** — Community tasting data from the event
3. **Learn Hub content** — If a new technique was demonstrated, document it
4. **Social media assets** — Branded tasting cards, event photos with captions

The PostSessionArchive already captures most of this data. The pipeline to turn it into published content is what's missing.

### Event Series

Group related events into series:
- "Puerh Journey: 6-Part Series" — monthly events building knowledge progressively
- Attendees who complete the series get a certificate or store credit
- Series have their own landing page with progress tracking
- This drives repeat attendance and deeper engagement

---

## Quick Wins (< 1 day each)

1. **Post-event purchase links** — Email attendees with links to buy teas from the event
2. **"I attended" badge** — Show on user's account panel which events they've attended
3. **Calendar integration** — ICS download already exists. Add Google Calendar deep link.
4. **Event photo gallery** — Admin uploads photos, attendees see them on the post-session page
5. **Waitlist notification** — When a spot opens, auto-notify first person on waitlist
6. **Repeat attendee recognition** — "Welcome back! This is your 5th Teajia event."

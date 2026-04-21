# Teajia Vision Audit — Part 3: Tea Compass & Personal Practice

## Current State

Tea Compass is 27 files and 10,000+ lines. It supports photo capture, voice recording, natural language input, session logging, vendor tracking, a personal ledger with PDF export, and cloud sync. It's the stickiest feature in the app — a daily-use tool.

But it's isolated. Sessions logged in Compass don't connect to the shop, don't enrich product pages, don't feed the learning system, and don't build community. It's a private notebook when it could be the heartbeat of the entire platform.

---

## Transformation 1: The Intelligent Tea Journal

### Session Templates by Tea Type

Right now, logging a session is a blank form. But a gongfu session with a young Sheng is fundamentally different from a casual mug of jasmine green. Offer **session templates**:

- **Gongfu Session**: Multiple infusions tracked (steep 1: notes, steep 2: notes...), vessel used, water temp, leaf weight
- **Casual Cup**: Single steep, simple notes, mood
- **Comparison Tasting**: Side-by-side two teas, comparative notes
- **Aging Check**: Specifically for revisiting aged teas — compare against previous sessions of the same tea
- **New Tea First Impression**: Guided prompts — "First smell? First sip? How does it change as it cools?"

Templates are just pre-configured form layouts. The underlying data model stays the same.

### Smart Prompts Based on History

If someone has logged 15 sessions of the same tea, stop asking basic questions. Instead:
- "How does today's session compare to your last one?"
- "You rated this 4/5 last time. Still feeling the same?"
- "Your usual steep time is 15s. Try 20s today and note the difference."

This turns passive logging into active practice development. The data is already there — just query the user's session history for that product.

### Voice-to-Structured-Notes Pipeline

Voice recording exists but appears to save raw audio. The backend has a `transcribeAudio` endpoint. Close the loop:
1. User speaks during session: "This steep is more astringent than the last, getting some camphor notes, the body is thicker"
2. Transcribe → extract structured data: `{ flavor: ["camphor"], body: ["thick"], notes: "more astringent than last steep" }`
3. Pre-fill the tasting form with extracted data
4. User confirms/edits → saves

This is the killer workflow for people who brew with wet hands and can't type.

---

## Transformation 2: The Practice Dashboard

### Session Heat Map

AUDIT.md #11 suggests a streak tracker. Go deeper. Show a **12-month heat map** (like GitHub contributions) of tea sessions:
- Color intensity = number of sessions that day
- Tap a day → see what teas were brewed
- Weekly/monthly summaries: "You brewed 23 sessions this month, mostly oolong (14)"

### Taste Profile Evolution

Over time, a practitioner's palate changes. Visualize it:
- Radar chart of flavor categories logged (floral, earthy, mineral, sweet, roasted, etc.)
- How it shifts month over month — "You're gravitating toward earthier teas lately"
- Comparison: "Your palate 6 months ago vs. today"

This uses the structured `tasting{}` data that already exists on each session entry. Aggregate, count categories, plot.

### Collection Inventory

Tea Compass knows what the user has been drinking. The shop knows what they've bought. Combine them into a **personal collection tracker**:
- Teas I own (from purchases)
- Estimated remaining quantity (from logged sessions × estimated consumption)
- "Running low" alerts
- Storage notes (where it's stored, how it's aging)
- Total collection value

This is the feature that makes people open the app daily even when they're not buying.

---

## Transformation 3: Compass as Content Engine

### Auto-Generated Session Summaries

After 10+ sessions with a tea, auto-generate a personal review:
> "You've brewed Da Hong Pao 14 times over 3 months. Your most common notes: mineral, roasted chestnut, lingering sweetness. Average rating: 4.2/5. You tend to brew it at 95°C for 15-20 seconds. Your favorite session was March 12 — you described it as 'the best steep yet, incredibly smooth on the 4th infusion.'"

This is pure data aggregation + templating. No AI needed.

### Shareable Tasting Cards

AUDIT.md #14 suggests this. Implement it:
- After logging a session, offer "Share this tasting"
- Generate a branded card image: tea name, tasting notes radar, personal note, Teajia branding
- Share to Instagram stories, WeChat moments, WhatsApp
- Card links back to the product page (if the tea is in Teajia's catalog)

This is organic marketing that costs nothing. Every shared card is an ad.

### Community Tasting Aggregation

When multiple users log tasting notes for the same product, aggregate anonymously on the product page:
- "Community tasting profile" radar chart alongside the official one
- "Most commonly noted: orchid (73%), mineral (61%), hui gan (54%)"
- This makes product pages richer over time as more people log sessions
- Opt-in only — users choose to contribute their notes

---

## Transformation 4: The Offline-First Daily Driver

### True Offline Mode

The PWA manifest exists but there's no service worker for caching. Tea Compass should work **fully offline**:
- Cache the entire UI shell + fonts + icons
- Queue all writes (new sessions, photos, voice) locally
- Sync when back online with conflict resolution
- Show clear sync status: "3 sessions pending upload"

Tea sessions happen everywhere — mountain retreats, tea farms, travel. Offline isn't a nice-to-have, it's essential.

### Widget / Quick Action

For mobile PWA users:
- "Log a quick session" action accessible from home screen long-press
- Opens directly to a minimal capture form: tea name (autocomplete from history), quick rating, one-line note
- 10 seconds to log. No friction.

### Apple Watch / Wearable Integration (Future)

This is aspirational but worth noting: a WatchOS companion that tracks session timing (tap to start steep, tap to pour) and syncs back to Compass. Tea timers exist as standalone apps — integrating one into the practice log is unique.

---

## Transformation 5: Vendor Intelligence

### The Vendor Map

Tea Compass tracks vendors. The admin has vendor/source management. Surface this for practitioners:
- "Your tea comes from 7 different vendors across 4 countries"
- Map visualization of your tea sources
- Vendor notes: "Last ordered from [vendor] on [date], [X] teas from them"

### Shared Vendor Reviews

Anonymized, aggregated vendor data from Compass users:
- "This vendor's teas are rated 4.3/5 average by Teajia members"
- "Most popular teas from this vendor: [list]"
- This builds trust and helps the community find good sources

---

## Quick Wins (< 1 day each)

1. **Autocomplete tea names** from previous entries + product catalog
2. **"Brew again" button** on past sessions — pre-fills form with same tea, adjusts date
3. **Session timer** — simple countdown timer for steep times, logs duration automatically
4. **Photo gallery view** — grid of all session photos, tappable to view session details
5. **Export to PDF** — monthly journal export with photos and notes (PDF renderer already in the stack)
6. **"Today's tea"** — morning notification/suggestion based on weather, season, and past preferences

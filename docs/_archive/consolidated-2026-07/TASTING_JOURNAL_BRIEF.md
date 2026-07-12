# Tasting Journal. Design Brief

This brief describes the customer-facing Tasting Journal destination inside Your Table (AccountPanel). It assumes the data-model migration is complete: one `CustomerTasting` per `(user × productId)`, with a top-level note (the current view of what the user thinks about the tea) and a `tastings[]` array of recorded sittings.

This document guides implementation. It is not implementation.

A note on vocabulary. The user-facing word for the top-level paragraph is **note**. Internally the data field can stay `synthesis` if needed, but no surface ever uses that word. The user-facing word for one recorded sitting is **tasting**. The act of writing into a note is **adding** or **editing**. We avoid "session," "deepen," "synthesis," and "Nth tasting" everywhere users can see.

## 1. Feature summary

The Tasting Journal is the customer's personal record of the teas they've cared enough to write about. It lives inside Your Table on a phone or in the side panel on desktop. It is a destination for reflection between tea sittings, not a real-time logger. Each row is one tea, added to over time.

## 2. Primary user action

Open a single tea entry and add to your note about it. Everything else (browsing, finding, sharing, looking at past tastings) serves that.

The journal is not a dashboard, not a quantified-self tracker, not a feed. It's a small private library of teas you've thought about. The most important interaction is opening one. Every other affordance is downstream of that.

## 3. Design direction

Editorial, slow, contemplative. This surface should feel most like reading a private notebook and least like an app. Aged bronze accents on warm cream surfaces (existing tea palette). Serif display for tea names, sans for metadata. Generous vertical rhythm. Tighter clusters within an entry, larger breathing room between entries. No icon-and-stat dashboards. No bright borders, no bright colors except the bronze accent on a single moment per row.

Reference the way a hand-bound tea journal would feel. A leaf pasted to one page, your scribbled notes on the facing page, a date stamp in the corner. The digital version doesn't need to imitate the texture. It should imitate the pace.

Anti-references. Goodreads' "books read" counters, Vivino's wine-rating leaderboards, any "streak" or "X tastings this month" gamification. These all push toward more entries. We want fewer and richer.

## 4. Layout strategy

The destination has three surfaces, in order of importance.

### a) Entry detail (the primary surface, most pixel budget)

The single-tea view. Where the user spends the most time per visit. Should occupy the full panel or screen when open, with the list view fading or sliding away. Layout:

- **Tea identity at top.** Image (if any), name, type pill in a small, restrained typographic header. Not a hero. Not a banner.
- **Note as the main reading surface.** The current personal note rendered as a single readable paragraph, italic serif, 14 to 15px, generous line-height. This is the "what I think of this tea right now" canvas. Editable inline (tap to enter edit mode, no modal).
- **Tasting profile.** The existing TastingProfileStrip from the main journal, rendered as a seam below the note: flavor, body, feeling, finish in compact pill rows. Latest values from the most recent tasting. Tap to expand into edit mode.
- **Past tastings.** A vertical list below the profile. Each tasting is a small dated marker with the reason it was a fresh tasting (if any) shown as a quote underneath. Tap a tasting to expand its raw data inline. Default-collapsed. The list shows just dates and reasons.
- **Provenance.** Source type, event, sample, all live at the tasting level, shown in the past-tastings list. "At Bali Sangha, 2025-03-12" reads as a caption under that tasting's date.
- **Actions, footer.** A thin row at the bottom: *Edit note* (default-state primary), *Start a new tasting* (text-link, secondary, opens the reason prompt), *Share*, *Archive*. No chrome, text labels, single bronze accent on the primary.

### b) The list (the way in)

The way to find an entry. Stays simple. Each row is one tea, dense but legible:

- **Tea image (left, 44px).** If no image, a soft colored swatch (existing pattern: type color, then liquor color, then fallback emblem).
- **Tea name and type** in serif, gold on hover (existing pattern).
- **One-line note preview.** Italic serif, 13px, line-clamped to one line. This is the personal note, not raw flavors. The line that would make you want to open this entry vs. another. If empty, falls back to the latest tasting's overall impression, then to its primary flavors.
- **Right-side meta cluster.** Relative date ("3 days ago"), tasting count if more than one ("3 tastings"), rating if greater than 0 (star strip). Stack vertically right-aligned, all in 11 to 12px secondary text.
- **Chevron-right** on the right edge. The established Your Table affordance for "this navigates."

The whole row is the tap target. Hover lifts the background subtly. No card containers, rows separated by hairline dividers in tea-border, with comfortable vertical padding (16 to 20px). This gives the feel of a printed list of entries, not a card grid.

### c) Header strip and sort

Above the list:

- **Title.** "Tasting Journal" in serif, modest size. Below it, a small caption: *"N teas"*. The count means unique teas, not events. When N is 0, the empty-state copy lives here (see § 7).
- **Sort affordance.** A single quiet chip, *Most recent · By tea · By rating*. Text-button cycling through three states. No filter sidebar, no search bar by default. (Search appears as a single icon-button that expands inline when N is greater than 12.)

The list and header together fit on the first screen on mobile. Scroll reveals more rows.

### Asymmetric breathing

Within an entry detail, the note surface is wide (full panel width) and tall. The past-tastings list is narrower (left-aligned, ~70% width). Visually subordinate. The actions footer is thin. This asymmetry says note is the point, past tastings are the substrate, actions are the exit.

## 5. Key states

### Empty (zero entries)

The user has never tasted a tea. Editorial copy, not a placeholder. Roughly: *"The teas you taste will show up here. Come back to write what you noticed."* Below it, a single gold text-link: *Browse teas*. No illustration, no card.

### One entry

Don't show sort. Don't show count semantics ("1 tea" is fine). The single row is the only thing. It should feel intentional, not lonely. List-view styling otherwise unchanged.

### Many entries (12 or more)

Search affordance becomes visible (icon button in the header). Sort chip is more useful here. Otherwise the design holds.

### A tea you tasted again yesterday (entry detail)

Note at top is your latest edit. The past-tastings list shows: today's tasting with its reason underneath ("Different vessel, wanted to see what the gaiwan did"), then the original tasting below it. Default-collapsed lets you see the story of how this tea has lived in your head without overwhelming.

### Editing the note (inline edit mode)

Tap the note paragraph. It transforms into a text area in place. The rest of the entry dims slightly (background, not a modal overlay). Save is a small bronze text-button. Cancel is a text-link. Esc closes. No save-or-discard dialog. Auto-save on blur after a 2-second pause, with a tiny "Saved" caption that fades.

### Adding a new tasting (the friction path)

Tapping "Start a new tasting" reveals an inline form (not a modal): a single textarea labeled *"Why are you tasting this again?"* with a one-line caption: *"Use this when something changed: different brew, aged tea, new pot. Otherwise just edit your note above."* The Save button is disabled until the textarea has at least ~10 characters. Once submitted, the user enters the existing TastingSession flow with a fresh blank profile. On save, the tasting appends to the entry.

If the new tasting captures values that differ from the current note, the user is shown the existing note and the values from the new tasting side by side, and picks one or merges. The note is never silently overwritten.

### Loading

When hydrating from server: the existing list with sync indicator ("3 unsynced") in the header. Rows render optimistically from local state.

### Error

Sync failure shows as a small caption near the unsynced count: *"Will sync when you're back online."* Never a banner, never a modal.

### Archived

Archived entries don't show in the list by default. A single "Show archived" text-link at the bottom of the list reveals them with reduced opacity.

## 6. Interaction model

The journal is read-mostly. Most visits are: open list, tap an entry, read it, close. The interactions that exist are tuned for that:

- Tap an entry, enter detail. Full panel transition, slide-from-right, ease-out 240ms.
- Tap the note, inline edit. Fade-in textarea over the paragraph, no layout shift.
- Tap a past tasting, expand its raw data inline. Grid-template-rows transition, 200ms.
- Tap "Start a new tasting", reveal reason form inline. Same expand pattern.
- Long-press an entry in the list, archive sheet. (V2 nice-to-have, not blocking.)
- Pull to refresh on mobile triggers a sync.

What doesn't exist:

- No swipe gestures on rows.
- No drag-to-reorder.
- No filters beyond the single sort chip and optional search.
- No tag clouds, no charts, no "your taste profile" inferences.

The interaction principle: fewer things, each one calm.

## 7. Content requirements

All copy lives here so it can be reviewed independently.

| Surface | Copy |
|---|---|
| List header | *Tasting Journal* |
| List subhead (N=0) | *Where the teas you taste will show up.* |
| List subhead (N≥1) | *{N} teas* |
| Empty body | *The teas you taste will show up here. Come back to write what you noticed.* |
| Empty action | *Browse teas* (text-link to /shop) |
| Sort chip states | *Most recent · By tea · By rating* |
| Search placeholder | *Search by tea or note* |
| Detail back button | *← Tasting Journal* |
| Note empty state (in entry detail) | *Write your note here.* |
| Edit note save | *Save* |
| Edit note cancel | *Cancel* |
| New tasting button | *Start a new tasting* |
| New tasting caption | *Use this when something changed: different brew, aged tea, new pot. Otherwise just edit your note above.* |
| New tasting input label | *Why are you tasting this again?* |
| Past tastings list header | *Past tastings* |
| Past tasting marker (no reason) | *{relative date}* |
| Past tasting marker (with reason) | *{relative date}. "{reason}"* |
| Past tasting source caption | *At {eventTitle}* / *From a sample* / *From the Compass* |
| Share button | *Share* |
| Archive button | *Archive* |
| Restore button | *Restore* |
| Synced status | *Saved* (grey, only shown briefly post-sync) |
| Unsynced status | *{N} unsynced* (gold pill, top-right of header) |
| Sync error | *Will sync when you're back online.* |

Voice principles:

- Prefer plain words that translate. **Note**, **tasting**, **add**, **edit**, **save**.
- Avoid: synthesis, deepen, session, Nth tasting, ordinal language, "record tasting."
- The journal is yours. Second person ("you") and possessive ("your") are right. "Users" is wrong.
- Editorial, never instructional. Don't tell the user what to do, describe what's there.
- No em-dashes anywhere. Use periods, commas, or parentheses.

## 8. Recommended impeccable references

Most useful during build:

- **spatial-design.md** for the asymmetric breathing in the entry-detail view (note wide, past-tastings narrower) and for the rhythm of the list.
- **interaction-design.md** for the inline-edit pattern and the new-tasting friction prompt. Both depend on getting the inline transitions right.
- **motion-design.md** for the panel transition in and out of detail, and the grid-template-rows expand on past-tasting items.
- **typography.md** for the serif and sans pairing, especially the note as a reading surface (line-height, max width).
- **ux-writing.md** for the empty state and the new-tasting caption.

## 9. Open questions

These should be resolved during implementation, not in the brief:

1. **Note auto-update vs. manual when a new tasting is added.** Default proposed: latest tasting's values populate the note's tasting profile, but the personal-note paragraph is never silently overwritten. User is shown previous and new values, picks one or merges.
2. **Past-tastings visual treatment.** "Left-aligned vertical list" needs a small visual decision: dot and line, or just date and indent? Resolve in code by trying both at 1x scale.
3. **Search behavior.** Search by tea name is obvious. Search by content (within the note or past tastings) is more useful but more expensive. Default to name-only, add content search if cheap.
4. **Long-press archive sheet.** Defer to V2 unless trivially cheap to implement during V1.
5. **Sort persistence.** Should sort persist across visits? Default proposed: yes, in localStorage, scoped per-user.

## Out of scope for V1

- Tag-based filtering (mood, flavor families)
- Statistics or "your taste profile" surfaces
- Cross-tea comparison views
- Public sharing of the note (separate from the existing share-card feature)
- Migration UX for existing duplicate entries (handled server-side, transparent)

## Definition of done for V1

- Entry detail surface exists with note (editable inline), tasting profile, past-tastings list, actions footer.
- List surface uses the note preview as the body line, not raw flavors.
- New-tasting friction path works (required reason, then enters TastingSession with blank profile, appends on save).
- All copy from § 7 is in place. No legacy "Nth tasting" or "Quick note" strings remain.
- Empty state matches § 5.
- Both the AccountPanel (`TastingJournalView`) and the main `/journal` page (`TastingJournal.tsx`) consume the same data shape. The AccountPanel is a focused subset of the main destination, not a separate model.

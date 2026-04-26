# Network UI Brief

*Design direction for every new screen introduced by NETWORK_ROLLOUT_PLAN.md. Anchored in `.impeccable.md` (brand) and MEMBERS_AND_ACCESS_BRIEF.md §6 (Members & Access design language). Read both first.*

*Status: complete. All 4 sessions, 11 surfaces specified.*

---

## Shared vocabulary across all network surfaces

These rules govern every surface in this brief. Cited rather than repeated per surface.

- **Editorial register, not SaaS.** Wine-list rhythm. Type and space over chrome. No pills, no chips, no rounded-rectangle badges, no KPI cards.
- **Bronze is rare.** One bronze element per visual cluster, on the moment of focus or commit. Resting states use neutral tea tokens.
- **Mine vs theirs is a structural choice, not a mode toggle.** When a screen mixes a partner's content with canonical content, the layout itself shows the split (split-pane, dimmed dimming, secondary type). Never use a mode switch.
- **No toasts for routine actions.** Inline state change is the confirmation. Toasts reserved for asynchronous actions (invite delivered, wholesale order shipped).
- **Errors as prose, not red boxes.** Body italic in tertiary color, no icon, no border. Tone: knowledgeable friend, not compliance officer.
- **Mono only for numerics.** Prices, weights, percentages, dates as mono metadata. Everything else is serif (display or body).
- **Sentences over labels.** "Six members. Two with full access." beats "Members: 6."
- **Curator/originator distinction is always visible.** Anywhere a profile is shown to anyone other than its curator, the canonical attribution line ("Sourced from Teajia · curated by Adrian") appears in 11px tertiary.
- **Brewing parameters do NOT appear on tea profiles or listings anywhere in this brief.** Brewing instruction lives in Learn / training content, not on the tea card. Tea profile canonical attributes are: name, origin, varietal, harvest year, description, flavor tags, mood tags, photos. Period. (Decision 23 in NETWORK_ROLLOUT_PLAN.md.)
- **Mobile is a real target, not a fallback.** Adrian, Jesse, and Tea Masters will sometimes do this work on mobile. Every surface in this brief specifies mobile behavior. The pattern: canonical content is woven inline at decision points, not housed in a separate panel that disappears below the fold on mobile.
- **The card is the editor.** Canonical content is edited *in place* on the same card / page that displays it. There is no separate compose surface, no "edit mode," no rationale field. The view IS the edit surface. The only visual change on entering edit is the footer commerce buttons swap to editorial actions in the same slots. The rest of the card stays put.
- **Card edits identity. Tasting edits experience.** The card surfaces what the tea IS (description, origin, varietal, harvest year, name, photos). Tasting captures what someone EXPERIENCES (flavors today, mood today, observations across sessions). Flavor and mood tags are NEVER edited on the card — they're edited in tasting. Description and origin are NEVER edited in tasting — they're edited on the card. The two domains never overlap.
- **No rationale on canonical edits.** When a partner proposes a canonical change, the change itself is self-explanatory. Adrian sees current vs proposed and decides. No "tell Adrian why" form. The new text is the argument.

---

# Session 1 — Catalog & Listing surfaces

The partner's daily inventory loop: browse Adrian's catalog, carry a tea, refine the listing, see her trust tier, get a soft nudge when her retail drifts below canonical.

## Surface 1 — Catalog browse ("Carry from network")

### The job
Jesse opens this when deciding to add a tea Adrian curates to her own shop. Not shopping. A curatorial act.

### Layout
- Single column mobile; two-column desktop (not three or four — denser feels like e-commerce)
- Page heading: display serif, count woven into the sentence ("The Teajia catalog · 47 teas you don't yet carry")
- One-line italic body subtitle: "Pick what belongs in your house."
- Filter row as comma-separated text-links by tea type. Selected one bronze. No dropdowns, no chip rows, no sidebar facets. Wraps via `flex-wrap` on narrow widths (no horizontal scroll per CLAUDE.md).

### Card structure
Horizontal on desktop (photo left at 280px square, text right). On mobile: stacked, photo full-width at the top of each card, text block below. One entry per row at every breakpoint.

```
[photo, 280px square]   Silver Needle Fuding 2024
                        Fujian · 福鼎白茶 · spring single bud
                        White · sweet · honey · light
                        ─────
                        Adrian's retail · IDR 2,400,000/100g
                        Your wholesale · AUD 132/100g (45% · verified)
                        ─────
                        Carry this tea →
```

- Tea name in display 24px
- Origin/varietal/Chinese in body 14px secondary
- Flavor row in body 13px tertiary
- Both prices in mono 13px (the only mono on the page)
- "Carry this tea" as text-link with arrow on hover, no button
- Photo: square, design-system radius, 1px bronze/8% border

### Bronze placement
One bronze element per card, on hover only — the "Carry this tea" arrow turns bronze when the row is hovered. Resting state has no bronze.

### States
- **Empty (carries everything):** italic body, "You carry everything Adrian curates. New harvests appear here as Adrian publishes them." No CTA.
- **Loading:** tea-skeleton card outlines, soft tinted photo rectangles. Never spinner.
- **FX unavailable:** retail shown in canonical currency only; wholesale line reads "Wholesale will calculate when prices reload" italic.
- **Catalog bundle missing:** destination hidden from nav entirely. URL-hack falls through to "This destination requires the Catalog bundle. Ask your owner."

### Interaction
- Tap row → right-side drawer (desktop) / full sheet (mobile) with full canonical detail: all photos, full description, origin notes, mood/flavor tags, network-visible tasting notes. (No brewing — see shared vocabulary.)
- Drawer footer: "Carry this tea" (primary text-link) + "Carry as sample only" (secondary)
- "Carry this tea" inline-expands within the drawer:
  ```
  Stock to start with    [____] g
  Your retail price      [____] AUD/100g
                         Suggested AUD 290 (Adrian's IDR 2,400,000 × FX)

                                Cancel    Carry it
  ```
- On commit: navigate to listing edit page (Surface 2) with quiet inline message: "Silver Needle is now in your house. Refine below." No toast.

---

## Surface 2 — Listing edit page

### The job
Maintain a listing whose content is anchored to canonical (Adrian's). Adjust stock, edit price, add store note, add packaging photos, optionally hide canonical photos.

### The mental model
Single-column editorial form. Canonical context is **woven inline** at each decision point, not housed in a separate panel that disappears below the fold on mobile. The form reads like a wine list footnote rather than a software inspector. Same layout at every breakpoint — only horizontal margin scales.

### Layout
One column. Generous editorial whitespace on desktop (max-width on the form, ~640px), tight on mobile. Top of page:

- Tea name in display serif, large
- 11px tertiary attribution underneath: "Sourced from Teajia · curated by Adrian · originated from Yang's Garden, Fujian" (originator line shown only when originator ≠ curator)
- 12px tertiary line below: "View Adrian's full canonical content →" — opens the same canonical detail drawer used by Surface 1

Then the form, in this order, with canonical context as inline footnotes (italic body in tertiary color, 12px) directly under each editable block where the comparison matters:

```
Stock                          [____] g
                               Sample available · yes / no

Your retail price              [____] AUD/100g
                               Adrian's retail · IDR 2,400,000/100g
                               (≈ AUD 290 at today's FX · suggested)

Your note on this tea
[                                                              ]
[                                                              ]
[                                                              ]
                               Adrian's canonical description shows below
                               yours on your storefront. Your note is your
                               voice on this tea.

Your photos
[ drag-drop with grain texture ]
[ photo grid, your uploads first ]
                               Adrian's canonical photos:
                               [ thumb ] [ thumb ] [ thumb ]
                               · "Hide on my storefront" under each thumb
                               · "Show on my storefront" if hidden

                                              Cancel    Save
```

Each canonical-context line is the *minimum* needed to make the editing decision in front of her. The full canonical (description, origin notes, flavor tags, all photos at full size, network-visible tasting notes) lives in the drawer, one tap away.

Footer (sticky on mobile, inline on desktop): Cancel left · Save right per CLAUDE.md.

### Bronze placement
- Focused input ring (low-opacity bronze)
- "View Adrian's full canonical content" arrow on hover
- "Suggest an edit" arrow on hover
- Save button when changes are unsaved

One bronze active at a time per visual cluster.

### Where "Suggest an edit" lives
Single text-link at the bottom of the form, above the footer: "Suggest an edit to Adrian's canonical →" — opens Surface 5 (compose, designed in Session 2).

### States
- **First time after carry:** prefilled stock + price from carry flow; store note empty; canonical photos shown. Save disabled until change.
- **Below-canonical retail (>5% below after FX):** Surface 4 warning appears as the inline footnote beneath the price field, replacing the suggested-price line.
- **Canonical content changed since last view:** quiet inline line at top of page (above the title, no banner): "Adrian updated this tea's description on 22 April."
- **Profile archived by curator:** inline italic at top of page: "Adrian has archived this tea. Your listing still works; new customers won't find it in the network catalog."
- **Suggestion accepted that conflicts with her store note:** inline italic at top: "Adrian accepted your description suggestion. Your store note may now be redundant. Review it →"

### Interaction
- Stock/price autosave on blur with inline "saved · 14:32" in tertiary type
- Store note has explicit Save (it's prose, not a number)
- Photo upload: drag-drop with grain texture; immediate crossfade-in on success; "Replace" and "Remove" on hover
- "Hide on my storefront" on canonical photo: dims to 30%, link flips to "Show on my storefront"
- Tap "View Adrian's full canonical content" → drawer (desktop) / sheet (mobile)
- Tap "Suggest an edit" → Surface 5 compose

### Why this works on mobile
Canonical is never below the fold — every comparison she needs is right next to the field she's editing. The full canonical detail is one tap, in a familiar drawer pattern she already knows from Surface 1. The form is genuinely the same on phone and laptop, only horizontal margin changes.

---

## Surface 3 — Trust tier display

### The job
Partner sees her own trust tier and effective wholesale margin. Honest, quiet, non-negotiable surface.

### Placement
In account settings, under Account Profile section, before Currency / Timezone block.

### Layout
Single typographic line, not a card, not a callout:

```
TRUST TIER
Verified · Adrian's wholesale to you defaults to 45% of his retail.
```

- 11px metadata uppercase label "TRUST TIER" (one of the rare uppercase usages allowed)
- Body line in regular type
- "Verified" in display serif as soft emphasis
- "45%" in mono

Below in 12px italic body, dim:

```
Trust tier is set by Adrian. It applies to teas you carry from the network
and adjusts the default wholesale margin you pay. Per-tea overrides take
precedence when set.
```

### States
- **Tier changed since last visit:** quiet line at bottom: "Adrian set you to Verified on 14 April." No celebration.
- **Account suspended:** trust tier line replaced by M&A suspended banner.
- **Tea Master:** wording adjusts to "TEA MASTER · default wholesale 48%." (No separate Tier label — Tea Master is the tier.)

### What's deliberately not here
- No upgrade button
- No application form
- No "Request promotion" link
- No badge

The tier is given, not earned through the UI.

---

## Surface 4 — Pricing-discipline warning

### The job
When partner sets retail below canonical (after FX, beyond 5% tolerance), surface a soft, prose warning. Never blocks. Never red. Educates.

### Placement
Inline beneath price field on listing edit page (Surface 2). Appears on blur / save.

### Visual
Three-line italic body in tertiary color. No icon, no border, no background.

```
This price is 12% below Teajia's canonical retail of AUD 290 (after FX).
Customers who follow both stores may notice. You can keep this price —
it's your shop, but the difference is worth seeing.
```

- Percentage and canonical price in mono
- "It's your shop" in italic
- Tone: knowledgeable friend, not compliance

### Triggering
Server returns `warnings: ['below_canonical_retail']` on `PUT /api/listings/:id` with payload `{ canonical_retail, your_retail, gap_pct, fx_at_check }`. UI renders only when present. 5% tolerance band.

### Placement on the listing edit page
The warning **replaces** the inline canonical-context footnote under the price field (the "Adrian's retail · IDR 2.4M / ≈ AUD 290 suggested" line) when triggered. Keeps the form rhythm intact — same slot, different prose.

### States
- **Within 5%:** no warning. Silence is success.
- **Significantly below (>20%):** same warning text, tone never sharpens. Editorial control lives in words, not in policing.
- **FX recently volatile (canonical moved 10%+):** different prose: "Adrian's retail changed recently. Your price is now 18% below Teajia retail — possibly worth a look."

### Why this works
- Warning by prose, not by alert chrome
- "It's your shop" preserves autonomy
- Matches the M&A brief's "diary entries, not Stripe events" pattern
- No red, no icon, no urgent design pattern

---

# Session 2 — Editorial governance

How canonical content evolves: partners suggest changes by editing the card directly; curators review and accept; brand-new teas get adopted into the network. No standalone compose surface, no rationale fields, no editing modes that take you to a different page.

## Surface 5 — Card-as-editor (inline canonical editing)

### The job
Jesse spots "Fukden" in Silver Needle's origin field. He fixes it in place on the listing card and saves. Adrian sees a one-tap accept in his queue. No form, no destination change, no prose justification — the change speaks for itself.

Same pattern at any scale: one-character typos through full description rewrites all happen on the card, in the card.

### The mental model
The listing edit page (Surface 2) and the canonical detail drawer (opened from Surface 1's catalog browse) both surface canonical content. For users with editorial permission on that canonical curator's account, every canonical text element becomes editable in place. Visually the card looks identical — same type, same spacing, same prose. The affordance lives on hover (cursor change + low-opacity bronze underline). On commit, footer commerce buttons swap to editorial actions in the same slots. No new sections appear, no panels open, no rationale field surfaces.

### Permission gating
Edit affordance visibility:

| Viewer | Sees affordance? | On commit |
|---|---|---|
| Curator on own canonical (Adrian on Bali profile, Mei Lin on her originated profile) | Yes, always | Writes straight to canonical, no review queue |
| Partner with `Catalog` bundle, viewing other curator's canonical (Jesse on Silver Needle) | Yes | Goes to that curator's review queue (Surface 6) |
| Member without `Catalog` bundle | No | n/a |
| Customer / Guest | No | n/a |

The affordance is the same everywhere; the commit semantics differ by relationship. The button text on commit is the only visual signal of which kind of save this is — see "Footer button swap" below.

### Editable canonical fields
- Tea name
- Description
- Origin
- Varietal
- Harvest year
- Photos (suggest a new photo, hide a canonical photo for own storefront only)

NOT editable on the card:
- Flavor tags (live in tasting)
- Mood tags (live in tasting)
- Stock, price, store note, listing photos (these are listing-level, edited on the listing portion of the page per Surface 2)

### Affordance behavior

**Resting state:** canonical text renders identically to non-editor users. No icons, no edit pencils, no chrome.

**Hover state (editor users only):** the canonical text element gets a low-opacity bronze underline. Cursor changes to text-edit. A small "edit" hint appears as a 11px tertiary line *only on first three sessions per user*, then withdraws — discoverability decays as the user learns the affordance.

**Active state (clicked):** the text element becomes a contenteditable region with a soft bronze focus ring. Type to edit. Tab moves to the next editable canonical field. Shift+tab moves back. Escape exits the field, reverting changes.

**Footer button swap:** the moment any canonical field enters active state, the card's footer commerce buttons (grams selector + Add to cart, or whatever this card's commerce footer normally shows) cross-fade in place to editorial actions. Identical position, identical rhythm, different language:

```
Before edit (commerce):
[ 50g  ▾ ]   Add to cart       Request basket

After first edit interaction (editorial — partner):
[ Cancel ]   Save proposed edits

After first edit interaction (editorial — curator on own):
[ Cancel ]   Save canonical
```

The button text is the entire signal that the commit will go to a review queue (partner) vs write through (curator). No banner, no warning, no "This will be reviewed" prose. The text says what will happen. Editorial calm.

**Multiple fields edited at once:** all changes within a session bundle into one suggestion when committed. The footer buttons commit the entire bundle. Cancel discards all in-flight edits with a quiet inline tertiary line at top of the card: "3 changes discarded." Visible for 5 seconds, dismissible.

**Photo changes:** photo region gets a "Suggest a photo" text-link that opens an inline file picker. Selected file appears immediately as a proposed-photo thumb with a "Remove" link. Hide-canonical-photo (own-storefront only, not a canonical change) is the existing behavior from Surface 2 and stays separate from canonical edits — it doesn't trigger the editor footer swap.

### States
- **First time hovering a canonical field:** "edit hint" appears once per session for first three sessions: small italic tertiary line under the card, "Tap any of Adrian's content to propose a change." Then withdraws permanently for that user.
- **Edit committed (partner, goes to queue):** footer reverts to commerce buttons. Inline tertiary line at top of card: "Sent to Adrian. He'll respond on his time." Visible 5 seconds.
- **Edit committed (curator, writes through):** footer reverts. Inline tertiary line: "Canonical updated." Visible 5 seconds.
- **Concurrent edit conflict (someone else committed an overlapping change while editing):** on Save attempt, inline italic at top of card: "This field's canonical changed since you started editing. Refresh to see the new value, then re-apply your change if it still applies." Doesn't block — partner can override and let Adrian sort it out.
- **Network error on save:** inline italic at top: "Couldn't reach the server. Your edit is held locally — try Save again when you're back online." Local edit persists in browser storage.
- **Already-pending suggestion on this profile from same partner:** when partner enters edit, inline tertiary line at top: "You have one pending suggestion on this tea from 14 April." No block — they can layer another.

### Why this works
- Card never restructures — only the footer buttons change language
- No mode toggle, no compose page, no "where am I"
- Editorial calm: the change is the argument, no rationale field
- Discoverability is on-hover for those with permission, invisible for those without
- Mobile and desktop behave identically — the contenteditable + footer swap pattern works at any width
- Curator vs partner is signaled by button text, not by chrome

### What this replaces from earlier drafts
- The standalone "Suggest an edit" compose page (deleted)
- The "+Add another change" field-picker workflow (deleted)
- The lightweight "Tell Adrian about a factual issue" form (deleted — typos are just card edits)
- Editor-mode-in-tasting (deleted — tasting stays sacred)

---

## Surface 6 — Suggestion review (Adrian's queue)

### The job
Adrian opens his suggestions queue and sees pending edits from partners. Each is one or more canonical field changes. He accepts or rejects each field. Accepted changes apply to canonical immediately; rejected changes get an optional note sent back to the partner.

### Layout
Lives at `/admin/network` under the **Suggestions** tab. Two-pane on desktop (queue left, detail right), single-column on mobile.

**Queue pane (320px on desktop):**

Wine-list rhythm. Each pending bundle is one entry:

```
─────────────────────────────────────────
Silver Needle Fuding 2024
Jesse · Teajia Australia · 22 April

description, origin
─────────────────────────────────────────
Tie Guan Yin Anxi 2023
Mei Lin · Tea Master · 18 April

harvest year
─────────────────────────────────────────
```

- Tea name in display serif
- Suggester attribution in 12px tertiary (name · account · date)
- Field-list snippet in 11px tertiary metadata, comma-separated, listing which canonical fields the bundle proposes to change

No rationale snippet (none was captured). The fields-changed line is the entire preview.

Top of queue: count line in body italic — "Three pending suggestions across two partners."

Empty state: italic body, "No pending suggestions. Quiet right now."

**Detail pane (right on desktop, full screen on mobile):**

Header:
- Display heading: "Silver Needle Fuding 2024"
- 12px tertiary: "Suggested by Jesse · Teajia Australia · 22 April"

Then proposed changes, one block per field, hairline-separated:

```
─────────────────────────────────────────
DESCRIPTION

Current
"Silver Needle Fuding 2024 is a delicate white tea from Fujian's
oldest white-tea region. Sweet, gentle, with notes of honey and
warm stone."

Proposed
"Silver Needle Fuding 2024 is a delicate white tea from Fujian's
oldest white-tea region. Sweet, gentle, with honey and a clear note
of stonefruit — peach more than melon — that opens after the second
infusion."

Diff (toggle to see word-level)

Optional note to Jesse (shown if you reject)
[                                                                  ]

  Reject     Accept
─────────────────────────────────────────
ORIGIN

Current      Fukden
Proposed     Fujian

  Reject     Accept
─────────────────────────────────────────
```

Each field reviewable independently. Accept and Reject are text-links, not buttons. Bronze on Accept hover, neutral on Reject hover. Once decided, the block transitions:

```
─────────────────────────────────────────
DESCRIPTION   accepted

Current       [...]
Proposed      [...]
                                          Undo
─────────────────────────────────────────
```

The "accepted" / "rejected" label appears in body italic, tertiary color, next to the field name. "Undo" reverses the decision until the bundle is finalized.

**Diff view** is a toggle, off by default. When on, the proposed text shows insertions in bronze underline and deletions in dim strikethrough, inline within the prose. Word-level, not character-level (character is too noisy on prose).

**Bottom of detail pane:**

After all field decisions are made, a single primary action appears:

```
Apply 1 accepted change. Send Jesse the rejection note above for the other.

                                          Cancel    Apply
```

Body sentence, not a button label. Apply commits all decisions in one go: accepted fields update canonical, rejection notes sent back to partner, listing notifications fire if any of partner's store_notes overrode an accepted field.

### States
- **Empty queue:** "No pending suggestions. Quiet right now." in italic body.
- **All decisions made:** Apply enabled.
- **No decisions made yet:** Apply reads "Make decisions above" in tertiary, disabled.
- **Mixed accepted + rejected:** Apply prose adjusts to describe what will happen.
- **All accepted:** "Apply 2 accepted changes."
- **All rejected:** "Send rejection notes to Jesse without changing canonical."
- **Suggester withdrew while reviewing:** banner at top of detail: "Jesse withdrew this suggestion at 15:02. Your decisions won't apply."
- **Conflict (canonical changed since suggestion sent):** affected field shows italic: "This field's current value changed since the suggestion was sent. Your accept will overwrite the new value."

### Interaction
- Per-field Accept/Reject toggle inline with crossfade
- Optional note text input expands inline beneath Reject when reject is chosen
- Diff view toggle persists per session (localStorage)
- Apply prompts inline: "Confirm: apply 1 accepted, send 1 rejection?" with Confirm/Cancel; clicking Confirm commits

### Why this works
- Wine-list queue, editorial detail — same vocabulary as M&A roster + editor sheet
- No rationale to read — the change is the argument
- Per-field decisions match Decision 3 (Option C suggestion model)
- "Send Jesse the rejection note" names the human, not the system
- No red, no checkmark icons, no success toasts

---

## Surface 7 — Adoption queue

### The job
Mei Lin (Tea Master) tasted a tea she sources locally — a wild-growing oolong from a friend's mountain plot in northern Thailand. She originated the profile in her own account. She thinks it belongs in the Teajia network. She flagged it for adoption. Adrian opens his adoption queue, sees what's pending, decides which profiles to canonicalize network-wide.

This is the rarest curatorial action — adoption transfers `curated_by` to Teajia and the profile becomes available in everyone's catalog browse. It should feel weighty.

### Layout
Lives at `/admin/network` under the **Adoption** tab. Same two-pane / single-column-mobile pattern as Suggestion review.

**Queue pane:**

Same wine-list rhythm. Each pending adoption is one entry:

```
─────────────────────────────────────────
Wild Mountain Oolong · Doi Tung 2025
Mei Lin · Tea Master · 14 April

originator note: "limited harvest, grower is a friend"
─────────────────────────────────────────
```

The note is the one piece of prose context Mei Lin wrote when flagging — kept because adoption is a different kind of decision from a typo fix. New tea entering the network catalog warrants a sentence of context. (This is the only place a "rationale" field exists in the editorial flow, and it's optional even here.)

**Detail pane:**

Header:
- Display heading: "Wild Mountain Oolong · Doi Tung 2025"
- 12px tertiary: "Originated by Mei Lin · Tea Master · 14 April"

Then the partner's full proposed canonical content, presented as if it were already a network profile:

```
ORIGINATOR NOTE
"limited harvest, grower is a friend, happy to share my tasting
notes with anyone who carries it"

DESCRIPTION
[full description as prose]

ORIGIN
Doi Tung, Chiang Rai, Thailand · 2025 spring harvest

VARIETAL
Wild-growing assamica hybrid, ~60 year old trees

PHOTOS
[ thumb ] [ thumb ] [ thumb ]   (tap to enlarge)

MEI LIN'S TASTING NOTES (network-visible)
[2 tasting entries shown, dated]
```

Read-only. This is Adrian deciding whether to adopt the content as-is. He can't edit before adopting in the first version — if he wants changes, he declines and asks her to revise. (Future consideration: edit-on-adopt flow.)

Note: flavor and mood tags are absent from this view because they live in tasting, not on canonical. The tasting notes section below shows what flavors and moods Mei Lin actually captured during her tastings.

### Decision

At the bottom of the detail:

```
─────────────────────────────────────────
Adopt this tea into the Teajia network?

Curation will transfer to you. Mei Lin remains the originator,
attributed permanently. The profile becomes available in every
partner's catalog browse.

Optional note to Mei Lin
[                                                                  ]

           Decline           Adopt
─────────────────────────────────────────
```

Adopt is the primary text-link, bronze on hover. Decline is neutral.

Decline always requires a note ("A reason helps Mei Lin"). Adopt without a note is fine.

### States
- **Empty queue:** "No pending adoptions. Partners haven't flagged anything new." in italic.
- **Adopt confirms inline:** "Confirm: adopt Wild Mountain Oolong into the Teajia network. Curation transfers to you, Mei Lin stays as originator." Confirm/Cancel.
- **Decline confirms inline:** "Send decline note to Mei Lin?" Confirm/Cancel.
- **Profile updated by originator since flagging:** banner: "Mei Lin updated the description on 18 April after flagging. The current canonical above reflects her latest." Adrian still adopts the current state.
- **Originator withdrew flag:** entry disappears from queue with a quiet log line in audit ("Mei Lin withdrew her network adoption request").

### Interaction
- Same rhythm as Suggestion review: text-link decisions, inline confirmations, no modals, no toasts
- After adopt: redirect to the now-canonicalized profile with inline message: "Wild Mountain Oolong is now in the network catalog. Mei Lin attributed as originator." Mei Lin receives a notification.

### Why this works
- Same queue rhythm as suggestions (they're both pending partner decisions)
- Detail pane reads like a curatorial portfolio, not a form
- Adopt language names the social act (curation transfers, originator preserved)
- The weight of the decision lives in the prose, not in red/green buttons or alarming chrome

---

# Session 3 — Wholesale flow

How partners order stock from suppliers (typically Adrian). Two surfaces: order draft (buyer building it) and order timeline (both sides watching it move). Wholesale is transactional but the design stays editorial — orders are a relationship, not a checkout.

## Surface 8 — Wholesale order draft

### The job
Jesse builds an order: picks teas from Adrian's catalog, sets quantities, reviews totals in AUD with margin math visible, adds shipping address, sends. Saves and resumes are first-class. Reads as an invoice draft, not a shopping cart.

### Where it lives
`/admin/network` under the **Wholesale** tab. "Start a new order →" text-link at top creates a draft. Each draft has its own URL: `/admin/network/wholesale/[order-id]`. URL-shareable so Jesse can come back, send the link to a manager, etc.

### Layout

Single column at all breakpoints, max-width ~640px on desktop, full width on mobile.

**Header:**

```
WHOLESALE ORDER · DRAFT
Started 22 April · Last saved 14:32

Supplier   Adrian · Teajia Bali
Buyer      You · Teajia Australia
```

Status word ("DRAFT") in display serif. People-first attribution — names of people, then account names. Body type.

**Line items section.** Each item is a row, no card chrome:

```
─────────────────────────────────────────
Silver Needle Fuding 2024
Fujian · 福鼎白茶 · spring single bud

Wholesale  IDR 1,080,000/100g (45% · verified)
           ≈ AUD 132/100g at today's FX

Quantity   [____] g
Line       AUD 0.00

                                          Remove
─────────────────────────────────────────
+ Add a tea
```

- Tea name in display serif
- Origin line in body 14px secondary
- Wholesale block: IDR canonical wholesale first, AUD conversion second (italic tertiary). Both mono. Percentage + trust tier in parens echoes Surface 1's catalog browse vocabulary.
- Quantity input in mono, accepts grams. On blur, line total recalculates.
- Line total in mono 14px.
- "Remove" as text-link.

**"+ Add a tea"** opens an inline picker scoped to teas Jesse already carries (most wholesale orders restock existing inventory). Secondary text-link "Add a tea I don't yet carry →" opens the full catalog browse, and selecting from there pre-fills listing creation if he commits to the order.

**Shipping section:**

```
─────────────────────────────────────────
SHIPPING TO

[ Multi-line address, prefilled from account profile ]

Override for this order   [text-link, expands inline]
─────────────────────────────────────────
```

Address as prose, body type. "Override for this order" expands inline (pop-up event addresses, friend's house, etc.).

**Notes to supplier:**

```
─────────────────────────────────────────
NOTE TO ADRIAN

[ Optional textarea, body italic placeholder: "Anything Adrian
  should know? Timing, packaging, sample requests." ]
─────────────────────────────────────────
```

Body serif (Lora). Where the relationship breathes.

**Totals block:**

```
─────────────────────────────────────────
SUBTOTAL                              AUD 0.00
SHIPPING                  Estimated by Adrian on confirm
                                      —
TOTAL                                 AUD 0.00 + shipping

Currency snapshot: 1 IDR = 0.00012 AUD as of 22 April 14:32.
This rate is locked when you submit. Adrian's confirmation
keeps it.
─────────────────────────────────────────
```

Quiet typographic block, mono numerics, em-spaces over borders. Currency-snapshot line in 11px tertiary italic — explicit about FX locking up front.

**Footer:**

```
                          Save draft    Submit to Adrian
```

Save draft left (escape per CLAUDE.md), Submit right. Submit disabled until ≥1 nonzero quantity AND non-empty shipping address.

### Bronze placement
- Focused input rings on quantity
- "Submit to Adrian" arrow on hover when enabled
- One bronze active at a time

### States
- **Empty draft:** no items, "+ Add a tea" link, totals show "—". Submit disabled.
- **One line, zero quantity:** Submit disabled with tertiary line: "Set a quantity above to submit."
- **FX rate stale (>24h):** italic above totals: "Currency rate is from yesterday. Refresh to lock today's rate." with "Refresh →" text-link.
- **FX unavailable:** wholesale shown in IDR only. Italic line: "AUD conversion paused. Submit at your discretion; Adrian will confirm in IDR." Submit still works.
- **Already-pending order to same supplier:** banner-line at top: "You have one pending order with Adrian from 18 April. He hasn't confirmed yet." No block.
- **Insufficient supplier stock on a line:** italic under that line: "Adrian has 280g of Silver Needle. Reduce or split." Submit blocked on the line OR allow inline tertiary "OK to partial fulfill" checkbox (input ships now, partial-fulfill flow is future consideration).
- **Network error on save:** italic at top: "Couldn't reach the server. Your draft is held locally."
- **Submitted:** route transitions to timeline view (Surface 9). Inline message: "Sent to Adrian. He'll review and respond." No toast.

### Interaction
- Quantity autosaves on blur with inline tertiary "Saved · 14:32"
- Notes textarea autosaves debounced
- Address override expands/collapses inline
- Submit prompts inline: "Submit this order to Adrian for AUD 590 + shipping?" Confirm/Cancel

### Why this works
- Reads as an invoice draft, not a shopping cart
- Pricing transparency front and center: percentages, FX, snapshot rule
- "Note to Adrian" names the human; field is generous
- Editorial calm in a transactional flow
- No coupons, promo codes, upsells, related-products

---

## Surface 9 — Wholesale order timeline

### The job
After submission, both buyer and supplier see this view. It's the order's record from draft to receipt — current status, next expected action, full event history. Both act when it's their turn.

### Where it lives
`/admin/network/wholesale/[order-id]`. Same URL as the draft — the page transitions to timeline view once submitted.

### Layout

Single column at all breakpoints. Top half is current state; bottom half is timeline.

**Header:**

```
WHOLESALE ORDER · CONFIRMED
Submitted 22 April · Confirmed 23 April

Supplier   Adrian · Teajia Bali
Buyer      Jesse · Teajia Australia
```

Status word in display serif. Status IS the heading.

**Current state block** — most prominent thing on the page:

```
Adrian confirmed your order on 23 April. He'll ship within
the week and update with tracking when it goes out.
```

Body serif, ~17px, no card chrome. The answer to "what's happening?" One sentence per status, written for the viewer.

**Status sentences:**

| Status | Buyer's view | Supplier's view |
|---|---|---|
| submitted | You sent this to Adrian on 22 April. Awaiting his confirmation. | Jesse sent this on 22 April. Confirm or reply with adjustments. |
| replied | Adrian replied with adjustments on 23 April. Review his note and resubmit. | You replied with adjustments on 23 April. Awaiting Jesse's response. |
| confirmed | Adrian confirmed your order on 23 April. He'll ship within the week and update with tracking when it goes out. | You confirmed Jesse's order on 23 April. Ship when ready and add tracking. |
| shipped | Adrian shipped your order on 26 April with [carrier]. Tracking: [#]. | You marked this shipped on 26 April. Jesse will mark received when it arrives. |
| received | You marked this received on 4 May. Stock is in your inventory. | Jesse marked this received on 4 May. Closed. |
| cancelled | Cancelled on [date] by [actor]. Reason: [note] | Same |

Diary-entry register. Same vocabulary as M&A audit log.

**Action area** — appears only when viewer can act:

For Adrian on a confirmed order:
```
─────────────────────────────────────────
Update tracking

Carrier        [____]
Tracking #     [____]
Notes          [____ optional ____]

                                          Mark as shipped
─────────────────────────────────────────
```

For Jesse on a shipped order:
```
─────────────────────────────────────────
Mark as received when it arrives.

Optional note  [____]

                                          Mark as received
─────────────────────────────────────────
```

When viewer has no available action, the area is absent. Empty space says "informed, not blocked."

**Order summary** — always visible:

```
─────────────────────────────────────────
SILVER NEEDLE FUDING 2024     400 g     AUD 528.00
TIE GUAN YIN ANXI 2023        200 g     AUD 117.00

SUBTOTAL                                 AUD 645.00
SHIPPING (added on confirm)              AUD 65.00
TOTAL                                    AUD 710.00

Currency snapshot at submission: 1 IDR = 0.00012 AUD.
─────────────────────────────────────────
```

Mono numerics. Read-only.

**Address block** — read-only display below summary.

**Note to supplier (Jesse's, if any)** — quoted body italic.

**Supplier's confirmation note (Adrian's, if any)** — quoted body italic, attributed.

**Timeline:**

```
─────────────────────────────────────────
TIMELINE

26 April · 09:14
Adrian shipped this with Pos Indonesia. Tracking JT9482-AU.
"Packed with extra care since the Silver Needle is fragile."

23 April · 11:02
Adrian confirmed. Shipping estimated AUD 65.
"All in stock. Will pack tomorrow morning."

22 April · 14:38
Jesse submitted this order. AUD 645.00 + shipping.
"For our autumn opening on 12 May."
─────────────────────────────────────────
```

Reverse chronological. Each entry: mono timestamp, body sentence, optional quoted italic note. No icons, no colored dots, no progress bars.

**Invoice references (once received):**

```
─────────────────────────────────────────
INVOICES

Adrian's outgoing invoice    TJB-00073    Open →
Your incoming invoice        TJA-00018    Open →
─────────────────────────────────────────
```

Mono invoice numbers. Each row is a text-link to that account's invoice page.

### Bronze placement
- Action area button on hover
- Tracking-number input ring when focused
- "Open →" on invoice reference hover

One bronze active.

### States
- **Submitted, awaiting supplier:** buyer sees current-state + summary + timeline, no action. Supplier sees same plus confirm action area.
- **Replied (supplier asked for adjustments):** current-state sentence describes; buyer's action area is "Edit and resubmit →" returning to draft route with supplier's reply quoted at top.
- **Confirmed:** supplier's action area is tracking + ship. Buyer has no action.
- **Shipped:** buyer's action area is mark-as-received. Supplier has no action.
- **Received:** both see closed state; no action area; invoices at bottom.
- **Cancelled:** action area absent; current-state describes; timeline logs the cancel event.
- **Stuck — submitted >7 days, no confirm:** buyer view gets quiet italic under current state: "It's been 7 days. You can nudge Adrian or cancel and start over." Two text-links: "Send a nudge →" (notification, no status change) and "Cancel order →" (confirm inline first).
- **Stuck — confirmed >14 days, no ship:** symmetric line for supplier: "It's been 14 days since you confirmed. Ship when ready, or update Jesse with a note."
- **Cancellable states:** draft, submitted, confirmed. After ship, parties coordinate by note rather than cancel.

### Interaction
- Action submissions confirm inline before transition: "Confirm: mark as shipped with tracking JT9482-AU?" Confirm/Cancel.
- Tracking number, once added, becomes a text-link to carrier's tracking page (carrier-specific URL templates, fall back to plain text).
- Notes appear in timeline immediately, no toast.
- Status transitions log to platform_audit_log as `wholesale.<status>` events.

### Authorization
- Buyer + their Members with `Sell` bundle: read order, mark received
- Supplier + their Members with `Sell` bundle: read order, confirm, ship, cancel
- Platform tier (Adrian on platform hat): read all wholesale orders network-wide (separate platform-only Wholesale tab in `/admin/network` Platform view, future consideration)

### Why this works
- One sentence answers "what's happening?" at the top
- Diary-entry timeline matches M&A audit log register
- No progress-bar chrome, no status pills, no dashboard tropes
- Empty action area is the signal that it's the other party's turn
- Stuck states surface gentle nudges, not alerts
- Same URL throughout — bookmark, comeback, share all work

---

# Session 4 — Storefront surfaces

Two customer-facing surfaces: the Tea Master storefront (categorically different from a Location storefront), and the discovery fallback empty state (when a local search has no results).

## Surface 10 — Tea Master storefront

### The job
A Tea Master storefront reads as **someone's personal practice that happens to sell tea**, not as a tea shop with a person attached. Same listing/cart/checkout machinery as a Location storefront; different composition is the entire difference.

### Where it lives
Same route shape as Location storefronts: `teajia.com/store/[slug]`. Server detects `accounts.kind = 'master'` and renders this surface instead.

### Layout

Long, vertical, generous. Single column at all breakpoints. Editorial pacing — reward slow scrolling.

**Practitioner header:**

```
                      [ Mei Lin's photo, square, ~280px ]

                              MEI LIN

                      Practicing tea since 2014
                      Currently in Berlin

                  "I taste tea slowly. Most of what I carry
                   is small-harvest and limited. If you find
                   something you like, ask before it's gone."
```

- Name in display serif, large (44px desktop, 32px mobile)
- Practice years + current city in body 14px secondary, comma-separated
- Personal statement in body italic with quotation marks, multi-line. Editable in admin like a bio.

No tagline, no slogan, no "About" link. The introduction IS the top of the page.

**The shelf — one section per tea:**

Not a grid. Not a card list. Each tea gets a small editorial spread.

```
─────────────────────────────────────────

[ tea photo, full width, ~16:9 letterbox ]

SILVER NEEDLE FUDING 2024
Sourced from Adrian · Teajia Bali

Mei Lin's note
"This is the tea I've come back to most often this winter.
It opens slowly — give it three infusions before you decide.
There's a quietness to it that takes a moment to notice."

Adrian's canonical description
[Body italic, dimmed. Default canonical description.]

50g · €38      100g · €72      Inquire about smaller portions

                                          Add to cart →

─────────────────────────────────────────
```

- Photo at top: her listing photo if uploaded, otherwise canonical
- Tea name in display serif
- Provenance line in 11px tertiary: "Sourced from [supplier name] · [their store]" OR "Sourced by Mei Lin" if she originated it
- **Mei Lin's note** (her store_note from the listing model) in body serif (Lora), generous — the most prominent prose. Her voice headlines.
- **Canonical description** in body italic, dimmed — present but secondary. Both readable; her voice wins by weight.
- Prices as quiet typographic offerings, not e-commerce stock indicators. Reads as portion options.
- "Inquire about smaller portions" → WhatsApp pre-filled with tea name (existing checkout pattern)
- "Add to cart" as text-link with arrow on hover. Bronze on hover. One bronze per section.

Sections separated by hairlines and ~96px vertical space.

If she carries 5 teas, 5 sections. If 30, the page is long. **That's intentional.** A grid would commodity the curation.

**Recent tastings section:**

```
─────────────────────────────────────────

RECENT TASTINGS

22 April · Silver Needle Fuding 2024
"Late afternoon, alone, slightly cold. Three infusions in
glass. Lighter than last time. The honey came forward only
on the third pour."

15 April · Tie Guan Yin Anxi 2023
[snippet body italic]

                                          Read more tastings →

─────────────────────────────────────────
```

Wine-list rhythm. Mono date, tea name as smooth-scroll text-link to that tea's section above, snippet body italic. "Read more tastings" → her full tasting archive at `/store/[slug]/tastings` (future surface, out of scope here).

This section is the second-strongest signal that this is a practice, not a shop.

**Events (if any):**

Same pattern as Location storefront events. Absent if she doesn't host — no "no upcoming events" placeholder.

**Footer:**

```
─────────────────────────────────────────

You can reach Mei Lin on WhatsApp.
She replies when she can — usually the same week.

WhatsApp →    Email →

Part of the Teajia network · find a table →
```

No newsletter signup. No social links. Network attribution at the very bottom, small.

### Bronze placement
- Per shelf section: "Add to cart" arrow on hover (one per section)
- WhatsApp link in footer on hover
- Tea name in tasting snippet on hover

### Cart and checkout
Reuses existing public cart + WhatsApp inquiry. Same flow, but routed to the Tea Master's WhatsApp number. Stock decrements on her listing.

### States
- **No teas yet (newly invited Tea Master):** practitioner header shows; shelf section replaced by italic body: "Mei Lin is setting her shelf. Check back soon, or send her a note." Tastings/events sections present only if content exists.
- **One tea:** still a full section; page is short but correct.
- **All out of stock:** each section appears with portion prices replaced by italic: "Currently between harvests. Ask Mei Lin if you'd like to be told when this returns." Add to cart replaced by "Inquire →" → WhatsApp.
- **Account suspended:** entire storefront becomes 410-style page: italic body, "This storefront is paused. Mei Lin will be back. In the meantime, find another table →" with `/find-a-table` link.
- **Tea Master who only originates:** provenance line reads "Sourced by Mei Lin"; no canonical description below her note (she IS the canonical authority).
- **Carries Adrian-archived teas:** section still appears with normal provenance and canonical description. Her choice to keep carrying is respected.

### Mobile
Same single-column layout. Practitioner photo ~200px, name ~32px. Each shelf section is a vertical stack with full-width photo on top, prose below. Reads like an editorial Instagram-feed sequence — appropriate since most followers discover via phone links.

### Why this works
- Practitioner header puts the human first; the shop is a consequence
- One section per tea (no grid) treats each tea as worthy of attention
- Her store_note headlines, canonical secondary
- Tastings section is the second proof-of-practice signal
- Quiet contact footer — no growth hacking, no newsletter capture, no social CTAs
- WhatsApp checkout reuses existing pattern
- Stock-out preserves dignity — "between harvests," not "sold out"

### What this is NOT
- Not a Location storefront with the grid swapped for a list
- Not a blog, portfolio, Instagram, or Substack
- An editorial home for a tea practitioner who happens to sell what she's drinking

---

## Surface 11 — Discovery fallback empty state

### The job
A customer searches a storefront for a tea it doesn't carry. Instead of a hostile empty state, surface the nearest network store(s) carrying it. Single-line referral per the rollout plan.

### Where it lives
Inline in the search results area on any storefront when local results are zero. Not a separate page.

### Layout

When local results return zero:

```
                Teajia Australia doesn't carry shou puerh
                            right now.

              Adrian carries this at Teajia Bali →
              Mei Lin carries this in Berlin →

                  Or browse the full network →
```

- Top line: body italic, slightly dimmed, ~17px. Names what's missing in plain prose.
- Referral lines: max 3 shown. Format: "[name] carries this at [store name] →" or "[name] carries this in [city] →" (use city when store name would be redundant). Text-link to that storefront's product detail page directly. Bronze on hover.
- Footer line: 12px tertiary text-link to `/find-a-table`.
- Generous vertical space around the block — let it breathe.

When zero network stores carry it either:

```
                Teajia Australia doesn't carry shou puerh
                            right now.

              No store on the Teajia network currently
              carries this either. Try a related search,
              or browse the network →
```

### Resolution rules
Endpoint returns profile_id matches for the search term where any account has a `network_visible=1, status='published', is_public=1` listing. Sorted by:
1. Currently in stock (stock_grams > 0) first
2. Closest geographically to the customer (viewing storefront's location as proxy, or browser geolocation if granted)
3. Most recently restocked

Top 3 returned. Customer doesn't see the sort logic, just the result.

### Linking
Tapping a referral takes the customer directly to that store's product detail page (`teajia.com/store/teajia-bali/silver-needle-fuding-2024` style). Not to the store's home page, not to a generic search. Customer was looking for shou puerh — deliver them to shou puerh.

The receiving storefront handles its own context (you-are-now-on-X) per Phase 1A behavior.

### States
- **One referral, same city as starting storefront:** show the single line; don't pad with "browse network" link (would feel redundant).
- **Two referrals in different cities:** both, then network directory link.
- **Three referrals:** all three, then network directory link.
- **>3 matching network stores:** top 3, then "+ N other stores carry this →" text-link to filtered directory (`/find-a-table?carries=shou-puerh` — small future enhancement; basic version links to `/find-a-table` unfiltered).
- **Network directory unreachable:** suppress referrals, fall back to plain "Nothing matches your search at Teajia Australia."
- **Search returned local results:** this surface doesn't show.

### Bronze placement
Referral lines get bronze on hover. One bronze per cluster, multiple lines can each hover-bronze independently (only one at a time, naturally).

### Why this works
- Plain prose says what's missing without apologizing
- Single-line referrals are quiet, not urgent
- Customer routed directly to the tea, not to another search
- "Browse the network" respects autonomy without pushing
- No restock email capture, no upsells, no algorithmic recommendations

### What this is NOT
- Not a recommendations engine
- Not a "47 alternatives" dump
- Not an email capture
- Not a cross-sell to in-stock teas

The job: honor the customer's intent and route them to it elsewhere on the network. Anything beyond that turns this surface into the hostile UI the brand explicitly rejects.

---

# Brief complete

Sessions 1–4 designed. Eleven surfaces specified at implementation depth. Shared vocabulary at the top of this document governs every surface; each surface specifies layout, states, interactions, mobile behavior, and rationale.

This brief is the source of truth for UI work in Steps 1–6 of NETWORK_ROLLOUT_PLAN.md. When implementing any of these surfaces, read both this brief and the relevant step section in the rollout plan.

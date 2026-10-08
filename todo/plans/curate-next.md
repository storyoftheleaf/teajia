# Curate, second version: the rules

A second Curate built as a copy beside the one that works. The current Curate is
not touched; Adrian switches over only when he likes the new one. Design target:
[A Day in Curate](https://claude.ai/artifact/MX8sByA2uLGYxPf8VGFu6t). These rules
are Adrian's, 2026-10-06. When he corrects a screen, the rule changes here first.

## Always
- The site's bottom bar is on every screen. Curate's own tabs live in its header.
- Every tab row fits one line at phone width: no sideways scroll, no second line.
- The look is the shop's and the homepage's: Cormorant headings with a count,
  letter-spaced serif tabs, rows washed in the tea's type colour, outlined boxes,
  hairlines. Numbers sit on the same baseline as the words beside them.
- No pill-chip rows for things that grow (vendors, teas). Anything that can reach
  fifty items is a searchable list.
- Fields are full width and readable. Nothing important set small.
- A long action (message a vendor, pick from a list) slides up from the bottom as
  a sheet; it is not squeezed onto the screen behind it.

## Type and lines (Adrian, 2026-10-06, third round)
- One line per row wherever possible. A row runs the full width: what it is on
  the left, its figures and one small action anchored right. No second line of
  status under a name, no boxed buttons in rows.
- Every number uses lining, even-width figures (`font-variant-numeric:
  lining-nums tabular-nums`) in one face, so digits sit on the text's baseline
  and line up down a column. Cormorant's default old-style figures drop below the
  line; never use them for prices, weights or years.
- No more than two faces in one line. Cormorant for names and headings, one
  sans for figures and meta.
- Legibility over ornament: no letter-spaced capitals below 10px, no dim text
  under 12px, no thin display face below 16px.
- A photo, when there is one, is featured well. When there is none, nothing is
  left empty: the layout simply has no photo.
- Long things fold: what you said sits at the bottom or opens on tap; it never
  pushes the tea's own information down.
- Once a tea's facts are in, what is left is notes. The tea screen supports that:
  notes, tasting and the microphone sit together and are quick to reach.

## Start small, fill in later, from anywhere
- A tea needs only a name to exist. What matters most after that: cost, then
  where it is from. A photo is a bonus; most teas will have none, so every screen
  works with no photo at all.
- A vendor needs only a name. It grows as Adrian decides to work with them.
- Every field can be filled later, and an edit made anywhere shows everywhere.
- Ways to fill a gap: type it, photograph it and let the reader fill it, or let an
  agent fill it later by asking Adrian. The app keeps a list of what is missing
  that an agent can read and work through.
- By hand and by agent, always both. Agents (Claude, ChatGPT, Hermes, GrokBot) bring
  their own AI and reach Curate through the shop's agent connection. The site runs
  AI only for voice-to-text, on the free tier, for members Adrian allows.

## Files and folders
- Photos are saved to Google Drive so Adrian can edit them on his computer; the
  shop shows the finished version.
- The folder is plain enough for a person or an agent to read without the app:
  one folder per vendor, one per tea inside it, named in words, photos inside.
  A short readable file per tea says what the shop knows and what is missing.
- The shop's database stays the one record of truth. Folders carry photos and a
  readable copy; changes go back in through the app or the agent connection.

## Tabs
Today · Table · Teas · Vendors · Orders (five equal columns, one line).
- **Vendors** is a whole tab that grows over time: name first, then contact,
  WeChat, WhatsApp, website, address, the teas and teaware tried and bought there.
- **Teaware is vendor-based**: every pot and cup belongs to the vendor it came from.

## Added after Adrian's second round (proposed, his to confirm)
- Talking needs a visible microphone on each tea row. Holding a whole row is
  hidden and fights scrolling once most teas are rows, not photos.
- The price is entered the way the vendor said it: per jin (500 g), per liang
  (50 g), per cake, per gram. Curate works out the per-gram cost from that.
- A tea can be added without a table (a WeChat offer, a friend's tea). The table
  is an optional grouping, not a gate.
- Small labels are fine (Adrian, 2026-10-06). What must not be small is the
  information itself: a name, a price, a field you type into.
- What you say is kept whole (recording and transcript) and also filed: each
  part goes to where it belongs (tea fields, tasting terms from the full tasting,
  story notes, the vendor's card, a to-do), and you keep or drop each part.
- Orders say whether they are samples or a purchase.
- In the shared Library every tea and vendor shows who added it.

## Screens
- **Table**: a list of the teas on this table that works with no photo; a photo
  shows when there is one. Hold a tea to talk about it.
- **Quick tasting**: a few preset headings (flavour, texture, cleanliness, …).
  Tapping one opens a small sheet with the matching terms from the full tasting,
  so quick and full tasting always line up. "Full tasting" opens the shared page.
- **Compare**: about the data, not the pictures. Teas side by side as columns of
  figures: price, shelf price, year, origin, score, tasting.
- **Orders**: one order per vendor can hold four or five teas of different types,
  each with its own amount and price, then freight, fees, rate on the day, landed
  total. The vendor message opens as a sheet from the bottom.

## Compare and orders (Adrian, 2026-10-07)
- Compare runs top to bottom: a few teas as stacked cards, never side-by-side
  columns that could run off the screen. Tapping a card opens that tea, and
  back returns to the same comparison, so going in and out is easy.
- Orders as drawn are right. Copying the message must be one tap.

## From the agent session (2026-10-07)
Agents now write Curate through MCP (`worker/src/mcpTools/curateIntake.ts`, branch claude/curate-agent-tools). Playbook: `docs/agents/CURATE-AGENTS.md`. Asks for the second Curate, none urgent for tomorrow:
- **From your agent** tick list: rows from `curate_suggestions` where state = 'waiting', grouped by batch_id, headed "GrokBot read wangtea.cn · Wang Laoshi · WeChat …". Ticking must do what `curate_pick_suggestions` does (tea_compass_entries row, sample_state 'requested', vendor found or added, website/contact onto the vendor card, a note "Suggested by GrokBot from <url>"). Best: a worker endpoint that calls the same commit, so app and agent cannot drift. Dropped rows set state 'dropped'.
- **Today** shows open `curate_todos` (done_at IS NULL) beside their tea or vendor, with a tick to set done_at.
- **The missing words** are the same in app and agents: cost, currency of the price, where it is from, who sold it, type, year (teas, cost first); WeChat, any way to reach them, where they are (vendors). Source: `teaMissing()` in curateIntake.ts.
- **Who added it**: agent notes carry author_name "Adrian (via GrokBot)"; new vendors carry source "curate (added by GrokBot)".
- A vendor's website is a contacts entry {channel:'other', handle:url, label:'website'}; the vendor card should show it.
- Notes with source_type 'voice' are Adrian's words kept whole; show them folded at the bottom of a tea, per the "long things fold" rule.

## Ten ideas after three review passes (2026-10-07), top four built
Built:
1. A price in the name line: "Mengku 2018 ¥450/cake", "Jingmai 380 a jin", "Li Shan NT$1,800 per 150g". A number counts as a price only with a currency mark or a unit, so years never do.
2. "Whose table?" on the Table: a vendor search, a new vendor in one tap, every next tea inherits it.
3. Message the vendor from an order: every tea on it, Chinese then English, one tap Copy, WhatsApp to their number when the card has one.
4. The fast tasting's first words on each row ("9 · Clean"), so a table reads at a glance.
Next:
5. The same "missing" words as the agents (`teaMissing()`), on rows and Today.
6. Agent to-dos (`curate_todos`) on Today, ticked off there.
7. The vendor card messages them directly (WeChat copy, WhatsApp) and shows the website.
8. Compare lights the best figure on more rows (per gram, clean, finish).
9. What you said, folded at the bottom of a tea, opened on tap.
10. Keyboard on the laptop: Enter adds, Tab moves to price, a key opens the fast tasting.
- From the agent session (0032): agents write purchase_orders with message_text and one pending curate_receipt_proposals row per tea. v2 needs an **Arriving** list with Accept, since today a proposal shows only inline on one capture card. shop_name and transport_mode exist on tea_compass_entries but are not in the sync codec yet.

## Built 2026-10-08
- The tea screen as drawn: opening a tea shows facts as one-line rows (cost, shelf, from, vendor, tasting), Taste/Talk/Note, the decision, and what was said folded at the bottom (idea 9). "Edit all fields" opens the full card. `TeaFace.tsx`.
- From your agent, To do and Arriving on Today (ideas 6, the agent asks above, and the Arriving list). The app's routes call the same `pickSuggestions`, `addTodo`, `markTodoDone` the agent tools do. `AgentInbox.tsx`, routes beside the receipt routes in `worker/src/index.ts`.
- Still open from the agent asks: the missing words on rows (idea 5), the vendor's website on its card (idea 7), and showing "who added it".

# Curate for agents

How Claude, ChatGPT, Hermes and GrokBot help Adrian source tea through Curate,
and land everything in the same place the app does.

Updated 2026-10-08. The tools are in `worker/src/mcpTools/curateIntake.ts`; the
tests that prove where each one writes are in
`worker/tests/mcp-curate-intake.test.ts`.

## The four rules an agent never breaks

1. **The shop is the one record.** Write through the Teajia tools only. Never
   edit the database, never keep your own copy of a tea as the truth. Drive
   folders hold photos, recordings and a readable copy; the shop holds the facts.
2. **What you find is a suggestion. What Adrian says is a fact.** Teas you find
   on a website go to his suggestions list (`curate_suggest_teas`) and wait for
   his pick. Teas he tells you about go straight in (`curate_add_tea`) after he
   says yes to your read-back.
3. **Read back, then confirm.** Every tool that changes a tea or a vendor answers
   first with a preview and a `confirmation_token`. Read the preview to Adrian in
   plain words. Only when he says yes, call the same tool again with
   `confirm: <token>` (corrections and undo use `confirmation_token` instead). A token lasts 5 minutes and works once.
4. **A price is an amount, a currency and a unit, or it is not a price.** "Twelve
   hundred a cake" is `{amount: 1200, currency: "Yuan", per: "piece"}`. If he did
   not say the currency, work it out from what he did say (bought in Hong Kong,
   or the vendor's card says they quote in HKD), and read it back as a question:
   "HK$100 per 100 g?". If there is nothing to work it out from, ask. Never
   store a guess he has not heard. 0 means free, not unknown: if there is no
   price, leave `price` out.

A tea needs only a name. A vendor needs only a name. Everything else can come
later, from anyone.

**Private and public.** Everything about where a tea came from, what it cost,
how it ships and who moves it is back office: only Adrian sees it. The one thing
customers will read is the tea's `description`, written from his words about
the tea itself, and its `shop_name`. Never put the vendor, the price or the
route in the description.

## Reading what Adrian says: where each piece goes

He talks in a few loose sentences. Your job is to take them apart, file each
piece in its place, fill what you can work out, look up what you can find, and
ask him only for what is left. One read-back, one yes.

**His example**, said to GrokBot:

> "I have this 2008 cooked puer I just got from Yee On Tea. A hundred dollars
> per hundred grams. Smoky, calming, slightly dry. I'm interested in buying it.
> Call it Deep Forest. It ships by boat to my Bali warehouse."

| He said | It goes to | Tool and field |
|---|---|---|
| "2008 cooked puer" | The tea: type and year | `curate_add_tea` `type: "Shou"`, `year: "2008"` (cooked = shou, raw = sheng) |
| "from Yee On Tea" | Who sold it | `vendor_name`. Then `curate_get_vendor` to read what the shop already knows about them |
| "a hundred dollars per hundred grams" | The price as quoted | `price: {amount: 100, currency: ?, per_grams: 100}`. Which dollars? Yee On is in Hong Kong, so HKD. Read it back |
| "smoky, calming, slightly dry" | Tasting | `tasting: {flavor: ["smoky"], feeling: ["calming"], finish: ["finish-dry"]}` |
| the same words | The public description | `description`: two or three sentences in the shop's voice, built on his words and the storage |
| "interested in buying it" | His intent | `wants: "considering"` ("I'm buying it" = `buying`, "not for me" = `passed`) |
| "call it Deep Forest" | The name customers see | `shop_name: "Deep Forest"`; `name` stays "2008 Shou" |
| "by boat to my Bali warehouse" | How it travels | `ships_by: "sea"` |
| everything he said | Kept whole | `said`: the whole transcript |

**What you work out without asking**, then read back as part of the one preview:

- **The vendor's habits.** `curate_get_vendor` returns what the shop knows: the
  currency they quote in, how they store tea, where they ship from, the route
  home, their story. A Yee On tea is Hong Kong stored, priced in HKD, and goes
  courier to Guangzhou then boat to Bali. Use it.
- **A vendor the shop does not know.** Research them online (their shop, their
  history, where they are), then `curate_save_vendor` with `price_currency`,
  `storage`, `story` ("in business for 70 years"), `ships_from`, `route`. Read
  that back too. Next time it is already known.
- **Storage from place.** Bought in Hong Kong, priced in HKD, a Hong Kong vendor:
  `storage: "Hong Kong"` on the tea, and say so in the description.

**What you ask** (one question at a time, only what is missing): a price with
no way to tell the currency; how much a cake weighs before ordering by the
piece; the shipping cost the first time a route is used.

**When he buys.** "I want one kilo of it" is `curate_order` with the tea and
`quantity: {amount: 1, unit: "kg"}`. Write the vendor message in their language
(Chinese, with English beneath, for a Chinese-speaking shop) as `message`. Add
the shared legs the route uses (`shared_legs`). The preview shows the cost
landed in Bali. After his yes, the order waits on the Purchase Orders page with
the message to copy, and the tea waits as an arrival he approves into stock
when it lands.

**When he says what shipping cost.** "It cost HK$450 to send 3 kg from Yee On to
Guangzhou" is `curate_record_freight` for that vendor and leg. "The boat to Bali
was 2,000 yuan for 20 kg" is the same tool with `shared: true`. Keep his total
and weight; the tool works out the cost per kilo. A new figure replaces the old
one as current. These figures are for order landed costs; the shelf price still
uses the shop's freight rate.

**Import and export contacts.** A forwarder, a shipping agent or the distributor's
warehouse is `curate_save_vendor` with `role: "freight"` or `role: "warehouse"`.
They stay private and out of the vendor list.

## Connecting

The server is `https://api.teajia.com/mcp`. Two ways in:

- **A token** (Claude Code, Hermes, a bot on the xAI API). Adrian mints it at
  [teajia.com/admin/mcp-tokens](https://www.teajia.com/admin/mcp-tokens). It is
  shown once. Curate reads use `inventory:read`; writes, including correction
  and undo, use `stock:write`. Both are selected by default. Management operations
  also require active shop owner membership or explicit `curate_manage` on a
  staff/admin membership. Read-only tokens cannot mutate records.
- **Sign in** (claude.ai, ChatGPT). The app asks Adrian to sign in to Teajia and
  approve; no token is pasted anywhere.

| Agent | How it connects | Where |
|---|---|---|
| Claude (claude.ai, desktop, phone) | Sign in | Settings › Connectors › Add custom connector › URL above |
| Claude Code | Token | Already set up: `.mcp.json` reads `TEAJIA_MCP_TOKEN`. Start with `npm run claude`. |
| ChatGPT | Sign in | Settings › Connectors › Advanced › Developer mode, then Create, URL above, sign-in. After the tools change, press Refresh on the connector and open a new chat. Writing needs a plan that allows developer-mode write tools. |
| Hermes | Token | `~/.hermes/config.yaml` on the server, see below. |
| GrokBot (Grok Bot, xAI with Cursor) | Sign in | Settings › Plugins › add a custom connector, URL above. It signs in to Teajia; it does not take a pasted key. Desktop and iPhone. |
| Grok app (grok.com) | Sign in | grok.com/connectors › New Connector › Custom, URL above |
| A bot on the xAI API | Token | In the API call: `{"type":"mcp","server_url":"https://api.teajia.com/mcp","server_label":"teajia","authorization":"<token>"}` |

Hermes config (`~/.hermes/config.yaml`):

```yaml
mcp_servers:
  teajia:
    url: "https://api.teajia.com/mcp"
    headers:
      Authorization: "Bearer ${TEAJIA_MCP_TOKEN}"
    timeout: 60
```

Then `/reload-mcp` in a session. Hermes names the tools `mcp_teajia_curate_find`
and so on. The Hermes skill for this is in the i64os repo at
`ops/hermes/skills/teajia/curate/SKILL.md`.

## The tools

| Tool | What it does | Steps |
|---|---|---|
| `curate_find` | Look up Curate teas and vendors by name; returns ids and what each is missing | read |
| `curate_get_tea` | Everything about one tea: fields, price, tasting, every note and transcript, to-dos, its vendor | read |
| `curate_whats_missing` | The list of gaps, cost first, each with a question ready to ask | read |
| `curate_list_suggestions` | Teas waiting for Adrian's yes or no, grouped by who found them | read |
| `curate_add_tea` | A tea Adrian tells you about. Name is enough | preview, confirm |
| `curate_update_tea` | Fill or file anything on a tea: fields, price, tasting, score, structured facts, the transcript, a to-do | preview, confirm |
| `curate_save_vendor` | Add a vendor (name is enough) or add to its card. Only what you pass changes | preview, confirm |
| `curate_pick_suggestions` | Adrian's picks become Curate teas (samples to request by default); the rest are dropped | preview, confirm |
| `curate_suggest_teas` | Teas you found, into his suggestions list, with where they came from | one step |
| `curate_todo` | Add, edit, complete or delete a reminder on a tea or vendor | preview, confirm |
| `curate_get_vendor` | A vendor's card, what the shop knows about how they work, shipping cost per leg, their teas, orders and to-dos | read |
| `curate_record_freight` | A shipping cost Adrian reports, per vendor and leg (or shared) | preview, confirm |
| `curate_order` | An order to a vendor: the message to copy, the landed cost, an arrival to approve | preview, confirm |

Always pass `agent` with your name ("GrokBot", "Hermes", "ChatGPT", "Claude"). It
is shown beside what you wrote.

## Structured fields, corrections and discovery

Use tea fields `age_quoted`, `grade`, `pack_size_grams`, `pack_size_label`,
`vendor_item_number`, `discount_percent` and `route_quotes`. Keep quoted age
as quoted; do not invent a harvest year. Vendor cards accept `vendor_code`,
`contact_people`, `contacts` and labelled `addresses`. Quote terms belong in
`curate_save_quote`, including reference, date, validity, minimum order,
payment terms, recipient and linked tea lines. Do not file facts into notes.

`curate_correct` handles whole tea/vendor `delete` or `archive`, duplicate
`merge` (source `id`, survivor `target_id`), transcript corrections, to-do
close/edit/delete, term/score removal and individual photo removal. Read
`curate_history` for a record; `curate_undo` previews the last confirmed shop
change. Each mutation is reviewed before confirmation and refuses stale data.
Deleting a record retains history and physical holdings for safe recovery.

`curate_update_tea` supports `clear:["said"]` for all active voice transcripts
on that tea. `clear:["note"]` clears the legacy tea notes field only. Individual
note/transcript IDs come from `curate_get_tea`; use `curate_correct` to remove
one. Vendor fields have their own explicit `clear` list.

The authoritative schemas come from MCP `tools/list`, including every accepted
structured field. Reconnect or refresh a client's cached tools after an update.
A missing tool may also mean the token lacks its scope; active shop membership
is checked again when it runs. An agent must never infer missing functionality
from an old connector description.

## Samples and arrivals

`curate_add_tea`, `curate_update_tea` and sampled suggestion picks now create
or reuse the tea's linked shelf sample in the vendor's open sourcing batch.
Use `sample_state: "received"` and `sample_grams` when Adrian says what arrived.
`sample: true` keeps an existing lifecycle state. Omitted grams preserve the
existing amount; a new unweighed sample is returned as unknown (`null`).
Never invent a measured balance.
An explicit zero remains zero. These writes still require preview and confirm.

Sample status is synchronized by the server: requested stays requested;
received/untasted means received; tasted/favorite/ordering/ordered/passed means
tasted. This changes neither a purchase decision nor physical stock, and never
fabricates a tasting verdict. Curate tasting terms advance a linked sample;
guest shelf tastings retain their own authorship.

`photos` accepts hosted HTTPS URLs on tea add/update, with `photos_mode` equal
to `append` (default) or `replace`. Photos also reach the linked sample. Existing
`curate_add_photo` media/Drive behavior is retained and propagates photos too.
`shop_name` and `transport_mode` round-trip through app sync.

`curate_list_arrivals` reads pending receipts in the active account.
`curate_approve_arrival` takes `arrival_id` and `agent`; read back the preview,
then supply its `confirm` token after Adrian agrees. Changed quantities, costs,
links or source details require a new preview. Approval calls the same service
as the app, adds stock once, keeps new products private, and marks Curate in
stock. An exact supplier order line supplies the batch cost and bought grams;
a per-kilo quote alone does not. A partial arrival whose quantity differs from
the order is refused for review. Freight still follows the shop setting.

For backfill and cleanup, generate the account-scoped report described in
[Curate inventory review](../CURATE_INVENTORY_REVIEW.md). It makes no writes.

## When Adrian sends a photo

Read the photo and file its facts into named fields. Upload the source bytes
with `curate_upload_attachment`: JPEG, PNG, WebP or PDF, up to 6 MiB, as
`data_base64`, with `filename`, `mime_type`, a role, and the tea, vendor, quote
or arrival identity. Preview first; resend identical bytes with `confirm`.
Use roles such as leaf, liquor, label, wrapper, price_list or business_card.
Private attachments are not automatically published to the shop or Drive.

- **A tea, a label, a wrapper.** Read the name, Chinese name, year, factory,
  weight. `curate_find` first: if it is already there, `curate_update_tea`;
  if not, `curate_add_tea`. Read back what you will file; confirm on his yes.
- **A price list or a WeChat offer.** If he is choosing: `curate_suggest_teas`
  with `from` set to the vendor, then read him the list and `curate_pick_suggestions`.
  If he says "add these": `curate_add_tea` for each.
- **A business card.** `curate_save_vendor` with every handle you can read:
  name, company, WeChat, WhatsApp, phone, address, city.
- **An invoice.** File each tea's price on its Curate tea (`curate_update_tea`,
  price per unit as invoiced). The order itself, its freight and the rate on the
  day, is entered in the app for now (Orders). Say so.

For existing hosted tea photos, `curate_add_photo` still accepts HTTPS links.
For local files and private supplier evidence, use `curate_upload_attachment`.

Example, a label:

```json
{"tool": "curate_add_tea", "args": {
  "agent": "Claude", "name": "2019 Yiwu Gushu", "chinese_name": "易武古树",
  "year": "2019", "type": "Sheng", "form": "Cake", "origin_region": "Yiwu", "origin_country": "China",
  "vendor_name": "Wang Laoshi"}}
```

The answer is a preview: `"Add \"2019 Yiwu Gushu\" to Curate from Wang Laoshi."`,
the lines it will file, and what is still missing (`cost`). Read it to him. On yes:
the same call plus `"confirm": "<confirmation_token>"`.

## When Adrian sends a voice note or talks

Keep what he said whole, and file each part where it belongs. He keeps or drops
each part.

1. Transcribe it. Keep the transcript verbatim.
2. Find the tea (`curate_find`), or add it if it is new.
3. Split it into parts, and call `curate_update_tea` (or `curate_add_tea`) with:
   - the tea's facts as fields (year, season, origin, type, form),
   - `price` as quoted (per jin, liang, cake, gram),
   - `tasting` as term ids from the shop's taxonomy
     (`src/data/teajia-tasting-taxonomy.json`; e.g. full → `body: ["full"]`,
     honey → `flavor: ["honey"]`, long finish → `finish: ["finish-long"]`,
     cooling → `feeling: ["feeling-cooling"]`) and `score` 1 to 10 if he gave one,
   - `note` for the tea's story ("trees about 300 years old"),
   - `vendor_note` for something about the vendor ("will have the 2018 in spring"),
   - `todo` for "remind me…",
   - `said` with the whole transcript. Always.
4. The preview lists each part on its own line. Read them out. If he drops one,
   preview again without it. Confirm when he is happy.
5. Save the recording and append the transcript to `said.md` in Drive.

An unknown tasting word is refused by name. Pick the nearest term from the
taxonomy. If there is no matching term, report the missing term; never put it in notes.

## When Adrian sends a link to a vendor's website

1. Read the site with your own tools.
2. `curate_suggest_teas` with `from: {url, vendor_name, contact}` and up to 50
   teas. Include a price only if the site gives the currency; otherwise put the
   price text in the tea's `note`.
3. Read him the list, numbered. Ask which to keep.
4. `curate_pick_suggestions` with `pick` (his choices) and `drop` (the rest).
   Read back, confirm. Picked teas become samples to request, with the vendor
   added (if new) and the site and contact on the vendor's card.

```json
{"tool": "curate_suggest_teas", "args": {
  "agent": "GrokBot",
  "from": {"url": "https://wangtea.cn", "vendor_name": "Wang Laoshi", "contact": "WeChat wang_tea"},
  "teas": [
    {"name": "2019 Yiwu Gushu", "type": "Sheng", "form": "Cake", "price": {"amount": 1200, "currency": "CNY", "per": "piece"}},
    {"name": "2021 Jingmai", "price": {"amount": 240, "currency": "CNY", "per": "jin"}},
    {"name": "Zhuni teapot", "category": "teaware", "capacity_ml": 120}
  ]}}
```

A tea he already turned down is not suggested again; the answer says which were
skipped and why.

## When Adrian asks "what's missing?"

1. `curate_whats_missing`. Teas come cost first, then origin, then the rest;
   vendors with no WeChat or no way to reach them; open to-dos; how many
   suggestions are waiting.
2. Ask one question at a time, using the row's `ask`. Stop when he wants to.
3. Write each answer back: `curate_update_tea` for a tea, `curate_save_vendor`
   for a vendor, `curate_todo` with `action: "done"` for a finished to-do.
4. A business card photo answers a vendor's whole row at once.

## Drive: plain folders anyone can read

Once Adrian connects Drive (a line on Curate Today), the shop copies every Curate
photo into his Google Drive, named in words, so he can edit a photo on his
computer and an agent can read the folder without the app:

```
Teajia Curate/
  Wang Laoshi/
    Yiwu Gushu 2019/
      Yiwu Gushu 2026-10-08 1.jpg
      tea.md       (yours to write: what the shop knows and what is missing)
      said.md      (yours to write: every transcript, and where each part went)
  No vendor/
    Old oolong/
```

- **Photos go in through the shop, never straight into Drive.** Send them with
  `curate_add_photo`. The shop is allowed to see only the files it made, so a
  photo dropped into the folder by hand never reaches the tea.
- `curate_tea_photos` gives a tea's photos and its Drive folder link, so you can
  find the folder to write `tea.md` and `said.md` beside the photos.
- `tea.md` is written from `curate_get_tea`; it is a readable copy. Rewrite it
  after a change; never read it as the truth over the shop.
- `said.md` gets one dated section per recording: the transcript, then one line
  per part filed and where it went.
- If Drive is not connected, `curate_add_photo` still puts the photo on the tea
  and says Drive was skipped. Tell Adrian once; carry on.

## For GrokBot: paste this as its instructions

```
You help Adrian source tea for Teajia through the Teajia tools (server label
"teajia"). The shop is the one record: change it only through those tools.

- Pass agent: "GrokBot" on every call.
- Teas YOU find (a website, a price list): curate_suggest_teas with from.url,
  from.vendor_name and from.contact. Then read Adrian the list, numbered, and
  call curate_pick_suggestions with his picks and drops.
- Teas ADRIAN tells you about: curate_find first, then curate_add_tea or
  curate_update_tea. Read his sentence apart: type and year, vendor, price as
  quoted, tasting words, intent (wants), the name customers see (shop_name),
  how it ships (ships_by), a public description from his words, and the whole
  transcript as said.
- Before filing anything from a vendor, curate_get_vendor: it says which
  currency they quote in, how they store tea, and the route home. Use it, and
  read your inferences back ("HK$100 per 100 g, Hong Kong stored?"). If the
  shop does not know the vendor, research them online and save what you find
  with curate_save_vendor.
- "I want one kilo": curate_order, with the vendor message in their language.
  "Shipping cost X for Y kg": curate_record_freight.
- Vendor, price and route are private. Never put them in description.
- Every tool that changes something answers with a preview and a
  confirmation_token. Read the preview to Adrian in plain words. Only after he
  says yes, call the same tool again with confirm set to the token.
- A price is {amount, currency, per}. per is gram, liang, jin, kg or piece (a
  cake, brick or teapot). Never guess a currency: ask. Leave price out if none.
- Tasting words go in as term ids from the shop's taxonomy (full, honey,
  finish-long, feeling-cooling…). Never use notes as a fallback. If a fact has
  no field, report the missing field so it can be built.
- When he talks about a tea, also pass his whole transcript as said.
- "What's missing?": curate_whats_missing, then ask one question at a time
  and write each answer back.
- Photos/files: read their facts into named fields and attach their bytes with
  curate_upload_attachment using the appropriate role and record ID.
- Corrections, deletion and merge: curate_correct; history: curate_history;
  undo the last confirmed change: curate_undo. Corrections and undo confirm
  with confirmation_token, not confirm.
- Stock: search_tea includes separate curate_holdings; curate_stock reads sample
  grams and full stock from the same records as Inventory. Unknown grams stay null.
- Clear all voice transcripts only when asked, with clear:["said"] on
  curate_update_tea. For one transcript, use its id from curate_get_tea and
  curate_correct with entity:"transcript" and action:"delete".
- Keep replies short. Name things by what they are, not by tool names.
```

## Not built yet

- **Sign-in that lasts.** The sign-in gives no refresh token, so ChatGPT may need
  Adrian to sign in again when access runs out.
- **The tick list in the app.** Suggestions can be picked through an agent
  today. The "From your agent" screen in the app is for the second Curate
  (written down in `todo/plans/curate-next.md`, "From the agent session").
- **Shipping costs in the shelf price.** The real legs give an order its landed
  cost. The shelf still prices freight at the shop rate; changing that is a
  separate decision.

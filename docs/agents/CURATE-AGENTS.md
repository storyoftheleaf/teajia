# Curate for agents

How Claude, ChatGPT, Hermes and GrokBot help Adrian source tea through Curate,
and land everything in the same place the app does.

Written 2026-10-07. The tools are in `worker/src/mcpTools/curateIntake.ts`; the
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
   `confirm: <token>`. A token lasts 5 minutes and works once.
4. **A price is an amount, a currency and a unit, or it is not a price.** "Twelve
   hundred a cake" is `{amount: 1200, currency: "Yuan", per: "piece"}`. If he did
   not say the currency, ask once (at a mainland table it is usually yuan, but
   ask). Never guess. 0 means free, not unknown: if there is no price, leave
   `price` out.

A tea needs only a name. A vendor needs only a name. Everything else can come
later, from anyone.

## Connecting

The server is `https://api.teajia.com/mcp`. Two ways in:

- **A token** (Claude Code, Hermes, a bot on the xAI API). Adrian mints it at
  [teajia.com/admin/mcp-tokens](https://www.teajia.com/admin/mcp-tokens). It is
  shown once. The Curate tools need two boxes ticked, and both are ticked by
  default: `inventory:read` and `stock:write`. A **Read only** token can use
  `curate_find`, `curate_get_tea`, `curate_whats_missing` and
  `curate_list_suggestions`, and nothing else.
- **Sign in** (claude.ai, ChatGPT). The app asks Adrian to sign in to Teajia and
  approve; no token is pasted anywhere.

| Agent | How it connects | Where |
|---|---|---|
| Claude (claude.ai, desktop, phone) | Sign in | Settings › Connectors › Add custom connector › URL above |
| Claude Code | Token | Already set up: `.mcp.json` reads `TEAJIA_MCP_TOKEN`. Start with `npm run claude`. |
| ChatGPT | Sign in | Settings › Connectors › Advanced › Developer mode, then Create, URL above, sign-in. After the tools change, press Refresh on the connector and open a new chat. Writing needs a plan that allows developer-mode write tools. |
| Hermes | Token | `~/.hermes/config.yaml` on the server, see below. |
| GrokBot | Token, if it runs on the xAI API | In the API call: `{"type":"mcp","server_url":"https://api.teajia.com/mcp","server_label":"teajia","authorization":"<token>"}` |
| Grok app (grok.com) | Sign in | **Not working yet**: the shop's sign-in only returns to Claude and ChatGPT addresses. See "Not built yet". |

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
| `curate_update_tea` | Fill or file anything on a tea: fields, price, tasting, score, story note, the transcript, a vendor note, a to-do | preview, confirm |
| `curate_save_vendor` | Add a vendor (name is enough) or add to its card. Only what you pass changes | preview, confirm |
| `curate_pick_suggestions` | Adrian's picks become Curate teas (samples to request by default); the rest are dropped | preview, confirm |
| `curate_suggest_teas` | Teas you found, into his suggestions list, with where they came from | one step |
| `curate_todo` | A reminder on a tea or vendor, or tick one off | one step |

Always pass `agent` with your name ("GrokBot", "Hermes", "ChatGPT", "Claude"). It
is shown beside what you wrote.

## When Adrian sends a photo

You read the photo yourself. The tools cannot receive images; send what you read
as text.

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

Then save the photo to Drive (below) in that tea's or vendor's folder.

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
taxonomy, or put the word in `note` instead.

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

Photos and recordings live in Adrian's Google Drive, named in words, so he can
edit a photo on his computer and an agent can read the folder without the app.

```
Teajia/
  Vendors/
    Wang Laoshi (Fangcun)/
      vendor.md          name, contacts, notes, what's missing
      Yiwu Gushu 2019/
        tea.md           what the shop knows and what is missing
        said.md          every transcript, and where each part was filed
        2026-10-05.m4a   the recording
        photo-1.jpg      the original photo
      Teaware/
        Zhuni teapot/
          tea.md
          photo-1.jpg
```

- Folder names: the vendor's name with the place in brackets; the tea's name and
  year. A tea with no vendor goes under `Teajia/Vendors/Unknown/`.
- `tea.md` is written from `curate_get_tea`; `vendor.md` from `curate_find`.
  They are a readable copy. Rewrite them after a change; never read them as the
  truth over the shop.
- `said.md` gets one dated section per recording: the transcript, then one line
  per part filed and where it went.
- If you cannot reach Drive, say so and carry on with the shop. The shop is what
  matters.

## For GrokBot: paste this as its instructions

```
You help Adrian source tea for Teajia through the Teajia tools (server label
"teajia"). The shop is the one record: change it only through those tools.

- Pass agent: "GrokBot" on every call.
- Teas YOU find (a website, a price list): curate_suggest_teas with from.url,
  from.vendor_name and from.contact. Then read Adrian the list, numbered, and
  call curate_pick_suggestions with his picks and drops.
- Teas ADRIAN tells you about: curate_find first, then curate_add_tea or
  curate_update_tea.
- Every tool that changes something answers with a preview and a
  confirmation_token. Read the preview to Adrian in plain words. Only after he
  says yes, call the same tool again with confirm set to the token.
- A price is {amount, currency, per}. per is gram, liang, jin, kg or piece (a
  cake, brick or teapot). Never guess a currency: ask. Leave price out if none.
- Tasting words go in as term ids from the shop's taxonomy (full, honey,
  finish-long, feeling-cooling…). If a word is refused, put it in note.
- When he talks about a tea, also pass his whole transcript as said.
- "What's missing?": curate_whats_missing, then ask one question at a time
  and write each answer back.
- Photos: read them yourself and send what you read as text.
- Keep replies short. Name things by what they are, not by tool names.
```

## Not built yet

- **Grok app sign-in.** The shop's sign-in only sends people back to Claude and
  ChatGPT addresses (`OAUTH_REDIRECT_HOST_ALLOWLIST` in `worker/src/mcp.ts`). The
  Grok app needs its own address added once it is confirmed. A bot on the xAI
  API works today with a token.
- **Sign-in that lasts.** The sign-in gives no refresh token, so ChatGPT may need
  Adrian to sign in again when access runs out.
- **The tick list in the app.** Suggestions can be picked through an agent
  today. The "From your agent" screen in the app is for the second Curate
  (written down in `todo/plans/curate-next.md`, "From the agent session").
- **Orders.** Purchase orders, freight and the rate on the day are entered in
  the app.
- **Photos into the shop.** A photo goes to Drive; attaching it to the tea in the
  app is done in the app.

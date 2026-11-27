# Teajia photo sorting and teaware intake

## 2026-11-23 full sandbox batch result

The locked queue reconciled to 67 groups. The sandbox retained three private drafts (Bai Liang, Inward, and the existing Pot 04 test record), 59 private physical-review results with per-group reasons, and five sold exclusions. All 62 active groups are marked Needs count. Confirmed tea Stock IDs were copied to matching private sandbox fixture rows. Yi-Wu Snow remains a candidate. Unknown costs, counts, and retail prices were left unset for the new drafts.

Bai Liang retained its approved wide and close leaf crops. Inward's crops still await gallery approval, so its written draft has no photos. Pot 04 retained front, base and mark, and alternate. Signed-out product and direct-image checks passed for all three drafts and five stored photos. On the second run, the per-group records and order matched the first run, with zero new drafts, description updates, or photo attachments. The sandbox was stopped and its data retained offline. Nothing was published.

Authoring-only local commit `b6b7e7e0` builds on the one-pot checkpoint. [Per-group results](</Users/adrianrasmussen/.local/share/teajia/sandbox/batch-20261123/WebStore sandbox intake results.md>) and [machine-readable results](</Users/adrianrasmussen/.local/share/teajia/sandbox/batch-20261123/run-2.json>).

## 2026-11-23 private Pot 04 intake result

The Pot 04 intake round trip passed in an isolated offline sandbox using the released storefront revision `1df4333b` as the base. The local authoring checkpoint is `82dbf0b5` on `codex/pot04-private-intake`. It restores the MCP detail tools and attaches draft photos to private storage. The original `3688a63c` branch remains intact. No storefront layout or database migration changed.

- **Saved** in synthetic sandbox Stock record `sandbox-pot04-intake`: Inscribed Hexagonal Teapot, category pot, Hexagonal form, a short description of visible features, and an observation that the incised characters are unread. Clay, material, maker, capacity, condition, and price remained blank.
- **Read back** board photos 007 front, 008 base and mark, 009 alternate. Owner requests returned the exact saved bytes in order and carried `private, no-store`. Each photo denied signed-out GET and HEAD, access from the other sandbox shop, and access through public media paths.
- **Verified** Draft status, zero public flags, no listing on public REST or MCP, and no appearance in the public catalog while a synthetic control proved those surfaces were working. The control and test tokens were removed or revoked afterward. The sandbox Worker was stopped, with the private draft and photos retained locally.
- 43 focused checks passed. The worker typecheck ratchet recorded no new errors. [API check results](</Users/adrianrasmussen/.local/share/teajia/sandbox/pot04-20261123/result.json>). [Final sandbox database check](</Users/adrianrasmussen/.local/share/teajia/sandbox/pot04-20261123/final-state.json>).

The pilot used a sandbox fixture because Pot 04 has no verified real Stock ID. No live Stock changes, photo uploads, listing publication, or deployment took place.

## 2026-11-23 manager checkpoint

The manager confirmed the shared storefront is live at revision `1df4333b`, build `bo9z7faaz`, and accepted the Pot 04 rendering pilot. The remaining engineering dependency is **a private teaware authoring round trip against the current code**. The release projects `teaware_details` to the storefront and already adds its column in migration `0079`. Its MCP registry has the generic `intake_add_items` route with `category: teaware`, but lacks `get_teaware_details`, `update_teaware_details`, and `upload_teaware_photo`. Those tools are preserved on `codex/teaware-photo-handoff` at `3688a63c`. Reconcile the authoring modules and tests with the current branch if assigned. The old checkpoint's migration `0055` adds the same column as `0079` and should be left in the historical checkpoint.

The next local acceptance check is to take one reviewed manifest through scoped preview and confirmation on an exact sandbox Stock ID, then read back the supported facts and ordered gallery. Confirm that the draft and its images remain private throughout, since the checkpoint's dedicated photo tool can create publicly addressable media. The historical tool contracts below describe checkpoint behavior.

[Pot 04's manifest](</Users/adrianrasmussen/Documents/Codex/2026-11-19/i-want-you-to-go-online/outputs/WebStore Pot 04 mapping manifest.json>) still has an unresolved private Stock match. Its rendered ID is synthetic. Add it to real intake only after a verified match or confirmed new-stock record. Physical condition and retail price are open, and acquisition cost and currency are absent if a new purchase record is needed. Pot 04 stays private. No production change or release was requested.

## 2026-11-19 checkpoint

The [Teajia shop chat](codex://threads/01a1f3c3-61b8-72b2-965c-6019563dbbce) owns product rendering, Stock, MCP and publication. [Research AI photo sorting tools](codex://threads/01a1f3c1-ac3e-71e3-9c56-5c67ad4d950a) owns the WebStore album, grouping board, corrections, research and batch preparation. Both chats should use this file as their shared contract. The link between the two is a reviewed group export which carries forward any drag-and-drop corrections.

- Source checkpoint: local branch `codex/teaware-photo-handoff`. The source checkout contained other work. Integrate the checkpoint by commit in a clean checkout when needed. The checkpoint is local and unpublished.
- [Built teaware listing with example data](http://127.0.0.1:7781/shop/product/teaware-preview-siting) and [four-photo example](http://127.0.0.1:7781/shop/product/teaware-preview-sparse). These local development URLs depend on the fixture server. The separate [design reference](http://127.0.0.1:7777/preview/teaware-product/) has only museum photos and simulated intake.
- [WebStore grouping board](</Users/adrianrasmussen/Documents/Codex/2026-11-19/i-want-you-to-go-online/outputs/WebStore grouping board.html>). The research chat is testing the review board. The status of the board's corrections and any export should be checked with that chat before use. Its project directory is outside Teajia.
- Verified locally in the built shop: one through four photos with zoom, full IDR price and selector inside the order box at 320 px, 390 px and desktop, one-piece cart and removal, hidden empty fields, linked suggested teas, linked clay and form, and the pouring and Yixing articles. Focused cart and shop checks passed (49 tests). The teaware MCP tests covered updates and clearing, account scope, concurrent edits, photo upload, and retaining legacy single tea suggestions.
- Migration `worker/migrations/0055_teaware_details.sql` is additive. The live API and storefront still need their coordinated release. The working checkout had a separate transcription type-check error in `worker/src/index.ts`. That unrelated hunk is outside the checkpoint. Live MCP discovery also returned a shared-allowance 503 during an earlier check. Recheck the actual endpoint before attempting live intake.

## Decisions the next chat needs

- Use the existing tea product layout. Teaware shows photos and the one-piece price first, then **About this piece**, **Suggested teas**, and compact optional facts. Two to four photos use the gallery. A single photo shows the full vessel. The currency selector lives inside the order box. Product pages show neither counts nor quantity pickers. One-offs stay at one in the cart.
- **Clay type** means identified material such as Zhuni (朱泥), Duanni (段泥), Zini (紫泥), or a documented blend. Colour may help the research but is not a product fact. Construction includes fully handmade and half handmade. Publish only supported facts or clearly attributed estimates. Age, maker, marks, history, condition, previous use, acquisition place or source, and photos are optional. Acquisition and manufacture are separate. Show capacity only if supplied, as **Approx. 120 ml**.
- Suggested teas can be several types, with an attributed basis in brewing notes. Shop links use recognized tea families. Clay and form link into the Yixing Wisdom article. Observed pouring behavior can include a dribble at the end and links to the pouring article. Keep general clay and form history in Wisdom so it can be reused. Labeled photos of documented clay examples are a possible future addition to that guide.
- The research chat can extract label text, propose the category and name, look up form and clay comparables, and draft most copy. Keep observed, attributed and unknown details distinct. Use acquisition records or Adrian's supplied notes for acquisition and firsthand observations. A still photo cannot establish how a pot pours. Omit unknown fields and avoid inventing measurements, prices, dates or authenticity.

## Shared handoff format

One item in the board becomes one record. The following is the minimum suggested export shape. The research chat can map its existing storage to this rather than rebuilding its board.

| Key | What to hand over |
| --- | --- |
| `group_id` | Stable identifier preserved when a name or membership changes |
| `category`, `working_name` | Tea or teaware and a provisional label |
| `review_state` | Proposed or reviewed. Include unmatched photos and uncertain assignments as explicit exceptions |
| `photos` | Ordered list of stable Photos asset identifiers, local export paths when available, and roles such as main, reverse, lid/interior, base/mark, or tea label/leaf/liquor |
| `stock_match` | Existing Teajia product ID when verified. Otherwise a proposed match and its evidence, or unmatched |
| `evidence` | Relevant label/receipt transcription, source URLs, concise observations and the attribution or confidence of claims |
| `listing_draft` | Proposed public description and only supported fields, including `details.recommended_tea_types` if present |
| `price` | Adrian's approved retail amount and currency if supplied. Keep actual cost and its currency separate if new stock intake needs them |

Export a local file after the board's corrections. Avoid burying the only copy of reviewed groups in browser storage. Keep original images in Photos and keep asset identifiers, source files, receipts and private notes on the Mac. Shop-ready copies use a consistent crop and no private image metadata. Export at most four images per teaware listing. A group can retain more evidence without publishing every image.

## Teajia applied intake

Read [MCP details](../../docs/claude/mcp.md) and [money rules](../../docs/claude/money.md) before writing. Match existing records with account-scoped `search_tea` and exact product ID. Read a teaware match with `get_teaware_details` for its current fields, fixed USD retail and gallery. For a new piece, use the existing `intake_start` → `intake_add_items` (`category: teaware`) → `intake_finalize` draft path when purchase facts and cost support it. A missing acquisition cost stays unresolved. Never enter a made-up zero. Keep listings private until explicitly authorized to publish them.

| Write | How to use it |
| --- | --- |
| Details | Preview `update_teaware_details` with the exact product ID, top-level names/form/material/origin/description/capacity, and the nested optional `details` patch. Confirm with the issued token alone. Omit unknown fields. Explicit `null` clears a field. `recommended_tea_types` is an ordered list. `null` or an empty list clears suggestions. |
| Photos | `upload_teaware_photo` takes a product ID, `slot` set to `main` or `additional`, MIME type and plain base64 bytes. JPEG, PNG or WebP, up to 6 MiB each. Preview, then resend the exact bytes and slot with the token to upload and attach. Existing URL tools can attach already-hosted photos. Check gallery slots and one-to-four order after the write. |
| Price and listing | Use the existing pricing and visibility tools. Price is per piece and the UI converts with shop rates. Confirm details and photos separately from a publication decision. Read back the product and verify saved values. |

The connector is `https://api.teajia.com/mcp`. Account-scoped reads use `inventory:read`. Teaware details and photo writes need owner `catalog:write`. Public MCP is read-only. Use the existing scoped connector or Infisical and keep authorization values out of files and prompts. Test writes against a local fixture or sandbox. A photo attachment confirmation can store the bytes as publicly addressable shop media even when its listing is private.

## First integration test

Take **one approved teapot group** from the WebStore board. Export its reviewed grouping as a small local manifest. Keep any ambiguous image out of the candidate. Match the group to a Stock item or report the unresolved match. Present a draft with the chosen photo order, evidence, one short description and a price only if supplied. Prove that the draft maps cleanly to the MCP patch and photo calls using a local fixture. Retain the exact product ID and source links in the report. Confirm the handoff is useful before running a larger batch.

## Tasting copy for tea listings

- Publish tasting, mouthfeel, and drinking-experience claims only when Adrian has supplied or approved notes for the exact lot. Leave those fields blank for untasted or unverified lots.
- A match to a catalog record or Stock product can establish identity, year, origin, and form. Treat any existing sensory language as unverified until someone confirms it applies to this lot.
- Put style-level aroma context last, after the documented facts and processing. Name the related tea or style and link to the source. Attribute the observed aromas or flavors to the examples or samples in that source. Keep the context separate from the listing’s own tasting or experience fields.


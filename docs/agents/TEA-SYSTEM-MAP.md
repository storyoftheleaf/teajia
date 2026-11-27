# The tea system, end to end

The one map of how a tea moves through Teajia, from the moment Adrian meets it to the moment someone drinks it and comes back. Read this before you change any step, so you know what the step reaches and who owns it. Written 2026-11-27 from the code on `main`, the open pull requests and the day's threads.

Whiteboards for Adrian (same content, drawn):

- [The tea system, end to end](https://claude.ai/artifact/RE2RbTsE1SJAMZoy8UdvhS): this map.
- [Teajia, section by section](https://claude.ai/artifact/VmvoJCULgNWbmerUqiVY5i): the whole site. Each section carries a card to its detailed board.
- Section boards, one per part of the site: [Read](https://claude.ai/artifact/ScMi5emjDXfuChAQDaTjNC), [Tea Table, sessions and people](https://claude.ai/artifact/8TLB9JJKRuU8grsi4KTkVo), [Tea Houses](https://claude.ai/artifact/8t3JqANYy58JP4reJ2kJrc), [Your Table](https://claude.ai/artifact/MySjydyn6bxEfK9D6moVr2). Shop and Manage open this map's board.
- [How people use Teajia](https://claude.ai/artifact/CmADPt5RhNZUerbdmnfQwB): each kind of person, what they touch and do, and where their path is thin.
- [Switch-on tracker](https://claude.ai/artifact/XphiutT5eeqzZAXTZJEYrZ): every switch, open PR and decision that stands between today and the whole site on. Keep its State column true.
- Child boards: [Bringing a tea in](https://claude.ai/artifact/5wWBCaREDvXyoSiCAu4pAf) (steps 1 to 6, the intake plan), [From sample to sent link](https://claude.ai/artifact/Cw9iVkjtje3bjMBcpFeTZf) (steps 2 to 9), [New tea to Tea Wisdom](https://claude.ai/artifact/8N9HcPPeDqHmfUbZbLdT21) (step 7), [Wisdom Review](https://claude.ai/artifact/2MZWE6AFWwCmih1PonbesE) (Adrian's approvals in step 7).

**Keep it true.** When you change a step, its doors or its tools, change its row here and the whiteboard in the same piece of work. When a gap below is closed, move it out of "Missing" and say which PR closed it.

## The short answer

Every step exists and works on its own. What is missing are the joins between steps: a tea can come in without its supplier, approvals and tastings each have several doors, and nothing follows a tea past its write-up to say it still needs a price, a photo, its Tea Wisdom entry or a place in a collection.

## The ten steps

| Step | What happens | Where (screen) | Agent tools | Owner doc | Leads to |
|---|---|---|---|---|---|
| 1 Find it | A tea or sample comes in by talk, photo, paste, typing or an agent | The Library's Bring in sheet (`src/components/curate/BringInSheet.tsx`: "Sample, or bought?" then New tea, New teaware or Import files; Stock's Add tea and the command palette open it with `?bring=1`), Curate Source sheet (with the mic), package scan, Curate Import, Stock Bulk intake (`/admin/intake`), AR Create voice handoff | `curate_add_tea`, `intake_*`, `create_tea` | [CURATE-AGENTS.md](CURATE-AGENTS.md), [curate-intake.md](../claude/curate-intake.md) | 2 |
| 2 The tea card | One card per tea in the Library, grouped by supplier with their face | Manage › Curate › Library (`/admin/compass`, code in `src/components/TeaCompass`; new parts in `src/components/curate/`). The face opens `/admin/vendors/:id` | `curate_get_tea`, `curate_update_tea`, `curate_get_vendor`, `curate_save_vendor` | [CURATE_WORKSPACE.md](../CURATE_WORKSPACE.md) | 3, 4, 6 |
| 3 Taste and decide | Taste it, then Want or Reject | Taste on the card (score, terms, notes); after a tasting of a tea in Stock the Library asks the leaf used and takes it off as a tasting use (`src/components/curate/LeafUsedAfterTasting.tsx`); Stock › Samples (grams used) | `set_tasting`, `curate_update_tea` (`wants`) | [CURATE-AGENTS.md](CURATE-AGENTS.md) | 4 or 6 |
| 4 Buy and bring home | A supplier order or an invoice becomes a purchase on its way | Order shop stock on the card; invoice Import; Purchases (`/admin/purchase-orders`) and Logistics for each leg | `curate_order`, `intake_finalize`, `update_delivery_tracking` | [PURCHASE_LOGISTICS.md](../PURCHASE_LOGISTICS.md), [invoice-intake-flow.md](../invoice-intake-flow.md) | 5 |
| 5 Approve the arrival | Adrian says yes to what came, line by line | Manage delivery on the card, Stock › Received & incoming, Curate › Orders, the Ledger | `record_arrival`, `curate_approve_arrival`, `curate_reject_arrival` | [CURATE-AGENTS.md](CURATE-AGENTS.md) (Agent-led invoices and arrivals) | 6 |
| 6 Add to Stock | A private Stock tea with amount, cost and its currency, and a price | Add to Stock on the card; the card then offers the quote's grams and cost to confirm (`src/components/curate/StockFromQuote.tsx`: a recount, and the cost with its currency); the Stock panel | `curate_promote_tea`, `add_stock`, `update_tea_pricing` | [money.md](../claude/money.md) | 7 |
| 7 Make it public | Main photo, write-up, Tea Wisdom, then shown in the shop | Main photo from the Library photo viewer; Write it up (Stock › Story, `/admin/products/:id/story`); Wisdom Base list on the Stock panel (`WisdomNeedsList`); visibility on Stock. The Tea Wisdom entry comes from the `/tea-wisdom` chain as repo files | `set_tea_image`, `set_tea_visibility`, `/tea-wisdom` | [TEA-WISDOM-AGENTS.md](TEA-WISDOM-AGENTS.md), [PRODUCT_DESCRIPTION_STYLE.md](../PRODUCT_DESCRIPTION_STYLE.md), [TEA_WISDOM_BASE.md](../TEA_WISDOM_BASE.md) | 8 |
| 8 Offer it | The shop page, a priced link, an invoice, or a host's shelf | `/shop/product/:id` (cart, PayPal or WhatsApp); collection link `/c/:slug`, the shop filtered for one person: the shop's own rows inside the shop's nav, marked "chosen for you"; under its head the same row of pictures as an invoice, Keep, Taste, Order (`GuideStep.tsx`; signed out, Keep and Taste go through sign-up showing the teas), and a tea opens with the same strip, Taste, Photo, Keep, under the sender's words; a tea opens in the shop's own tea card with its Wisdom entry, and Add goes to the shop's cart at the link's quoted price, a private tea included (`worker/src/collectionCart.ts`); the shop's checkout makes the invoice (optional free account); anyone signed in sends their saved teas as a collection link from the shop's Saved view or My Collection (`POST /api/me/collections/make`, shop price, the maker's name); Quick invoice from Stock or a person; `/store/:slug` | `create_collection`, `add_tea_to_collection`, `publish_collection`, `prepare_order`, `convert_order_request` | [PILLAR.md](../PILLAR.md) (How a purchase happens) | 9 |
| 9 Paid and sent | The invoice, the pay link, the parcel | Activity › Orders; the pay link with pasted payment details, listing the invoice's teas in the shop's own rows, one row per line, with the total; a tea opens the shop's own tea page (`LinkTeaPage.tsx`), as on the collection link, kept in the address as `?tea=` (`useOpenLinkTea.ts`) and carrying the shop's own order footer when the shop lists it; Wise details show as one slim panel per account, and an owner's accounts in several currencies (Wise USD, Wise IDR) show the one for the page's currency with a switch; under the head, four pictures say what comes next, each a button: Pay, Keep, Taste, Again (`PayInvoiceGuide.tsx`; the words are placeholders); Keep puts the invoice in the buyer's orders, and signed out it goes through sign-up, which shows the teas being kept (`src/lib/keepTeaser.ts`), and finishes by itself on the way back; Taste asks which tea and opens its tasting; a tea of hers opens the shop's page with the one strip that is hers, Taste, Photo and Keep (`YoursStrip.tsx`), and more of it is the shop's own order bar, so the sheet has one list of teas; the collection the invoice came from is linked under the total; the shop that sent it (owner, staff, seller) never saves it and sees "This is your invoice to send" instead, an invoice made out to a customer with an email is saved only by that email, otherwise the first signed-in person, and `release_invoice_keep` gives a wrongly saved invoice back (`POST /api/public/people/:slug/pay-access/keep`, `worker/src/payInvoiceKeep.ts`); dispatch. The buyer sees `/order/:ref` | `update_invoice`, `split_invoice_line`, `release_invoice_keep`, `record_payment`, `mark_invoice_paid`, `fulfill_invoice`, `set_order_tracking` | [SHIPPING_PAYMENT_NOTIFICATIONS.md](../SHIPPING_PAYMENT_NOTIFICATIONS.md) | 10 |
| 10 After the cup | What the buyer keeps, and what comes back | The shop itself marks each tea the signed-in buyer bought ("You bought 150g" on the row, the amount, date and invoice on top of the tea's page in the strip that is hers, with Taste, Photo and Keep, `YoursStrip.tsx`) and Bought shows only those, with a private tea she bought that the shop does not list (`GET /api/me/bought-teas`, `worker/src/myBoughtTeas.ts`, `src/lib/myBoughtTeas.ts`); Your Table: orders, Tea Chest, journal. An approved tasting excerpt shows on the tea page. A session's thank-you links each tea to its shop page | `approve_tasting_excerpt`, `list_low_stock` | [PILLAR.md](../PILLAR.md) (What a signed-in person gets) | 8 (they buy again), 1 (Adrian reorders) |

## Around every step

- **Money.** Shop price is cost x3 plus freight at cost, 85 yuan a kilo (Adrian, 2026-11-27; live since PR 588). The arithmetic lives only in `worker/src/shippingRate.ts` and `worker/src/markup.ts`. Nothing entered is NULL, a typed 0 is 0, every cost says its currency. Rules: [money.md](../claude/money.md).
- **Suppliers.** One vendor record per supplier. The Library heading and the vendor page read the same record.
- **Photos.** Every photo opens in the one photo editor first (`usePhotoEditor()`).
- **Agents.** The Teajia connector (`/mcp`, preview then confirm on every write, tools in `worker/src/mcpTools/`), i64os on Adrian's Mac, AR Create's shared word library for voice, and the `/tea-wisdom` chain. Intake to stock: [CURATE-AGENTS.md](CURATE-AGENTS.md). Knowledge: [TEA-WISDOM-AGENTS.md](TEA-WISDOM-AGENTS.md).
- **Problems** go to `incident_ledger` and `/account/fixes`, never onto a page.
- **Aside.** Curate version 2 (`/admin/compass/v2`, `/admin/curate/v2`) is not the live Curate. Build in today's Curate.

## In flight (2026-11-27)

| PR | What it joins | State |
|---|---|---|
| 586 | Step 2: each card says where the tea is, now past the write-up (priced, main photo, public, Tea Wisdom entry); one Waiting for you list (arrivals, samples to taste, chosen not in Stock, amount, cost, write-up, public with no Tea Wisdom entry yet) | Open |
| 568 | Step 2: the vendor page opens every record and its contacts | Open, ready for review |
| 579 | Step 4: freight rates live with each logistics company | Live |
| this thread | Step 4: "shop default" on a tea opens Shipping rates (`?serviceId=shop`) with its form ready; Curate arrivals on the way are one list by supplier; agents get `list_freight_rates` and `set_tea_freight_service` | Open |
| 585 | Step 7: Palace Grade page, loose leaf only | Open |
| 588 | Step 8: collections show the shelf price when no quote is typed; freight passed on at cost | Live |
| 583 | Steps 8 and 9: invoices link puer teas; payment details are one paste box | Live |
| 577 | Steps 2 to 8: supplier face, Add to Stock wording, Write it up and Add to collection on the Library card | Live |

## Missing or not joined up

In the order recommended to fix them. Nothing here is built without Adrian's yes.

Closed: the tea's path used to stop at "Written up". PR 586 (commit c215452) carries it on through priced, main photo, public and Tea Wisdom entry, and adds "Public, no Tea Wisdom entry yet" to Waiting for you, which is the signal gap 3 below asked for. A place in a collection is not on the path yet.

Closed: freight at cost went live with PR 588, with the money docs changed in the same piece of work.

1. **Two doors skip the Library.** Bulk intake and the agent's `create_tea` make a Stock tea with no supplier, quote or tasting behind it. Stock's Add tea now opens the Library's Bring in sheet (intake plan step 2, 2026-11-27).
2. **Two Taste doors, four approve doors, and Add to Stock arrives empty.** A new Stock tea starts with no counted amount and no price, and nothing asks. Intake plan step 4 (2026-11-27): after Add to Stock the card offers the quote's grams and cost to confirm, and a tasting of a tea in Stock asks the leaf used afterwards.
3. **Two write-ups.** The Story description is live the moment it is saved. The Tea Wisdom entry lives in `data/tea-reference/entries/` and is live only after a push. The signal between them is now built: "Public, no Tea Wisdom entry yet" in Waiting for you (PR 586, open). The chain still runs only on Adrian's word.
4. **The selling half has tools but no agent guide.** Collections, invoices, payment and dispatch tools exist (step 8 and 9 rows above) and only this table names them. Recommended: a short "Selling" section in `CURATE-AGENTS.md`.
5. **i64os has its own tea sale and invoice tools** (`create_tea_sale`, `create_tea_invoice`, `mark_tea_sale_paid`, `purchase_tea_inventory`) beside the `teajia_*` ones and Teajia's own invoices. Nothing written says whether they make the same records. Recommended: check, then document or retire them, so one sale never sits in two ledgers.
6. **Low stock does not lead back to the supplier in the Stock view.** For agents this is closed: `list_low_stock` names the Library tea, supplier and last quote (PR 595). The Stock view still has no way to open the supplier's card.

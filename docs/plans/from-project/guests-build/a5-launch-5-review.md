# Launch 5 review: host token, credit and circles (A5, 2026-11-26)

Reviewed on `build/l5-finish`, cut from `origin/build/launch-5` at `e479d130`. Opus 5.5.
Files read: `worker/src/hostTokens.ts`, the host-key parts of `worker/src/mcp.ts` (authenticateMcp, HOST_SELF_TOOLS, visibleToolDefs, dispatchTool), the 15 host tools in `mcpTools/fewHosts.ts`, `launch3.ts`, `circles.ts`, `launch4.ts`, `mcpTools/tickets.ts`, `worker/src/hostCreditLedger.ts`, its routes in `index.ts`, migrations 0135, 0143 and 0146, and `worker/src/circles.ts`.

## The short answer

The host token holds. It reaches only the host's own tables, guests (by name), teas, notes, circles and favourites, never another host, a guest's contact, the shop's records, credit or an owner tool. Every write previews and needs the confirm. It stops working at once when hosting stops, approval is withdrawn or either switch closes. It is stored as a SHA-256 hash and shown once. Two real bugs were found in the key routes and one real bug in credit; all three are fixed with tests. Circles leak nothing when a past guest is asked back.

## Host token (HOST_TOKENS_OPEN, scope `host:self`)

| Question | Finding |
|---|---|
| Another host's tables | Refused. Every host tool reads ownership by `host_user_id` and the token's own personal account (`ownHostedTable`, `circleTable`, `services.ownTable`). Another host's table and a shop session both answer `table_not_found`. Tested in `host-token.test.ts`. |
| Guests' private details | Not reachable. `get_table_guests` and every preview give name, status, party size, came, the photograph wish. No phone, email, address or note. The guest book (`get_guest_notes`) is the host's own lines, never the guest's words. |
| Shop records | Not reachable. A host key carries no shop scope (`scopes: []`), and `dispatchTool` answers "Unknown tool" for anything outside `HOST_SELF_TOOLS`, before any handler runs. The test walks every one of the 100+ other tools. |
| Credit approval | Not reachable. No credit tool exists in MCP, and the credit routes take a signed-in session, not an MCP token. |
| Owner tools | Not reachable. `set_host_approval`, `stop_host`, `let_host_again`, `hide_tea_table_piece` are unknown to a host key. The key is never platform-owner tier, even when Adrian makes one. |
| Acting without preview and confirm | Not possible. Each write issues a ticket (`issueTicket`), bound to the issuing token id and account, single use, five minutes, and the confirm re-reads the host's standing and the table. |
| After hosting stops | Refused at once: `/mcp` re-reads the switches, the personal account and `hosting_stopped_at` on every request (`hostTokenMayAct`). |
| After approval is withdrawn | Refused at once, the same way. |
| With a switch off | Refused (both HOST_TOKENS_OPEN and FEW_HOSTS_OPEN). Keys are kept and work again if the switch reopens. |
| Revocable | Yes, from "Your assistant". Also revoked by sign-out everywhere and a password change, which revoke every MCP token of the person. |
| Stored hashed | Yes, `token_hash` is SHA-256; the secret is in the mint answer only and in no log. |

### Fixed

1. **A host whose approval Teajia withdrew could not see or disconnect their keys.** With ANYONE_HOSTS_OPEN off, a withdrawn host is neither "may host" nor "stopped", so every key route answered 404. Their keys did not work, but they could not be removed, and would quietly work again if approval came back. Now anyone who still holds a live host key of their own may list and disconnect it; only a person who may host now makes a new one (404 otherwise, 403 when stopped). The host page shows "Your assistant" in that case only while a key is left. Test: `host-token.test.ts`, "a host whose approval Teajia withdrew".
2. **The ten-key limit could be passed by keys made at once.** The count was read, then the row written. The limit is now inside the INSERT itself. Test: "holds the limit in the write: keys made at once never pass it" (failed before the fix).

### Not bugs, noted

- A key made while open works again if a switch closes and reopens, or a stopped host is let host again. This is the reading in the code ("every key of theirs stops working at once" while stopped). See guess 3.
- `report` is in the host set. It previews and confirms, and files a report for Teajia's review; it reads nothing back.

## Tea credit (HOST_CREDIT_OPEN, migrations 0135 and 0143)

| Rule (Adrian's) | Holds? |
|---|---|
| An ongoing balance | Yes. No window, no expiry; the balance is worked out from the ledger, never stored. |
| Earnings pending until Filled | Yes. A line is `pending` when the order comes in, `earned` only once it is Filled and fully paid. The journey checks it: paid but not filled earns nothing. |
| Spend only on an owner's approval | Yes. Only `approveHostCreditSpend` writes `spent`, and only the shop's active owner reaches it. A host cannot approve their own request: on their own account it is "not found", on the shop's account it is 403. |
| Append-only ledger | Yes. Triggers in 0143 refuse UPDATE and DELETE. |
| A per-order ceiling | Yes. An order whose credit is over the ceiling waits for the owner; a spend over it needs a second, explicit yes. |

Concurrency: a hold and an approval are each one guarded statement, so two approvals at once cannot take the balance below zero (new test), a request is spent once (unique index), and a Void overlapping a Fill leaves no unreversed earning (existing test). A Void after spending leaves debt that later earnings repay before anything is spendable.

### Fixed

3. **A hold could be placed on any open order in the shop, and several holds could together pass an order's tea.** `holdHostCreditSpend` checked that the order was open and that one request fitted its tea lines, but not that the order was the host's own, nor what other requests already held or spent on it. It had no route yet, but "ask to spend" needs one. Now the hold is written only on an order whose customer is linked to the host, and only while all requests on that order stay within its tea lines. Tests: `host-credit-orders.test.ts`, "a hold is only on the host's own order..." and "two approvals at once..."; `host-credit-spend-audit.test.ts` now asks on a second order of the host's own, since the first one's tea was already paid by credit.

### Built for the journey (worker only)

- `POST /api/me/tea-credit/orders/:id/use`: the host asks to use credit on one of their own open orders. No amount is read: the ledger works out as much of the order's tea as their credit in that shop covers, less what is already held or spent on it (`useHostCreditOnOrder`). `GET /api/me/tea-credit` now also lists the host's own requests and their open orders with what each could take. `GET /api/host-credit` lines now carry the order's status, so Manage can tell "Filled, over the ceiling" from "not filled yet". The screens are a separate build (`build/l5-credit-screens`); they can use or replace this route.

## Circles and series (CIRCLES_OPEN, migration 0146)

Asking a past guest back leaks nothing. The list is names only, of guests confirmed at an earlier table of the same circle by the same host, in the host's own account; the answer carries no phone, email or address (the journey checks it). The new seat copies the guest's contact and photograph wish inside the host's own account, is hidden from the public guest list, sends nothing, and is taken through the guarded allocator, so a full or closed table refuses. A series' public page names only its other findable sessions. A stopped host asks nobody back. No bug found.

## The card for the table (M3)

**Fixed: the card had no switch.** "Print a card for the table" and its page showed in Manage on `build/launch-5` with nothing to turn it off, so merging Launch 5 would have shipped it. It now sits behind `TABLE_CARD_OPEN` (`src/lib/tableCard.ts`, `VITE_TABLE_CARD_OPEN`), off. Closed, Manage offers no link and the address opens nothing. See guess 4.

## Guesses (the safest reading, for Adrian to confirm)

1. **Credit spent on an order that is later cancelled is not given back by itself.** The `spent` row stays; the owner can make it right by hand. Giving it back automatically would let money move without his eye.
2. **A host cannot take back their own request.** A held request waits for the owner, who declines it to release the credit. An order cancelled while a request is held cannot be approved ("no longer open") and waits for his decline.
3. **A key revives if hosting is let again or a switch reopens.** Revoking every key at the stop would be stricter; the code's reading keeps them so a host is not made to reconnect after a pause.
4. **The card is behind its own switch**, `TABLE_CARD_OPEN`, a new name. It could instead share Launch 2's switch if he prefers fewer.

## Journey

`tests/launch-5.spec.ts`, offline fixture sandbox on ports 8891/8892 (worker on and off) and 7891/7892 (site on and off), both confirmed serving this checkout. Fresh state, one run: 9 passed, 1 left as the labelled TODO for the credit screens. Phone 390x844 and desktop 1280x800; no side scroll on any page.

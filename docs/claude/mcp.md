# Voice and agent control (MCP)

> Moved verbatim from CLAUDE.md on 2026-11-03 so it loads only when needed. The short rules stay in [CLAUDE.md](../../CLAUDE.md).

## Voice & agent control (MCP)
The worker exposes an MCP server at `/mcp` for voice/agent control. Tokens are minted at `/admin/mcp-tokens` (owner-tier only) and shown ONCE, or obtained via the OAuth 2.1 connector flow. There is ALSO a public, unauthenticated, read-only MCP at `/mcp/public` for the shopping public.

**Authenticated tools (`/mcp`)** — gated by scopes; mutating tools use a two-step preview/confirm pattern (first call returns a `confirmation_token`, second commits):
- **Read** (`inventory:read` / `customers:read` / `sales:read`): `search_tea`, `get_tea`, `list_low_stock`, `find_customer`, `get_customer`, `get_account_context`, `list_invoices`, `get_invoice`, `sales_summary`.
- **Write — Operator** (`stock:write` / `sales:write`): `create_tea`, `add_stock`, `remove_stock`, `set_low_stock_threshold`, `record_sale`, `update_invoice`, `void_invoice`, `fulfill_invoice`, `mark_invoice_paid`.
- **Write — Owner** (`catalog:write` / `customers:write` / `admin:write`, owner-tier only): `update_tea_pricing`, `set_tasting`, `set_archive_status`, `create_customer`, `update_customer`, `tag_customer`, `untag_customer`, `link_vendor`, `unlink_vendor`, `update_account_settings`, `update_exchange_rate`.

`set_tasting` writes the shop's own sensory claim about a tea (taste, feel, body, finish, liquor colour) as taxonomy term ids, and is the only agent path to it: `update_tea_pricing`'s `tasting_notes` is the LEGACY free-text tag array, not the structured tasting the product page reads. It MERGES rather than overwrites, because `products.tasting` also holds the starred notes the page quotes, the teaser and the brewing terms; only the categories you pass change, and an empty array clears one. Unknown term ids are refused by name rather than dropped, since a dropped term publishes a shorter claim in silence. Terms present stamps `tasting_source` as `owner`, which is what removes the "potential profile" qualifier on the page. Validation and the merge live in `worker/src/curateImportTasting.ts` so the vocabulary has one home in the worker (`worker/tests/mcp-set-tasting.test.ts` covers the merge). Brewing is not settable: the shared validator does not accept it, and widening it for one tool would change what the Curate import path accepts too.

### Tools added after `mcp.ts` got long live in `worker/src/mcpTools/`

More tools ship as modules (see `mcpTools/registry.ts` for the current set), not as more edits to `mcp.ts`. A tool used to touch `mcp.ts` in four places (the `PendingMutation` union, `TOOL_DEFS`, the dispatch switch, its handler), which is survivable for one tool and unmergeable for four groups written at once. A module exports a `ToolModule` and `mcp.ts` gains it in one line; `mcpTools/registry.ts` refuses a duplicate tool name, a def with no handler, and a handler with no def, at boot rather than silently.

- **`transfer.ts`** — `transfer_stock`, `list_transferable_accounts`. Moves stock between shops in one `db.batch()` guarded on `stock_movement_guard`, so it lands on both shelves or neither. It will not create the destination product: a new row needs a cost, a currency and a freight rate, and the source's are what *that* shop paid, so copying them is the four-freight-rates shape. Destination authority is re-derived from `account_members`, never inherited from the token.
- **`curation.ts`** — collections (`list`/`create`/`add_tea`/`remove_tea`/`publish`/`unpublish`) and images (`set_tea_image`, `add_tea_images`, `remove_tea_image`). An unparseable `additional_images` is an error, not an empty array: every read path in the codebase does `catch { [] }`, which on a write silently replaces the stored photos. An ambiguous product prefix is refused rather than resolved to the first match, because for a photo that means the picture lands on the wrong tea in silence.
- **`events.ts`** — events, sessions and RSVPs.
- **`writing.ts`** — articles, drafts and sample sets.
- **`curateIntake.ts`** — Curate for agents (`curate_*`): find, get, what's missing, add/update a tea (with `bought`, a quantity and whether it is ordered, on the way or here), save a vendor, suggestions an agent found waiting for Adrian's pick, to-dos. Writes where the app reads (compass entries under the token's user, vendors as `customers` tagged vendor, transcripts as `voice` notes). Suggestions and to-dos are one step because neither changes the shop; everything else is preview/confirm. Playbook for the agents: [docs/agents/CURATE-AGENTS.md](../../docs/agents/CURATE-AGENTS.md).
- **`curateSupply.ts`** — the back office of a Curate tea: `curate_get_vendor` (what the shop knows about how a vendor works), `curate_record_freight` (shipping costs kept as reported, a total, its currency and the weight; per kg worked out on read, newest per leg is current), `curate_order` (a `purchase_orders` row with the vendor message to copy, a landed-cost estimate from the real legs, and one pending `curate_receipt_proposals` row per tea to approve on arrival). It never touches a shelf price: the shelf still uses the shop freight rate. Tables from migration `0032`.

**The ticket lives in `mcpTools/tickets.ts`, once.** All four modules independently re-implemented the durable preview/confirm helper, because `mcp.ts` imports them and importing its helpers back would be a cycle. All four reasoned correctly and separately, and disagreed three ways: two put `kind` and `account_id` inside the `UPDATE`'s `WHERE` and two checked them after the row came back, which marks a wrong-kind ticket consumed on its way to rejecting it — a model that hands an `add_stock` ticket to `publish_collection` then **spends** a confirmation Adrian gave for something else. Three awaited the housekeeping reap inside a `try`; one left it on a floating `.catch()`, which throws against the D1 shim the tests run on. Three redefined a `sha256Hex` that `inquiryDomain` exports. Five places held the five-minute TTL: one real and four comments promising to mirror it. That is the four-freight-rates shape with a security property in place of a price, so there is now one implementation, taking the strictest reading of each, and `mcp.ts` imports the TTL from it. Enforced by [worker/tests/one-ticket-one-home.test.ts](../../worker/tests/one-ticket-one-home.test.ts), which fails any module that writes its own `issueTicket`, `consumeTicket`, `sha256Hex` or TTL.

**The seam carries scope, annotations and the audit trail, or a module tool is a second-class tool.** All three were missing when the modules were written: `visibleToolDefs` rebuilt annotations from `mcp.ts`'s own name sets, so every module tool advertised `readOnlyHint: false` whatever it did, and a careful client will not call a writing tool unprompted — a read-only tool nobody may call is not a tool. `AUDITED_TOOLS` names built-in tools one at a time, which is fine for a list that grew slowly and is a trap for a seam, because a module added later would be dispatched, listed and scoped by that file and silently missing from its audit log, and nobody finds a hole in a log by looking at it. Both are now derived: read-only follows from a `:read` scope (the scope check runs before the handler, so it cannot write), and every module tool that is not read-only is audited.

A held write scope implicitly grants its read scope, so pre-`sales:read` tokens still work with the new invoice read tools. `record_sale` / `fulfill_invoice` go through the same fulfillment path as the admin UI (stock_ledger, listing mirror, low-stock alerts, sold-out auto-archive all fire). Invoice PDF/email delivery is still **Phase 2** — download/share from the admin UI for now.

**Public tools (`/mcp/public`, no auth, read-only):** `search_tea`, `get_tea`, `browse_catalog`, `prepare_order`. Public-safe fields only (no cost/margin/vendor/exact stock). `prepare_order` returns a prefilled `wa.me` checkout link — it never places an order; the human WhatsApp conversation closes it. Scope a shop with `?account=<slug>`, default platform-owner.

**Confirmation tickets are durable:** mutation previews are stored in D1 (`mcp_confirmation_tickets`), NOT module memory — Cloudflare may route preview and confirm to different isolates. Single-use via atomic `UPDATE…RETURNING`.

**Protocol:** `2025-06-18` (negotiated down to the client's requested version); results carry both text and `structuredContent`; tool defs carry read-only/destructive/idempotent annotations.

### Connecting a Claude session to it
`.mcp.json` (committed) points a session at `https://api.teajia.com/mcp` and reads the token from **`TEAJIA_MCP_TOKEN`**. The file carries the variable, never the value: mint an owner-tier token at `/admin/mcp-tokens` (shown once) and put it where that surface keeps secrets.

- **Claude Code locally** — Infisical, same as every other Teajia secret. Two commands, once:

  ```
  cd "$(git rev-parse --show-toplevel)" && infisical secrets set --env=dev --path=/ TEAJIA_MCP_TOKEN=<the token>
  ```

  ```
  npm run mcp:check
  ```

  The folder leads because Infisical resolves the project from `.infisical.json` in the repo, and run from `~` it stops to ask for one. The flags precede the assignment so that a newline arriving with a pasted token ends the command rather than leaving `--env=dev --path=/` to run as a command of its own, which is what happened the first time this was handed over.

  Then start sessions with `npm run claude`, which is `infisical run --env=dev --path=/ -- claude`: the variable reaches the process, `.mcp.json` substitutes it, and the value never lands in a file. Never in the file, never in chat.
- **Claude Code on the web / a cloud session** — the environment's variables, set where the environment was created (claude.ai/code → environment settings). A cloud session ALSO needs `api.teajia.com` on its network allowlist, or the connection fails at the proxy with no route rather than with an auth error, which reads like a broken token and is not one. The block is at the egress proxy, so it is not a missing tool and no tool routes around it: the sandbox Chromium loads `www.teajia.com` as an empty body for the same reason `curl` gets `000`.
- **The token in a cloud environment should be READ ONLY, and it is a different token from the laptop's.** Almost everything a cloud session needs the shop for is reading: showing which teas a change would move, checking a cost, confirming what is live. Reading is also the half that cannot go wrong unattended. So mint a second token with the **Read only** preset for the environment, and leave the full-scoped one on the machine where Adrian is sitting in front of it. The preview/confirm ticket still guards every mutation either way, but a read-only token means a session nobody is watching cannot reach the shelf at all, rather than being stopped one step before it.

**Tick `catalog:write` when minting, or the token connects and cannot change a price.** The three owner-tier boxes at `/admin/mcp-tokens` are UNTICKED by default (`SCOPE_DEFS` in `MCPTokensView.tsx`), and a token cannot be widened afterwards, so the default mint produces a token that passes every connection test and fails the one job it was minted for. The form now carries an **Everything** preset beside the Scopes heading and, when no owner box is ticked, a line saying in plain words what that token will not be able to do; the defaults are unchanged, because a token gets pasted into somebody else's client. `npm run mcp:check` exists for the same gap from the other side: it lists the scopes the shop actually grants the token, refuses to print the token itself, and distinguishes a shop refusal (JSON body, `401`) from a proxy refusal (no body, same status), because blaming the token for a blocked allowlist sends you to mint a second one that fails identically.

Connected, a session can do the admin work directly instead of describing it: set visibility, correct a cost, read the live catalogue. Without it a session is blind to the live shop and can only ask Adrian to paste, which on 2026-09-04 cost most of an afternoon in round trips over a migration ledger.

**What a session cannot reach from a cloud sandbox by default:** `api.teajia.com`, `api.cloudflare.com` and `registry.npmjs.org` are all off the allowlist, so no MCP, no `wrangler`, no `npm install`, which means no `npm run lint` and no `npm run test:worker` either. Deploys do not need any of it (CI holds the Cloudflare credentials and runs migrations then deploy on every push to `main` touching `worker/**`); diagnosis does. To give a cloud session Cloudflare directly, add `CLOUDFLARE_API_TOKEN` (Workers Scripts: Edit + D1: Edit) and `CLOUDFLARE_ACCOUNT_ID` to the environment and allow those hosts.

**Implementation:** [worker/src/mcp.ts](../../worker/src/mcp.ts) (JSON-RPC handlers, tool defs, OAuth, public server), [src/admin/views/MCPTokensView.tsx](../../src/admin/views/MCPTokensView.tsx) (token management), [src/admin/views/OAuthConsentView.tsx](../../src/admin/views/OAuthConsentView.tsx) (OAuth consent).

**Schema:** `mcp_tokens` in [0000_initial_schema.sql](../../worker/migrations/0000_initial_schema.sql) (tokens as SHA-256 hash; `last_used_at` bumped on auth), `mcp_confirmation_tickets` (same file) (durable confirm tickets), `oauth_clients`, `oauth_codes` and `oauth_authorize_requests` (same file) (OAuth + scoped grants + mobile-safe consent passing).

**AI discoverability:** `public/llms.txt` indexes the public MCP + shop + journal; Organization/WebSite JSON-LD in `index.html`, Product JSON-LD on `ProductPage`, Article JSON-LD on `ArticlePage`.

### Explicit scope consent

Tokens minted without a scope selection retain the existing legacy default set.
An explicit selection is different: empty, malformed or fully filtered choices
are refused instead of replaced by defaults. OAuth decisions return
`invalid_scope`; unusable stored grants return `invalid_grant` before consuming
the authorization code. The admin mint route returns `invalid_scopes` without a
token or mint audit entry. Valid selections remain limited to their accepted
scopes; existing owner-only approval and live-authority checks still apply.

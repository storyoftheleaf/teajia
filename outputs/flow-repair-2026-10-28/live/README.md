# Isolated live flow verification

Prepared only. No production mutation or deployment was performed when creating this packet.

`verify-flow.mjs` defaults to creating a fresh manifest, fixture SQL and exact-account archive SQL. Running without `--execute` performs no network request. The immutable deployed API revision must already include the silent verification policy before live execution.

## Authentication and safety

No production signing secret is required. The script generates two independent random 256-bit fixture passwords in memory, hashes each using the existing worker format (`pbkdf2:100000:<16-byte salt hex>:<SHA-256 256-bit hash hex>`), and writes only hashes into the private fixture SQL. The fixture users are already email verified, with `.invalid` email addresses. It then calls normal `POST /api/auth/login` and checks each returned identity, sole membership and default active account. Passwords and API-issued JWTs stay in memory and are never written or printed. There is no signup, verification email, invitation, AI work, payment-provider call or real banking. Existing MCP tokens cannot authorize these REST routes.

The platform-controlled `account_features.live_verification_notifications_suppressed=1` takes effect **only** on IDs matching `acc_live_flow_<8–80 lowercase/digit/underscore characters>`. Own-account `/features` then returns `live_verification_policy: "isolated-flow-v1"`. The script refuses commerce until that proof is present. Order, payment claim, payment confirmation and fulfillment mail check the policy; the WhatsApp outbox checks it again before transport. Normal accounts are unaffected. A missing contact alone is unsafe: the existing order helper falls back to `SENDER_EMAIL`.

Required environment names for explicit execution:

- `LIVE_FLOW_RUN_ID`: stable prepared run directory ID (optional on fresh preparation).
- `LIVE_FLOW_EXPECTED_REVISION`: exact 40-character deployed commit, checked against `/api/release` before fixture creation.
- `LIVE_FLOW_ALLOW_MUTATIONS=isolated-account-only`: explicit guard.
- `LIVE_FLOW_ARCHIVE_AFTER=1`: archive exact accounts after success or failure.

Run `node outputs/flow-repair-2026-10-28/live/verify-flow.mjs --execute` only from the authorized release environment after the schema migration and Worker deployment. Wrangler credentials must already be injected by that environment. Command output is deliberately withheld; only operation labels, response status and assertion evidence are exposed. The script uses `https://api.teajia.com` and the recorded `teajia-db` binding. No hostname override or locally signed JWT is accepted.

## Flow and evidence

The fixture contains one isolated store and one buyer home account. The buyer has no membership of the seller store. The actual API creates a capture, accepts a 500g receipt twice, publishes the normal holding, saves/replays an inquiry with deliberately incorrect client prices, verifies the buyer's Draft history, agrees the invoice, records/replays a clearly labeled test cash payment, ships/replays, and verifies the completed customer order and private tracking. It verifies exactly one original receipt ledger and one 50g payment deduction with balance450. No card checkout is involved.

Only safe record IDs, revision, operation assertions, and an outcome appear in `proof.json`. Tracking tokens, authorization headers and credentials remain in memory. Files/directories are created with private permissions. A failure exits nonzero, retains the exact fixture manifest, and can archive it without re-running commerce. Do not repeat `--execute` on the same run once its fixture INSERT committed; inspect `proof.json` and resume/archive deliberately.

## Archive

`archive.sql` addresses only the exact two account IDs and two fixture user IDs from its manifest. It suspends accounts, hides/archives their products/listings and network profiles, disables fixture passwords and invalidates JWTs by incrementing session_version, deactivates their memberships, revokes fixture MCP tokens and removes fixture refresh tokens. Paid invoices, stock movements, receipts, settlements and customer records are retained as labeled audit evidence. A shipped test order is never canceled to fabricate a return. No historical real-shop record is changed. The notification flag stays effective so a delayed test send remains blocked.

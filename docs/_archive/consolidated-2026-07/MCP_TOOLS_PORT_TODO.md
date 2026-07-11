# Follow-up: port `create_tea` + `mark_invoice_paid` MCP tools

> **DONE.** Both `create_tea` and `mark_invoice_paid` are present and dispatched
> in `worker/src/mcp.ts`. This doc is retained for history only.

> Created 2026-05-18 during the branch-consolidation effort. This is a scoped,
> ready-to-execute task for a fresh session — deliberately deferred so it gets
> full attention rather than a rushed end-of-session port.

## What this is

`main`'s MCP server (`worker/src/mcp.ts`, ~3,028 lines) has 22 tools. The
`prelaunch/autofix` branch had a 10-tool version that included two tools
`main` lacks:

- **`create_tea`** — create a new tea product through the MCP (preview/confirm).
- **`mark_invoice_paid`** — mark an invoice paid, optionally fulfilling stock.

When `prelaunch/autofix` was merged (PR #172), the `mcp.ts` conflict was
resolved by keeping `main`'s complete 22-tool version. These two unique tools
were intentionally **not** ported then — they pull in their own types and
handlers, and reconciling them inside a 232-conflict mega-merge was too risky.
They remain preserved on the `prelaunch/autofix` branch.

## Source locations (on `origin/prelaunch/autofix`, `worker/src/mcp.ts`)

| Piece | Lines (approx) |
|---|---|
| `PendingMutation` variants for both tools | 239, 241 |
| `SaleLineInput` type | 247 |
| `NewTeaInput` type | 384 |
| `create_tea` preview handler (`toolCreateTea`) | 582–635 |
| `create_tea` commit handler (`commitCreateTea`) | 637–705 |
| `mark_invoice_paid` preview handler (`toolMarkInvoicePaid`) | 1353–1390 |
| `mark_invoice_paid` commit handler (`commitMarkInvoicePaid`) | 1454–1495 |
| tool definitions (the `name: 'create_tea'` / `'mark_invoice_paid'` entries) | 1544, 1652 |
| dispatcher: confirm-detection | 1694–1695 |
| dispatcher: `case` entries | 1727, 1732 |

## How to execute

1. Branch from current `origin/main`.
2. Read `main`'s `mcp.ts` in full first — its `PendingMutation` union,
   tool-definition array, and dispatcher `switch` differ structurally from
   prelaunch's. Match the port to `main`'s shape, do not paste blindly.
3. Add the two `PendingMutation` variants, `NewTeaInput`, and (if not already
   present under another name) `SaleLineInput`. Check whether `main`'s
   `record_sale` already has an equivalent line-input type — reuse it if so.
4. Add the four handler functions (`toolCreateTea`, `commitCreateTea`,
   `toolMarkInvoicePaid`, `commitMarkInvoicePaid`), adapting any helper calls
   to `main`'s current helpers (D1 query helpers, stock-ledger, invoice
   fulfilment path may have changed names).
5. Register both in the tool-definition array and the dispatcher `switch`.
6. Verify: `npm run lint` (tsc) and `npm run build`. If the worker has tests,
   run them; `worker/tests/mcp-fulfillment.test.ts` exists but had no runner
   wired — wiring a test script is optional polish.
7. Open a PR. Result: a 24-tool MCP backend.

## Notes

- These are *mutating* tools — both must follow the existing two-step
  preview/confirm pattern (first call returns a `confirmation_token`, second
  call commits). The source handlers already do this; preserve it.
- Once ported and merged, the `prelaunch/autofix` branch can be deleted.

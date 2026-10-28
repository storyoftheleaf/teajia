# Backend release integration — 2026-10-28

Release checkout: `/Users/adrianrasmussen/.codex/worktrees/flow-continuity-release/teajia`.

Resolved and staged index/customer-history conflicts against newer main. Kept database health guard, provider/budget/realtime imports, audited Curate manager writes, tombstones and owner boundaries, Drive background copy, delegated promotion, sanitized tasting and reviewed receipt facts. Safe source propagation preserves independently edited Stock categories. Receipts may use explicit actual buy_total/actual purchased quantity; vendor quotes remain unknown until reviewed purchase facts. Main purchase-order NULL totals, complete hashed replay fingerprints, ship mode and tracking remain intact.

A single sourcing-protected proposal GET preserves enriched pending/history response and now accepts status + compass_entry_id filters. No shadow raw route remains. Customer tests use actual SQLite ownership/tenant predicates and include foreign-account line collision, cross-store linked identity, Draft/Void visibility, and legacy phone fallback only inside proven membership.

Legacy immutable Intake plans replay existing IDs first. A first-attempt legacy received purchase lacking canonical IDs is retained pending with receipt_review_required; all replays retain that handoff. Preparing this old intake requires original source_movement_id links and refuses to add the already-recorded stock again. No names/row-order guessing.

Live policy: dedicated test account prefix plus platform-controlled feature; normal accounts unchanged. Order request/payment claim/payment confirmation/fulfillment emails and queued WhatsApp transport honor it. Own features exposes versioned computed policy only if effective. Four focused tests cover no outgoing provider fetch for test flow and normal mail behavior.

Verification performed locally: focused integrated schema+migrations flow + receipt bridge + economic boundaries31 passed; customer/policy/legacy focused checks green; main proposal/history and authorization7 passed; final inventory-purpose/promotion/legacy/policy23 passed. Main recount timestamp uses seven bound parameters; mock updated to model both six and seven parameters. No production deployment or data mutation executed.

Live packet `live/verify-flow.mjs` syntax checked and both generated fixture/archive SQL packets loaded against schema with foreign_key_check=0. Script defaults to plan only; explicit execution requires deployed revision identity + ordinary password sign-in with ephemeral fixture credentials + isolated guard. Tokens remain memory-only, and public private-tracking token URLs are never logged. Archive preserves paid test ledger and invalidates fixture sessions. Parent owns execution and release.

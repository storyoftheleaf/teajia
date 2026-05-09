# Compass / Tasting Separation — Follow-ups

> Two leftovers from the May 2026 carve-out that drew the line: **Compass = admin-only sourcing + ledger** (`/admin/compass`), **Tasting = its own surface** (`/account/journal`). Public `/compass` route was deleted, all member-facing links were repointed, the internal `'tasting'` mode in TeaCompass was renamed to `'library'`, and Compass capture now auto-promotes every save to a Draft product (no Personal/Inventory toggle — that decision moves to triage). See branch `claude/redesign-capture-intake-Cu6pE` and the relevant CHANGELOG entry once merged.

**Status:** scoped, deferred. Pick up when the bigger product-architecture pass touches `tea_compass_entries` schema or the member story.

---

## 1. Schema unification: `tea_compass_entries` → `products`

**Problem.** Today there are still two parallel tables for "tea I've touched":
- `products` — admin inventory (account-scoped, has `is_personal`, `status`, etc.).
- `tea_compass_entries` — per-user-per-account journaling rows, linked to a product via `draft_product_id` after auto-promotion.

The unification thesis (per the May 2026 discussion): **there is only one thing — a tea — with attributes that describe state**. Everything is a product row; `is_personal=1` is what makes something a private note instead of inventory; `status='Draft'` is what keeps it out of the public catalog.

**What's deferred.**
- One-time migration: every `tea_compass_entries` row that has no `draft_product_id` becomes a `products` row with `status='Draft'`, `is_personal=1`, `account_id` = the entry's `account_id`, `created_by_user_id` = the entry's `user_id`.
- Drop `tea_compass_entries` table (or keep as a thin per-user view on `products` filtered by `created_by_user_id` and `is_personal=1`).
- Worker handlers (`handleGetCompassEntries`, `handleCreateCompassEntry`, etc.) become thin wrappers over the `products` table; the `/promote` endpoint becomes a no-op (it's already-a-product).
- Client `teaCompassStore` mirrors flatten — a compass entry IS a product.

**Why it's deferred.** It's a meaningful migration; the UX win from removing the toggle (shipped in this branch) is the immediate payoff. The schema cleanup harvests the rest of the value but isn't blocking. Tackle it inside the next product-architecture phase touching `products` (see `plan/product-architecture-implementation.md`).

**One UX gap that exists today because of this.** When a member receives a shared tea via `CompassShareModal`, the worker still writes a `tea_compass_entries` row in the recipient's scope. The recipient now lands at `/account/journal` (we repointed `ShareCardPage`), but the journal surface reads from the `tasting_journal` data, not `tea_compass_entries`. So shared teas may not appear in the journal until the share-acceptance handler is updated to write into the journal source-of-truth (or until the schema unifies and there's only one place). Audit before relying on it.

---

## 2. Permission gate on `/admin/compass`

**Problem.** Compass is currently reachable by anyone with admin auth — no separate "compass.use" capability check. The intended audience (per the discussion) is tea masters / curators / staff who actually source tea, not necessarily every admin (e.g. event organizers, content editors).

**What's deferred.**
- Define a capability — likely `compass.use` or fold into the existing `catalog` bundle in `src/lib/permissions.ts` and the corresponding worker `requireBundle` check.
- Gate the `/admin/compass` route in `AdminApp.tsx` with that capability.
- Gate the worker compass handlers (`handleGetCompassEntries`, `handleCreateCompassEntry`, `handleUpdateCompassEntry`, `handleDeleteCompassEntry`, `handleSyncCompassEntries`, `handlePromoteCompassEntry`) with the same capability via `requireBundle` instead of just `requireAccount`.
- Sidebar/nav: hide the Compass entry from the admin sidebar for users without the capability.

**Why it's deferred.** The bundle/capability model already exists for `catalog`, `events`, etc. — adding one more is mechanical. It's deferred because the current "any admin can use Compass" surface isn't actively causing harm (the audience overlap is high in practice), and adding the gate without a real role to test against risks gating yourself accidentally. Pick this up alongside the next pass on bundle assignments per role.

---

## 3. Audit: orphaned member compass entries

**If** any member ever captured in Compass via the (now-deleted) public `/compass` route, those rows still exist in `tea_compass_entries` with `account_id` = whatever scope the member had at the time. They no longer have a UI surface (Journal doesn't read `tea_compass_entries`).

**Action when picking #1 up:** include a one-time audit query — `SELECT COUNT(*) FROM tea_compass_entries WHERE account_id NOT IN (SELECT id FROM accounts WHERE owner_role = 'owner')` (or similar) — to size the orphan set. If > 0, the migration in #1 should fold them into the migrated `products` table or the journal table, not drop them.

If 0, the route deletion was clean and there's nothing to do.

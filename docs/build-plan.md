# Teajia Receipt → Inventory Intake — Build Plan

**Owner:** headless build agent
**Status:** authoritative, no clarifications expected

**Convergence target:** one server-persisted draft (`curate_import_batches` + `_sources` + `_items` + new `_chat_messages`) driven by both `/admin/curate/intake` web UI and the 7 `intake_*` MCP tools. Finalize → Draft products (`is_public=0`, `shown_in_shop=0`) + stock ledger rows. Never auto-publish.

---

## 0. Non-negotiable invariants (apply to every phase)

- **Draft-only finalize.** `handleBulkCreateProducts` (`worker/src/index.ts:2740`) already forces `is_public=0, shown_in_shop=0` at line 2817. Do not weaken.
- **R9 askable set.** Only these fields may be filled via chat / operator input and only these may be *asked*: `vendor`, `origin_country`, `purchase_location`, `shipping_mode`, `pack_count`, `weight_grams`, `price_paid`, `cost_currency`, `purchase_date`. Server MUST return `400 { code: "field_not_askable" }` for any other field on both `PUT items` (chat path) and `POST chat`.
- **Never askable / never chat-writable:** `origin_region`, `mountain`, `cultivar`, `year`, `producer`, `description`. These come from vision extraction (evidence-bound) or the tea library only.
- **Every field mutation carries `evidenceRef`.** Chat writes → `evidenceRef: "chat:<msgId>"`. Unknown answers → `null` value + `evidenceRef: "chat:<msgId>:unknown"`. Vision → existing `curateImportAnalysis.ts` evidence path.
- **Concurrency:** every write to `curate_import_items` requires `If-Match: <version>`; server returns `409 { code: "version_conflict", current_version }`. Version is bumped in the same transaction as the write.
- **Confirmation-ticket pattern** for `intake_finalize` — mirror `record_sale` in `worker/src/mcp.ts` (`issueConfirmationToken` + durable `mcp_confirmation_tickets` row).

---

## 1. PHASES

### NOW — remove drift, harden extraction

Independent of NEXT/THEN except where noted. All three items ship as one PR.

#### N1 — Kill localStorage draft; re-parent IntakeWorkspace onto server draft

**Files**
- `src/admin/views/IntakeWorkspace.tsx` — delete localStorage read/write (~lines 49–93, key `teajia_intake_workspace_v1`). Replace with:
  - On mount: if no `?importId=` in URL, call `POST /api/curate/imports` (creates empty batch, returns id) and `replace` URL to `?importId=<id>`.
  - Load state from `GET /api/curate/imports/:id` (existing endpoint under `/api/curate/imports/*` in `worker/src/index.ts:24260-24285`).
  - Every state mutation → REST call; no client-owned draft.
- `src/admin/views/IntakeWorkspace.tsx` (top of page) — add **Resume incomplete intake** picker. Fetch `GET /api/curate/imports?status=in_progress` (new query param; see below).
- `worker/src/index.ts` (already-present list handler for `/api/curate/imports`): add `status` filter param and helper `listIncompleteCurateImports(accountId, limit=20)`. If a route helper already exists for listing imports, extend it; do not duplicate.
- `src/admin/lib/intakeMapping.ts` — remove any localStorage adapters; keep only pure mapping utilities.

**Acceptance:** reload of `/admin/curate/intake?importId=X` restores same state on a fresh browser profile / different device. `localStorage.getItem('teajia_intake_workspace_v1')` returns `null` after this ships.

#### N2 — Strip terroir/description fields from AI extraction schema

**File:** `worker/src/curateImportAnalysis.ts`

- Locate `IMPORT_ANALYSIS_OUTPUT_SCHEMA` (near :33) and remove these keys from the per-item schema so the LLM never emits them: `origin_region`, `mountain`, `cultivar`, `year`, `producer`, `description`, `notes` (if free-form).
- Update the analysis prompt (same file, near :889) to say plainly: *"Do not infer origin sub-region, mountain, cultivar, year, producer, or descriptions. Extract only what is literally printed on the receipt / label."*
- Update the TypeScript type for the parsed item to remove those fields.
- Downstream consumers (`intakeMapping.ts`, `IntakeWorkspace.tsx`) — if any read those fields, delete those reads (should be a no-op if analysis never returned them).

**Acceptance:** replay a receipt image with a fabricated cultivar claim through `/api/curate/imports/:id/analyze` — resulting `parsed_json` has no `cultivar` / `mountain` / `origin_region` keys.

#### N3 — Enforce shipping default + transport_mode on finalize

**Files**
- `worker/schema.sql` + new migration `worker/migrations/NNN_intake_transport_mode.sql` (next unused NNN):
  ```sql
  ALTER TABLE curate_import_items ADD COLUMN transport_mode TEXT
    CHECK (transport_mode IN ('air','sea','land','courier','unknown'));
  ALTER TABLE curate_import_batches ADD COLUMN shipping_rate_per_kg REAL NOT NULL DEFAULT 10.0;
  ```
- `worker/src/index.ts` `handleBulkCreateProducts` (~:2740) and the finalize handler that calls it:
  - When computing `cost_amount`, if `shipping_rate_per_kg` is unset on the batch, use the shop default (`DEFAULT_SHIPPING_RATE_PER_KG_USD` in `worker/src/shippingRate.ts`, currently 12 USD/kg). The `DEFAULT 10.0` in the migration above is historical: SQLite cannot alter a column default in place, so batch inserts now write the constant explicitly.
  - Persist `transport_mode` into the product row or a linked purchase-lot row (whichever exists — do NOT invent a new table; store `transport_mode` on `curate_import_items` and emit into `stock_ledger.note` as `transport=<mode>`).
- `IntakeWorkspace.tsx` — surface a `transport_mode` select (Air / Sea / Land / Courier / Unknown), default Unknown. Show a subtle "Shipping: $12/kg default — override" chip on the batch.

**Acceptance:** finalize a batch with no shipping override → each product's `cost_amount` includes `weight_grams / 1000 * 12 USD`. `transport_mode` round-trips.

---

### NEXT — concurrency + MCP surface + skill authoring

Depends on: NOW-N1 (server draft is source of truth). Independent internally: X1 and X3 can run parallel to X2.

#### X1 — Per-item version + If-Match

**Files**
- Migration `worker/migrations/NNN_curate_item_version.sql`:
  ```sql
  ALTER TABLE curate_import_items ADD COLUMN version INTEGER NOT NULL DEFAULT 1;
  ```
- `worker/src/index.ts` — `PUT /api/curate/imports/:id/items/:itemId`:
  - Read `If-Match` header (integer).
  - `UPDATE curate_import_items SET parsed_json=?, version=version+1 WHERE id=? AND version=? RETURNING version`.
  - If 0 rows updated: `409 { code: "version_conflict", current_version: <SELECT version FROM ...> }`.
  - Return new version in `ETag: <n>` and body.
- Same handler must enforce R9: reject any key outside the askable set with `400 { code: "field_not_askable", field }`.
- `src/admin/views/IntakeWorkspace.tsx` and `ImportBatchReview` — thread `version` through state; on 409, refetch item and surface a "Someone else updated this — reloaded" toast.

**Acceptance:** two concurrent `PUT` calls on the same item — second returns 409; item version increments exactly once.

#### X2 — 7 `intake_*` MCP tools

**File:** `worker/src/mcp.ts` (extend `TOOL_DEFS`; scope `stock:write` for mutations, `inventory:read` implicit).

| Tool | REST | Scope | Notes |
|---|---|---|---|
| `intake_start` | `POST /api/curate/imports` | `stock:write` | returns `{ import_id }` |
| `intake_add_source` | `POST /api/curate/imports/:id/sources` then `POST .../evidence` | `stock:write` | accepts `image_url` or `base64` |
| `intake_analyze` | `POST /api/curate/imports/:id/analyze` | `stock:write` | idempotent per source hash |
| `intake_get_draft` | `GET /api/curate/imports/:id` | `inventory:read` | returns items + versions |
| `intake_update_item` | `PUT /api/curate/imports/:id/items/:itemId` (If-Match) | `stock:write` | R9-enforced; 409 on version conflict |
| `intake_ask` / `intake_answer` | `POST /api/curate/imports/:id/chat` (see THEN-T1) | `stock:write` | one endpoint, `role` decides |
| `intake_finalize` | preview: build payload; confirm: `POST /api/curate/imports/:id/finalize` | `stock:write` | confirmation-ticket pattern, per `record_sale` |

- Register annotations: `intake_get_draft` = `readOnlyHint`; `intake_finalize` = `destructiveHint: false` (Draft) but require confirmation; all others `idempotentHint` where applicable.
- All tools return both `text` and `structuredContent` per the current protocol usage in `mcp.ts`.

**Acceptance:** end-to-end MCP session with a real token can start → add source → analyze → update items → finalize a Draft, mirroring the web flow.

#### X3 — Author / update skills

**Files:** update `teajia-store-intake` and `teajia-rich-descriptions` skills (in `~/.hermes/profiles/teajia/skills/devops/`).

- `teajia-store-intake/SKILL.md` — runbook: `intake_start` → `intake_add_source` (photo path or URL) → `intake_analyze` → loop items: `intake_get_draft` → for each item decide: (a) enough info → `intake_update_item`; (b) missing askable field → `intake_ask` then `intake_answer`; (c) missing non-askable field → **do not ask**, leave blank → `intake_finalize` (preview + confirm). Including the R9 askable/never-askable field lists.
- `teajia-rich-descriptions/SKILL.md` — About-This-Tea prose writes go through the product-edit path, gated on presence of `evidenceRefs` or a library-linked source. Never populated via chat. Never inferred from the receipt.

**Acceptance:** dry-run each skill against a stubbed transcript and verify no forbidden field appears in an `intake_update_item` or `intake_ask` payload.

---

### THEN — chat layer (converged transcript)

Depends on: NEXT-X1 (versioning), NEXT-X2 (MCP surface).

#### T1 — Chat table + endpoint

**Migration:** `worker/migrations/NNN_curate_import_chat_messages.sql`
```sql
CREATE TABLE curate_import_chat_messages (
  id          TEXT PRIMARY KEY,
  import_id   TEXT NOT NULL REFERENCES curate_import_batches(id) ON DELETE CASCADE,
  item_id     TEXT REFERENCES curate_import_items(id) ON DELETE CASCADE,
  role        TEXT NOT NULL CHECK (role IN ('system','agent','operator','assistant')),
  body        TEXT NOT NULL,
  asks_field    TEXT,
  answers_field TEXT,
  answer_value  TEXT,   -- JSON
  answer_kind   TEXT CHECK (answer_kind IN ('value','unknown','skip')),
  origin      TEXT NOT NULL CHECK (origin IN ('web','agent','system')),
  created_at  INTEGER NOT NULL,
  created_by  TEXT
);
CREATE INDEX idx_curate_chat_import ON curate_import_chat_messages(import_id, created_at);
CREATE INDEX idx_curate_chat_item   ON curate_import_chat_messages(item_id, created_at);
```

**Endpoint:** `POST /api/curate/imports/:id/chat` in `worker/src/index.ts`
- Body: `{ item_id?, role, body, asks_field?, answers_field?, answer_value?, answer_kind?, origin }`.
- Enforce R9 on `asks_field` and `answers_field` (400 if not in askable set).
- Transaction:
  1. Insert message → get `msgId`.
  2. If `answers_field`: `UPDATE curate_import_items SET parsed_json = json_set(parsed_json, '$.'||?, ?), version = version + 1 WHERE id = ?`; also merge `evidenceRefs` array with `{"field": answers_field, "ref": "chat:"||msgId, ...}` (or `"chat:"||msgId||":unknown"` if `answer_kind='unknown'`, and write `null` for the value).
  3. Return `{ message, item_version }`.
- Chat writes bypass `If-Match` deliberately (single-writer transaction), but each write still bumps `version`.

**Acceptance:** posting `{role:'operator', answers_field:'vendor', answer_value:'"Wistaria"', answer_kind:'value'}` mutates the item's `parsed_json.vendor` and appends an `evidenceRef` with `chat:<msgId>`.

#### T2 — Web chat sheet in `ImportBatchReview`

**File:** `src/admin/components/ImportBatchReview.tsx`
- Add per-item "Ask about this" sheet: shows chat history filtered by `item_id`, plus a batch-level thread for `item_id=null`.
- On agent-authored ask messages, render actionable answer chips (`Value…`, `Unknown`, `Skip`).
- Operator "Value" writes go through `POST /api/curate/imports/:id/chat` with `role='operator', origin='web'`.
- Use React Query to invalidate the import on new messages (polling 5s while sheet open).

**Acceptance:** operator answers a vendor ask in web; agent's next `intake_get_draft` sees `vendor` populated with `evidenceRef` `chat:<msgId>`.

#### T3 — Agent wiring `intake_ask` / `intake_answer` + NL parsing

**File:** `worker/src/mcp.ts`
- Single tool internally maps `intake_ask` → `POST chat { role:'assistant', asks_field, body, origin:'agent' }`, `intake_answer` → `POST chat { role:'operator'|'assistant', answers_field, answer_value, answer_kind, body, origin:'agent' }`.
- NL parsing for free-text operator replies stays client-side in the skill runbook.

**Acceptance:** a skill-driven session that only calls `intake_ask` / `intake_answer` produces the same `parsed_json` state as a web-driven session.

#### T4 — Inference-first silent fill

**File:** `worker/src/curateImportAnalysis.ts` and the analyze handler.
- After LLM extraction, run a deterministic pass that fills askable fields from evidence *without* asking the user, only for values meeting an evidence threshold. Each silent fill writes an `evidenceRef` with source `analyze:<sourceId>`.
- Non-askable fields are never touched here (already enforced by N2).

**Acceptance:** for a receipt with a clear date + vendor address, analyze produces items where `purchase_date` and `purchase_location` are already populated with `evidenceRef` — no chat needed.

---

### LATER — deferred, do not build now

- **SSE stream** on `/api/curate/imports/:id/events` to push chat + version updates.
- **Vendor-history chip** on the intake item card.
- **`stock_verified_at` UI** in `IntakeWorkspace`.

---

## 2. Migration filename discipline

- Format: `worker/migrations/NNN_short_snake.sql` where `NNN` = zero-padded next integer after the highest existing migration (verify at build time; do NOT reuse a number).
- One logical change per migration; each migration is a single transaction.
- Every migration MUST also be reflected in `worker/schema.sql` (baseline).

---

## 3. Dependency graph for parallel headless agents

```
NOW-N1 ─┬─► NEXT-X1 ──► THEN-T1 ──► THEN-T2 ──► THEN-T3
        └─► NEXT-X2 ──┘                       ▲
                                              │
NOW-N2 ── (independent) ──────────► THEN-T4 ──┘
NOW-N3 ── (independent, DB migration only)
NEXT-X3 ── (independent skill authoring, needs X2 tool defs)
```

**Runnable in parallel from a cold start:** Agent A (NOW-N1), Agent B (NOW-N2), Agent C (NOW-N3).

**After N1 lands:** Agent D (NEXT-X1), Agent E (NEXT-X2), Agent F (NEXT-X3 — can start once E's tool signatures are frozen).

**After X1 + X2 land:** THEN-T1 → then T2 / T3 in parallel → then T4.

Do **not** merge THEN-T2 (web sheet) before T1 (endpoint) — the sheet will 404.

---

## 4. Test / verify per phase

Prereqs: Node 22; `npm run test:worker` with `NODE_OPTIONS=--experimental-sqlite`.

| Phase | Verify |
|---|---|
| NOW-N1 | tsc clean; no localStorage read/write for intake key; resume list renders |
| NOW-N2 | schema no longer contains stripped keys; snapshot test on prompt |
| NOW-N3 | finalize test asserts `cost_amount` includes `weight_kg * 10`; transport_mode round-trips |
| NEXT-X1 | new test: two concurrent PUTs, second returns 409; version increments once |
| NEXT-X2 | 7 tools registered; scopes correct; round-trip through internal REST handler |
| NEXT-X3 | dry-run skills; no forbidden field in emitted payloads |
| THEN-T1 | post chat asserts item mutation + evidenceRef; R9 400s on forbidden field |
| THEN-T2 | sheet opens, ask + answer round-trip |
| THEN-T3 | MCP session: ask/answer fills same fields as web; draft state parity |
| THEN-T4 | analyze fixture → purchase_date populated with evidenceRef; non-askable empty |

Global gate before push:
```bash
npm run lint         # tsc --noEmit
npm run lint:colors  # MANDATORY
```

---

## 5. Deploy

- **Worker:** `.github/workflows/deploy-worker.yml` fires on push touching `worker/**`. Every worker-side phase auto-deploys when merged to `main`.
- **Frontend:** Cloudflare Pages CI on push to `main`.
- **Migrations:** applied by the worker's boot-time migration runner (existing pattern; verify migration ordering).
- **Secrets:** none new. All reuse existing auth + `X-Teajia-Account` scoping.
- **Ship semantics:** push to `origin/main` and verify remote has the commit — no PR.

---

## 6. Corrections vs the prompt's code references

1. **`worker/src/index.ts` line numbers drift.** Treat cited line numbers as symbol-anchors — `grep` for handler/route names rather than jumping to lines.
2. **`transport_mode` storage target.** Store on `curate_import_items` (batch-scoped) and, at finalize, emit into `stock_ledger.note` as `transport=<mode>`. Do not invent a new table.
3. **Chat table `role` enum.** Endpoint accepts both `'assistant'` and `'agent'` and normalizes on write.

---

**End of build plan.**
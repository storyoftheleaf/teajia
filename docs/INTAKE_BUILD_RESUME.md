# Teajia Intake Build — Resume & Recovery Plan (2026-08-30)

> **Purpose:** This document exists so the entire body of work performed across
> 2026-08-29 → 2026-08-30 on the Teajia receipt-to-inventory intake build can be
> resumed and completed safely no matter what happens to sessions/processes.
> It is git-tracked (so it survives) and should be read FIRST by any agent or
> human resuming this work.

---

## 1. TL;DR — is the work safe?

| Asset | Status | Where |
|---|---|---|
| Intake build code (N1/N2/N3/X1/X2/X3/T1/T2/T4) | ✅ ALL PUSHED to `origin/main` | repo `HEAD = 25dcd0f6` |
| Worker deployed with intake all phases | ✅ `conclusion: success` | GitHub Action run |
| Full worker test suite | ✅ **69 files / 1079 tests green** | `npm run test:worker` |
| Teajia skills (store-intake runbook, rich-desc evidence-gating) | ✅ on disk | `~/.hermes/profiles/teajia/skills/devops/teajia-*` |
| `teajia` MCP server added (exposes `intake_*` tools) | ✅ config written | `~/.hermes/profiles/teajia/config.yaml` |
| Hermes updated to v0.20.6 | ✅ done | `hermes --version` |
| Intake tools live on worker MCP | ✅ verified | `intake_start` … `intake_finalize` all exposed |
| **Hermes teajia profile backend process** | ⚠️ **CURRENTLY DOWN** | needs restart (see §5) |

**Not a single piece of the work is lost.** The only "broken" thing is that the
teajia profile's *serve process* is not running, so the tools aren't in a live
session right now. Everything is on disk and resumes on restart.

---

## 2. The complete build (what was shipped, commit by commit)

All commits are on `origin/main` in `/root/projects/teajia`.

| Phase | Commit | What it does |
|---|---|---|
| Build plan | `d3240fcd` | Fable (Opus) wrote the authoritative plan → `docs/build-plan.md` |
| N1 | `79a2d957` | Killed localStorage draft; `IntakeWorkspace` re-parented onto `/api/curate/imports/*` + resume picker |
| N2 | `26efa7f4` | R9: stripped LLM-fabricated region/cultivar/year/description from analysis schema |
| N2-corr | `419dd687` | Fixed type/schema split (canonical records keep fields; LLM still can't invent them) |
| N3 | `9a407597` | `transport_mode` + `shipping_rate_per_kg` default 10 USD/kg on finalize |
| X1+X2 | `6e9c9fe6` | per-item `version` + If-Match optimism; 8 `intake_*` MCP tools |
| X3 | skill edits | intake runbook + R9 askable lists (`teajia-store-intake`), evidence-gating (`teajia-rich-descriptions`) |
| T1 | `92c7993b` | chat table `curate_import_chat_messages` + `POST /chat` endpoint, R9 enforced, wired ask/answer MCP |
| T2 | `9bc53ef5` | web "Ask about this tea" chat sheet (`IntakeChatSheet.tsx`) |
| T4 | `9194149a` | inference-first silent fill (evidenceRef-tagged) |
| T4-fix | `25dcd0f6` | round-trip PUT accepts silently-filled fields; fix test apostrophe |

Plus concurrent product-UI commits (also pushed): `f7c32269`, `ab1e5d8e`,
`60fe50be`, `b8fd04fe`, `d65083af`, `c878002d`, `bb97f582`.

**Result:** the intake works two ways converging on one server-persisted draft —
agent (Hermes + skills via `intake_*` MCP tools) and web (curate UI). Chat answers
write back with provenance; R9 never fabricates region/cultivar/description.

---

## 3. Skills (all present on disk)

Located `/root/.hermes/profiles/teajia/skills/devops/`:
- `teajia-store-intake` — **agent-path intake runbook added**: `intake_start → add_source → analyze → update/ask/answer → finalize`, R9 askable-vs-never-askable field lists, "ask only small gaps / I-don't-know is terminal."
- `teajia-rich-descriptions` — **evidence-gating added**: About-This-Tea never from chat/receipt, only library/verified.
- Others: `teajia-shop-visibility`, `teajia-sales`, `teajia-site-ops`, `teajia-single-source-descriptions`, `teajia-product-descriptions`, `teajia-inventory-store-publish`, `teajia-mcp-claude-desktop-integration`.

---

## 4. MCP config (written, persists)

In `~/.hermes/profiles/teajia/config.yaml`, `mcp_servers`:
- `i64os`, `i64os-remote` (existing — commerce bridge, prior headless flow)
- **`teajia` (NEW)** — `url: https://teajia-api.lightcodes.workers.dev/mcp`, header `Authorization: Bearer <TEAJIA_MCP_TOKEN>`. This is what exposes the `intake_*` tools to Hermes.

**IMPORTANT:** The `teajia` MCP server exposes the **intake tools** (intake_start,
add_source, analyze, get_draft, update_item, ask, answer, finalize) — DIFFERENT from
the `i64os` bridge which exposes commerce tools (teajia_say, teajia_create_tea, etc.).

---

## 5. THE ONE OPEN ITEM — restart the teajia profile backend

Current state: **no `hermes --profile teajia serve` process is running.** It was
killed and did not auto-respawn. Everything else is fine.

**How to restart (SAFE, keeps all headless config):** the profiles are DESKTOP-OWNED
(launched via `.hermes/desktop-ssh/<ownership>/backend.lock.json` → `hermes --profile
teajia serve`). The correct way is to **re-open the teajia session in the Hermes
desktop app**, which spawns a fresh `hermes --profile teajia serve` loading v0.20.6 +
the `teajia` MCP server. Nothing headless is lost by doing this.

After restart, VERIFY:
1. `ps aux | grep "profile teajia"` → a process exists.
2. Runner tool-search reveals `mcp_teajia_intake_*` tools (or `intake_start` etc.).
3. `hermes --version` → v0.20.6.

---

## 6. Resume checklist (run this once the backend is back)

1. Confirm intake tools loaded (tool_search "intake_" → intake_start/finalize present).
2. Run the FULL worker suite to prove green: `PATH=/tmp/nv22/bin:$PATH NODE_OPTIONS=--experimental-sqlite npx vitest run worker/tests`.
3. Confirm worker deployed (GitHub Action on latest push succeeded).
4. If you want the old task to proceed: follow the `teajia-store-intake` skill runbook.
5. Close the intake todo list (see §7).

---

## 7. Pending / not-yet-done (be honest with Adrian)

These were raised but NOT completed:
- **T2 web chat sheet** is committed but I should confirm it actually renders in the
  live admin (it was a frontend change; Pages deploy should have covered it).
- **Voice-note → tea linkage**: confirmed wired at the CODE level (tasting mood/flavor
  → `mood` + `tasting_notes` → `AlcoveAboutSection`), but per-tea live data was NOT
  verified (the raw HTML is client-rendered; need the API, not the page shell).
- The old "photo → page, start to finish (commerce)" flow still works via `i64os`
  bridge; the NEW draft+chat+confirm flow needs the restart to be usable from Hermes.
- If Adrian wants the new curate flow to be the default going forward, that's decided
  after we confirm it works end-to-end.

---

## 8. Do NOT lose these facts (hard-won)

- Worker MCP endpoint: `https://teajia-api.lightcodes.workers.dev/mcp`, token `TEAJIA_MCP_TOKEN` (env).
- Worker test command requires Node 22 + `--experimental-sqlite` (Node 22 at `/tmp/nv22`).
- Deploy: push to `origin/main` touching `worker/**` triggers `deploy-worker.yml`; frontend via Cloudflare Pages.
- The `teajia` profile backend is desktop-owned — don't kill it from inside; re-open via desktop.
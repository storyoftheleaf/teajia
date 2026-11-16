# Read delivery confidentiality — 5 November 2026

Status: isolated source candidate; no merge, database change or deployment.
Branch: `codex/editorial-confidentiality`.
Base: `2a3209499` (`origin/main` when the managed worktree was created).
Scope: curated hand-built `/read/*` prose and saved text. Commerce, inventory, schema, publication choices and adopted templates are unchanged.

## Measured exposure and repair

The existing route gate hid drafts visually, but lazy article chunks still entered public assets. Browser-decoded claims could authorize the UI without a verified signature. Separately, the public story-content read returned saved published edits even when the curated story was unpublished. The older snapshot restore also returned full prose to an unrelated legacy admin; the whole saved-text editing/history family now uses the same magazine-editor check, with a legitimate save/publish/restore regression.

A synthetic fixture reproduced private text and dependency text in the static build before the fix. The repaired build removes all fourteen curated modules and their exclusive code/data dependencies from static assets, including source maps. Vite assembles a private generated JSON payload used only by the Pages Function. A deliberately public import of conversation story data fails the build. A map-coverage check requires every curated route to have a protected source module.

`/read-assets/*` is a Pages Function route. It serves the original executable module only after `/api/read/access` permits every story represented in that module. The Worker checks current stored publication state; if unpublished, it verifies signature, expiry, session version and current database editorial membership. Auth and publication dependency failures withhold bytes. It never falls back to the build's live map on a failed state read. Responses are private and non-cacheable, including public stories, so an Unpublish applies to subsequent delivery.

The browser's editor hook waits for `/api/read/session`. Its HttpOnly, Secure, SameSite=Strict cookie lets native module imports authenticate without credentials in URLs. The cookie has the verified JWT's remaining lifetime and is accepted only for module authorization, never for writes. Session writes are serialized so a slow older login cannot overwrite a later logout. Saved curated story text uses the same publication/editor policy and stays non-cacheable. Public reader templates and owner Publish / Unpublish controls are retained.

## Verification

- Synthetic production build: no unpublished marker or private dependency marker in any static file or source map; protected delivery retains the unchanged module; a public story can still be unpublished; accidental public story-data imports fail.
- Worker requests against seeded SQLite: anonymous direct saved text, forged signatures and forged elevated claims, other-shop ownership, staff bundles, real editor access, cookie scope, expiry, demotion, session revocation, stored publish/unpublish and dependency outages.
- Production-artifact browser: anonymous/direct module and map refusal; forged browser claims; anonymous live ritual and conversation templates; real editor draft preview; HttpOnly/Secure cookie; immediate refusal after demotion. Uses the actual public CSP, Pages delivery helper and bundled real Worker with synthetic identities, without production connections.
- Frontend typecheck, color rules, relevant source and Worker tests, actual production build, and Pages Function compilation. Exact command results are recorded with the candidate's final delivery report/PR.

Reproduce after installing root and Worker dependencies:

```sh
npm run test:read-delivery
npm run build
NODE_OPTIONS=--experimental-sqlite npx vitest run worker/tests/read-delivery-boundary.test.ts worker/tests/read-publish-from-the-page.test.ts
PLAYWRIGHT_BASE_URL=http://127.0.0.1:1 NODE_OPTIONS=--experimental-sqlite npx playwright test tests/read-delivery-boundary.spec.ts --project='Desktop Chrome'
```

The last test starts its own isolated local production-artifact server. The supplied base URL disables the ordinary development web server; it is not contacted.

## Recorded local results

- Read build confidentiality: 2/2 tests pass.
- Relevant source/Pages tests: 170 pass, 1 pre-existing skip.
- Worker publication and saved-text boundary: 31/31 pass.
- Production-artifact browser: 4/4 pass across desktop and mobile.
- Existing Read route/publish/template browser checks: 21 passed on the first run; the sole navigation-context race passed alone (22 distinct checks qualified).
- Required mobile suite: 40/40 pass.
- Full source suite: 3,081 pass, 11 skips, one unrelated XLSX expansion case failed under concurrent browser load; all 22 XLSX cases pass when run alone. No unrelated intake code was changed. This is retained as a verification limitation, not hidden as a fully green full-suite run.
- Frontend types and colors pass; Worker type ratchet preserves its 37 known diagnostics with no new error (only exact unchanged source-line positions relocated).
- Vite production build and real Wrangler Pages Function compilation pass. The private payload contains fourteen separate story modules; none is a static file, and no shared private chunk blocks one live story on another draft.

The immutable candidate SHA and these results are recorded in the draft PR; this document is committed with that candidate.

## Remaining acceptance and release limits

Review/merge and production publication remain separate actions. Release the matching Worker before Pages using the existing exact-revision runner, then verify the public custom domain and active Pages aliases with the candidate's recorded artifacts. The generated `functions/readAssets.generated.json` is build-only, ignored by Git, and must be created by `npm run build` before Pages Function compilation/publication. It must never be copied into static `dist` or uploaded to a public artifact.

This change cannot recall bytes already downloaded or invalidate historical deployment URLs. No historical-deployment deletion or CDN purge was performed. It does not privatize existing public images or short catalogue metadata. The always-public flagship outside the curated map retains its existing exception. DB-backed `/article/:slug` uses its existing publication API and was not redesigned. Access is rechecked on subsequent requests; an ES module already loaded in a browser is not erased by unpublishing or demotion.

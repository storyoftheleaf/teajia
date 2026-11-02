# Testing, CI and the local sandbox

> Moved verbatim from CLAUDE.md on 2026-11-03 so it loads only when needed. The short rules stay in [CLAUDE.md](../../CLAUDE.md).

## Local sandbox — how to verify admin work yourself

`npm run dev` points the site at the **live production API**, so anything you
click in `/admin` edits the real shop. Never verify admin changes that way.

Use the sandbox instead: `npm run sandbox` runs the API locally on 8787 against
its own database plus the site on 7777 pointed at it. Sign in as `sandbox` /
`sandbox` (owner-tier, both shops). The local database carries a copy of the
product catalogue and **no users, customers, invoices or orders**, so clicking
anything is free. Refresh the copy with `npm run sandbox:refresh`.

Full notes, including the browser snippet that drops a session into storage
without touching the sign-in form: [worker/sandbox/README.md](../../worker/sandbox/README.md).

**Do not hand admin verification back to Adrian.** The sandbox exists so the
agent can click the thing it just changed.

## Testing
```bash
npm run test:mobile  # Playwright mobile audit at 390×844 (Mobile Chrome)
```
Catches: JS crashes (error boundaries), 404 pages, JS console errors, horizontal overflow.
The Playwright config starts its own server (`npm run dev:test`); stop any running `npm run dev` first. Takes ~90 seconds.

### What actually runs on a push to main

Until 2026-09-09, nothing did. `deploy-frontend.yml` was `workflow_dispatch` only
and `playwright.yml` ran two of 48 browser specs, so a syntax error unreachable
from those two specs landed green: two JSX comments placed inside an element's
attribute list in `AddProductModal.tsx` broke `tsc`, `vite build` and every
Cloudflare Pages build for two days (six production deploys failed in a row),
because the dev server transpiles a file only when a visited route imports it,
and neither mobile spec opens the admin route that does. Fixed in `2f1b7ea3`.

`.github/workflows/playwright.yml` is now the gate, on every push and pull
request to main. Its `checks` job runs `npm run lint` (tsc), `npm run
lint:worker-types`, `npm run test:src`, `npm run
lint:colors`, `npm run build` and `npm run test:worker`, which is the class of
check that would have caught the outage: none of them depend on a route being
visited. `npm run lint` covers `src` only, not `worker/tsconfig.json`, and
`wrangler deploy --dry-run` in the deploy workflow builds with esbuild, which
strips types rather than checking them; worker type errors are ratcheted by
`npm run lint:worker-types` in CI. `mobile` and `e2e` cover browser behavior; `e2e` builds first (two
specs read `dist/` directly) and runs the full suite on the Desktop Chrome and
Mobile Chrome projects, the two `tests/inventory-scroll.spec.ts` names
explicitly, sharded six ways (`--shard=N/6`, `fail-fast: false`) because the
unsharded suite measured 35 minutes of playwright time alone on faster
hardware than this private repo's 2 vCPU runner tier gets, past the 30-minute
cap the job used to carry; each shard still applies `KNOWN_FAILING_E2E`.
`china-scan`, `platform-hardening` and `recovery` wire in the three suites
(`test:china-scan`, `test:platform-hardening`, `test:recovery`) that
previously had no CI lane at all; `recovery` runs `npm run build` once before
Playwright starts so `playwright.recovery.config.ts`'s own
`npm run build && npm run preview` webServer warms into its 120-second budget
instead of racing it cold on a bare checkout. `tea-reference-preview.spec.ts`
and `tea-reference-revision-workflow.spec.ts` stay out of CI:
`playwright.config.ts` already excludes them, because they need a server
started under `--mode tea-reference-preview` and a private
`TEA_REFERENCE_HANDOFF_PATH` file that does not exist in the CI environment.

Some tests fail on main independent of this gate; `e2e` excludes the titles in `KNOWN_FAILING_E2E` via
the workflow-level `KNOWN_FAILING_E2E` regex so they cannot block a merge, and
the separate `known-failing` job runs those with `continue-on-error`
so they stay visible instead of going quiet. A title is removed from that
regex in the same commit that fixes the test or the page it exercises, never
on its own.

The browsers are NOT installed by `npm install` on this machine: npm blocks the
install scripts that would fetch them, so a fresh checkout fails every test in a
millisecond with "Executable doesn't exist". Run this once per machine:

```bash
npx playwright install chromium
```

Run the suite with the sandbox disabled; Playwright cannot manage its own browser
processes inside it and every test dies on `kill EPERM`.

**Stop `npm run dev` before running the browser suite.** The config starts
`npm run dev:test`, which points `VITE_API_URL` at the dev server itself so
every API call lands on a Playwright mock. It also sets
`reuseExistingServer`, so if your ordinary dev server is already on 7777 the
suite silently runs against the LIVE API instead. Tests that mock auth then
have their fake tokens rejected by the real worker and fail in ways that look
like app bugs: on 2026-08-31 that alone accounted for eight false failures and
several hours chasing them. If a test fails only when you have been developing,
check which server is on 7777 before believing it.

**A free port is not the same as your port.** The warning above is about 7777,
but the shape of it applies to any port, and the second half is worse because it
does not look like a failure. Adrian runs five or six sessions on this repo at
once and each has its own worktree, so a dev server answering on the port you
picked may be serving a different checkout entirely. On 2026-08-31 a browser run
started on 7788 to avoid disturbing 7777, got a healthy server and three passing
tests, and every one of them had exercised another session's copy of the code.
Reintroducing the defect under test changed nothing, which is the tell: a
mutation that cannot fail its own test means the test is not looking at your
work. Confirm the server is yours before believing a result:

```bash
for p in $(lsof -ti:PORT); do lsof -p "$p" | awk '$4=="cwd"{print $NF}'; done
```

The stronger habit is to make the code prove it: request the file you changed
from the server and check the change is in the response, then run. That is one
command and it converts "the server is up" into "the server is serving my work".

When you do need a server of your own, `PLAYWRIGHT_BASE_URL` skips the config's
managed one entirely, so you can point the suite at a port you started and
verified without touching anyone else's:

```bash
cd "$(git rev-parse --show-toplevel)" && VITE_API_URL=http://localhost:7802 npx vite --port 7802 --strictPort
```

Kill only what you started. Another session's dev server is another session's
verification in progress.

A build is also a prerequisite for two specs: `china-reachability` and
`admin-chunk-failure-production` read `dist/sw.js` and `dist/_headers`, so run
`npm run build` first or they fail on a stale or missing `dist`.

```bash
cd "$(git rev-parse --show-toplevel)" && lsof -ti:7777 | xargs kill 2>/dev/null; npm run build && npm run test:mobile
```

**Run `npm run test:mobile` before pushing any change that touches:**
- `src/components/AccountPanel/` — panel views, navigation, sub-views
- `src/pages/` — any account route page
- Any routing or navigation change in `src/App.tsx`

**Test files (examples, not the full list):**
- `tests/account-panel-mobile.spec.ts` — AccountPanel + linked routes
- `tests/inventory-scroll.spec.ts` — InventoryView scroll regression guard (Desktop + Mobile)

**Screenshots saved to:** `test-results/<spec-name>/` (not committed)

### Known stub/incomplete pages — do not add links to these without building them first
| Route | Status |
|---|---|
| `/account/orders` | Wired (`api.me.orders()`); per-order detail page still missing (TODO in `OrderHistoryPage.tsx`) |
| `/account/samples` | Wired (`api.me.samples()`) |
| `/api/verify/*` | Email delivery is built (Resend, `worker/src/verificationDelivery.ts`) but sends nothing until the worker has `RESEND_API_KEY` and `SENDER_EMAIL`; without them a code request answers 503 `email_not_configured` and the sign-in page says so in words. The same two secrets gate signup verification. `DEV_RETURN_VERIFY_CODES=true` (dev only) echoes the code so a sandbox with no provider can walk the whole sign-in. WhatsApp delivery is not built |

# Launch-to-Real-Use Release 3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete Teajia's mainland-China reachability floor and its contributor-to-article publishing workflow without inventing contributor content or changing the product's navigation language.

**Architecture:** Keep the browser on owned, same-origin `/api/*` and `/media/*` paths, with the Cloudflare Pages edge proxy as the only bridge to the Worker. Extend the existing account-owned contributor and article models from migration 059, enforce contributor/account linkage in one Worker transaction boundary, and reuse the existing Magazine editor and public contributor profile. Release verification uses deterministic synthetic fixtures; Barry's real record and voice remain a human-only editorial gate.

**Tech Stack:** React 19, TypeScript, React Query, Vite 6/VitePWA, Tailwind v3 design tokens, Cloudflare Pages Functions, Cloudflare Workers, D1, Vitest, Playwright.

**Implementation handoff (2026-07-13):** Publishing/contributor administration, same-origin browser API configuration, contact fallback, and service-worker behavior are implemented and locally verified. Relevant commits include `661eb767` (dependency/media gate), `22ee4fff` (same-origin API and contact handoffs), `de096cd9` (China-safe cache/contact policy), `c9453e3e`, `6b7a7b1d`, `d954db66`, `fa3d0e19`, and `279d0581` (contributor ownership, atomic host mirroring, UI, and publish-safe options), `cb8c9f2a` (article contributor linkage and public rendering), and `f9a056b5` (fully intercepted synthetic publishing journey). Migration `059_contributors.sql` was reused; no duplicate Release 3 migration was created. The integrated Release 2 migrations are `113` and `114`, not the earlier draft numbers.

Verification evidence: lint, color lint, and production build passed; Worker 339; scanner-policy tests 10; relevant focused media-plate, contact, publishing, and event-upload-race tests passed; and Release 3 browser coverage passed 34 tests across Desktop and Mobile Chrome. The synthetic journey contains no Barry, Rasmussen, or real-editorial marker and writes no persistent production row. The source and built audit now reports zero stock-host or prohibited hardcoded-origin findings.

**Technical implementation complete; real-world launch pending:** Task 4 is complete without claiming that owned photographs were supplied: dead sources were deleted and live founder, Shop-set, and contributor imagery was replaced with code-native plates. CSP is tightened and the scanner is at zero. The event upload/navigation race is fixed and focused-test covered. Deployed Resend OTP receipt, mainland-network testing, real Barry content, the Australia operator run, a real inquiry-to-fulfillment feedback loop, and the production invoice-repair apply decision remain pending.

---

## File map and sequencing

Release 3 depends on Releases 1 and 2 being green and on `worker/migrations/059_contributors.sql` being present in both clean-schema and current-schema rehearsals. Migration 059 already supplies `contributors`, `articles.subject_ids`, `articles.pull_quote`, `articles.pull_quote_subject`, and `accounts.host_contributor_id`; do not add a duplicate migration.

The implementation has two independent early streams:

- Reachability: dependency scanner, owned-media inventory, same-origin configuration, contact fallback, CSP, and service worker.
- Publishing: contributor Worker contract, contributor admin UI, article author selection, pull quotes, and fixture validation.

The streams may run in parallel until final verification, but assign one owner to shared files `src/lib/api.ts`, `src/types.ts`, and `worker/src/index.ts`. Do not parallel-edit those files. Tighten CSP only after the scanner reports no blocked public runtime dependencies.

**Create:**

- `scripts/check-china-dependencies.mjs` — scans browser-delivered source and built output, with explicit edge-only allowlists.
- `scripts/check-china-dependencies.test.mjs` — scanner behavior tests using temporary fixture directories.
- `docs/OWNED_MEDIA_INVENTORY.md` — exact stock-media occurrence, owning screen, replacement path, and disposition ledger.
- `src/lib/contact.ts` — deterministic WhatsApp/email contact-channel resolver and URL builders.
- `src/lib/contact.test.ts` — contact resolver unit tests.
- `worker/tests/contributors.test.ts` — contributor CRUD, publication, tenancy, and host-mirror behavior.
- `worker/tests/article-contributors.test.ts` — author and pull-quote persistence/validation behavior.
- `src/admin/views/ContributorsView.tsx` — contributor list with loading, empty, error, create, and edit states.
- `src/admin/components/ContributorEditorPanel.tsx` — contributor editor using established full-screen panel patterns.
- `tests/contributor-admin.spec.ts` — browser coverage for contributor administration.
- `tests/contributor-publishing-journey.spec.ts` — synthetic end-to-end publishing fixture.
- `tests/china-reachability.spec.ts` — same-origin API/media and contact fallback browser assertions.

**Modify:**

- `package.json` — add scanner and focused verification scripts.
- `src/lib/api.ts` — shared same-origin behavior plus full contributor/article API methods.
- `src/lib/storefrontApi.ts` — consume the same central API-origin helper.
- `src/types.ts` — admin contributor and article linkage fields.
- `functions/api/[[path]].ts` — configured Worker upstream with fail-closed validation.
- `functions/_middleware.ts` — configured Worker upstream for crawler metadata.
- `src/pages/BriefingPage.tsx`, `src/pages/McpPage.tsx`, `public/llms.txt` — remove browser/public hardcoded Worker URLs.
- The exact runtime files listed by `docs/OWNED_MEDIA_INVENTORY.md` — replace stock URLs only after an owned path exists.
- `src/components/shop/ProductInquiry.tsx` and WhatsApp-only public inquiry surfaces identified by the inventory — shared configured contact fallback.
- `public/_headers` — remove obsolete blocked hosts after runtime migration.
- `vite.config.ts` — align Workbox caching with owned same-origin paths.
- `worker/src/index.ts` — contributor write endpoints, mirrored host helper, and article linkage fields.
- `src/admin/AdminApp.tsx` — add the authorized `/admin/contributors` route without renaming existing routes.
- `src/admin/components/ArticleEditorModal.tsx` — contributor picker and pull-quote controls.
- `src/admin/views/MagazineView.tsx` — invalidate contributor-aware article queries when needed.
- `src/pages/ArticlePage.tsx` — contributor byline resolution with legacy fallback.
- `src/pages/ContributorProfilePage.tsx` — render the two existing pull-quote insertion points.
- `src/hooks/useContributor.ts` — retain and type normalized pull-quote data.
- `tests/people-smoke.spec.ts` — deterministic profile fixture assertions.

## Task 1: Establish a deterministic China dependency gate

**Files:**
- Create: `scripts/check-china-dependencies.mjs`
- Create: `scripts/check-china-dependencies.test.mjs`
- Modify: `package.json`

- [x] **Step 1: Write the failing scanner tests**

Create Node tests that call an exported `scanChinaDependencies(root)` and prove browser runtime files fail while tests and the edge proxy may be explicitly classified:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { scanChinaDependencies } from './check-china-dependencies.mjs';

test('flags blocked runtime media and browser Worker origins', async () => {
  const root = await mkdtemp(join(tmpdir(), 'teajia-china-'));
  await mkdir(join(root, 'src'), { recursive: true });
  await writeFile(join(root, 'src', 'bad.ts'), "export const x='https://images.unsplash.com/a'; const api='https://teajia-api.lightcodes.workers.dev';");
  const result = await scanChinaDependencies(root);
  assert.deepEqual(result.violations.map(v => v.kind).sort(), ['blocked-media', 'browser-api-origin']);
});

test('does not classify tests or configured edge upstreams as browser runtime', async () => {
  const root = await mkdtemp(join(tmpdir(), 'teajia-china-'));
  await mkdir(join(root, 'tests'), { recursive: true });
  await mkdir(join(root, 'functions', 'api'), { recursive: true });
  await writeFile(join(root, 'tests', 'fixture.spec.ts'), "const image='https://images.unsplash.com/fixture';");
  await writeFile(join(root, 'functions', 'api', '[[path]].ts'), "const upstream=env.WORKER_ORIGIN;");
  const result = await scanChinaDependencies(root);
  assert.equal(result.violations.length, 0);
});
```

- [x] **Step 2: Run the tests and verify the expected failure**

Run: `node --test scripts/check-china-dependencies.test.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `check-china-dependencies.mjs`.

- [x] **Step 3: Implement the scanner**

Export `scanChinaDependencies(root)`. Recursively scan `src`, `public`, `functions`, and `dist`; ignore `tests`, `test-results`, source maps, binaries, and `node_modules`. Report `{file,line,kind,value}` for:

```js
const RULES = [
  { kind: 'blocked-media', re: /https:\/\/(?:images\.unsplash\.com|source\.unsplash\.com|picsum\.photos)\b/g },
  { kind: 'browser-api-origin', re: /https:\/\/teajia-api\.lightcodes\.workers\.dev\b/g },
  { kind: 'google-font-runtime', re: /https:\/\/fonts\.(?:googleapis|gstatic)\.com\b/g },
];
```

Classify `functions/**` as edge code: it may contain no literal Worker origin after Task 3, but scanner output there is `edge-origin` inventory rather than a browser violation. CLI behavior must print each violation as `file:line kind value` and exit 1 when violations exist. Add scripts:

```json
"test:china-scan": "node --test scripts/check-china-dependencies.test.mjs",
"audit:china": "node scripts/check-china-dependencies.mjs ."
```

- [x] **Step 4: Run focused tests and inventory the current failures**

Run: `npm run test:china-scan && npm run audit:china`

Expected: scanner unit tests PASS; repository audit exits 1 and lists current Unsplash/Picsum/browser-origin occurrences with file and line.

- [x] **Step 5: Commit the scanner**

```bash
git add scripts/check-china-dependencies.mjs scripts/check-china-dependencies.test.mjs package.json
git commit -m "test: add China dependency gate"
```

## Task 2: Build the owned-media replacement ledger

**Files:**
- Create: `docs/OWNED_MEDIA_INVENTORY.md`
- Read only: `functions/media/[[path]].ts`, `src/lib/mediaUrl.ts`, Cloudflare/R2 configuration files

- [x] **Step 1: Generate the raw inventory**

Run:

```bash
rg -n "images\.unsplash\.com|source\.unsplash\.com|picsum\.photos" src public --glob '!**/*.test.*' --glob '!**/*.spec.*' > /tmp/teajia-owned-media-inventory.txt
```

Expected: exit 0 and one line for every runtime stock-media occurrence.

- [x] **Step 2: Verify every candidate replacement actually exists**

For each occurrence, choose exactly one disposition:

- `owned-existing`: an already present checked-in asset or confirmed `/media/<key>` object;
- `remove`: decorative/demo content can be removed without replacing factual editorial meaning;
- `removed`: the runtime dependency was deleted or replaced with code-native presentation, without claiming an owned photograph exists.

Verify checked-in files with `test -f <path>`. Verify remote owned objects with `curl -fsSI https://teajia.com/media/<key>`. Never convert a stock URL to an unverified `/media/*` guess.

- [x] **Step 3: Write the ledger**

Create `docs/OWNED_MEDIA_INVENTORY.md` with this exact column contract and one row per scanner occurrence:

```markdown
| Source file:line | Screen/content owner | Current host | Disposition | Verified owned path | Verification evidence |
|---|---|---|---|---|---|
```

Record the historical starting count and final `owned-existing`, `removed`, and remaining counts. The completed ledger records 174 initial occurrences, 174 removed, and zero remaining without inventing media.

- [x] **Step 4: Cross-check completeness**

Run: `test "$(wc -l < /tmp/teajia-owned-media-inventory.txt | tr -d ' ')" = "$(rg -c '^\|' docs/OWNED_MEDIA_INVENTORY.md | awk '{s+=$1} END {print s-2}')"`

Expected: PASS. If Markdown separator counting differs, compare the two explicit totals manually and record the exact scanner total in the document.

- [x] **Step 5: Commit the evidence ledger**

```bash
git add docs/OWNED_MEDIA_INVENTORY.md
git commit -m "docs: inventory China-blocked runtime media"
```

## Task 3: Centralize same-origin API and configured edge upstreams

**Files:**
- Modify: `src/lib/api.ts`
- Modify: `src/lib/storefrontApi.ts`
- Modify: `functions/api/[[path]].ts`
- Modify: `functions/_middleware.ts`
- Modify: `src/pages/BriefingPage.tsx`
- Modify: `src/pages/McpPage.tsx`
- Modify: `public/llms.txt`
- Test: `scripts/check-china-dependencies.test.mjs`

- [x] **Step 1: Add failing origin-policy tests**

Extend the scanner tests with a fixture containing `BriefingPage.tsx`, `McpPage.tsx`, and `public/llms.txt` literals and assert all three are `browser-api-origin` violations. Add a source assertion that `functions/api/[[path]].ts` references `context.env.WORKER_ORIGIN`, not a literal.

- [x] **Step 2: Run the focused tests**

Run: `npm run test:china-scan`

Expected: FAIL because the new configured-upstream assertion is false.

- [x] **Step 3: Expose one browser API-origin helper**

In `src/lib/api.ts`, export:

```ts
export function getApiOrigin(): string {
  if (import.meta.env.PROD) {
    return typeof window !== 'undefined' ? window.location.origin : 'https://www.teajia.com';
  }
  return (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');
}
export const API_URL = getApiOrigin();
```

Use this in `src/lib/storefrontApi.ts`. Make `BriefingPage.tsx` and `McpPage.tsx` use the shared helper. Change public documentation to the same-origin public MCP URL `https://teajia.com/mcp/public` if that route is confirmed by Pages routing; otherwise remove the unverified public endpoint sentence.

- [x] **Step 4: Configure edge upstreams and fail closed**

Change the Pages Function signatures to receive `env: { WORKER_ORIGIN?: string }`. Normalize with `new URL(env.WORKER_ORIGIN)` and return a JSON 503 when absent/invalid. Accept only `https:` in production. Use the same configured value in crawler metadata middleware. Preserve `redirect: 'manual'` for OAuth.

- [x] **Step 5: Verify browser and edge origin behavior**

Run:

```bash
npm run test:china-scan
npm run lint
npm run build
rg -n "teajia-api\.lightcodes\.workers\.dev" src public dist
```

Expected: tests, lint, and build PASS; final `rg` exits 1 with no browser/public/built literal. Edge functions contain only `env.WORKER_ORIGIN`.

- [x] **Step 6: Commit origin centralization**

```bash
git add src/lib/api.ts src/lib/storefrontApi.ts functions/api/\[\[path\]\].ts functions/_middleware.ts src/pages/BriefingPage.tsx src/pages/McpPage.tsx public/llms.txt scripts/check-china-dependencies.test.mjs
git commit -m "fix: centralize same-origin API access"
```

## Task 4: Replace runtime stock media only with verified owned paths

**Files:**
- Modify: exact source files marked `owned-existing` or `remove` in `docs/OWNED_MEDIA_INVENTORY.md`
- Modify: `docs/OWNED_MEDIA_INVENTORY.md`
- Test: `scripts/check-china-dependencies.test.mjs`

- [x] **Step 1: Add a failing repository-level scanner assertion**

Add a test invoking `scanChinaDependencies(process.cwd())` and assert no `blocked-media` violations outside test fixtures.

- [x] **Step 2: Run the scan and verify it fails**

Run: `npm run test:china-scan`

Expected: FAIL and print every remaining runtime Unsplash/Picsum reference.

- [x] **Step 3: Apply verified replacements by independent content family**

Replace only rows marked `owned-existing` with their verified `/media/*` or checked-in paths. Remove only rows marked `remove`, preserving layout with an intentional text/solid-token fallback. Work family-by-family so each diff is reviewable: public pages/components; static data; photo essays; demo/admin defaults. Do not edit test fixture URLs in this step.

- [x] **Step 4: Stop if editorial media remains unavailable**

The completed implementation did not fabricate imagery: dormant content was deleted and the live founder, Shop-set, and contributor surfaces received code-native plates. Scanner and CSP policy stayed strict and now report zero findings.

- [x] **Step 5: Verify owned paths and rendered fallbacks**

Run:

```bash
npm run test:china-scan
npm run audit:china
npm run lint
npm run build
```

Expected: all commands PASS; scanner reports zero runtime blocked-media violations. Manually open each changed public route and confirm no broken image icon, layout collapse, console error, or horizontal overflow.

- [x] **Step 6: Commit the owned-media migration**

```bash
git add docs/OWNED_MEDIA_INVENTORY.md src public
git commit -m "fix: move public runtime media to owned paths"
```

## Task 5: Add a configured email fallback to public inquiries

**Files:**
- Create: `src/lib/contact.ts`
- Create: `src/lib/contact.test.ts`
- Modify: `src/components/shop/ProductInquiry.tsx`
- Modify: public WhatsApp-only inquiry components identified by `rg -l "buildWhatsAppUrl|wa\.me" src/pages src/components`
- Modify: account-public response in `worker/src/index.ts` only if `contact_email` is not already returned
- Test: `tests/china-reachability.spec.ts`

- [x] **Step 1: Write failing contact resolver tests**

```ts
import { describe, expect, it } from 'vitest';
import { resolveContactChannels } from './contact';

describe('resolveContactChannels', () => {
  it('offers both configured channels', () => {
    expect(resolveContactChannels({ whatsappNumber: '+62 812', email: 'tea@example.com', message: 'Yancha' }))
      .toMatchObject([{ kind: 'whatsapp' }, { kind: 'email', href: 'mailto:tea@example.com?subject=Teajia%20inquiry&body=Yancha' }]);
  });
  it('falls back to email when WhatsApp is unavailable', () => {
    expect(resolveContactChannels({ email: 'tea@example.com', message: 'Yancha' }).map(x => x.kind)).toEqual(['email']);
  });
  it('returns an explicit unavailable channel when neither is configured', () => {
    expect(resolveContactChannels({ message: 'Yancha' })).toEqual([{ kind: 'unavailable', label: 'Contact is not configured for this shop.' }]);
  });
});
```

- [x] **Step 2: Run the focused test and verify failure**

Run: `npx vitest run src/lib/contact.test.ts`

Expected: FAIL because `resolveContactChannels` does not exist.

- [x] **Step 3: Implement the resolver**

Return a typed ordered array of WhatsApp, email, or unavailable channels. Normalize WhatsApp digits through the existing `buildWhatsAppUrl`; build email with `URLSearchParams`-equivalent encoding. Never persist an inquiry only to localStorage and claim it was sent.

- [x] **Step 4: Integrate configured account contact data**

Pass `activeAccount.whatsapp_number` and `activeAccount.contact_email` into the shared resolver. Replace `ProductInquiry`'s localStorage-only email submission with a visible `mailto:` handoff, labelled “Email”, and explain that the user's email application will open. Update WhatsApp-only commerce surfaces to show Email whenever WhatsApp is missing. Preserve inquiry-led commerce and existing route/nav names.

- [x] **Step 5: Add browser coverage**

In `tests/china-reachability.spec.ts`, route the account/public API with three fixtures and assert:

```ts
await expect(page.getByRole('link', { name: /email/i })).toHaveAttribute('href', /^mailto:china-contact@example\.com/);
await expect(page.getByText('Contact is not configured for this shop.')).toBeVisible();
```

Also assert no `wa.me` link renders when no WhatsApp number is configured.

- [x] **Step 6: Run focused verification**

Run:

```bash
npx vitest run src/lib/contact.test.ts
npx playwright test tests/china-reachability.spec.ts --project='Mobile Chrome' --reporter=list
npm run lint
npm run lint:colors
```

Expected: all commands PASS.

- [x] **Step 7: Commit contact fallback**

```bash
git add src/lib/contact.ts src/lib/contact.test.ts src/components src/pages worker/src/index.ts tests/china-reachability.spec.ts
git commit -m "feat: add configured email inquiry fallback"
```

## Task 6: Add account-safe contributor CRUD and publication

**Files:**
- Create: `worker/tests/contributors.test.ts`
- Modify: `worker/src/index.ts`
- Modify: `src/lib/api.ts`
- Modify: `src/types.ts`

- [x] **Step 1: Write failing Worker behavior tests**

Use the existing Worker test harness and schema fixture. Cover:

```ts
it('creates a draft contributor in the authenticated account');
it('rejects a contributor slug already used by another account without exposing that row');
it('denies read and update across accounts');
it('rejects publication until beginnings is nonblank');
it('normalizes links to label and https URL pairs');
it('sets and clears contributor.face_of_account_id and accounts.host_contributor_id together');
it('rejects a face_of_account_id outside the authenticated account');
it('reassigns an account host without leaving a stale mirror');
```

Assert exact statuses: 201 create, 404 cross-account resources, 400 invalid publication/links, 409 slug/host conflicts, 200 successful update.

- [x] **Step 2: Run the focused Worker test**

Run: `npx vitest run worker/tests/contributors.test.ts`

Expected: FAIL because `POST /api/admin/contributors`, `GET /api/admin/contributors/:id`, and the general update endpoint do not exist.

- [x] **Step 3: Implement contributor parsing and validation**

Define one allowed-field set matching migration 059. Trim scalar strings; enforce slug `/^[a-z0-9]+(?:-[a-z0-9]+)*$/`; enforce `closing.length <= 200`; parse links as an array of `{label:string,url:string}` and accept only `https:` URLs. Ignore client `account_id`, `created_at`, and `updated_at`. Publishing requires nonblank `beginnings`.

- [x] **Step 4: Implement the mirrored host helper**

Add a helper that receives authenticated `accountId`, contributor ID, and requested host account. Validate both contributor and target account belong to the authenticated account boundary. In one `env.DB.batch()`:

1. clear the contributor's previous account mirror;
2. clear the target account's previous contributor link;
3. clear the previous contributor's `face_of_account_id` when reassigning;
4. write the new `contributors.face_of_account_id` and `accounts.host_contributor_id` pair.

Passing `null` must unlink both sides. No partial writes are allowed.

- [x] **Step 5: Add routes and API methods**

Register:

```text
POST /api/admin/contributors
GET  /api/admin/contributors/:id
PUT  /api/admin/contributors/:id
POST /api/admin/contributors/:id/publish
POST /api/admin/contributors/:id/unpublish
```

Use `requireOwnerTier` consistently with the existing contact-link endpoint. Add typed methods under `api.people` and define `AdminContributor`/`ContributorWrite` in `src/types.ts`.

- [x] **Step 6: Run Worker and type verification**

Run:

```bash
npx vitest run worker/tests/contributors.test.ts worker/tests/auth-boundaries.test.ts
npm run lint
```

Expected: all tests and type-check PASS.

- [x] **Step 7: Commit contributor APIs**

```bash
git add worker/src/index.ts worker/tests/contributors.test.ts src/lib/api.ts src/types.ts
git commit -m "feat: add account-safe contributor administration API"
```

## Task 7: Build contributor list and editor administration

**Files:**
- Create: `src/admin/views/ContributorsView.tsx`
- Create: `src/admin/components/ContributorEditorPanel.tsx`
- Create: `tests/contributor-admin.spec.ts`
- Modify: `src/admin/AdminApp.tsx`

- [x] **Step 1: Write the failing contributor admin browser test**

Mock admin contributor APIs and assert loading, empty, error/retry, create, edit, and publish validation states. The success fixture must use synthetic text:

```ts
const fixture = {
  id: 'publishing-fixture', display_name: 'Publishing Fixture', role: 'Writer',
  beginnings: 'Synthetic origin text used only to verify the publishing path.',
  now_text: 'Testing the current-practice field.', inspirations: 'Testing inspirations.',
  closing: 'Synthetic fixture closing.', links: [{ label: 'Fixture', url: 'https://example.com' }],
  is_published: 0,
};
```

Assert no request body contains `Barry`.

- [x] **Step 2: Run the browser test and verify failure**

Run: `npx playwright test tests/contributor-admin.spec.ts --project='Desktop Chrome' --reporter=list`

Expected: FAIL because `/admin/contributors` has no route.

- [x] **Step 3: Implement the list view**

Use React Query key `['admin-contributors']`. Render accessible refresh and create buttons, published/draft status, account-host label, loading, empty, error/retry, and row-to-editor behavior. Use `TYPOGRAPHY_CLASSES`, safe color tokens, `tap-target`, and no horizontal scrolling.

- [x] **Step 4: Implement the editor panel**

Use a full-screen `z-modal` panel with close X at top-left, scrollable body with `pb-nav-gap`, and footer `flex justify-between`: Cancel left, Save/Publish right. Fields: display name, Chinese name, role, pronouns, location, active since, beginnings, current practice (`now_text`), current stamp, inspirations, closing with 200-character counter, avatar/portrait/voice owned-media URLs, pouring-today fields, where-to-find text, links, contact association, and host-account association. Do not create or rewrite prose.

- [x] **Step 5: Register the route**

Add `/admin/contributors` under the existing publish-bundle gate. Do not rename `magazine`, `people`, or any existing nav item. If the established admin navigation source has a Publish subsection, add “Contributors” there; otherwise make the route reachable from `MagazineView` with a secondary “Contributors” link rather than redesigning navigation.

- [x] **Step 6: Run UI verification**

Run:

```bash
npx playwright test tests/contributor-admin.spec.ts --project='Desktop Chrome' --project='Mobile Chrome' --reporter=list
npm run lint
npm run lint:colors
```

Expected: all commands PASS; mobile panel content remains above the bottom nav and has no horizontal overflow.

- [x] **Step 7: Commit contributor UI**

```bash
git add src/admin/views/ContributorsView.tsx src/admin/components/ContributorEditorPanel.tsx src/admin/AdminApp.tsx tests/contributor-admin.spec.ts
git commit -m "feat: add contributor editor workflow"
```

## Task 8: Replace free-text article authors and persist pull quotes

**Files:**
- Create: `worker/tests/article-contributors.test.ts`
- Create: `tests/article-editor-contributors.spec.ts`
- Modify: `worker/src/index.ts`
- Modify: `src/lib/api.ts`
- Modify: `src/types.ts`
- Modify: `src/admin/components/ArticleEditorModal.tsx`
- Modify: `src/admin/views/MagazineView.tsx`

- [x] **Step 1: Write failing Worker tests**

Cover article create/update round trips for `author_id`, `subject_ids`, `pull_quote`, and `pull_quote_subject`; reject newly selected contributor IDs from another account; accept an unchanged unknown legacy `author_id`; reject a pull-quote subject outside the account; and ensure public list/detail responses return contributor display names when linked.

- [x] **Step 2: Run the focused Worker tests**

Run: `npx vitest run worker/tests/article-contributors.test.ts`

Expected: FAIL because create/update allowlists and serializers omit the linkage fields.

- [x] **Step 3: Extend article persistence safely**

Add `subject_ids`, `pull_quote`, and `pull_quote_subject` to create, update, list, get, and public serializers. Validate JSON arrays and account-owned contributor references. Join `contributors` on both ID and article account for `author_name`; retain the existing user/legacy fallback only when no contributor exists. On update, permit an unknown author only when it exactly equals the article's stored pre-update value.

- [x] **Step 4: Extend article types and payloads**

Add to `DbArticle`:

```ts
subject_ids?: string[];
pull_quote?: string;
pull_quote_subject?: string;
```

Add those fields to `ArticleEditorModal` state, reset behavior, autosave dependencies, and `buildPayload`.

- [x] **Step 5: Write the failing editor test**

Mock contributor search/list with two contributors and load an article whose `author_id` is `legacy-writer`. Assert the picker displays `Legacy author: legacy-writer`, selecting a contributor sends its slug, pull-quote subject is selected from contributors, and pull-quote text is included in PUT.

- [x] **Step 6: Implement searchable contributor selectors**

Use the existing command/search pattern (`cmdk` or established searchable select). Never expose a free-text author field for new values. Preserve an unknown current legacy value as a disabled/current option until the editor selects a contributor. Provide empty/loading/error states and accessible labels “Author” and “Pull quote subject”.

- [x] **Step 7: Run focused verification**

Run:

```bash
npx vitest run worker/tests/article-contributors.test.ts
npx playwright test tests/article-editor-contributors.spec.ts --project='Desktop Chrome' --reporter=list
npm run lint
npm run lint:colors
```

Expected: all commands PASS.

- [x] **Step 8: Commit article linkage editing**

```bash
git add worker/src/index.ts worker/tests/article-contributors.test.ts src/lib/api.ts src/types.ts src/admin/components/ArticleEditorModal.tsx src/admin/views/MagazineView.tsx tests/article-editor-contributors.spec.ts
git commit -m "feat: link article authors and pull quotes to contributors"
```

## Task 9: Render contributor bylines and pull quotes with legacy compatibility

**Files:**
- Modify: `src/pages/ArticlePage.tsx`
- Modify: `src/pages/ContributorProfilePage.tsx`
- Modify: `src/hooks/useContributor.ts`
- Modify: `tests/people-smoke.spec.ts`

- [x] **Step 1: Make public profile tests deterministic and failing**

Route `**/api/people/publishing-fixture` with two pull quotes and one authored article. Assert quote one appears after Origin and quote two after Inspirations, each links to `/article/<slug>`. Route an article with contributor `author_name` and assert linked byline `/people/publishing-fixture`. Add a legacy article fixture and assert its formatted byline remains plain text.

- [x] **Step 2: Run the focused tests**

Run: `npx playwright test tests/people-smoke.spec.ts --project='Desktop Chrome' --reporter=list`

Expected: FAIL because the profile insertion comments render nothing.

- [x] **Step 3: Implement pull-quote rendering**

Add a small local `ContributorPullQuoteBlock` that uses semantic `blockquote`, cites and links the source article, uses typography/design tokens, and renders only when a quote exists. Insert `pull_quotes[0]` at `PULL_QUOTE_AFTER_ORIGIN` and `pull_quotes[1]` at `PULL_QUOTE_AFTER_INSPIRATIONS`. Do not duplicate one quote into both positions.

- [x] **Step 4: Resolve article bylines**

Prefer API `author_name` plus a contributor link when `author_id` maps to a contributor. Preserve the current UUID/slug legacy formatting behavior for old rows and never hide an already visible legacy author merely because no contributor exists.

- [x] **Step 5: Run public-route verification**

Run:

```bash
npx playwright test tests/people-smoke.spec.ts tests/read-index-articles.spec.ts --project='Desktop Chrome' --project='Mobile Chrome' --reporter=list
npm run lint
npm run lint:colors
```

Expected: all commands PASS with no console errors or horizontal overflow.

- [x] **Step 6: Commit public contributor rendering**

```bash
git add src/pages/ArticlePage.tsx src/pages/ContributorProfilePage.tsx src/hooks/useContributor.ts tests/people-smoke.spec.ts
git commit -m "feat: render contributor bylines and pull quotes"
```

## Task 10: Tighten CSP and service-worker behavior after migration

**Files:**
- Modify: `public/_headers`
- Modify: `vite.config.ts`
- Modify: `scripts/check-china-dependencies.mjs`
- Modify: `scripts/check-china-dependencies.test.mjs`
- Modify: `tests/china-reachability.spec.ts`

- [x] **Step 1: Add failing built-output assertions**

Extend the scanner to inspect `dist/_headers` and `dist/sw.js`. Assert CSP `img-src` excludes Unsplash/Picsum, `connect-src` excludes the Worker literal, and generated SW contains same-origin `/api/` and `/media/` routing without Google Fonts runtime caching.

- [x] **Step 2: Build and verify the assertion fails**

Run: `npm run build && npm run audit:china`

Expected: FAIL because current `_headers` permits blocked media/Worker hosts and Workbox still has Google Fonts caching.

- [x] **Step 3: Tighten CSP**

Remove `https://images.unsplash.com`, `https://picsum.photos`, and the Worker origin from browser directives. Remove other media hosts only when the scanner and owned-media ledger prove they are unused. Keep necessary Google OAuth `frame-src`/`form-action` because Google remains an optional path; Release 1 email OTP is the China path. Keep `worker-src 'self' blob:` and same-origin defaults.

- [x] **Step 4: Align Workbox with owned paths**

Retain navigation denylist for `/api`, `/media`, `/mcp`, `/oauth`, and `/.well-known`. Retain NetworkFirst for same-origin GET `/api` and CacheFirst for immutable same-origin `/media`. Remove Google Fonts runtime caching when fonts are confirmed locally served. Do not cache POST, OTP, auth, or contributor mutation responses.

- [x] **Step 5: Test service-worker network policy in the browser**

In `tests/china-reachability.spec.ts`, use a production preview build. Assert `/api/articles` reaches the network instead of SPA HTML, `/media/<fixture>` is requested same-origin, and a second owned-media read succeeds through the registered service worker/cache. Assert OTP POST is not served from cache.

- [x] **Step 6: Run built verification**

Run:

```bash
npm run build
npm run audit:china
rg -n "unsplash|picsum|teajia-api\.lightcodes|fonts\.googleapis|fonts\.gstatic" dist/_headers dist/sw.js
```

Expected: build and audit PASS; `rg` exits 1 with no matches.

- [x] **Step 7: Commit CSP and Workbox policy**

```bash
git add public/_headers vite.config.ts scripts/check-china-dependencies.mjs scripts/check-china-dependencies.test.mjs tests/china-reachability.spec.ts
git commit -m "fix: enforce owned-origin CSP and service-worker policy"
```

## Task 11: Validate the full publishing path with a synthetic Barry-ready fixture

**Files:**
- Create: `tests/contributor-publishing-journey.spec.ts`
- Test only: browser-routed synthetic API fixtures or isolated test database

- [x] **Step 1: Write the complete failing journey**

Use only this test identity and prose:

```ts
const contributor = {
  id: 'publishing-fixture',
  display_name: 'Publishing Fixture',
  role: 'Writer',
  beginnings: 'Synthetic origin text used only to verify the contributor publishing path.',
  now_text: 'Synthetic current-practice text.',
  inspirations: 'Synthetic inspirations text.',
  closing: 'Synthetic closing text.',
  links: [{ label: 'Fixture reference', url: 'https://example.com/fixture' }],
};
const article = {
  title: 'Synthetic Publishing Path',
  author_id: 'publishing-fixture',
  pull_quote: 'A synthetic pull quote proves placement without borrowing a real contributor voice.',
  pull_quote_subject: 'publishing-fixture',
};
```

Journey: create contributor; fill all designed fields; associate an account; publish; create article; select fixture as author and quote subject; publish article; visit article and contributor profile; verify linked byline, profile body, pull quote, and article link.

- [x] **Step 2: Add explicit content-safety assertions**

Capture every POST/PUT body and assert:

```ts
expect(JSON.stringify(requestBodies)).not.toMatch(/Barry/i);
expect(JSON.stringify(requestBodies)).not.toMatch(/Rasmussen/i);
expect(requestBodies.every(body => !body.is_real_editorial_content)).toBe(true);
```

No fixture may be inserted by a production migration or left published in a shared environment.

- [x] **Step 3: Run the journey and verify initial failure**

Run: `npx playwright test tests/contributor-publishing-journey.spec.ts --project='Desktop Chrome' --reporter=list`

Expected: FAIL at the first still-unimplemented integration boundary.

- [x] **Step 4: Fix only integration defects exposed by the journey**

Correct query invalidation, response typing, route handoff, or rendering defects in the files introduced by Tasks 6–9. Do not add Barry content, infer personal biography, or publish a real contributor.

- [x] **Step 5: Run desktop and mobile fixture validation**

Run:

```bash
npx playwright test tests/contributor-publishing-journey.spec.ts --project='Desktop Chrome' --project='Mobile Chrome' --reporter=list
```

Expected: PASS on both projects, with fixture cleanup or fully intercepted APIs leaving no persistent row.

- [x] **Step 6: Commit the fixture gate**

```bash
git add tests/contributor-publishing-journey.spec.ts src worker
git commit -m "test: validate contributor publishing journey"
```

## Task 12: Release 3 verification and handoff

**Files:**
- Modify only if evidence requires correction: `docs/OWNED_MEDIA_INVENTORY.md`
- Read: `worker/migrations/059_contributors.sql`, newest Worker migration, Release 1 OTP verification evidence

- [x] **Step 1: Rehearse migrations from a clean schema**

Run the repository's migration rehearsal command against a disposable D1 database through the newest migration, explicitly confirming `059_contributors.sql` is applied once and its `INSERT OR IGNORE` seed remains idempotent. If no wrapper script exists, use the same `wrangler d1 migrations apply <disposable-db> --local` command established by Releases 1 and 2.

Expected: exit 0; contributors and article linkage columns exist; re-running reports no destructive duplicate-column application because migration bookkeeping prevents a second application.

- [x] **Step 2: Rehearse from the current legacy snapshot**

Copy the current legacy fixture into a disposable database, run pending migrations, and query:

```sql
SELECT COUNT(*) FROM contributors;
SELECT COUNT(*) FROM pragma_table_info('articles') WHERE name IN ('subject_ids','pull_quote','pull_quote_subject');
SELECT COUNT(*) FROM pragma_table_info('accounts') WHERE name = 'host_contributor_id';
```

Expected: all queries succeed; article count query returns 3 and account query returns 1.

- [x] **Step 3: Run the complete Release 3 automated gate**

Run:

```bash
npm run test:china-scan
npm run audit:china
npm run test:worker
npx vitest run src/lib/contact.test.ts
npx playwright test tests/china-reachability.spec.ts tests/contributor-admin.spec.ts tests/article-editor-contributors.spec.ts tests/people-smoke.spec.ts tests/contributor-publishing-journey.spec.ts --reporter=list
npm run lint
npm run lint:colors
npm run build
```

Expected: every command PASS with fresh output.

- [x] **Step 4: Run the repository mobile gate with the dev server**

Terminal 1: `npm run dev`

Terminal 2: `npm run test:mobile`

Expected: all configured mobile tests PASS with no JS crash, console error, 404, horizontal overflow, bottom-nav collision, or Inventory height-chain regression.

- [ ] **Step 5: Verify deployed same-origin and OTP behavior**

On the review deployment, use browser network inspection to verify `/api/*` and `/media/*` remain on the deployment hostname, CSP has no blocked-resource errors, service-worker update completes, and Release 1 email OTP completes end-to-end without Google or WhatsApp. Record delivery/provider evidence without logging any verification code.

Expected: same-origin API/media requests succeed; OTP request, delivery, and verification succeed; POST responses are not served from service-worker cache.

Pending external evidence: local same-origin and OTP provider-boundary behavior is automated, but a deployed Resend receipt has not been recorded.

- [ ] **Step 6: Perform manual smoke tests**

Pending human/environment evidence: mainland-network, Australia operator, real commerce loop, and Adrian-approved Barry-content checks cannot be replaced by fixtures.

Smoke commerce contact fallback, authentication, account switching, Read, Magazine, contributor create/edit/publish, contributor author selection, pull-quote placement, and public profile/article linking. Confirm no route or navigation label was renamed.

- [x] **Step 7: Report human-only gates as pending**

The release report must state separately:

- actual mainland-China network testing is pending until performed from mainland China;
- Barry's real profile and article voice are pending Adrian-supplied or approved content;
- WeChat integration was not built because credentials and an operating workflow were not supplied.

Do not convert fixture success into a claim that these human gates passed.

- [x] **Step 8: Commit verification documentation if evidence changed it**

```bash
git add docs/OWNED_MEDIA_INVENTORY.md
git diff --cached --quiet || git commit -m "docs: record Release 3 reachability evidence"
```

## Final self-review checklist

- [x] Every Release 3 requirement maps to a task: owned media (Tasks 1–4), origins/contact/CSP/SW (Tasks 3, 5, 10), contributor administration (Tasks 6–7), author/pull quotes (Tasks 8–9), Barry-ready fixture (Task 11), release verification (Task 12).
- [x] Migration 059 is reused rather than duplicated, and both clean/current rehearsals are required.
- [x] Contributor/account mutations fail closed and host mirroring is atomic and account-scoped.
- [x] Existing legacy article author data remains visible and editable without accepting new arbitrary author IDs.
- [x] No owned-media URL is invented; every replacement has file or HTTP verification evidence.
- [x] No Barry biography, quotation, article prose, or publication is invented.
- [x] CSP and service-worker restrictions are tightened only after runtime migration passes.
- [x] Styling work follows `docs/COLOR_RULES.md`, typography tokens, tap targets, bottom-nav clearance, and `z-modal` rules.
- [x] No existing route, tab, or navigation label is renamed.
- [x] No completion claim is made without fresh final-gate output, and human-only checks remain explicitly pending.

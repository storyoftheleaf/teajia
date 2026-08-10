# Tea Reference Teajia Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the detached Tea Reference preview with a deterministic, read-only receiving preview rendered inside Teajia's existing Wisdom pages.

**Architecture:** Keep `previewWebsiteHandoff` as the pure trust boundary. A Vite development plugin loads the handoff from an explicit path and returns only `PublicReferencePreview`; a small React client consumes it in the actual Wisdom routes. Domain helpers derive sellable Pu'er family/type records and product-connected origin records without exposing verification data or inventing hierarchy.

**Tech Stack:** React 19, TypeScript 5.8, Vite 6 middleware, React Query, React Router 7, Vitest, Node test runner, Playwright.

---

## File map

- Modify `src/wisdom/receiving/previewImporter.ts`: strengthen the browser-safe projection boundary and export a runtime assertion.
- Modify `src/wisdom/receiving/previewImporter.test.ts`: test allowlisted projection, registers, idempotency, and publisher-role separation.
- Create `scripts/tea-reference-website-preview/vite-plugin.mjs`: local-only Vite middleware returning only the public projection.
- Create `scripts/tea-reference-website-preview/teajia-preview.mjs`: start the real Teajia Vite app in Tea Reference preview mode without writing files.
- Modify `scripts/tea-reference-website-preview/load-preview.mjs`: expose a public-transport loader without exposing the transpiled importer module.
- Modify `vite.config.ts`: activate the middleware only in `tea-reference-preview` serve mode.
- Modify `package.json`: replace detached serve/test scripts with the integrated preview command and focused tests.
- Delete `scripts/tea-reference-website-preview/index.html`, `serve.mjs`, and detached preview UI files under `src/dev/tea-reference-preview/`.
- Create `src/wisdom/reference/types.ts`: public family/type/place/fact/source view models only.
- Create `src/wisdom/reference/catalogue.ts`: deterministic family/type/origin derivation and active-product matching.
- Create `src/wisdom/reference/catalogue.test.ts`: model, matching, hierarchy, and privacy tests.
- Create `src/wisdom/reference/client.ts`: React Query loader for the local public endpoint.
- Create `src/pages/wisdom/ReferenceFactSections.tsx`: shared cited statements, sources, available teas, and report action.
- Create `src/pages/wisdom/TeaTypeIndexPage.tsx`, `TeaFamilyPage.tsx`, and `TeaTypePage.tsx`: actual Wisdom type routes.
- Modify `src/pages/wisdom/frame.tsx`: preview-only `Types` and `Origins` label, path activation.
- Modify `src/pages/wisdom/WisdomHomePage.tsx`: preview-only Types holding and Origins wording.
- Modify `src/pages/wisdom/RegionIndexPage.tsx`: preview-only cited origin section grouped by declared geographic level.
- Modify `src/pages/wisdom/RegionPage.tsx`: resolve preview origin records on existing region URLs and render hierarchy/citations/products.
- Modify `src/App.tsx`: preview-only lazy routes for types/families, preserving existing region routes.
- Modify `src/pages/wisdom/reference.test.tsx`: route, label, compatibility, and leakage coverage.
- Create `tests/tea-reference-preview.spec.ts`: actual desktop/mobile integrated preview checks.
- Update `docs/_notes/tea-reference-receiving-layer.md`: replace detached-preview instructions with actual Teajia preview instructions.

### Task 1: Lock the pure public boundary

**Files:**
- Modify: `src/wisdom/receiving/previewImporter.ts`
- Modify: `src/wisdom/receiving/previewImporter.test.ts`

- [ ] **Step 1: Write failing tests for a public-only transport object**

Add tests asserting that `publicTransportFor(preview)` returns only `manifest` and `publicPreview`, contains no `operations`, `projectedState`, `privateVerification`, evidence IDs, hold reasons, payload hashes, exact-lot text, or personal tasting, and throws for an unsupported public fact register.

```ts
const transport = publicTransportFor(previewWebsiteHandoff(handoff));
expect(Object.keys(transport)).toEqual(['manifest', 'publicPreview']);
expect(JSON.stringify(transport)).not.toMatch(/privateVerification|evidenceId|holdReason|personal_tasting|exact_lot/);
```

- [ ] **Step 2: Run the focused importer test and confirm failure**

Run: `npx vitest run src/wisdom/receiving/previewImporter.test.ts`

Expected: FAIL because `publicTransportFor` does not exist.

- [ ] **Step 3: Add the minimal allowlisted transport type and function**

```ts
export interface WebsiteReceivingPublicTransport {
  manifest: { schemaVersion: 1; mode: 'preview-only' };
  publicPreview: PublicReferencePreview;
}

export function publicTransportFor(preview: WebsiteReceivingPreview): WebsiteReceivingPublicTransport {
  assertPublicReferencePreview(preview.publicPreview);
  return {
    manifest: { schemaVersion: 1, mode: 'preview-only' },
    publicPreview: structuredClone(preview.publicPreview),
  };
}
```

The assertion must recursively reject private-key names (`evidenceId`, `candidateValue`, `reason`, `status`, `operations`, `verification`) and reject statement labels/registers for exact-lot or personal tasting.

- [ ] **Step 4: Run focused tests**

Run: `npx vitest run src/wisdom/receiving/previewImporter.test.ts`

Expected: PASS.

### Task 2: Replace the detached server with a Teajia-only local adapter

**Files:**
- Create: `scripts/tea-reference-website-preview/vite-plugin.mjs`
- Create: `scripts/tea-reference-website-preview/teajia-preview.mjs`
- Modify: `scripts/tea-reference-website-preview/load-preview.mjs`
- Modify: `vite.config.ts`
- Modify: `package.json`
- Modify: `scripts/tea-reference-website-preview/tests/integrity.test.mjs`
- Modify: `scripts/tea-reference-website-preview/tests/args.test.mjs`
- Delete: `scripts/tea-reference-website-preview/index.html`
- Delete: `scripts/tea-reference-website-preview/serve.mjs`
- Delete: `src/dev/tea-reference-preview/main.tsx`
- Delete: `src/dev/tea-reference-preview/TeaReferencePreview.tsx`
- Delete: `src/dev/tea-reference-preview/TeaReferencePreview.test.tsx`

- [ ] **Step 1: Write failing Node tests for endpoint privacy and mode gating**

Test that the adapter returns `404`/is absent outside `tea-reference-preview`, returns the public transport inside the mode, never serializes private receiving fields, and returns a bounded diagnostic on invalid input.

- [ ] **Step 2: Run the Node tests and confirm failure**

Run: `node --test scripts/tea-reference-website-preview/tests/*.test.mjs`

Expected: FAIL because the Vite adapter does not exist.

- [ ] **Step 3: Implement the read-only middleware**

The plugin must read `TEA_REFERENCE_HANDOFF_PATH`, call a new `loadPublicTransport` helper that applies `publicTransportFor` inside the transpiled importer module, and respond only at `/__tea-reference-preview`. It must set `Cache-Control: no-store`, serialize no raw exception/candidate data, and keep the preview in memory.

```js
export function teaReferencePreviewPlugin({ command, mode, handoffPath }) {
  if (command !== 'serve' || mode !== 'tea-reference-preview') return null;
  return {
    name: 'tea-reference-teajia-preview',
    configureServer(server) {
      server.middlewares.use('/__tea-reference-preview', async (_request, response) => {
        response.setHeader('Cache-Control', 'no-store');
        try {
          const preview = await loadPublicTransport({ handoffPath });
          response.setHeader('Content-Type', 'application/json');
          response.end(JSON.stringify(preview));
        } catch {
          response.statusCode = 422;
          response.end(JSON.stringify({ error: 'Tea Reference preview could not be loaded.' }));
        }
      });
    },
  };
}
```

- [ ] **Step 4: Implement the wrapper command and Vite mode**

The command parses `--handoff`, verifies it is readable, and spawns the repository's Vite binary with `--mode tea-reference-preview`, passing the path only through the child environment. It must not create `.env`, snapshot, cache, or generated data files.

- [ ] **Step 5: Remove the detached UI/server and update scripts**

Keep the JSON report command. Replace `tea-reference:website:serve` with `tea-reference:teajia:preview` and update `test:tea-reference-receiving` to cover the importer, catalogue, Wisdom routes, and Node adapter tests.

- [ ] **Step 6: Run adapter tests**

Run: `node --test scripts/tea-reference-website-preview/tests/*.test.mjs`

Expected: PASS.

### Task 3: Derive sellable reference entities without flattening

**Files:**
- Create: `src/wisdom/reference/types.ts`
- Create: `src/wisdom/reference/catalogue.ts`
- Create: `src/wisdom/reference/catalogue.test.ts`

- [ ] **Step 1: Write failing model and matching tests**

Cover these exact rules:

```ts
expect(catalogue.families.map(item => item.id)).toEqual(['puer']);
expect(catalogue.types.find(item => item.id === 'sheng')?.familyId).toBe('puer');
expect(catalogue.types.some(item => item.id === 'shou')).toBe(false); // no matched active product in fixture
expect(catalogue.origins.find(item => item.id === 'menghai-county')?.level).toBe('tea_area');
expect(catalogue.origins.find(item => item.id === 'menghai-county')?.parentId).toBeUndefined();
expect(JSON.stringify(catalogue)).not.toMatch(/held|evidence|candidate|verification/);
```

Use fixtures containing active Sheng, active Shou, unrelated Oolong, inactive/unlisted, and matching/missing origin records. Assert a family survives when a child type matches, an origin ancestor survives when a descendant matches, and taxonomy terms never become entities.

- [ ] **Step 2: Run the catalogue test and confirm failure**

Run: `npx vitest run src/wisdom/reference/catalogue.test.ts`

Expected: FAIL because the catalogue module does not exist.

- [ ] **Step 3: Implement focused public view types**

```ts
export type PlaceLevel = 'major_region' | 'tea_area' | 'mountain' | 'village' | 'locality';
export interface PublicTeaFamily { id: string; name: string; facts: PublicReferenceStatement[]; productIds: string[]; }
export interface PublicTeaType { id: string; name: string; familyId: string; facts: PublicReferenceStatement[]; productIds: string[]; }
export interface PublicTeaOrigin { id: string; name: string; level: PlaceLevel; parentId?: string; facts: PublicReferenceStatement[]; productIds: string[]; }
export interface TeaReferenceCatalogue { families: PublicTeaFamily[]; types: PublicTeaType[]; origins: PublicTeaOrigin[]; sources: PublicReferencePreview['sources']; }
```

- [ ] **Step 4: Implement deterministic derivation**

Use normalized exact/token-boundary matching against `PublicProduct.type`, `originRegion`, `originCountry`, `givenName`, and `productName`. Never use supplier/vendor fields. Map handoff `tea_family` Pu'er to `puer`; map Sheng/Shou `tea_style` entries to controlled tea types; ignore `taxonomy_term` and `glossary_term`. Keep origin `entityKind` as its `level`; read a parent only from an allowlisted public `parentId` when present.

- [ ] **Step 5: Run catalogue tests**

Run: `npx vitest run src/wisdom/reference/catalogue.test.ts`

Expected: PASS.

### Task 4: Add the actual Wisdom type experience

**Files:**
- Create: `src/wisdom/reference/client.ts`
- Create: `src/pages/wisdom/ReferenceFactSections.tsx`
- Create: `src/pages/wisdom/TeaTypeIndexPage.tsx`
- Create: `src/pages/wisdom/TeaFamilyPage.tsx`
- Create: `src/pages/wisdom/TeaTypePage.tsx`
- Modify: `src/pages/wisdom/frame.tsx`
- Modify: `src/pages/wisdom/WisdomHomePage.tsx`
- Modify: `src/App.tsx`
- Modify: `src/pages/wisdom/reference.test.tsx`

- [ ] **Step 1: Write failing route/navigation/rendering tests**

In preview mode assert:

- `WISDOM_SECTIONS` contains `Types` and displays `Origins` at the unchanged `/wisdom/regions` path;
- `/wisdom/types`, `/wisdom/family/puer`, and `/wisdom/type/sheng` render inside the Wisdom frame;
- Type pages show cited reference notes and matching `/shop/product/:id` links;
- Shou is absent when it has no matched public product;
- public HTML contains no held/conflict/private wording.

In normal mode assert the current section labels and existing routes remain unchanged.

- [ ] **Step 2: Run the focused Wisdom test and confirm failure**

Run: `npx vitest run src/pages/wisdom/reference.test.tsx`

Expected: FAIL because preview types/routes do not exist.

- [ ] **Step 3: Add the public client and shared rendering components**

`useTeaReferencePreview` fetches `/__tea-reference-preview` only when `import.meta.env.MODE === 'tea-reference-preview'`. The shared component groups statements by common characteristics, cultivar potential, and reference context; renders outbound citations with source metadata; renders available teas; and provides a page-specific `mailto:` inaccuracy action.

- [ ] **Step 4: Add type index and detail pages**

Use the existing Wisdom `PAGE`, `PageHead`, `WisdomSubNav`, `HoldingRow`, `IndexList`, `SectionHead`, spacing, typography, and colour tokens. Show family → type relationships, citations, and available teas. Use `pb-nav-gap` through the existing page shell and introduce no horizontal-scroll container.

- [ ] **Step 5: Gate navigation and routes**

Add a pure `wisdomSections(previewEnabled)` helper so tests can assert both modes. `sectionForPath` must resolve `types`, `type`, and `family` to the Types section. Render the new routes only when preview mode is active; otherwise they fall through exactly as before.

- [ ] **Step 6: Run focused tests**

Run: `npx vitest run src/pages/wisdom/reference.test.tsx src/wisdom/reference/catalogue.test.ts`

Expected: PASS.

### Task 5: Integrate cited origins into existing region URLs

**Files:**
- Modify: `src/pages/wisdom/RegionIndexPage.tsx`
- Modify: `src/pages/wisdom/RegionPage.tsx`
- Modify: `src/pages/wisdom/reference.test.tsx`

- [ ] **Step 1: Write failing origin integration tests**

Assert that preview Origins groups entries by major region/tea area/mountain/village, preserves the declared level, does not invent a parent, resolves a preview record at `/wisdom/region/:id`, and leaves `/wisdom/region/wuyi-mountains-fujian` behavior intact.

- [ ] **Step 2: Run focused tests and confirm failure**

Run: `npx vitest run src/pages/wisdom/reference.test.tsx`

Expected: FAIL on the new origin expectations.

- [ ] **Step 3: Add the preview origin section to the index**

Keep the existing 182-region index. In preview mode, prepend a `Cited origins in this preview` section grouped by declared level. Link every qualifying record to the unchanged `/wisdom/region/:id` route. Do not merge or relabel existing data objects.

- [ ] **Step 4: Add preview origin detail rendering**

Resolve existing `Region` first and preview `PublicTeaOrigin` second. The preview detail shows level, verified parent/children only when present, cited fact sections, source metadata, matching products, and the inaccuracy action. It must not reuse the old `country`, `province`, `altitude`, or `climate` fields for incompatible values.

- [ ] **Step 5: Run focused tests**

Run: `npx vitest run src/pages/wisdom/reference.test.tsx src/wisdom/reference/catalogue.test.ts`

Expected: PASS.

### Task 6: Documentation, browser verification, and local commit

**Files:**
- Modify: `docs/_notes/tea-reference-receiving-layer.md`
- Create: `tests/tea-reference-preview.spec.ts`
- Modify: `package.json`

- [ ] **Step 1: Update operator notes**

Document one command that starts the actual Teajia app with the current handoff, explain that the terminal report is private and the Wisdom pages are public-shaped, and state that production remains disabled.

- [ ] **Step 2: Add desktop/mobile browser assertions**

Intercept public products with deterministic fixtures. Assert `/wisdom/types`, `/wisdom/type/sheng`, and a cited origin detail render; citations and `Report an inaccuracy` are visible; product links work; no private markers occur; `scrollWidth <= innerWidth`; and the final action clears the mobile bottom navigation.

- [ ] **Step 3: Run the complete focused receiving suite**

Run: `npm run test:tea-reference-receiving`

Expected: PASS.

- [ ] **Step 4: Run required project verification**

Run:

```bash
npm run lint
npm run lint:colors
npm run build
npm run test:mobile
```

Expected: all commands PASS. Existing non-blocking colour notices may remain unchanged.

- [ ] **Step 5: Start the integrated preview and inspect real screens**

Run:

```bash
npm run tea-reference:teajia:preview -- --handoff /Users/adrianrasmussen/.codex/worktrees/38d9/teajia/outputs/tea-reference-capture/chinese-industry-run-7/website-handoff.json
```

Inspect `/wisdom/types`, `/wisdom/type/sheng`, `/wisdom/regions`, and a qualifying cited origin at desktop and 390×844 mobile. Confirm Teajia chrome, wrapping, hierarchy, source links, product links, contact action, and bottom-nav clearance.

- [ ] **Step 6: Review the diff and commit task-scoped changes**

Run `git diff --check`, inspect `git status --short`, stage only the files listed in this plan, and commit with:

```bash
git commit -m "Integrate Tea Reference preview into Wisdom"
```

Do not push or deploy.

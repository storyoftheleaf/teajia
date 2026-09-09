# teajia — Capabilities

> **GENERATED — do not edit by hand.** Rerun
> `npx tsx scripts/gen-capabilities-portable.ts`. It reads the code, so it cannot drift.
> Generated 2026-09-09T06:10:00.301Z.

**At a glance:** 35 commands · 95 pages · migration head `022_member_connections.sql`.

## Commands (how to use it)

| script | runs |
|---|---|
| `npm run dev` | `lsof -ti:7777 >/dev/null 2>&1 \|\| (infisical export --env=dev --format=dotenv --path=/ > .env.local && vite)` |
| `npm run claude` | `infisical run --env=dev --path=/ -- claude` |
| `npm run mcp:check` | `infisical run --env=dev --path=/ -- node scripts/check-mcp-token.mjs` |
| `npm run dev:test` | `VITE_API_URL=http://localhost:7777 vite` |
| `npm run sandbox` | `concurrently -n api,site -c magenta,cyan "npm --prefix worker run sandbox" "npm run sandbox:site"` |
| `npm run sandbox:site` | `VITE_API_URL=http://localhost:8787 vite --port 7777` |
| `npm run sandbox:refresh` | `npm --prefix worker run sandbox:refresh` |
| `npm run build` | `node scripts/check-required-deployment-config.mjs --if-cloudflare-pages && vite build` |
| `npm run check:deploy-config` | `node scripts/check-required-deployment-config.mjs` |
| `npm run lint:colors` | `bash scripts/lint-colors.sh` |
| `npm run preview` | `vite preview` |
| `npm run lint` | `tsc --noEmit` |
| `npm run audit` | `node scripts/audit.mjs` |
| `npm run audit:shop-catalogue` | `node scripts/audit-shop-catalogue.mjs` |
| `npm run intake:findings` | `node scripts/intake-findings.mjs` |
| `npm run incidents:export` | `node scripts/export-incident-queue.mjs` |
| `npm run test:worker` | `NODE_OPTIONS=--experimental-sqlite vitest run worker/tests --exclude='**/.claude/worktrees/**' --exclude='**/.worktrees/**' --testTimeout=20000` |
| `npm run test:china-scan` | `node --test scripts/check-china-dependencies.test.mjs` |
| `npm run audit:china` | `node scripts/check-china-dependencies.mjs .` |
| `npm run test:recovery` | `playwright test --config=playwright.recovery.config.ts` |
| `npm run test:mobile` | `playwright test tests/account-panel-mobile.spec.ts tests/customer-money-mobile.spec.ts --project='Mobile Chrome' --reporter=list` |
| `npm run test:platform-hardening` | `node --test scripts/platform-hardening.test.mjs` |
| `npm run test:mcp-token` | `node --test scripts/check-mcp-token.test.mjs` |
| `npm run test:tea-reference-capture` | `node --test scripts/tea-reference-capture/tests/*.test.mjs` |
| `npm run test:tea-reference-pages` | `node --test scripts/tea-reference-markdown/tests/*.test.mjs` |
| `npm run test:tea-reference-receiving` | `vitest run src/pages/wisdom/reference.test.tsx src/wisdom/reference/catalogue.test.ts src/wisdom/receiving/previewImporter.test.ts && vitest run --mode tea-reference-preview src/pages/wisdom/reference.test.tsx src/wisdom/reference/catalogue.test.ts && node --test scripts/tea-reference-capture/tests/adapters.test.mjs scripts/tea-reference-website-preview/tests/*.test.mjs` |
| `npm run test:tea-reference-browser` | `playwright test --config=playwright.tea-reference.config.ts` |
| `npm run test:tea-reference-revision-browser` | `playwright test --config=playwright.tea-reference-revision.config.ts` |
| `npm run tea-reference:capture:preview` | `node scripts/tea-reference-capture/cli.mjs --allowlist scripts/tea-reference-capture/pilot-allowlist.json --output outputs/tea-reference-capture/pilot` |
| `npm run tea-reference:capture:diversity-preview` | `node scripts/tea-reference-capture/cli.mjs --allowlist scripts/tea-reference-capture/source-diversity-allowlist.json --output outputs/tea-reference-capture/source-diversity` |
| `npm run tea-reference:pages` | `node scripts/tea-reference-markdown/build-pages.mjs` |
| `npm run tea-reference:pages:check` | `node scripts/tea-reference-markdown/build-pages.mjs --check` |
| `npm run tea-reference:website:preview` | `node scripts/tea-reference-website-preview/preview-cli.mjs` |
| `npm run tea-reference:teajia:preview` | `node scripts/tea-reference-website-preview/teajia-preview.mjs` |
| `npm run sandbox:site:alt` | `TEAJIA_API_PROXY=http://localhost:8787 VITE_API_URL= vite --port 7788` |

## Pages

- `/AccountJourneyPage`
- `/AccountProfilePage`
- `/AccountSettingsPage`
- `/ArticleEditorHarness`
- `/ArticlePage`
- `/BriefingPage`
- `/CellarPage`
- `/CenterPage`
- `/CollectionPage`
- `/ContributorProfilePage`
- `/ContributorsIndexPage`
- `/DesignSystemShowcase`
- `/DeveloperDocsPage`
- `/DiscoverPage`
- `/EventRecapPage`
- `/EventsPage`
- `/ForYourSpacePage`
- `/GuestInviteClaimPage`
- `/ImmersiveArticlePage`
- `/JoinPage`
- `/JournalPage`
- `/JourneyPage`
- `/McpPage`
- `/OrderDetailPage`
- `/OrderHistoryPage`
- `/OrderStatusPage`
- `/PalettePreviewPage`
- `/PassportPage`
- `/ProductPage`
- `/ProfileFavoritesPage`
- `/ProfilePaymentPage`
- `/PublicCollectionPage`
- `/ResetPasswordPage`
- `/SampleHistoryPage`
- `/SamplePage`
- `/SessionPage`
- `/ShareCardPage`
- `/SharedCollectionsPage`
- `/ShelfPage`
- `/SignInPage`
- `/SignUpPage`
- `/SpacesPage`
- `/StartHerePage`
- `/StoreLaunchPlaybookPage`
- `/TabStyleDemo`
- `/TableCardPage`
- `/read/AtlasMapOfMountains`
- `/read/BeforeTheMist`
- `/read/CraftPotThatRemembers`
- `/read/CraftRenewalPorcelain`
- `/read/EarthWaterFire`
- `/read/EditablePhoto`
- `/read/EssayLongWayToCup`
- `/read/FieldNotesTwoRoomsBali`
- `/read/FieldStudyWaterBeforeLeaf`
- `/read/HistoryTenThousandMornings`
- `/read/LeafToLiquor`
- `/read/LegendImmortalsCliff`
- `/read/PlateRow`
- `/read/ReadIndex`
- `/read/RitualSevenSteeps`
- `/read/RockRemembers`
- `/read/StoryEditorBar`
- `/read/TastingVocabularyOfTaste`
- `/read/TeaHouseQuietHours`
- `/read/immersive`
- `/read/storyEdit`
- `/wisdom/CultivarIndexPage`
- `/wisdom/CultivarPage`
- `/wisdom/EntryResearchSection`
- `/wisdom/FlagReferenceIssueSheet`
- `/wisdom/LineageTree`
- `/wisdom/MarkIndexPage`
- `/wisdom/MarkPage`
- `/wisdom/NamedTeaIndexPage`
- `/wisdom/NamedTeaPage`
- `/wisdom/PreviewOriginIndexSection`
- `/wisdom/PreviewOriginPage`
- `/wisdom/PreviewWisdomHomePage`
- `/wisdom/ProducerIndexPage`
- `/wisdom/ProducerPage`
- `/wisdom/ReferenceFactSections`
- `/wisdom/RegionIndexPage`
- `/wisdom/RegionPage`
- `/wisdom/StyleIndexPage`
- `/wisdom/StylePage`
- `/wisdom/TeaFamilyPage`
- `/wisdom/TeaTypeIndexPage`
- `/wisdom/TeaTypePage`
- `/wisdom/WisdomHomePage`
- `/wisdom/WisdomRelatedMaterial`
- `/wisdom/WisdomVerificationControl`
- `/wisdom/frame`
- `/wisdom/publicIndexVisibility`
- `/wisdom/wisdomShared`

## Migrations

Head: `022_member_connections.sql` · 10 total.

---

_Generated by `scripts/gen-capabilities-portable.ts` (auto-detects scripts, pages, API routes, MCP tools, migrations). Copy that one file into any repo and run it — no config._

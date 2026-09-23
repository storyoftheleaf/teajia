# Navigation foundation: one word per route, nothing dead behind the doors

The third and last slice of Direction A from the 2026-09-22 navigation survey
(https://claude.ai/artifact/VNLJtEDaYFRshPSgMeWk9P, sections "What is actually
wrong" and "The shared foundation"). Slices one and two shipped on 2026-09-22
and are live: the two-door bottom bar with the site panel (PR #303), and Your
Table as the person's room with one Manage door plus the rail's glyph foot
(PR #306). This slice is the cleanup those two exposed.

## 2026-09-23 audit deltas (read before the plan below)

- `src/components/manageNav.ts` is the ONE list of Manage rooms. The desktop
  column (`LeftSidebar.tsx`), the phone's site panel (`SiteMenu.tsx`) and the
  Your Table door (`AccountPanel/index.tsx`, via `tableItems`) all read it.
  Rename a room there and it renames everywhere. Do not add a second list.
- `getVisibleAdminItemIds` in `navigationConnections.ts` holds one gate per
  room id, matched to the route's own gate in `AdminApp.tsx`. A new or renamed
  room id needs its rule there or it never shows.
- The mobile ADMIN bar (`BottomTabBar.tsx`, three role variants) still carries
  its own four words per variant. It is the one nav surface not reading
  `manageNav.ts`; its words must match the column's after the renames.
- `tests/site-menu.spec.ts` and the three "manage door" tests in
  `tests/account-panel-mobile.spec.ts` assert on Manage row words
  (dashboard, stock, events, members, settings). Renames touch them.
- The Playwright suite must run on its managed mock server (plain
  `npx playwright test`, port 7777 free), NOT against a dev server that talks
  to the live API: forged tokens are rejected there and auth specs fail for
  reasons that look like app bugs. Verified the hard way on 2026-09-22.
- The worker type ratchet (`scripts/known-worker-ts-errors.txt`) fails when
  worker line numbers move. This slice should not touch `worker/`, so leave it.
- The connections PAGE (people and places merged with Find a Table) is a
  design call and is NOT in this slice. "Places" already points at `/spaces`.

## 1. One word per route

| Today | Becomes | Where |
|---|---|---|
| Manage parent "Business" with child "Activity", both `/admin/activity`; mobile admin tab "sales" | One room, **Orders**, `/admin/activity`, gated `hasSell` only (today the parent shows for five capabilities while the route accepts one: a signpost to a locked door). Drop the Activity child. Mobile tab word becomes "orders". | `manageNav.ts`, `navigationConnections.ts`, `BottomTabBar.tsx` |
| "People" as a child of Business | Its own room, **People**, `/admin/people`, gated like the route (`canUsePeople`: any bundle), with one child **Tea Masters** (owner tier, `/admin/contributors`). Keeps People reachable for gather-only or publish-only members who lose the Business door. | same files |
| "Tea Masters" (nav) vs "Contributors" (page heading, tool registry) | **Tea Masters** everywhere: the page heading in `src/admin/views/ContributorsView.tsx`, the tool registry label. The public site already says tea master. Route stays `/admin/contributors`. Default; Adrian may prefer the other word, ask once if unsure. | `ContributorsView.tsx`, `toolRegistry.ts` |
| Stock children "Equipment", "Collection", "Sources" | Remove the three rows. Their routes are pure redirects (`/admin/teaware` and `/admin/personal` to stock, `/admin/sources` to people); keep the redirects for old links. | `manageNav.ts` |
| "Tasting Notes" under Stock, route gated `publish` | Move under **Magazine** as its first child, or gate the row on `hasPublish`. Default: child of Magazine. | `manageNav.ts`, `LeftSidebar.tsx` (children render for any parent already) |
| "Quick Capture" (desktop) vs "capture" (mobile) | **Capture** on both. | `manageNav.ts`, `BottomTabBar.tsx` |
| Footer word "Learn" beside "Craft", both `/craft` | Remove "Learn" from the footer. `/learn` redirect stays. | `src/components/shared/Footer.tsx` |
| Site panel and rail: "Places" points at `/spaces` | Unchanged in this slice. | |

Add a guard: a vitest in `src/components/` that renders the manage list and
the mobile admin tab sets and fails if one route carries two labels or one
label points at two routes (the "one word per route" rule). Prove it goes red
by renaming one row before committing.

## 2. Dead navigation code (delete, do not comment out)

Verified unreferenced on 2026-09-22 by the survey agents; re-grep each before
deleting (a day is enough for another session to have used one):

- `src/components/TopRightUtilities.tsx`: never imported.
- `src/components/navIconConfig.ts`: never imported.
- `src/admin/toolRegistry.ts`: `toolsForRole`, `groupTools` unreferenced;
  `ADMIN_TOOLS` reached only by a type import in `AccountPanel/workflows.ts`.
  If nothing else reads it, delete the file and the import. If something does,
  its labels must match `manageNav.ts` after the renames.
- `src/components/AccountPanel/workflows.ts`: `MEMBER_MEMORY_LINKS`,
  `staffToolsForPanel` unreferenced (only `READER_EXPLORE_LINKS` is used).
- `src/components/AccountPanel/primitives.tsx`: only `NeedsAttention`,
  `daysWord`, `ListShell` are imported; the rest is dead.
- `src/components/AccountPanel/index.tsx`: `CURRENCY_OPTIONS`,
  `formatRelativeDate`, `Item`, `JourneyCard` (defined, never rendered),
  `QuickAction`, `CardSectionLabel`, `handleOpenCart`, `compassProfile`, the
  `myJourney` query (fetches data nothing shows), prop `onNavigateToStory`
  (never passed).
- `LeftSidebarProps.topOffset`: declared and passed, never used.
- `src/components/AccountPanel/INDEX.md` lists `StaffView.tsx`, which does not
  exist, and says the panel uses `z-modal`; it uses `z-panel-modal` (70).
- FIX, not delete: `src/components/shop/alcove/AlcoveModals.tsx:103` dispatches
  `openAccountPanel` with a `view` detail; `App.tsx` listens for
  `open-account-panel` and ignores the detail. That "create account" button
  does nothing today. Make the event name match and honour `detail.view`.

## 3. Routes with no door (decide each, do not delete blindly)

Full list on the survey page, "Routes with no door". Defaults:

- Aliases `/v2`, `/stores/playbook`, `/compass`: remove the routes. `/learn`,
  `/consult`, `/community` stay (linked or long-lived).
- `/design/tabs`, `/design/palette-preview`, `/design/article-editor`,
  `/design/system`: register only when `import.meta.env.DEV`.
- `/collection` (base64 shared collection): grep for anything minting a `?c=`
  link; if nothing does, remove the route and `SharedCollection.tsx`.
- `/join` (no code): link it from the Events page.
- `/read/leaf-to-liquor`: add to the Read index contents under "The interactive
  issue". Editorial placement is Adrian's; the default is the top of that group.
- `/me` (445 lines, duplicates Your Table) and `/mcp` (public explainer): leave
  both, list them for Adrian in the closing report with a one-line
  recommendation each (remove `/me`; link `/mcp` from About).
- `/wisdom/types` cluster: leave; it is preview-mode work in progress.

## 4. Docs, in the same commit as the code they describe

- `docs/SITE_MAP.md`: regenerate the route table from `App.tsx` and
  `AdminApp.tsx`. It still lists `/magazine`, `/account/saved`,
  `/account/history` (all gone) and knows nothing of `/read`.
- `docs/PILLAR.md`: the Manage paragraph (Sell/Source/Gather/Publish grouping)
  should name the rooms as the column names them.
- `CLAUDE.md`, "Desktop / mobile layout principles": the line saying
  "Connections" is the foot label is stale (it is Places); fold it into the
  rail bullet. The Manage column bullet's width note names "Collections" and
  "Carry from network" as the longest labels; re-measure if a longer word
  lands (Tea Masters as a child is shorter than Carry from network).
- `src/components/AccountPanel/INDEX.md`: see section 2.

## Verification (what "done" means)

- `npm run lint`, `npm run lint:colors`, `npx vitest run src/components`.
- Browser, on the managed mock server: `tests/site-menu.spec.ts`,
  `tests/account-panel-mobile.spec.ts`, `tests/read-bottom-bar.spec.ts`,
  `tests/account-switcher-multi-location.spec.ts`, plus every spec under
  `tests/` whose name contains admin, inventory or compass, at both widths.
- The new one-word guard proven red then green.
- A screenshot of the open Manage column and of the phone's site panel for an
  owner, showing Orders and People as rooms and no Business or Activity.
- PR against main, every CI job green, merged, then the live bundle proven to
  carry a string this slice introduced (the word "orders" beside a room icon
  is in the entry chunk; the Manage column is not lazy).

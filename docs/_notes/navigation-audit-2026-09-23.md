# Direction A: reconciled navigation audit and bounded cleanup

Audited 2026-09-23 against `19d2e962` (HEAD and remote main matched). This is
an audit and implementation proposal, not a record of new UI changes. It
supersedes the execution recommendations in `todo/plans/nav-foundation.md`.

## Recovered work and verification boundary

All four saved reconnaissance transcripts contain a final text report with
`stop_reason: end_turn`. The later session notice saying they stopped is not
evidence that their maps were lost. Their last reports cover:

| Agent output | Completed map | Reconciliation needed |
|---|---|---|
| `a5f72303e5b7cab6c.output` | Rail, Manage column, mobile bar, utilities, duplicates, width constraints | Search was replaced by Menu on mobile; rail foot changed |
| `abf001b411d4d5a29.output` | Your Table views, triggers, personal routes, redundant code | Personal links and the single Manage tile shipped |
| `a100dc039c141f603.output` | Manage tree, capability gates, overlapping people/place concepts | Shared registry and Members entry shipped; gate gaps remain |
| `a963ee3a6dd3ed95a.output` | Public routes, inbound links, orphans, documentation drift | Craft rebuilt; several orphan conclusions were incomplete |

Transcripts are under the original session's `tasks` directory in
`/private/tmp/claude-501/`, session `15c97529-3651-4764-a5d6-d3f7a7a297b1`.
They are historical evidence; current source takes precedence.

GitHub confirms [PR 303](https://github.com/storyoftheleaf/teajia/pull/303)
and [PR 306](https://github.com/storyoftheleaf/teajia/pull/306) are merged.
Their code is present on current main. The event-link fix `d617607f` is also
present: search and expired invites now use `/event/:slug`.

This pass inspected source, route definitions, call sites, existing tests,
Git history and PR state. It also executed the current pure navigation gate
function for single-capability memberships. It did not rerun browsers,
deployment checks or the application test suite; previous visual and CI
results belong to the earlier shipping passes, not to this audit.

## 1. Rail and bottom-bar map, as built

| Surface | Contents and destination | Purpose / remaining gap |
|---|---|---|
| Desktop rail, at 1024px and above | Home emblem; Read `/read`, Craft `/craft`, Advise `/advise`, Shop `/shop`; conditional Manage | Stable public sections and work entry |
| Desktop rail foot | Search overlay, Your Table overlay, Cart overlay as icons; People `/people`, Places `/spaces` as words | Shorter and coherent; theme is in Your Table, settings in Manage |
| Expanded Manage column | Ten possible parents, with Stock and Business children (next section) | Full desktop navigation; children reveal for the active parent/child |
| Collapsed Manage column | Parent icons only | Children require expansion or an in-page entry |
| Public mobile bar | Menu icon, Read, Craft, home wordmark, Advise, Shop, person icon | Seven positions retained; menu SVG stroke is 1.75; balanced fixed end slots |
| Mobile Menu, public band | Search action; Sessions `/events`, People `/people`, Places `/spaces`, Tea Wisdom `/wisdom`, Cart action | Public destinations no longer need their own bottom-bar positions |
| Mobile Menu, Manage band | Shared registry's parent rows only; Collections fallback for curator flag | Does **not** render registry children; sharing data has not established full mobile parity |
| Mobile admin bar: shop-running role | Curate, Stock, Sales, Events | Each is a shortcut; current selection is not individually capability-filtered |
| Mobile admin bar: staff/seller role | Curate, Sales, Events, People | May advertise Catalog/Gather tools to a Sell-only member |
| Mobile admin bar: fallback | Curate, Samples, Capture, Events | Samples redirects to Curate's sample-order view; may advertise denied destinations |

The center mobile wordmark returns home in public mode and opens Dashboard
in admin mode. Long press switches between admin and public. Dashboard is
owner-gated, so its admin tap also needs the same eligibility review as the
shortcuts. The explicit Menu has removed dependence on discovering long press.

Sources: `src/components/{LeftSidebar,BottomTabBar,SiteMenu}.tsx`.
The mobile bar is hidden at desktop widths and while the cart is open;
focused share routes suppress the main navigation.

## 2. Your Table map, as built

Signed out: sign in/create account, journal invitation, attend a session,
Discover, Read, Shop, Find a Table and the business-space invitation.

Signed in: eleven personal tiles are always defined. Their labels and
destinations are:

| Tile | Destination |
|---|---|
| steep | Panel journal view; standalone `/account/journal` also exists |
| sessions | Panel events view for the active table; public `/events` also exists |
| remember | `/account/collection` (favorites) |
| cellar | Panel cellar view; standalone `/account/cellar` also exists |
| discover | `/discover` |
| profile | `/account/profile` (public identity editor and payment settings) |
| orders | `/account/orders` (the person's purchases) |
| samples | `/account/samples` |
| journey | `/account/journey` |
| collections | `/account/collections` (shared collections) |
| account | `/account/settings` |

Conditional additions: Switch for multiple memberships; one Manage tile
using the first permitted `tableItems` destination, with a token/account
scope check; Walk-throughs and Library when `auth.isAdmin` is true. The
latter predicate is the legacy global admin/owner check, not a separate
platform-role-only predicate.

The panel also retains account switching, the operator attention queue,
readiness/setup actions, payment-access requests, avatar editing, theme and
sign-out. Thus "one Manage tile" is accurate; "nothing operational remains
in Your Table" is not. Contextual work reminders are different from repeating
the whole admin menu and can remain unless Adrian chooses a stricter split.

Panel views are `main`, `location-switcher`, `events`, `signin`, `signup`,
`journal`, `cellar`. `/account` opens the overlay; it is not a full dashboard
page. Journal, favorites and cellar have existing cross-links through
`src/components/account/PersonalTeaLinks.tsx` and distinct records to preserve.

Two concrete remaining defects are small: the product alcove dispatches
`openAccountPanel` with `{ view: 'signup' }`, while App listens for
`open-account-panel` and ignores the view; the signed-out panel header still
prints "Logged in to your account". Sources: `AlcoveModals.tsx:103`,
`App.tsx:817`, `AccountPanel/index.tsx:1077`.

## 3. Manage and role-gating map

`manageNav.ts` defines the tree; `navigationConnections.ts` filters parents.
`AdminApp.tsx` independently guards routes. Routes, not navigation labels,
remain the access authority. In this table C=Catalog, S=Stock, V=Sell,
G=Gather, P=Publish, M=Members; legacy admin and platform overrides apply
as implemented in the auth/store selectors.

| Parent / route | Nav predicate | Route predicate | Children / issue |
|---|---|---|---|
| Dashboard `/admin/dashboard` | owner tier | owner tier (includes legacy admin) | No children |
| Stock `/admin/stock` | C or S | C or S | Tea Glossary `/admin/catalog`; Equipment `/admin/teaware`; Sources `/admin/sources`; Collection `/admin/personal`; Quick Capture `/admin/capture`; Curate `/admin/compass`; Tasting Notes `/admin/tasting-notes`; Carry from network `/admin/network?tab=catalog` when C |
| Collections `/admin/collections` | P | P | Curator fallback is separate; verify its grant against this route |
| Business `/admin/activity` | V or G or M or S or P | V | Activity repeats parent URL; People `/admin/people`; Tea Masters `/admin/contributors` when owner tier |
| Events `/admin/events` | G | G | Event details, venues and tasting operations belong downstream |
| Magazine `/admin/magazine` | P | P | Publishing tools |
| Wisdom `/admin/wisdom` | P | P | Reference maintenance |
| Network `/admin/network` | C or V | C or V or platform role | Catalog/suggestions/wholesale/adoptions live in tabs |
| Members `/admin/access` | M or owner tier | M | Owner tier alone is not enough in `selectHasBundle`; server-issued bundles may normally supply M |
| Settings `/admin/settings` | owner tier | redirects to owner-gated `/admin/account-settings` | Keep compatibility redirect |

Current gate function output for non-admin single-capability memberships:

| Membership | Visible parents |
|---|---|
| No capabilities | None |
| Catalog only | Stock, Network |
| Stock only | Stock, **Business** |
| Sell only | Business, Network |
| Gather only | **Business**, Events |
| Publish only | Collections, **Business**, Magazine, Wisdom |
| Members only | **Business**, Members |
| Owner tier without bundles | Dashboard, **Members**, Settings |

Bold entries can lead to a route that requires a missing bundle. The existing
unit test named "never offers an entry ... the route ... would turn away"
does not assert that Stock-only lacks Business, so its name overstates coverage.

Further mismatches:

- Stock children inherit the parent display permission: Catalog/Capture/Curate
  need C, Tasting Notes needs P, and Sources redirects to People, which needs
  V/G/M/S/P (Catalog alone is **not** enough). Equipment and Collection are
  pure redirects to Stock, not distinct destinations.
- Mobile Menu drops children altogether. Public People is `/people`, not
  the operator's `/admin/people`. The shop-owner shortcut set also omits
  operator People, and the Tea Masters tile was removed from Your Table.
  In-page dashboard/customer links exist, but no equivalent direct menu
  entry replaces those desktop children.
- `tableItems` disables `isAdmin` in its filter, but its input selectors still
  grant platform roles every bundle and owner tier. Do not describe it as
  removing all platform privilege; do not change that policy in a UI cleanup.
- `SiteMenu` and the rail use `items`; Your Table uses token-scoped
  `tableItems`. Account-switch transition behavior needs a focused parity
  check, without changing server authorization.

Business / Activity / Sales are three names for the same workspace. However,
`ActivityView` contains Pending, Orders, Inquiries, Ledger and Log and defaults
to Pending. Renaming the whole workspace **Orders** is a design proposal,
not an obvious correction; **Sales** is a broader candidate already used by
the mobile bar. A one-label-per-path test alone would not detect access gaps
and would incorrectly reject legitimate context such as personal vs shop orders.

## 4. Public-route and orphan map

Grouped coverage of the current non-admin route table follows. Lack of a
global menu link is not by itself a defect: details, shared URLs and account
actions should usually be reached in context.

| Family / exact paths or pattern | Entry / classification |
|---|---|
| `/` | Home emblem/wordmark; host-specific storefront on store domains |
| `/read` | Rail, bar, footer, home |
| `/read/leaf-to-liquor`, `/read/leaf-to-liquor/:template` | Flagship reached from related pieces; template variant is a layout URL. Flagship missing from Read contents, not wholly orphaned |
| `/read/{rock-remembers,earth-water-fire,before-the-mist,atlas,craft,porcelain-and-tea,essay,field-notes,field-study,history,legend,ritual,tasting,tea-house}` | Curated Read entries, public visibility governed by publication map; drafts are not missing nav items |
| `/article/:slug` | Product, person and event context links; Read fetches published articles then discards the result (`void published`) |
| `/craft` and `?v={course,glossary,reading,journeys,wisdom,spaces}` | New CraftIndex plus URL-synced subviews. Query URLs **are** linkable; old nine-view/unlinkable diagnosis is obsolete |
| `/shop`, `/shop/product/:id` | Catalog and product details; modal/page share a URL |
| `/advise`, `/for-your-space`, `/store-launch-playbook` | Main service section and contextual business/onboarding links |
| `/spaces` | Places in rail/Menu, spaces on home; venue presentation and inquiry |
| `/find-a-table`, `/store/:slug` | Guest Your Table and storefront links; directory and real store destination. Distinct from `/spaces` today |
| `/people`, `/people/:slug`, `/people/:slug/favorites`, `/people/:slug/pay` | Public directory, profile, shareable favorites and access-controlled payment view; linked from teas/stores/events/profile tools |
| `/wisdom`, `/wisdom/{cultivars,regions,producers,marks,styles,named}`, `/wisdom/{cultivar,region,producer,mark,style,named}/:id` | Craft/footer/mobile Menu, reference index and detail cross-links |
| `/wisdom/types`, `/wisdom/family/:id`, `/wisdom/type/:id` | Registered in all builds; preview-mode entry points. Leave owned reference-preview work alone |
| `/start`, `/discover`, `/about` | Home Start link; Craft/personal discovery; home/footer About |
| `/account`, `/account/{journal,collection,cellar,collections,journey,profile,settings,orders,samples}`, `/account/orders/:id` | Personal room and its records/detail links; former orders/samples/journey entry gaps fixed; cellar is cross-linked |
| `/account/docs`, `/account/briefing` | Privileged support tools from Your Table; preserve their destination gates |
| `/signin`, `/signup`, `/reset-password` | Authentication actions and email workflow; do not add permanent nav slots |
| `/events`, `/event/:slug`, `/event/:slug/recap`, `/journey` | Home/Menu/panel sessions; event details and post-RSVP continuation |
| `/collection?c=...` | **Actively generated by MyCollection.buildShareUrl. Keep.** Not an orphan |
| `/c/:slug`, `/u/:slug` | Named collections and personal public shelves; profile/share links |
| `/join`, `/join/:code`, `/session/:id` | Join-code tasting workflow; ShareScreen generates code URLs. Base code entry has no ordinary browse entry observed; not a primary destination |
| `/m/:magicToken`, `/order/:ref`, `/passport/:token`, `/invite/:token`, `/s/:sampleId`, `/share/:token`, `/t/:token` | Token/share/transaction entry points by design; absence from navigation is intentional |
| `/me`, `/mcp` | No ordinary inbound browse link found; legacy personal center and integration explainer. Keep pending an explicit product decision |
| `/design/{tabs,palette-preview,article-editor,system}` | Internal/demo URLs currently registered in production; separate exposure decision, not a reason to add menu links |
| `/learn`, `/consult`, `/v2`, `/stores/playbook`, `/compass`, `/community` | Compatibility redirects to Craft, Advise, Home, playbook, journal, directory. Preserve: source grep cannot prove absence of bookmarks/external links |

The meaningful existing interconnections are tea → writing/reference/person,
person → teas/store/session, directory → store, event → recap, and personal
journal ↔ favorites ↔ cellar. Strengthen these contextual links before adding
global navigation positions. Places and Find a Table still overlap conceptually;
combining them is a separate content/product decision, not needed for this cleanup.

## 5. One bounded Direction A cleanup proposal

Keep the accepted four public words, seven mobile positions, balanced end
icons, personal records and one Manage tile. Preserve all live route paths,
compatibility redirects, data models, backend gates and publication decisions.

One implementation batch, in this order:

1. **Make existing tools reachable by the right members.** Align parent and
   child visibility with existing route gates; separate access to operator
   People from the Sell-only Activity destination. Give eligible mobile users
   entries to currently omitted Manage children, including Tea Masters and
   Tasting Notes. Use a compact grouped drill-in or a small secondary list
   inside the existing menu; do not add bottom-bar positions. Filter admin
   shortcuts and select an eligible center/Manage landing. Keep current
   platform policy; test account switching with confirmed token scope.
2. **Repair the two account-panel defects.** Unify the signup event contract
   and honor only valid requested panel views. Render signed-out header copy
   accurately. These are navigation correctness fixes, not a new account UI.
3. **Prune only verified unused navigation plumbing and refresh its docs.**
   `TopRightUtilities`, `navIconConfig`, unused `toolRegistry` runtime exports,
   unused workflow lists, unrendered panel helpers/query and unused
   `topOffset` are candidates. Recheck repo-wide references including tests
   before each removal. Preserve `READER_EXPLORE_LINKS`, `NeedsAttention`,
   `daysWord`, `ListShell` and the share URL generator. Update admin INDEX
   instructions that still tell builders to register tools in `toolRegistry`.
   Remove the duplicate Learn footer link only as a reviewed copy cleanup;
   keep its redirect. Bring SITE_MAP, AccountPanel INDEX and affected PILLAR
   descriptions into agreement with the actual interfaces.

Not part of this batch: rename Business to Orders, rename Contributors,
merge people/place directories, delete public URLs, change Craft/Read
publication or editorial placement, convert Your Table into a page, introduce
new registries/backends, or alter the worker type baseline. The old plan's
default deletions and automatic editorial additions are withdrawn.

Naming decision for a later reviewed copy change: use one clear name for
the sales workspace across nav and heading; distinguish public People from
operator contacts by context; verify whether every Contributor really is a
Tea Master before renaming that page. A wholesale route rename is unnecessary.

Acceptance: guest, ordinary member, invited owner, each single bundle,
curator-only and platform fixtures; account switching; every displayed link
opens an allowed destination; essential existing Manage tools reachable on
mobile without URL typing or long press. Inspect 375px and desktop screens,
light/dark, menu scrolling and bottom clearance, keyboard dismissal/focus,
and the icon balance. Run focused nav/account tests while building, then
one relevant lint/typecheck/test pass and normal CI before any deployment.
Do not rerun every inventory/compass test for label-only changes or treat
bare static string checks as proof of behavior.

## Closure

The four mapping workstreams and this reconciliation can close. No agent
needs restarting. The two agreed UI slices are merged and present on main;
this pass changed documentation only. Direction A's original broad cleanup
is not implemented, and reliable mobile access for partial-capability members
is still worth a bounded follow-up. This audit does not claim that every
user can already reach every permitted tool or that production was freshly
visually verified today.

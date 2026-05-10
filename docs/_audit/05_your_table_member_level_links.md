# Your Table Section Audit

**Audit date:** 2026-05-10  
**Scope:** The `Your Table` section only: AccountPanel, personal/account routes, operator access, staff bundle surfaces, and features that need a home inside or adjacent to the panel.  
**Reason for audit:** Decide what links, homes, and access rules the Your Table section should own before changing navigation or routing.

## Sources Reviewed

Primary product and IA sources:

- `PRODUCT.md`
- `docs/VISION.md`
- `docs/FLOWS.md`
- `docs/SITE_MAP.md`
- `docs/IA_REVIEW.md`
- `docs/ARCHITECTURE.md`
- `docs/ACTIVE_BRIEFS.md`
- `docs/POST_AUDIT_ROADMAP.md`
- `docs/STATE_OF_THE_SITE.md`
- `docs/NETWORK_ROLLOUT_PLAN.md`
- `docs/NETWORK_UI_BRIEF.md`
- `docs/TASTING_JOURNAL_BRIEF.md`
- `docs/ORDER_SYSTEM_PLAN.md`
- `docs/plan/product-architecture-prd.md`
- `docs/plan/product-architecture-implementation.md`
- `docs/plan/product-architecture-route-auth-inventory.md`
- `docs/plan/product-architecture-phase-0-inventory.md`
- `docs/plan/product-architecture-discussion-log.md`
- `docs/plan/compass-tasting-separation-followups.md`
- `docs/plan/customer-contact-taxonomy.md`
- `src/components/AccountPanel/INDEX.md`
- `src/admin/INDEX.md`
- `worker/INDEX.md`

Code checked for current reality:

- `src/components/AccountPanel/index.tsx`
- `src/components/AccountPanel/ReaderView.tsx`
- `src/components/AccountPanel/MemberView.tsx`
- `src/components/AccountPanel/StaffView.tsx`
- `src/components/AccountPanel/OperatorView.tsx`
- `src/admin/toolRegistry.ts`
- `src/App.tsx`
- `src/lib/routes.ts`

Automated pass:

- `npx impeccable --json --fast src/components/AccountPanel src/admin/toolRegistry.ts`
- Finding: one `bg-black` backdrop class in `AccountPanel/index.tsx`. Low relevance to this IA audit; note it only if doing visual polish.

---

## 1. Core Finding

`Your Table` should be Teajia's **role-adaptive home surface**, not a route dump and not a mini sitemap.

The documents repeatedly point to the same product model:

- Teajia works before and after tea, not during.
- Personal memory must feel private, calm, and cumulative.
- Operator tools must feel dense, precise, and professional.
- Staff access must follow bundles.
- Platform access must feel like stewardship, not generic admin.
- Public content, commerce, events, and personal memory should connect into one coherent Tea Practice OS.

That makes Your Table the correct home for **identity, personal memory, current obligations, account context, and role-specific next actions**.

It should answer a different question for each level:

| Level | The question Your Table answers |
|---|---|
| Guest / Reader | How do I enter this world? |
| Waiting user | Why do I not have access yet? |
| Member / Practitioner | Where is my tea life? |
| Staff | What do I need for my shift? |
| Location Owner | What needs operating today? |
| Tea Master | What needs tending in my practice and shop? |
| Platform Owner/Admin | What needs stewardship across the network? |

---

## 2. Current Shape

`Your Table` is currently a panel, not a true page:

- Opened by the person icon in `BottomTabBar` or the desktop account identity card.
- Rendered by `src/components/AccountPanel/index.tsx`.
- Role views:
  - `ReaderView` for unauthenticated users
  - `MemberView` for signed-in non-staff/non-owner users
  - `StaffView` for delegated staff
  - `OperatorView` for owners, Tea Masters, and platform users

Important route mismatch:

- `src/lib/routes.ts` maps `YOUR_TABLE` to `/account`.
- `docs/SITE_MAP.md` says `/account` is the Your Table hub.
- `src/App.tsx` does **not** define a `/account` route.
- Existing account routes are only deeper routes such as `/account/journal`, `/account/collection`, `/account/journey`, `/account/settings`, `/account/saved`, `/account/history`, `/account/orders`, and `/account/samples`.

Decision needed: either make `/account` a real Your Table route, or stop documenting it as one.

---

## 3. What Your Table Should Own

### 3.1 Owns

Your Table should own these categories:

| Category | Why it belongs |
|---|---|
| Identity and account context | User needs to know who they are, which account/table they are acting in, and how to switch if allowed |
| Personal memory | Journal, collection, journey, saved/history, order/session continuity |
| Current obligations | Today's event, cart waiting, pending invoices, inbound shared collections, unsynced notes |
| Role-specific tools | Staff and owner tools should be accessible from the role-adaptive panel |
| Access explanation | Waiting state, bundle-limited state, trust tier, platform acting-as context |
| Quiet continuation | Read more, find a table, return to shop, attend a session, without turning panel into marketing nav |

### 3.2 Should Not Own

Your Table should not become:

- A duplicate of the public nav.
- A generic account/settings menu.
- A dashboard of personal metrics.
- A command center for features that are not built.
- A place to expose empty-state routes just because they exist.
- A social feed or engagement surface.

---

## 4. Section Architecture Recommendation

Use five internal zones. Every role gets the same grammar, but not the same density.

| Zone | Job | Examples |
|---|---|---|
| 1. Identity | Who am I, where am I acting? | Name, role, account, location, active membership, platform acting-as |
| 2. Now | What needs attention? | Next session, cart, pending invoice, inbound collection, unsynced notes |
| 3. Memory / Work | Main personal or operational body | Last note, collection, journey, event prep, inventory state, invoices |
| 4. Tools / Links | Role-specific destinations | Personal links for Members, bundle tools for Staff, grouped admin tools for Owners |
| 5. Account | Maintenance and escape | Settings, switch location, sign out |

The key is **progressive disclosure**:

- Guest sees entry points.
- Member sees personal life.
- Staff sees granted work.
- Owner sees operating bench.
- Platform sees governance.

---

## 5. Level-by-Level Link Matrix

### 5.1 Guest / Reader

**Current:** `ReaderView` shows Sign In, Create Account, Journal your sessions, Attend a session, Magazine, Shop, Our Spaces, For Your Space.

**Ideal job:** invite, orient, and let the guest keep exploring.

| Link / action | Destination | Include? | Notes |
|---|---|---:|---|
| Sign In | inline panel sign-in | Yes | Primary returning action |
| Create Account | inline panel sign-up | Yes | Guest-to-member path |
| Attend a session | inline sessions view or `/events` | Yes | Stronger than generic browsing |
| Magazine | `/magazine` | Yes | Editorial proof |
| Shop | `/shop` | Yes | Commerce path |
| Find a Table | `/find-a-table` | Yes | Prefer this over `/spaces`; it is the real network locator |
| For Your Space | `/for-your-space` | Yes, secondary | Useful for operator/B2B discovery |
| Start Here | `/start` | Optional | Good if onboarding becomes a maintained path |
| Our Spaces | `/spaces` | Demote | Showcase route, weaker than Find a Table |

Recommendation: change `Our Spaces` to `Find a Table` in this panel, unless `/spaces` is intentionally the editorial showcase and `/find-a-table` is intentionally utilitarian.

### 5.2 Waiting User

**Current:** handled outside AccountPanel by `NoMembershipGate` when a signed-in user has no memberships.

**Ideal job:** explain why they are signed in but cannot access a table.

| Link / action | Destination | Include? | Notes |
|---|---|---:|---|
| Sign Out | auth logout | Yes | Required escape |
| Browse public site | `/magazine`, `/shop`, `/events` | Yes | They can still use public Teajia |
| Request invite / contact | WhatsApp or support path | Yes | Missing product affordance if invite-only remains |
| Find a Table | `/find-a-table` | Optional | Useful if membership is tied to a location |
| Settings | `/account/settings` | Optional | Only if profile editing is useful before membership |

Do not show a normal Member table to zero-membership users. Their state is not "member with empty data"; it is "identity exists, table access pending."

### 5.3 Member / Practitioner

**Current:** `MemberView` shows identity, frontispiece, notes, sessions when linked, tasting profile, collection, footer links: Sessions, Orders, Our Spaces, Magazine, Settings.

**Ideal job:** private tea memory and soft continuation.

| Home / link | Destination | Priority | Current state | Recommendation |
|---|---|---:|---|---|
| Last note | inline journal or `/account/journal` | P0 | Present | Keep as centerpiece |
| Tasting Journal | `/account/journal` | P0 | Present via Notes/Tasting | Keep |
| Collection | `/account/collection` | P0 | Present | Keep, but acknowledge partial implementation |
| Journey / passport | `/account/journey` | P1 | Conditional via Sessions | Keep when there is linked session data |
| Sessions attending | inline events view, event detail | P1 | Present | Keep |
| Cart | cart panel | P1 | Present only when new cart attention exists | Keep as attention, not permanent link |
| Saved articles | `/account/saved` | P2 | Route exists, not linked | Add if personal memory spine includes reading |
| Reading history | `/account/history` | P2 | Route exists, not linked | Add if personal memory spine includes reading |
| Orders | `/account/orders` | P2 | Linked, but empty state only | Hide until wired, or relabel as WhatsApp order references |
| Samples | `/account/samples` | P3 | Route exists, empty only | Do not link |
| Find a Table | `/find-a-table` | P2 | Current footer uses `/spaces` | Prefer Find a Table |
| Magazine | `/magazine` | P2 | Present | Keep as quiet continuation |
| Shop | `/shop` | P2 | Not in footer | Optional, but cart/product context may be enough |
| Settings | `/account/settings` | P0 | Present | Keep |
| Personal timeline | `/me` or future `/account/timeline` | Future P1 | `/me` partial | Do not link until coherent |

Important product decision: the docs say the personal spine should weave tasting journal, Compass, favorites, events, orders, reading, and saved articles. Your Table should be the **preview** of that spine. The full spine needs a home, probably `/account/timeline` or a reworked `/me`, but it should not be silently split across six footer links forever.

### 5.4 Staff

**Current:** `StaffView` shows date/account, today's sessions, Shift tools from `toolsForRole`, Learn links, Settings, Sign Out. It filters out bottom-bar tools: `compass`, `inventory`, `activity`, `events`, `people`, `capture`.

**Ideal job:** make granted work obvious without exposing owner authority.

| Bundle | Needs a Your Table home | Current visibility issue |
|---|---|---|
| Catalog | Compass, Quick Capture, Vendors, Carry from Network, Suggestions | Compass/Capture filtered out as bottom-bar tools; Network Catalog/Suggestions are owner-gated |
| Stock | Inventory, stock verification, stock ledger, purchase order work if granted | Inventory filtered out; Purchase Orders owner-gated |
| Publish | Collections, Magazine/editorial work if intentionally grantable | Both owner-gated, so Publish bundle can appear meaningless |
| Gather | Events, Venues, Interest Signups, tasting events/control room | Events filtered out; Venues/Interest can appear in Shift |
| Sell | Activity, Quick Invoice, Customers, Wholesale | Activity/People filtered out; Wholesale owner-gated |
| Members | Members & Access if delegated, otherwise no | Currently owner-gated, likely correct for v1 |

Principle: **a grantable bundle must produce a visible useful destination.** If a Staff member receives a bundle and Your Table shows no meaningful link for it, access feels broken.

Recommended Staff structure:

- `Today`: event/session prep if relevant.
- `Shift`: the top one or two tools from each granted bundle, not filtered away just because bottom bar has them.
- `Learn`: Magazine and Craft, as today.
- `Account`: Settings, Sign Out.
- Optional `Ask owner`: if no tools are granted.

### 5.5 Location Owner

**Current:** `OperatorView` shows signals, notes, gatherings, grouped tools from `toolRegistry`, and account footer.

**Ideal job:** daily operating bench.

| Group | Links that belong | Notes |
|---|---|---|
| Sell | `/admin/activity`, `/admin/activity?qi=1`, `/admin/people` | Orders, invoices, people, commerce relationships |
| Source | `/admin/compass`, `/admin/capture`, `/admin/compass?tab=sourcing` | Sourcing, vendors, field capture |
| Stock | `/admin/inventory`, `/admin/purchase-orders`, stock ledger/history surfaces | Inventory is a primary home and should not only live in bottom nav |
| Gather | `/admin/events`, `/admin/events?tab=venues`, `/admin/events?tab=interest`, tasting events if kept | Gatherings and venue prep |
| Publish | `/admin/magazine`, `/admin/collections` | Editorial and curated public lists |
| Teach / Access | `/admin/access`, `/admin/people?tab=team`, `/admin/settings`, `/admin/mcp-tokens` | Team, account, agent/voice access |
| Network | `/admin/network?tab=catalog`, `/admin/network?tab=suggestions`, `/admin/network?tab=wholesale` | Carry, suggest, wholesale |
| Personal | `/account/journal`, `/account/collection`, `/account/journey`, `/account/settings` | Owner is also a practitioner |

The Owner version is close. The main improvement is not adding more links; it is making the toolRegistry and bottom-nav relationship less fragile.

### 5.6 Tea Master

Docs are clear: Tea Master is operationally identical to Location Owner. Difference is presentation, not permissions.

| Need | Your Table implication |
|---|---|
| No required physical address | Account/settings links must not force location completion |
| Practitioner-first public presence | Storefront/profile copy should feel less like shop management |
| Holds and resells own stock | Stock and Sell remain first-class |
| Can carry from network and place wholesale orders | Network links remain first-class |
| Trust tier visible | Account/settings should expose tier and effective wholesale margin |

Do not create a separate route set for Tea Masters. Use account kind to tune words, settings requirements, and storefront framing.

### 5.7 Platform Owner / Admin

**Current:** platform users see OperatorView with platform-only tools in `toolRegistry`: Platform Access, Exchange Rates, Adoptions. Routing also has `/admin/platform/audit-log`, `/admin/platform`, and platform activity/audit concepts.

**Ideal job:** network stewardship and account context switching.

| Home / link | Destination | Priority | Recommendation |
|---|---|---:|---|
| Platform Access | `/admin/access/platform` | P0 | Keep prominent |
| Account switcher / Acting As | panel location switcher + banner | P0 | Keep, make always discoverable for platform |
| Adoption Queue | `/admin/network?tab=adoptions` | P0 | Keep |
| Exchange Rates | `/admin/currency` | P0 | Keep |
| Platform Audit Log | `/admin/platform/audit-log` | P1 | Add to toolRegistry or link from Platform Access |
| Platform Dashboard | `/admin/platform` | P2 | Decide whether this is still canonical |
| Trust tier controls | Platform Access/account detail | P0 | Should live with account register, not scattered |
| Tea Master invites | Platform Access | P0 | Should be a first-class action |
| Suspend/reactivate | Platform Access account detail | P0 | Should not be hidden in generic settings |

Platform should not just be "Owner with more tools." It needs a governance register: accounts, applications, trust, audit, adoption, rates.

---

## 6. Features That Need A Home

This is the important part: features implied across docs that either need a clear Your Table home or should explicitly live elsewhere.

| Feature / object | Best home | Access | Status / note |
|---|---|---|---|
| Tasting Journal | Your Table primary memory | Member+ | Already central; should remain private notebook, not dashboard |
| Personal Collection | Your Table memory | Member+ | Partial; keep but frame carefully |
| Personal Timeline / My Tea Life | Your Table preview + future full page | Member+ | Not built; likely `/account/timeline` or reworked `/me` |
| Saved Articles | Your Table memory footer or timeline | Member+ | Wired route, not linked |
| Reading History | Your Table memory footer or timeline | Member+ | Wired route, not linked |
| Orders | Your Table commerce memory | Member+ | Empty state only; do not overpromise |
| Samples | Your Table only after wired | Member+ | Empty state only; keep out for now |
| Event attendance / journey | Your Table memory and Now zone | Member+ | Present but conditional |
| Event hosting | Operator/Staff Gather tools | Gather bundle / Owner | Present through admin |
| Tasting event guest notes | Journal + Journey | Member/guest auth | Tasting event plan writes verdicts to journal |
| Compass sourcing | Operator/Staff Source tools | Catalog bundle / Owner | Admin-only after carve-out; correctly not a Member link |
| Orphaned Compass member entries | Migration/audit work | Internal | Needs schema unification follow-up |
| Carry from Network | Operator/Staff Catalog tools | Catalog bundle | Owner-visible, Staff gap |
| Suggestions | Operator/Staff Catalog tools | Catalog bundle | Owner-visible, Staff gap |
| Wholesale | Operator/Staff Sell tools | Sell bundle | Owner-visible, Staff gap |
| Collections | Owner/Publish or Staff Publish if granted | Publish bundle / Owner | Owner-visible; Staff policy unclear |
| Magazine editor | Owner/Publish or Staff Publish if granted | Publish bundle / Owner | Owner-visible; Staff policy unclear |
| Contributor workflow | Publish / editorial tools | Publish bundle | Future; should not become Member personal |
| People / relationship records | Role-specific relationship surfaces | Sell/Catalog/Gather/Publish | Needs split per contact taxonomy |
| Vendors / sources | Source tools | Catalog bundle | Exists through Compass vendor tab |
| Buyers/customers | Sell tools | Sell bundle | Exists under People, but taxonomy is broad |
| Event guests | Gather tools | Gather bundle | Should not be exposed to Sell-only staff by default |
| Collection recipients | Publish tools | Publish bundle | Future split |
| MCP / Voice & Agent | Owner Teach tools | Owner-tier | Present; keep owner-only v1 |
| Trust tier display | Account settings + Platform Access | Owner/Tea Master/Platform | Needed per network brief |
| Account switcher | Your Table account zone | multi-membership/platform | Present; platform should make it more prominent |
| No-membership waiting state | Dedicated gate | Auth user with zero memberships | Present outside AccountPanel |
| Find a Table | Guest/Member continuation | Public | Should replace or supplement `/spaces` |
| Start Here | Guest onboarding | Public | Optional link if maintained |
| For Your Space | Guest/B2B | Public | Present in ReaderView |

---

## 7. Structural Mismatches

| Issue | Severity | Why it matters | Fix direction |
|---|---:|---|---|
| `/account` is documented but not routed | P1 | Your Table has no deep-linkable home despite docs and route map saying it does | Implement `/account` as a panel/page bridge or remove it from docs/route map |
| Staff bundles do not reliably create visible links | P1 | Access can be granted but feel absent or broken | Make toolRegistry express "owner-only" vs "bundle-visible" separately; stop filtering away all primary bundle tools in StaffView |
| Platform governance is mixed into OperatorView | P1 | Platform work is qualitatively different from owner work | Add a Platform section/register in OperatorView or a PlatformView |
| Member memory is split across many routes | P1 | "Tea Practice OS" spine is not discoverable | Create a personal-memory link contract and eventually a timeline home |
| Empty routes are linked or documented as if real | P2 | Users click into feature promises that are not wired | Hide or relabel `/account/orders`; keep `/account/samples` out |
| `/spaces` and `/find-a-table` overlap | P2 | Network discovery has two homes | Decide: `/find-a-table` is locator, `/spaces` is editorial showcase |
| Compass has shifted from personal to admin-only but docs still vary | P2 | Users and contributors may keep expecting member Compass | Update docs and links to reinforce: Member tasting lives in Journal; Compass is Source/Catalog work |
| Relationship data has one UI home but many access meanings | P1 | Buyer/vendor/guest/contributor records need different permissions | Split People sections by contact relationship taxonomy |
| Bottom admin tabs and Your Table tools use different access logic | P1 | Staff may see tabs/routes inconsistent with bundle grants | Derive both from one access-aware registry |
| Personal stats risk drifting into dashboard feel | P2 | Tasting brief explicitly rejects quantified-self framing | Keep counts as quiet captions; avoid scorecards in MemberView |

---

## 8. Design Health Score

This scores the Your Table IA/product structure, not visual polish.

| # | Heuristic | Score | Key Issue |
|---|---|---:|---|
| 1 | Visibility of System Status | 3 | Frontispiece and urgent states work; platform/staff access state less explicit |
| 2 | Match System / Real World | 3 | "Table" metaphor fits; Staff/Platform still too generic in places |
| 3 | User Control and Freedom | 3 | Sign out/settings/switch exist; `/account` deep-link missing |
| 4 | Consistency and Standards | 2 | Docs, routes, panel, bottom tabs, and toolRegistry disagree |
| 5 | Error Prevention | 2 | Staff can receive bundles with weak visible affordance; empty routes overpromise |
| 6 | Recognition Rather Than Recall | 2 | Users must infer where saved/history/timeline/Compass belong |
| 7 | Flexibility and Efficiency | 3 | Role-adaptive concept is strong; operator bench is efficient |
| 8 | Aesthetic and Minimalist Design | 3 | Panel is restrained, but link ownership needs pruning |
| 9 | Error Recovery | 2 | Waiting/no-access and missing-bundle states need better homes/copy |
| 10 | Help and Documentation | 2 | Docs are rich but drift from code on `/account`, Compass, and network routes |
| **Total** |  | **25/40** | **Good concept, inconsistent ownership** |

---

## 9. Recommended Link Contract

### Personal Link Registry

Create a small personal link registry so `MemberView`, `OperatorView` account footer, and docs do not drift.

Recommended categories:

| Category | Links |
|---|---|
| Memory | Journal, Collection, Journey, Saved Articles, Reading History |
| Commerce | Cart, Orders when wired |
| Gatherings | Sessions attending, Passport/Journey |
| Account | Settings, Switch Location, Sign Out |
| Continue | Magazine, Find a Table, Shop when appropriate |

Rules:

- Do not link incomplete routes.
- Do not expose samples until wired.
- Saved/history should either be part of Memory or intentionally demoted from docs.
- `/me` should not be linked until it has a clear job.

### Operator Tool Registry

Keep `src/admin/toolRegistry.ts` as the operator source of truth, but add clearer fields:

| Field | Meaning |
|---|---|
| `bundle` | Capability needed for non-owner staff |
| `ownerOnly` | Cannot be delegated even if bundle exists |
| `platformOnly` | Platform governance only |
| `primaryForBundle` | Should appear in StaffView even if also shown in bottom tabs |
| `surface` | `panel`, `bottomTab`, `both`, or `hidden` |

This would fix the current problem where a tool can have a bundle but still be owner-gated, or can be useful but filtered out of StaffView.

### Platform Registry

Either add platform tools to `toolRegistry` more completely or create a separate platform registry.

Minimum platform set:

- Platform Access
- Account switcher / acting-as
- Applications / Tea Master invites
- Trust tier controls
- Adoption Queue
- Exchange Rates
- Platform Audit Log
- Suspend / Reactivate account

---

## 10. Phased Plan

### Phase 1: Clarify Homes, No Major Navigation Change

1. Decide if `/account` is a real route.
2. Replace `Our Spaces` with `Find a Table` in Reader/Member, or document the distinction.
3. Hide or soften `/account/orders` until wired.
4. Keep `/account/samples` out of Your Table.
5. Add Saved Articles and Reading History only if they are part of the personal memory spine.
6. Update docs to say Compass is admin/source work and Member tasting is Journal.

### Phase 2: Make Access Legible

1. Refactor `toolRegistry` fields so owner-only, platform-only, and bundle-visible are unambiguous.
2. Ensure every Staff bundle creates a visible useful link.
3. Align admin bottom tabs with the same access model as Your Table.
4. Add no-tools/ask-owner state for Staff with no bundles.
5. Add Platform Audit Log to the platform surface if it is not nested inside Platform Access.

### Phase 3: Build The Personal Memory Spine

1. Decide whether the full memory home is `/me`, `/account/timeline`, or `/account`.
2. Define a unified personal timeline query/view across journal, collection, events, orders, reading, saved articles, and future samples.
3. Make Your Table show the latest memory entry, not every memory route.
4. Keep personal memory private and non-performative per `TASTING_JOURNAL_BRIEF.md`.

### Phase 4: Relationship-Aware People Access

1. Use `customer-contact-taxonomy.md` to split People surfaces by relationship meaning.
2. Sell staff sees buyers/orders.
3. Catalog staff sees vendors/sources.
4. Gather staff sees guests/attendance.
5. Publish staff sees collection recipients/contributors.
6. Owner/platform can see the full relationship portrait.

---

## 11. Open Product Decisions

1. Should `/account` become a true page, or should Your Table stay panel-only?
2. Is `/me` the future personal timeline, or should it be retired/replaced by `/account/timeline`?
3. Should Staff with all six bundles remain distinct from Owner, or should they get an "operator" view minus owner-only account authority?
4. Should Publish be grantable to staff for Magazine/Collections, or remain owner-only despite the bundle model?
5. Should Members bundle ever be delegatable, or is it owner-only in practice?
6. Is `/spaces` an editorial showcase while `/find-a-table` is the locator, or should one absorb the other?
7. Where should Platform Audit Log live: Platform Access, Activity, or a visible Your Table platform link?
8. When Orders are wired, does Your Table show orders as personal memory, commerce status, or both?

---

## 12. Bottom Line

The current Your Table concept is right. The implementation already has the right bones: role-adaptive views, editorial tone, quiet previews, and a tool registry.

The work now is **ownership and access clarity**:

- Member Your Table should become the front door to personal memory.
- Staff Your Table should become a trustworthy reflection of granted bundles.
- Owner/Tea Master Your Table should remain the operating bench.
- Platform Your Table should become a governance register, not just a larger operator bench.
- Routes that are incomplete or conceptually homeless should not appear just because they exist.

Do this before adding more links. The next iteration should remove ambiguity, not add surface area.


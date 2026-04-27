> SUPERSEDED 2026-04-27 by docs/NETWORK_ROLLOUT_PLAN.md and docs/ARCHITECTURE.md. Tier model and bundles fully merged.

# Members & Access — Design Brief

> **SUPERSEDED 2026-04-26.** This brief has been merged with the Phase 1B catalog/wholesale plan into a single source of truth at **[docs/NETWORK_ROLLOUT_PLAN.md](./NETWORK_ROLLOUT_PLAN.md)** as Step 0. Read that for current implementation guidance. This document is preserved because its design direction (§6) and key states (§8) are referenced by the merged plan and remain authoritative for the M&A destination's visual design.

Status: Approved 2026-04-26. Design direction for the Members & Access destination retained as reference. Implementation tracked in NETWORK_ROLLOUT_PLAN.md.

---

## 1. Feature Summary

Members & Access is the single destination for managing **who has power inside Teajia**, replacing today's scattered surfaces (Team buried as a tab in People, Platform Admin grouped under Teach, hardcoded `ai_wisdom` permission). It exposes a five-tier model (Platform Owner, Platform Admin, Location Owner, Tea Master, Member) over a six-bundle capability system (Catalog, Stock, Publish, Gather, Sell, Members), with a Platform-tier approval queue for new Location accounts and an invite gesture for Tea Masters. One destination, two registers: Location Owners see their roster; Platform tier sees the union of all accounts and a hidden Platform tab.

## 2. Tier Model

| Tier | Who | Has a location? | Scope | Granted by |
|---|---|---|---|---|
| Platform Owner | Adrian | Yes (yours) + all | Everything, every account | Self |
| Platform Admin | Rare anointed | Yes or no | Everything except revoke Platform Owner | Platform Owner |
| Location Owner | Tea house owner | Yes | One account: catalog, stock, events, members, sell | Platform Owner / Admin |
| Tea Master | VIP individual practitioner | No | Personal account: own catalog, own tasting, compass, can curate Collections | Platform tier (invite-only) |
| Member | Staff under a Location Owner | Inherits location | Subset of Location bundles, scoped by Owner | Location Owner |
| Guest | Reader / customer | No | Read-only public + own orders/tastings | Self-signup |

Tea Master is an `accounts.kind`, not a user role. The `curator` flag is obsolete — Tea Master is the canonical curator tier.

## 3. Capability Bundles

Six bundles. Granted per Member by their Location Owner. Default bundle sets per tier listed below.

| Bundle | What it lets you do |
|---|---|
| Catalog | Add and edit teas, teaware, sources, and purchase orders. |
| Stock | Adjust inventory counts and log shipments received. |
| Publish | Write articles and curate Collections. |
| Gather | Run events and approve attendees. |
| Sell | Manage customers, orders, and pricing. |
| Members | Grant and revoke access for other people at this location. |

**Defaults:**
- Platform Owner / Admin: all bundles on every account, plus a meta "Platform" bundle (trust tier, suspend, grant Platform Admin).
- Location Owner: Catalog · Stock · Publish · Gather · Sell · Members on their own account. Members bundle is locked-on, cannot be removed.
- Tea Master: Catalog · Stock · Publish only.
- Member: starts empty; Owner grants per person.
- Guest: none.

Storage: `account_members.permissions` JSON column with `bundles: string[]`. Revisit only if cross-account bundle queries become hot.

## 4. Cross-Account Visibility (Account-Scoped with Platform Visibility)

Every entity stays scoped to one `account_id` (existing multi-tenancy). Platform tier reads across all accounts as a privilege of tier — a union view. When Platform tier acts inside another account, the action is logged with `actor: platform` and attributed in the audit log.

## 5. Primary User Action

**Location Owner:** look at the people who work at my tea house, understand at a glance what each one can do, and tune a person's capabilities in under thirty seconds.

**Platform tier (Adrian):** see the state of the whole network — pending applications, all Location Owners, all Tea Masters, all platform admins — and make a decision (approve, invite, revoke, suspend) without leaving the page.

The destination must answer "who is what level of admin, and what can they do" the moment it loads.

## 6. Design Direction

Pro register. Dense, precise, editorial — never SaaS-dashboard. Bronze appears once per screen at most.

- No avatars-in-circles, no role-as-pill, no blue Invite button.
- Members listed as set type: name on a line, bundles as comma-separated capability words underneath in secondary color. Wine-list rhythm.
- Capability bundles are nameable English, not toggle pills. "Catalog · Stock · Publish" reads as a sentence.
- Tier conveyed by typography and grouping, not by colored badge.
- Grain texture and bronze atmosphere persist. Back-office of a museum, not a Shopify store.
- Audit log reads like diary entries, not Stripe events.

## 7. Layout Strategy

Two scopes, one component.

**Location Owner view:**
- Top: location name as a quiet heading. One-line summary ("Six members. Two with full access.")
- Roster grouped by tier (Owner, Members), set as a typographic list with name + bundles underneath. No table rules; dividers between groups.
- Right edge of each row: one quiet bronze "Edit" action that opens an editor sheet.
- Footer: single text-link "Add member" — not a button.

**Platform tier view:**
- Top: horizontal rhythm of three quiet counts — Locations · Masters · Pending — set as type, not KPI cards. Tappable to filter.
- Below: roster of accounts grouped by kind (Pending first if non-empty, then Locations, then Masters). Each row: account name, owner email, trust tier as a single typographic word.
- Tap an account → reveals that account's roster (the Location Owner view, in a sub-frame).
- Hidden Platform tab (Platform Owner / Admin only): list of platform admins, audit log, "Invite Tea Master," "Suspend account."

**Editor sheet (shared):** Right-side drawer on desktop, full-screen sheet on mobile. Header: person's name in display font, tier in secondary type. Body: six bundles as toggleable lines (the bundle name itself is the affordance, with bronze tone when active). Below: dangerous actions (Remove, Transfer Ownership) in secondary color, never red. Footer: Cancel left, Save right per CLAUDE.md.

**Mobile:** single column. Roster collapses to one tap-target per person; editor sheet takes the full screen with `pb-nav-gap` clearance.

**Bench tile:** Operators see "Team & Access." Platform tier sees "Platform & Access." Same destination, label adapts.

## 8. Key States

| State | What the user sees and feels |
|---|---|
| Default — Location Owner | Roster of members. Owner's own line at top, marked simply by tier label. |
| Default — Platform tier | Three counts at top. Pending section first if any (omitted when zero). Locations, then Masters. |
| Empty (new Location Owner) | Body italic: "You haven't invited anyone to help run this place yet." Single text link: Add a member. |
| Pending queue, has applications | Each pending row is a short editorial paragraph: name, email, application note, applied date. Two text actions: Approve (bronze) and Decline. Approving opens a small confirmation sheet to set initial trust tier. |
| Pending queue empty | Section omitted. Silence. |
| Editor sheet — first time | All six bundles shown, none active. Save disabled until at least one bundle is on. |
| Editor sheet — owner editing themselves | Members bundle locked: "Owners always have access." Ownership change happens via Transfer Ownership in dangerous-actions. |
| Loading | Tea-skeleton style — never spinner, never white. |
| Error (network) | Body italic at top: "Couldn't reach the server. Showing the last known state." Read-only. |
| Error (action failed) | Inline message in editor sheet, body type, sentence-cased. No red alert box. |
| Tea Master invited, not accepted | Lives in Masters section with metadata line: "Invited 14 April. Not yet accepted." Self-resolves on accept. |
| Account suspended | Suspended Locations at bottom of group in dim text color. Inside the account: banner-line "This account is suspended. No one can act in it." with Reactivate link. |
| Audit log entry | One sentence per event. "26 April · Adrian made Mei Lin a Location Owner." No table, no IDs. |
| Cross-account act-as | Banner-line under heading: "You are viewing as Platform. Actions will be logged." |

## 9. Interaction Model

**Entry points:**
- Admin nav → Members & Access (own destination, not a tab inside People). Owner-only for Location view; Platform-tier-only for platform variant.
- Operator AccountPanel Bench → "Team & Access" (Owners) or "Platform & Access" (Platform tier).
- Direct URLs: `/admin/access` and `/admin/access/platform`.

**Granting capabilities (Owner):**
1. Tap a member's row.
2. Editor sheet slides in.
3. Each bundle is a tappable line; tap toggles state. Bundle name fills with bronze tone when active. No checkbox glyph.
4. Save commits. Cancel discards. Closing without saving prompts only on unsaved changes.
5. On save, row updates inline. No toast — change is its own confirmation.

**Adding a member (Owner):**
1. "Add a member" text link at footer of roster.
2. Inline expansion (not modal): email field appears underlined.
3. Existing user → added with no bundles, taken to editor sheet.
4. New user → invite sent, appears as "Invited 26 April · not yet accepted."

**Approving a Location application (Platform):**
1. Pending paragraph row.
2. Approve text link → confirmation sheet: trust tier picker (basic/verified/partner) + optional one-line note. Confirm approval button.
3. Decline text link → confirmation with optional reason. Decline button.

**Inviting a Tea Master (Platform):**
1. Platform tab → "Invite a Tea Master" text link.
2. Inline email field + optional note ("Why this person.")
3. Invitation link sent. Appears in Masters section as "Invited · not yet accepted."

**Upgrading a Tea Master to Location Owner (Platform):**
1. Open the Tea Master's account from Platform view.
2. Dangerous-actions area: "Upgrade to Location Owner."
3. Confirmation sheet asks for the location's name and timezone. On confirm, `accounts.kind` flips, location bundles auto-grant. **Account ID and existing data unchanged.**

**Acting cross-account (Platform):**
- Entering another account's roster from Platform view shifts the X-Teajia-Account context for that page only. Quiet banner-line states you're acting as Platform. Actions logged with `actor: platform`.
- Returning to Platform view restores own account context.

**Audit log:**
- Bottom of every Members & Access destination, collapsed to most recent five entries with "See more" text link.
- Sentence-style entries. Tap to see one extra line of metadata (IP, user-agent), nothing more.

**Feedback model:**
- No toasts for routine actions. Inline state change is the confirmation.
- Toasts reserved for asynchronous actions (e.g. invite delivered).
- Errors inline body type, never popups.

## 10. Content Requirements

**Tier names** (final): Platform Owner / Platform Admin / Location Owner / Tea Master / Member / Guest

**Bundle one-line descriptions** (shown in editor sheet under bundle name in dim type):
- Catalog — Add and edit teas, teaware, sources, and purchase orders.
- Stock — Adjust inventory counts and log shipments received.
- Publish — Write articles and curate Collections.
- Gather — Run events and approve attendees.
- Sell — Manage customers, orders, and pricing.
- Members — Grant and revoke access for other people at this location.

**Empty states:**
- New Location Owner roster: "You haven't invited anyone to help run this place yet."
- New Tea Master account: "Your collection is yours alone. Invite is the only way another person sees it."
- Pending queue: omitted entirely when empty. No "All caught up" cheer.

**Invite emails:**
- Location member subject: "You've been invited to help at [Location name] on Teajia." First line: "[Owner name] would like you to join [Location name]. Accept this invitation to begin."
- Tea Master subject: "You've been invited to keep your tea practice on Teajia." First line: "This is a hand-picked invitation. We don't accept open applications for Tea Master accounts."

**Confirmations:**
- Remove member: "Remove [name] from [Location name]? They will lose access immediately. This cannot be undone, but they can be re-invited."
- Suspend account: "Suspend [Account name]? No one in this account will be able to act, including the owner. The account's data is preserved."
- Approve Location: no copy beyond tier picker.

**Audit-log sentence templates:**
- "[date] · [actor] made [target] a [tier]."
- "[date] · [actor] granted [target] access to [bundle]."
- "[date] · [actor] revoked [target]'s access to [bundle]."
- "[date] · [actor] removed [target] from [Location name]."
- "[date] · [actor] approved [Location name]'s application."
- "[date] · [actor] invited [target] as a Tea Master."
- "[date] · [actor] suspended [Account name]."
- "[date] · [actor] reactivated [Account name]."
- "[date] · Platform [actor] acted in [Account name] — edited [thing]."

**Realistic ranges:**
- Members per Location: 1–12. Optimize for 3–6.
- Locations on the Platform: 1–50 horizon. Optimize for 5–20.
- Tea Masters: 1–30 horizon. Optimize for 5–15.
- Pending applications: 0 most days; bursts of 5+ around moments of public attention.
- Audit log per Location: 0–5 a week typical, 20+ during a staffing change.

## 11. Schema & API Changes (summary)

- **`accounts.kind`** new column: `'location' | 'master' | 'platform'`. Migration: existing accounts → `'location'`; the Platform account → `'platform'`. (Confirm Platform account ID before writing migration.)
- **`account_members.permissions`** keep as JSON; add `bundles: string[]` shape; deprecate hardcoded `ai_wisdom`.
- **Pending applications table** new: `account_applications (id, applicant_email, applicant_name, note, status, created_at, decided_at, decided_by)`.
- **Audit log** continue using existing `platform_audit_log`; extend events with bundle grant/revoke and account-acting-as-platform.
- **API:** add `/api/accounts/:id/access` (roster + bundles), `/api/platform/applications` (queue + approve/decline), `/api/platform/tea-masters/invite`, `/api/platform/accounts/:id/upgrade-to-location`. Reuse existing member endpoints for grant/revoke.

## 12. Recommended References (impeccable)

- spatial-design.md — typographic-list-as-roster, editor-sheet rhythm.
- interaction-design.md — inline-expansion-instead-of-modal, toggle-as-typeword.
- motion-design.md — editor sheet entry, inline expansion, bronze-tone state change.
- `src/styles/card-utilities.css` — `pb-nav-gap`, dividers, sheet header. Do not invent utilities.
- `src/designTokens.ts` `TYPOGRAPHY_CLASSES` — every heading/body/label/meta line.

## 13. Open Questions — Resolutions

1. **Toolregistry placement** — new top-level group `access` with two entries (`/admin/access`, `/admin/access/platform`). Confirm naming pre-build.
2. **Bundle storage** — JSON column with `bundles: string[]`. Revisit only if cross-account queries become hot.
3. **`accounts.kind` migration** — existing → `'location'`; Adrian's account → `'platform'`. Confirm Platform account ID before writing migration.
4. **Tea Master public surface** — deferred to a follow-up brief on Collections.
5. **Tea Master upgrade — data migration** — account ID never changes; only `kind` flips. Existing data stays attached.
6. **Audit retention** — indefinite for v1. No retention UI.
7. **Trust tier copy** — `basic / verified / partner` retained for v1. Pre-launch copy review may revise to `trusted / featured / spotlight`.

---

**Status: Approved by Adrian 2026-04-26.**

Implementation will follow this brief. Hand off to `/impeccable craft` or implement directly using the references in §12.

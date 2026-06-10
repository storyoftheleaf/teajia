# src/components/AccountPanel — Index

> The AccountPanel ("Your Table") is the role-adaptive launchpad. Person icon top-right (mobile) or below logo in left sidebar (desktop). Renders a different view per tier. Full role model in /docs/ARCHITECTURE.md §1.2; full per-level link audit in /docs/_audit/05_your_table_member_level_links.md.

## Files

| File | Purpose |
|------|---------|
| **index.tsx** | Root panel component. Auth state, view switching, modals (sign-in, sign-up, events, journal, location-switcher). Manages z-index, scroll lock, focus trap. Dispatches to one of the three views below. |
| **ReaderView.tsx** | Signed-out guest: sign-in/sign-up CTAs, "what's inside" links, Explore cluster (from `READER_EXPLORE_LINKS`), For-your-space B2B link. |
| **LaunchpadView.tsx** | Every signed-in tier (Member, Staff, Owner, Platform). Tile launchpad — verbs not stats. Tiles are tier-gated by `isOwner` / `isStaffOrOwner` / `membershipsCount`. |
| **StaffView.tsx** | Delegated staff with bundles. Bundle-aware Shift tools from `toolsForRole()`, today's sessions, Learn links, Settings, Sign Out. (Note: index.tsx currently routes all signed-in tiers to LaunchpadView; StaffView is wired and imported — see "Live dispatch" below.) |
| **TastingJournalView.tsx** | Modal view: logged-in Member's tasting entries, filters, detail modal. Synced via hydrateTastingJournal(). |
| **MyCollection.tsx** | Member collection browser: teas saved, favorites, notes. |
| **AccountSwitcherChip.tsx** | Compact active-account chip + switch affordance for multi-membership users. |
| **workflows.ts** | Link registries + setup workflows: `READER_EXPLORE_LINKS`, `MEMBER_MEMORY_LINKS`, `FIRST_DOOR_WORKFLOW` (new-owner setup readiness), `OPERATOR_SUPPORT_LINKS`, `staffToolsForPanel()`. |
| **primitives.tsx** | Shared editorial helpers (getInitials, daysWord, capitalize, truncate), IdentityCard, NeedsAttention, PreviewBlock, StatusPill, and the typography floor (12px meta, 11px labels, 14-15px body). |
| **types.ts** | PanelView enum: 'main' \| 'location-switcher' \| 'events' \| 'signin' \| 'signup' \| 'journal'. |

## Live dispatch (index.tsx, panelView === 'main')

| Auth state | View rendered |
|---|---|
| Not authenticated | **ReaderView** |
| Authenticated (any tier) | **LaunchpadView** — tiles gated internally by `isOwner` / `isStaffOrOwner` / `membershipsCount` |

`StaffView` is imported and maintained as the bundle-aware staff surface, but the current `main` branch sends every authenticated tier to LaunchpadView. Keep both in sync when changing the staff surface.

## Per-level surface (what each tier actually sees)

| Tier | Surface | Links / tiles |
|---|---|---|
| Guest / Reader | ReaderView | Sign in · Create account · Journal your sessions · Attend a session · Explore (Magazine, Shop, Find a Table) · For your space |
| Member | LaunchpadView | steep · sessions · remember · discover · collections (+ switch if multi-table) |
| Staff | StaffView (bundle-aware) | Today's sessions · Shift tools per granted bundle · Learn (Magazine, Craft) · Settings |
| Owner / Tea Master | LaunchpadView | Member tiles + workshop · walk-throughs · library |
| Platform Owner / Admin | LaunchpadView + AccountSwitcherChip | Same as Owner today; no distinct governance register yet (open gap, see audit §5.7) |

## toolRegistry.ts (/admin/)

Tools across 6 groups: Sell, Source, Gather, Publish, Teach, Network.
- Each tool has: id, label, group, route, addedAt, requires (optional: 'owner' or 'platform'), bundle (optional: Bundle for staff visibility), staffVisible.
- `toolsForRole({ isOwner, isPlatform, bundles })` filters by role + bundles; `isRecentlyAdded()` marks new tools (< 30 days); `groupTools()` buckets by group.
- StaffView reads active membership bundles from useAppStore and renders only the tools the staff member can actually use.

## Z-index & rendering invariants

- Panel uses `z-modal` (40), backdrop uses `z-drawer`.
- Rendered late in App.tsx so it visually layers correctly.
- Never use `z-50` for full-screen overlays — blocks AccountPanel from opening.

## Mobile vs desktop

- Mobile: floating person icon top-right, full-sheet panel.
- Desktop: Account Identity card in LeftSidebar (top, below logo), panel opens as drawer.
- Cart lives in sidebar utility footer on desktop, in panel on mobile.

## When working here

1. Don't change tab labels or routing without explicit confirmation (per /CLAUDE.md).
2. Use TYPOGRAPHY_CLASSES from /src/designTokens.ts — no hardcoded font sizes.
3. Type floor: 12px meta, 11px labels, 14-15px body, no text opacity.
4. Read /docs/_audit/05_your_table_member_level_links.md before changing per-level links — but note it predates the LaunchpadView rebuild; treat its architecture section as historical and its link/level reasoning as current.

## See also

- /docs/_audit/05_your_table_member_level_links.md — per-level link/home audit (level reasoning current; architecture section predates LaunchpadView)
- /docs/_audit/01_guest_member.md — full Member-tier flow inventory
- /docs/_audit/02_owner_master.md §H — Operator launchpad section
- /docs/SITE_MAP.md — Member routes
- /CLAUDE.md — z-index, typography, "Your Table" naming
- /src/admin/toolRegistry.ts — tool definitions and role filtering

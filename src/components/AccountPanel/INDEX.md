# src/components/AccountPanel — Index

> The AccountPanel ("Your Table") is the role-adaptive launchpad. Person icon top-right (mobile) or below logo in left sidebar (desktop). Renders different views per tier. Full role model in /docs/ARCHITECTURE.md §1.2.

## Files

| File | Purpose |
|------|---------|
| **index.tsx** | Root panel component. Auth state, view switching, modals (sign-in, sign-up, events). Manages z-index, scroll lock, focus trap. |
| **ReaderView.tsx** | Public reader (no account): sign-in/sign-up CTAs, featured events, brand links. |
| **MemberView.tsx** | Member tier: Personal practice hub — tasting journal, collection, account settings. Journey stats, seals, milestones. |
| **OperatorView.tsx** | Owner / Tea Master: Curated 2-col Bench grid of admin tools by category (Sell, Source, Gather, Publish, Teach, Network). Imports from /admin/toolRegistry.ts. |
| **StaffView.tsx** | Delegated Member with bundles: Subset of Operator tools scoped by bundle grants. Today's event count, sign-out. |
| **TastingJournalView.tsx** | Modal view: logged-in Member's tasting entries, filters, detail modal. Synced via hydrateTastingJournal(). |
| **MyCollection.tsx** | Member collection browser: teas saved, favorites, notes. |
| **primitives.tsx** | Shared editorial helpers (getInitials, daysWord, capitalize, truncate) and typography floor (12px meta, 11px labels, 14-15px body). |
| **types.ts** | PanelView enum: 'main' | 'location-switcher' | 'events' | 'signin' | 'signup' | 'journal'. |

## Role-adaptive views

| Tier | Component | Purpose |
|---|---|---|
| Guest | (hidden, ReaderView if public?) | Sign in / sign up entry |
| Member | MemberView | Personal practice — tasting, collection, account |
| Operator (Owner / Tea Master) | OperatorView | Curated 2-col Bench (tools from toolRegistry) |
| Staff (delegated Member) | StaffView | Subset of Operator tools by bundle |
| Platform (Admin) | OperatorView + switcher | Cross-account "acting as" |

## toolRegistry.ts (/admin/)

51 tools across 6 groups: Sell, Source, Gather, Publish, Teach, Network.
- Each tool has: id, label, group, route, addedAt, requires (optional: 'owner' or 'platform')
- `toolsForRole()` filters by role; `isRecentlyAdded()` marks new tools (< 30 days)
- OperatorView renders OperatorView renders grouped tiles; layout driven by GROUP_ICONS map

## Z-index & rendering invariants

- Panel uses `z-modal` (40), backdrop uses `z-drawer`
- Rendered late in App.tsx so it visually layers correctly
- Never use `z-50` for full-screen overlays — blocks AccountPanel from opening

## Mobile vs desktop

- Mobile: floating person icon top-right, full-sheet panel
- Desktop: Account Identity card in LeftSidebar (top, below logo), panel opens as drawer
- Cart lives in sidebar utility footer on desktop, in panel on mobile

## When working here

1. Don't change tab labels or routing without explicit confirmation (per /CLAUDE.md)
2. Use TYPOGRAPHY_CLASSES from /src/designTokens.ts — no hardcoded font sizes
3. Type floor: 12px meta, 11px labels, 14-15px body, no text opacity
4. Read /docs/_audit/01_guest_member.md before adding Member-tier features

## See also

- /docs/_audit/01_guest_member.md — full Member-tier flow inventory
- /docs/_audit/02_owner_master.md §H — Operator launchpad section
- /docs/SITE_MAP.md — Member routes
- /CLAUDE.md — z-index, typography, "Your Table" naming
- /src/admin/toolRegistry.ts — tool definitions and role filtering

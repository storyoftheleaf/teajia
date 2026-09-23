# AccountPanel code index

> “Your Table” is the role-adaptive personal launchpad: a mobile full sheet and desktop drawer opened from account identity. Role and membership semantics live in [`docs/ARCHITECTURE.md`](../../../docs/ARCHITECTURE.md).

## Main files

- `index.tsx`: authentication, panel navigation, focus/scroll behavior, account context, and view dispatch.
- `ReaderView.tsx`: signed-out entry and public exploration.
- `LaunchpadView.tsx`: signed-in member, staff, owner, and platform tiles.
- `AccountSwitcherChip.tsx`: which table the person is sitting at, and the switch between tables.
- `TastingJournalView.tsx`, `MyCollection.tsx`, `CellarView.tsx`: personal tea surfaces.
- `workflows.ts`: the signed-out explore links (`READER_EXPLORE_LINKS`).
- `primitives.tsx`: `NeedsAttention`, `ListShell` and `daysWord`, the pieces the views still share.
- `types.ts`: panel-local view types.

## Current surface model

- Signed out: `ReaderView`.
- Signed in: `LaunchpadView`, with tiles filtered by role, memberships, and delegated capabilities. The one Manage door reads `tableItems` from `src/components/manageNav.ts`; there is no second list of rooms here.
- Journal, Favorites, and Cellar are distinct records connected by quiet cross-links; do not merge them into one engagement system.
- Account switching must invalidate or re-scope account-owned client state.

## Invariants

- Panel uses `z-panel-modal` (70), above the bars and admin overlays.
- Mobile sheet and desktop drawer must preserve focus trapping, scroll lock, and bottom-navigation clearance.
- Use `TYPOGRAPHY_CLASSES` and the named UI text scale.
- Do not change tab labels, navigation, or routes without explicit confirmation.
- Add or remove links in the live registries and renderers together; unused registries are dead code, not documentation.

Canonical route reference: [`docs/SITE_MAP.md`](../../../docs/SITE_MAP.md). Active account-panel/product work belongs in Tracks 1 or 5, not historical audit files.

# Admin code index

> Navigation aid for Owner, Staff, Tea Master, and Platform surfaces. Current role and capability rules live in [`docs/ARCHITECTURE.md`](../../docs/ARCHITECTURE.md); routes live in [`AdminApp.tsx`](AdminApp.tsx).

## Structure

- `AdminApp.tsx` — admin shell, route table, lazy boundaries, and height chain.
- `toolRegistry.ts` — operator/staff tool metadata, routes, capability visibility, and grouping.
- `components/` — shared panels, forms, tables, event/editorial tools, inventory, and Curate UI.
- `views/` — top-level routed admin destinations.
- `types.ts` — admin-specific types; shared product/account types live in `src/types.ts`.

## Product areas

- Stock and receipts — `components/InventoryView.tsx` and `components/inventory/`.
- Curate and sourcing — `components/TeaCompass/`, Sources/People views, and import/intake surfaces.
- People and commerce — customer views, invoices, orders, wholesale, and purchase orders.
- Gather — event manager, event detail, venues, reminders, and post-session drafting.
- Publish — Magazine/article editor, collections, contributors, and product stories.
- Account/platform — access, settings, activity, audit, adoption, and platform administration.

## Invariants

- Preserve the Inventory height chain documented in the repository `AGENTS.md`; wrappers must pass `flex-1 min-h-0` or `h-full` correctly.
- Client visibility never replaces Worker authorization.
- Full-screen admin overlays use `z-modal`, not `z-50`.
- Keep Cancel/Back/Close placement and the mobile bottom-navigation clearance contract.
- Register new operator tools in `toolRegistry.ts` and update [`docs/SITE_MAP.md`](../../docs/SITE_MAP.md) when routes change.
- Routing or navigation-label changes require explicit confirmation.

Open admin and platform cleanup belongs in [`docs/tracks/08-platform-hardening.md`](../../docs/tracks/08-platform-hardening.md), not in copied route inventories.

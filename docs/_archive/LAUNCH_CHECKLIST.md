SUPERSEDED 2026-04-27: PREVIEW_MODE was permanently removed (commit cleaning up #25 + #26). Kept here for historical context only.

# Launch Checklist — Restoring Hidden Sections

All sections below were hidden for the soft launch. Each one is gated by `PREVIEW_MODE = true` in `src/constants.ts`.

**To restore everything at once:** set `PREVIEW_MODE = false` in `src/constants.ts`.

**To restore sections individually:** set `PREVIEW_MODE = false`, then re-stub the ones you still want hidden by wrapping their `<Route>` element with a manual `<ComingSoonPage />` check.

---

## Gated Routes (show ComingSoonPage when PREVIEW_MODE = true)

| Route | Component | File | What needs to be done before restoring |
|---|---|---|---|
| `/community` | `CommunityPage` | `src/pages/CommunityPage.tsx` | Page is a placeholder — heading + Back only, no real content |
| `/for-your-space` | `ForYourSpacePage` | `src/pages/ForYourSpacePage.tsx` | New page, content not built |
| `/spaces` | `SpacesPage` | `src/pages/SpacesPage.tsx` | New page, content not built |
| `/start` | `StartHerePage` | `src/pages/StartHerePage.tsx` | New page, linked from homepage "New here? Start here →" |

All four routes live in `src/App.tsx` with inline `PREVIEW_MODE ?` ternaries — easy to find by searching `PREVIEW_MODE stubs`.

---

## Hidden Nav Items

| Location | Item | How to restore |
|---|---|---|
| `src/components/LeftSidebar.tsx` | "Our spaces" link (MapPin → `/spaces`) | Remove the `{!PREVIEW_MODE && ( ... )}` wrapper around the link |

---

## Shop — Product Visibility (not gated by PREVIEW_MODE)

The shop is live and fully functional. Visibility is controlled per-product in the admin:

- **Admin → Inventory**: toggle `is_public` to `true` + set `status` to `Active` for each tea you're ready to sell
- Products with `is_public = false` or `status != 'Active'` are invisible to the public automatically — no code change needed
- All other products remain safely hidden in your database

---

## Known Stub Pages (always empty, PREVIEW_MODE independent)

These routes exist and are accessible but have no real content yet. Do not add nav links to them without building them first.

| Route | Status |
|---|---|
| `/account/orders` | Empty state only — no order data wired |
| `/account/samples` | Empty state only — no sample data wired |

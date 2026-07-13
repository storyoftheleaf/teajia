# Remove Magazine Archive Design

## Decision

Remove the intentionally unlinked `/magazine-archive` experience and the code-defined legacy photo essays it alone exposes. The current `/read/*` routes and D1-backed `/article/:slug` publishing flow remain unchanged.

## Boundary

- `/magazine-archive` becomes an ordinary 404.
- Archive-only magazine and photo-essay UI is deleted when no remaining import uses it.
- The six code-defined stock-photo essays are deleted and no longer seed `StoryContext`.
- Persisted legacy stories are no longer restored into public search or product-related content.
- Current Read pages, event-to-photo-essay drafts, D1 articles, account UI, and navigation remain intact.
- Media documentation is regenerated from the post-removal audit rather than retaining the misleading claim that the new Read section uses the old images.

## Verification

A browser regression verifies the archive route is absent while `/read` and `/article/:slug` still work. TypeScript, color lint, production build, the China scanner, and focused mobile routing tests must pass.

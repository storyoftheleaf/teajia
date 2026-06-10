# Teajia

A unified tea journal, magazine, shop, and inventory management platform.

## Structure

- **Public site** (`/`, `/magazine`, `/learn`, `/shop`, `/consult`, `/about`) -- Editorial tea journal with magazine articles, photo essays, curated shop, learning hub, and consulting services.
- **Admin** (`/admin/*`) -- Private inventory management, invoicing, cost tracking, and analytics. Protected by JWT auth.
- **Worker API** (`worker/`) -- Cloudflare Worker backend with D1 (SQLite) database for products, invoices, exchange rates, and auth.

## Tech Stack

| Layer | Tech |
|---|---|
| Frontend | React 19, TypeScript, Vite 6 |
| Routing | react-router-dom v7 |
| State | Zustand (client), React Query (server) |
| Backend | Cloudflare Workers + D1 (SQLite) |
| Styling | Tailwind CSS |
| Deploy | Cloudflare Pages (frontend) + Workers (API) |

## Development

```bash
npm install
npm run dev          # Frontend at http://localhost:7777 (port reserved — see CLAUDE.md)
```

### Worker (API)

```bash
cd worker
npm run dev          # Pulls secrets from Infisical, then wrangler dev at http://localhost:8787
```

## Environment

Secrets live in Infisical (project: Teajia) — see the Secrets section in
`CLAUDE.md`. `npm run dev` (root and worker) generates `.env.local` /
`worker/.dev.vars` from Infisical on boot; neither file is tracked.

## Build & Deploy

Deploys run from GitHub Actions on push to `main`:

- `.github/workflows/deploy-frontend.yml` — type check, color lint, build, then
  Cloudflare Pages deploy to project **`teajiafinal`** (teajia.com). Do NOT
  deploy to the abandoned `teajia` Pages project.
- `.github/workflows/deploy-worker.yml` — worker tests, D1 migrations
  (`wrangler d1 migrations apply`), then worker deploy.

Manual builds: `npm run build` → `dist/`. The `_redirects` file handles SPA routing.

## Architecture

Both the public shop and admin inventory read from the same Cloudflare D1 database:
- Public: `GET /api/products/public` -- returns only active, public products with sensitive fields stripped
- Admin: `GET /api/products` -- returns all products (requires admin auth)

See `CLAUDE.md` for full architectural context.

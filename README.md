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
npm run dev          # Frontend at http://localhost:3000
```

### Worker (API)

```bash
cd worker
npx wrangler dev     # Local API at http://localhost:8787
npx wrangler deploy  # Deploy to production
```

## Environment

Copy `.env.example` and create `.env.local`:

```
VITE_API_URL=https://teajia-api.lightcodes.workers.dev
VITE_GEMINI_API_KEY=       # Optional: AI wisdom generation
VITE_EXCHANGE_RATE_API_KEY= # Optional: live currency rates
```

## Build & Deploy

```bash
npm run build    # Frontend -> dist/
cd worker && npx wrangler deploy  # API
```

Frontend deploys to Cloudflare Pages. The `_redirects` file handles SPA routing.

## Architecture

Both the public shop and admin inventory read from the same Cloudflare D1 database:
- Public: `GET /api/products/public` -- returns only active, public products with sensitive fields stripped
- Admin: `GET /api/products` -- returns all products (requires admin auth)

See `CLAUDE.md` for full architectural context.

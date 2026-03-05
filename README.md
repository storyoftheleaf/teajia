# Teajia

A unified tea journal, magazine, shop, and inventory management platform.

## Structure

- **Public site** (`/`, `/magazine`, `/learn`, `/shop`, `/consult`, `/about`) — Editorial tea journal with magazine articles, photo essays, curated shop, learning hub, and consulting services.
- **Admin** (`/admin/*`) — Private inventory management, invoicing, cost tracking, and analytics. Protected by Supabase auth.

## Development

```bash
npm install
npm run dev
```

Opens at http://localhost:3000

## Deploy

Deployed to Cloudflare Pages. Push to `main` triggers auto-deploy.

```bash
npm run build    # outputs to dist/
```

## Environment

Copy `.env.local` and fill in your Supabase credentials.

## Migration Notes

This project was created by merging two separate repos:
- **Teajia Grid** (magazine/public site)
- **Teajia Inventory** (admin/backend)

See `CLAUDE.md` for full architectural context and migration plan.

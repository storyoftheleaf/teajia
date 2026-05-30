# Let deploys apply database changes automatically

Right now the automatic deploy can update the site code but cannot apply database changes (D1 migrations), because the access token it uses lacks database write permission. Worker deploys still go live; database structure changes have to be applied by hand from a logged-in terminal.

## Steps to fix

1. Mint a new Cloudflare API token with both Workers deploy permission and D1 write permission.
2. Save it as the repository secret named `CLOUDFLARE_API_TOKEN`.
3. Remove the `continue-on-error: true` line from the "Apply D1 migrations" step so a failed migration actually fails the build instead of passing silently.

## Affected workflow

[.github/workflows/deploy-worker.yml](../../.github/workflows/deploy-worker.yml)

## Related one-off

The magazine editor needs its articles table created once before it works. Until that runs, `/admin/magazine` fails silently. Run once after logging in:

```
cd worker && npx wrangler login && npx wrangler d1 execute teajia-db --remote --file=migrations/031_articles.sql
```

Migration file: [worker/migrations/031_articles.sql](../../worker/migrations/031_articles.sql)

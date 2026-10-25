# Isolated working Library preview

From the repository root:

```sh
node worker/sandbox/library-preview.mjs snapshot
node worker/sandbox/library-preview.mjs start
```

`snapshot` reads the Bali account's Library, supplier identities, inventory and
receipt records through SELECT-only production queries. It does not copy user
authentication, API keys, supplier contact channels or verification information.
Referenced users become disabled local placeholders. A new local operator gets
a random password and a separate signing key.

The worker listens only on `http://127.0.0.1:8790`. Point the local Vite server at
it with `VITE_LIBRARY_LOCAL_PREVIEW=1 TEAJIA_API_PROXY=http://127.0.0.1:8790`
(the first setting shows the local-copy notice). For the review URL use port 7789:

```sh
VITE_LIBRARY_LOCAL_PREVIEW=1 TEAJIA_API_PROXY=http://127.0.0.1:8790 ./node_modules/.bin/vite --host 127.0.0.1 --port 7789 --strictPort
```

Open `/admin/compass?tab=library`. Sign in using the username and
password in `worker/.wrangler/library-preview/credentials.json`; this is ordinary
local authentication, with no production session or authorization bypass.

All preview edits persist in the isolated local database. Production is unchanged.
Use `start` to resume; `snapshot` refuses to overwrite an existing preview. The
private configuration, credentials and snapshot are inside the ignored,
owner-access-only `worker/.wrangler/library-preview` directory. The worker does
not load the main project's `.dev.vars`, and has no email, AI, OAuth or production
storage binding. Remote photographs remain references; files are not copied.

If initial creation stopped after exporting but before creating the database,
`node worker/sandbox/library-preview.mjs initialize` retries local initialization
without reading production again. It refuses existing populated tables rather
than overwriting edits.

## Verified quote correction in this local preview

The October 25 local copy exposed an import mapping error: computed money per
gram had been stored in the quote's gram denominator. The preserved source
excerpts explicitly quote Aged Liu Bao Tea at CNY380/500g, Aged Ripe Pu-erh Tea
at CNY400/500g, and Aged Northern Vietnam Ripe Pu-erh Tea at CNY280/500g.
These three local records were corrected through the normal Compass API to
500 quoted grams, preserving their original amount and currency. Production
records and the original snapshot file remain untouched. The mapper and its
tests now distinguish per-pack weight from whole-line weight for future imports;
migration `0049_repair_imported_quote_grams.sql` repairs only those three exact
known bad values on release, preserving subsequent human edits and other accounts.

## Pre-inventory names

Migration `0048_compass_given_name.sql` has been applied to this isolated local
preview only. It adds the encounter's chosen name and keeps linked Inventory
names synchronized without moving a tea into inventory. Apply this migration
to the deployment database before releasing the naming UI. No production
migration or live name change was performed during preview work.

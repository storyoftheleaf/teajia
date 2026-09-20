# The sandbox

A copy of Teajia that runs entirely on this machine, so an agent can sign in to
the admin, click every control, and break things without touching the live shop.

It exists because the dev site normally talks to the **live production API**.
That made it impossible to verify any admin fix without editing real inventory,
which meant handing verification back to Adrian every time. This is the fix.

## Start it

```bash
cd "/Users/adrianrasmussen/Documents/Files/2 Areas/Coding/teajia" && npm run sandbox
```

That runs two things together: the API on port 8787 with its own local database,
and the site on port 7777 pointed at it. The live database is never contacted.

## Sign in

The sandbox has one operator, owner-tier on both shops:

- username `sandbox`
- password `sandbox`

Deliberately trivial. Nothing here is worth protecting: the local database has
zero users, zero customers, zero orders.

An agent driving a browser can skip the form and put a session straight into
storage, which is faster and repeatable:

```js
(async () => {
  const r = await fetch('http://localhost:8787/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: 'sandbox', password: 'sandbox' }),
  });
  const j = await r.json();
  localStorage.setItem('teajia_token', j.token);
  localStorage.setItem('teajia_active_account', j.active_account_id);
  return j.user;
})()
```

Storage survives reloads, so this is normally a once-per-browser step.

## A new worktree starts with nothing

The local database is not in git, so a fresh clone or a new worktree has no
tables at all. Starting the API against that empty file used to answer a wall
of 500s that read like broken application code. It now refuses to start and
names the fix instead, so run the rebuild below first.

## What is in the database

Everything needed for a product screen to look real, and nothing else:

| Copied | Not copied |
|---|---|
| products, listings, tea profiles | users, customers |
| accounts, collections, batches | invoices, orders, sales |
| exchange rates | tasting journals, notes, tokens |

No personal details land on this disk. That is a rule of the refresh script, not
an accident of what happened to be exported: the copied-table list is explicit,
and anything not on it stays on the server.

## Rebuild it

The copy goes stale as the real shop changes. To pull a fresh one:

```bash
cd "/Users/adrianrasmussen/Documents/Files/2 Areas/Coding/teajia" && npm run sandbox:refresh
```

Takes a couple of minutes. It throws the local database away, re-reads the live
structure, re-copies the product rows, rebuilds, and re-seeds the operator. Safe
to run any time: it only ever READS from live, and the only thing it deletes is
the local copy it is about to replace.

Every rebuild ends by comparing the result against live, table by table and
column by column, plus every index and trigger. Any difference prints and the
script exits non-zero. A quiet finish is a measurement, not a hope.

## Creator profile fixtures

`contributors`, `contributor_accounts`, `profile_favorites`, `payment_methods`
and `contributor_gallery_images` are not on `refresh.mjs`'s copied-table list
either (same privacy reasoning as `users`/`customers`), so a fresh sandbox has
zero creators. To see real `/people` and `/people/:slug` pages, seed three
placeholder creators after building the database:

```bash
cd "/Users/adrianrasmussen/Documents/Files/2 Areas/Coding/teajia" && npm run sandbox:seed-creators
```

That inserts three fixed-slug fixtures at three fill levels:

- `wei-chen` -- sparse (portrait + one paragraph, everything else absent)
- `amara-osei` -- medium (some sections filled, some not, one unpublished payment method)
- `kenji-tanaka` -- full (gallery, typed links with a WeChat QR image, tea
  selection, a hosted upcoming event, an authored article with a pull-quote)

Every image URL is a stock Unsplash placeholder, named as such in the script's
header. The tea-selection rows point at real `product_listings` this sandbox
copy actually has, queried at seed time rather than hardcoded -- see
`seed-creator-fixtures.mjs` for the exact filter. Safe to run any time: it
deletes its own fixture rows by fixed id before re-inserting, so running it
twice does not duplicate anything. It does not touch `refresh.mjs`'s copied
tables or its live-vs-repo verification step.

## Four things that will bite whoever edits the refresh script

1. **The live database contains full-text search tables, and the export endpoint
   refuses to run on a database that has any.** The script works around this by
   listing tables first and naming each one it wants, rather than asking for the
   whole database.
2. **Exported rows arrive grouped by table in an order that breaks foreign
   keys.** The script re-orders them parents-first before loading. If you add a
   table to the copied list, put it after whatever it points at.
3. **The copied structure is LIVE's, which can sit behind this repo.** A column
   added in `worker/migrations/` but not yet applied to production is missing
   from the dump, and every sandbox request that reads it fails. After loading
   the dump the script applies each numbered migration on top; a column live
   already has reports "duplicate column name" and is skipped. That is expected
   output, not a failure. Each migration is applied **one statement at a time**:
   handed a whole file, the first duplicate column aborts the rest, and the
   columns the later statements would have added go missing silently.
4. **`wrangler d1 export` writes CREATE TABLE and nothing else.** Live's 253
   indexes and 15 triggers are absent from the dump, so the script reads them
   back out of live's `sqlite_master` and replays them. Skipping this is not a
   performance question: an upsert whose `ON CONFLICT` target is a unique index
   fails outright without it, and the triggers that maintain
   `contact_relationships` silently do nothing.

## What the sandbox is good for, and what it caught

It is worth being clear about which way the evidence points when an endpoint
fails here. On 2026-08-31 three endpoints (`/api/me/profile`, `/api/me/queue`,
`/api/me/wishlist`) and part of a fourth (`/api/me/journey`) answered 500 in the
sandbox. The schema was checked against live column by column: it matched. The
queries were asking for a `deleted_at` on `tea_compass_entries` that production
does not have either, and joining `tea_samples` on `sample_set_id` when the
column is `set_id`. All four were broken in production and had been for some
time; nothing in the live site reads those routes loudly enough to notice.

So: a 500 here is a claim about the code until the schema comparison says
otherwise, and the rebuild now runs that comparison for you.

## Files

- `refresh.mjs`: pulls a fresh copy from live and rebuilds everything
- `check-db.mjs`: refuses to start the API against an empty database (run by `npm run sandbox`)
- `seed-operator.mjs`: creates the sandbox operator (run by refresh; also standalone)
- `seed-creator-fixtures.mjs`: creates three placeholder creator profiles (standalone, run after refresh)
- `*.sql`, `*.json`: the pulled dumps, gitignored and disposable

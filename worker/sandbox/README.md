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

Takes a couple of minutes. It re-reads the live structure, re-copies the product
rows, rebuilds the local database, and re-seeds the operator. Safe to run any
time: it only ever READS from live.

## Two things that will bite whoever edits the refresh script

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
   output, not a failure.

## Files

- `refresh.mjs`: pulls a fresh copy from live and rebuilds everything
- `seed-operator.mjs`: creates the sandbox operator (run by refresh; also standalone)
- `*.sql`, `*.json`: the pulled dumps, gitignored and disposable

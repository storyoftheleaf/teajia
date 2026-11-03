# Deploy, migrations and secrets

> Moved verbatim from CLAUDE.md on 2026-11-03 so it loads only when needed. The short rules stay in [CLAUDE.md](../../CLAUDE.md).

## Deploy
```bash
npm run dev          # dev server port 7777 (exclusively reserved — see project_port_7777 memory)
npm run lint:worker-types  # worker type errors, ratcheted in CI
npm run build        # production build → dist/
npm run lint         # tsc --noEmit
npm run lint:colors  # MANDATORY pre-commit color check (run before every commit)
npm run preview      # preview production build
# deploy via Cloudflare Pages CI on push to main
```

`npm run dev` silently does nothing if port 7777 is already taken (the script exits when `lsof` finds a listener), and `npm run sandbox` also uses 7777, so check what holds the port first.

### The worker entry exports a handler, and no bare constants

The Workers runtime reads every named export of `worker/src/index.ts` as an
entrypoint, so `export const STALE_RATES_AFTER_DAYS = 3` is offered to it as a
request handler and it refuses to start: *"not of type 'function or
ExportedHandler'"*. Functions and classes are valid entrypoints and stay
exported; types are erased before the runtime sees them. Only `const`, `let` and
`var` are refused, by [worker/tests/entry-exports-only-the-handler.test.ts](../../worker/tests/entry-exports-only-the-handler.test.ts).

**It does not fail where you would look for it.** `wrangler deploy` and its dry
run only BUILD the bundle, so the deploy goes green and the live API keeps
answering. What breaks is `wrangler dev`, which actually boots the runtime, and
that is the local sandbox: the one tool that lets an agent click an admin change
instead of handing it to Adrian. On 2026-09-06 one exported number took the
sandbox down for every session while CI stayed green all day, so nothing
announced it and the only symptom was verification quietly becoming impossible.

### A migration that moves data gets shown to Adrian FIRST, as a link

**Before pushing a migration that changes rows, publish a page and give him the URL.** Not the SQL, not
a diff, not a paste in chat. He judges with his eye and a migration is the one thing an agent does that
changes his shop without him ever seeing it: it lands through CI, in a database no session can read
back, on prices customers pay.

Schema-only migrations (a column added, an index) do not need this. A migration with an `UPDATE`,
`DELETE` or `INSERT` in it does.

The page has to answer what he would ask if he could see the rows:

- **What it changes**, in his words, not the column's. "This tea stops shipping free", not
  "`shipping_rate_per_kg` → NULL".
- **What it touches AND what it leaves alone**, as a table of row shapes with before and after. The
  second half is the half that builds trust: a migration nobody can bound is a migration nobody can
  approve. Seed those shapes against `worker/schema.sql` in `node:sqlite`, run the migration over them,
  and put the real output on the page.
- **Say plainly that they are seeded shapes, not his shelf.** A cloud session cannot read the live
  database, so the page must never imply it did.
- **His check afterwards**, and it must be something he can see in the admin: the gold dot in the
  Ship $/kg column, a price on a product page, a count. "Trust me" is not a check.

Worked example: [the Y562 freight clearance](https://claude.ai/code/artifact/547ee5e7-b1db-4d4e-9028-199e7c8d5c53),
for migration `0015`.

**Seeding the shapes is not ceremony, it is where the bugs are.** `0015`'s year match was written as
text against `'1993'` and looked obviously right. Run against a seeded row it matched a year stored as
a string and MISSED one stored as a number, which a driver can land as `1993.0`. A text comparison
misses by doing nothing, which is the failure that looks exactly like success, and no amount of reading
the SQL would have shown it.

### The worker builds before the database moves

`deploy-worker.yml` runs, in order: worker tests, **`wrangler deploy --dry-run`**, D1 migrations, deploy. The dry run is there because vitest only transpiles the files a test imports, so it has no opinion about a module no test loads. On 2026-09-06 a renamed export left `curateImports.ts` importing a name that no longer existed: 1198 tests passed, migration `0009` applied to the live database, and the deploy then died in esbuild, leaving the schema ahead of the code. The dry run builds the same bundle, writes nothing, needs no credentials, and must stay **above** the migration step.

### "Ship" command — mandatory

When Adrian says **"ship"**, immediately publish the completed task-scoped changes to `origin/main` and verify the pushed commit is present on the remote. For Teajia, "ship" does not mean create a PR, stop after local verification, or merely prepare a commit. If the shared checkout contains unrelated work, isolate the task in a clean worktree and push its commit directly to `main`; never include unrelated changes. Do not report work as shipped until the push succeeds.

## Secrets — Infisical is the source of truth (set up 2026-05-24)
Worker secrets live in Infisical (project: Teajia, env: dev). The repo no longer carries a tracked `.env.local` or `worker/.dev.vars`; both are generated on demand or ignored.

**Local dev flow:**
- `cd worker && npm run dev` runs `infisical export ... > .dev.vars && wrangler dev`. Each boot regenerates `.dev.vars` from Infisical, so the on-disk file is a throwaway cache.
- To change a secret: edit it in the Infisical web UI, then restart `npm run dev`. No file edits needed.
- `.infisical.json` (committed) links this folder to the Teajia project. Safe — just an ID.
- `.dev.vars` is gitignored. Original pre-Infisical copy archived at `~/.infisical-backups/teajia/dev.vars.backup-2026-05-24` (kept until prod side is also migrated).

**Production (Cloudflare Worker):**
- Still uses `wrangler secret put` — not yet wired to Infisical. When ready, the path is `infisical run --env=prod -- wrangler secret put X` or a Machine Identity in CI.

**Frontend (`.env.local`):**
- Was untracked from git in commit `6eb75fc` (was on disk + tracked despite `.gitignore` listing it). Not yet wired to Infisical because Teajia's frontend only reads `VITE_API_URL` (a public URL) and dev-only seed credentials. Migrate when adding real `VITE_*` secrets.

**Never paste secret values into chat or scripts.** Source of truth is Infisical; if a value is needed, use `infisical secrets set KEY=...` in Terminal directly. See `~/.claude/projects/.../memory/feedback_secret_handling_strict.md`.

**Full cross-project pattern docs:** [../i64os/docs/SECRETS.md](../../../i64os/docs/SECRETS.md) — covers all four projects, the two-Infisical-projects shape, prod boundary, and command cheat sheet.

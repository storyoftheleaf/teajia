# Tea Atlas

A private reading library inside teajia.com: the Global Tea Hut archive (and any
source added later), read online with its pictures. It exists only for the
people who have been given access. For everyone else it does not exist: no link,
no sitemap entry, no index, and every page, API call and picture answers the same
plain 404 an unknown address answers.

This file is the contract. Two other sessions build on it (the design polish,
and the "drop in a new source" admin tool), so change it in the same commit that
changes the shape.

## Who can read it

The capability is called **Tea Atlas** (`tea_atlas`). It is not one of the six
operational bundles and is deliberately kept out of `ALL_BUNDLES`: every owner
of every shop, and every platform admin, receives all six bundles automatically,
and a licensed archive must not follow that rule.

A person can read the Tea Atlas when either:

1. they are the **site owner** (`users.platform_role = 'platform_owner'`), which
   is automatic and cannot be removed; or
2. they are an active member of the **platform account** (`accounts.is_platform_owner = 1`)
   and their membership row carries `"tea_atlas": true` inside
   `account_members.permissions` (the same JSON object that holds `bundles`).

Nobody else. Platform admins, other shops' owners and staff with every bundle do
not have it until somebody ticks it for them.

- **Granting.** In `/admin/access` on the platform account, open a person and
  tick **Tea Atlas**. The server route is
  `PUT /api/accounts/:id/members/:userId/tea-atlas` with `{ "granted": boolean }`.
  It requires the Members bundle on the platform account (the site owner, and
  anyone given Access manager). On any other account it answers 404: the
  capability is not offered there.
- **A person who is not a member yet** is invited to the platform account as a
  Viewer (no operational bundles) and then ticked. Viewer + Tea Atlas is "can
  read the library, can do nothing else".
- The rule lives once, in `worker/src/atlas.ts` (`canReadTeaAtlas`), and is
  checked server-side on every Tea Atlas request. The React app only asks the
  server; it never decides.
- Changing bundles never touches the tick: the bundles route merges into the
  permissions object, and the legacy permissions route carries `tea_atlas`
  across when it rewrites it.

## What "hidden" means here

| Surface | Signed out, or no capability | Has the capability |
| --- | --- | --- |
| `/api/atlas/...` (data and pictures) | `404 {"error":"Not found"}`, byte-identical to an unknown API route. Checked before any storage lookup, so a real key and a made-up key answer the same. | `200`, streamed from R2, `Cache-Control: private`, `X-Robots-Tag: noindex` |
| `/tea-atlas...` (pages) | HTTP status **404** from the edge (Pages middleware), then the site's ordinary "Page not found" view | HTTP 404 from the edge too (the shell is identical for everyone, the edge cannot see a session), then the app asks the API and shows the library |

- Pages carry `<meta name="robots" content="noindex, nofollow">` once rendered,
  and the 404 status already keeps them out of every index.
- No public nav link, no sitemap line, no robots.txt line (a Disallow would
  announce it), nothing in `llms.txt`.
- Two doors exist, and only for readers: a **Tea Atlas** tile in Your Table, and
  a **Tea Atlas** row in the Manage column after Wisdom (only for someone who
  already has Manage rooms; it never counts as one). `useAtlasAccess`
  (`src/atlas/access.ts`) decides whether to show them, asking as little as the
  rule allows: the site owner sees them without a request; a member of the
  platform account is asked once a session (`home.json`, a door only on 200);
  everyone else sees nothing and sends nothing, since only platform-account
  members can be ticked. A door is never proof: the server checks every Atlas
  request behind it.
- Pictures are never `<img src>` to an open URL: the app fetches each one with
  the session token and shows it from a blob. A picture URL pasted into a
  private window is a 404.
- The reader code is its own lazy chunk, loaded only after the server has said
  yes.

## Storage

**Bucket:** R2 `teajia-atlas-private`, bound to the Worker as `ATLAS_BUCKET`.
Private: no `r2.dev` public URL, no custom domain (both uploaders refuse to run
if either appears). The Worker is the only door.

Metadata lives in R2 too, not D1: it is rebuilt wholesale from the package, it
is read-only at runtime, and pre-split JSON files stream without being parsed,
which keeps every request far under the free plan's 10 ms CPU.

```
articles/<articleId>.json               the package's article, as built (metadata + blocks)
media/<issue>/<stem>.jpg                the package's pictures, as built
index/v1/home.json                      sources + topics with counts + totals
index/v1/sources/<sourceId>.json        one source, its issues grouped by year
index/v1/issues/<issueId>.json          one issue, its articles in reading order, prev/next issue
index/v1/topics/<topicId>.json          one topic, every article carrying it, oldest first
index/v1/search/catalog.json            every article: id, title, author, issue, issue label, topics, pages
index/v1/search/text/<shard>.json       full-text index shard: { term: [article number gaps] }
added/sources.json                      sources added from the admin, in the order added (never served to readers)
added/<sourceId>/manifest.json          each one's format-1 manifest (never served to readers)
_atlas-upload-state.json                upload bookkeeping (never served)
manifest.json, README.md                copied by the other uploader (never served)
```

The package files keep the package's own names, so `npm run atlas:upload` and
`~/builds/tea-atlas-upload.sh` write identical keys and either can fill the
bucket. Only `atlas:upload` builds `index/v1/`. The reader shows "in this issue"
and prev/next from the issue file, so article files are served untouched.

- Article, issue and topic ids come straight from the package and must be unique
  package-wide (the build refuses otherwise).
- An article's picture blocks keep the package's `src` (`<issue>/<stem>.jpg`);
  the app requests `/api/atlas/media/<src>`.
- `/api/atlas/articles/<id>.json` and `/api/atlas/media/...` map to the same key;
  `/api/atlas/home.json`, `sources/`, `issues/`, `topics/`, `search/` map under
  `index/v1/`.
- **Search.** Titles, authors and topics are searched from `catalog.json`
  (~1,500 rows, loaded once). Full text uses an inverted index split into shards
  by the first two characters of each term (`ab.json`; a term starting outside
  a–z/0–9 uses `u<hex code point>.json`). The app loads only the shards its query
  terms need. Each shard maps a lowercased, accent-folded term to a delta-encoded
  list of article numbers (positions in `catalog.json`). Common words are left out.

## Routes

**API** (Worker, all `GET`, all behind `canReadTeaAtlas`):

```
/api/atlas/<path>     →  R2 key (see the mapping under Storage)
```

`<path>` must match one of the shapes above (`home.json`, `sources/…json`,
`issues/…json`, `topics/…json`, `articles/…json`, `search/catalog.json`,
`search/text/…json`, `media/<issue>/<file>.jpg`); anything else is the same 404.

**Pages** (React, lazy, under `src/atlas/`):

```
/tea-atlas                         home: search box, sources, topics with counts
/tea-atlas/source/:sourceId        a source's issues by year
/tea-atlas/issue/:issueId          an issue: articles in order
/tea-atlas/read/:articleId         the reader
/tea-atlas/topic/:topicId          every article on a topic
/tea-atlas/search?q=               titles, authors, topics, then full text
```

Every article credits its source (`Global Tea Hut, globalteahut.org`).

## Adding or refreshing a source

The input is the web package (format 1) built by Adrian's `tea-atlas` script at
`~/Documents/Files/2 Areas/Brands/Teajia/Reference/Tea wisdom/Atlas/_export/`.
Read its `README.md`. Never edit the package or anything in `~/builds/tea-atlas*`;
rebuild it instead.

1. Rebuild the package with `tea-atlas` (a new source is a new entry in
   `manifest.json` `sources[]`, with its issues, articles and media).
2. Run `npm run atlas:upload`. It builds the R2 layout into a scratch folder,
   hashes every file, compares with `_state.json`, and uploads only what changed
   (wrangler bulk put, remote). A rerun with nothing changed finishes in seconds;
   the first full upload of ~10,500 pictures takes about 45 minutes because of
   Cloudflare's API rate limit.
   - `npm run atlas:upload -- --dry-run` prints what would change.
   - `npm run atlas:upload -- --local` fills the local sandbox bucket instead
     (for `npm run sandbox`).
   - `--export <dir>` points at a different package.
   - `--index-only` sends only the built index and search files (for when the
     package files are already up, e.g. sent by `~/builds/tea-atlas-upload.sh`,
     which writes the same `articles/` and `media/` keys; files its ledger records
     are never sent twice).
3. Nothing to deploy: the Worker serves whatever the bucket holds.

## Adding a source in the admin

The site owner can add a book, a magazine issue or a saved web article from a
PDF, without the `tea-atlas` scripts: **`/tea-atlas/add`**, linked from the
Tea Atlas home page for the owner only. Code only, no AI.

1. **Drop the PDF.** It is read in the browser with pdf.js
   (`src/atlas/add/readPdf.ts`, `extract.ts`), because the Worker has 10 ms of
   CPU per request and cannot run PDF tools. Text comes out as lines in reading
   order (two magazine columns left first, drop caps joined back on), pictures
   as true-colour JPEGs at most 1600 px (icons, thin strips, flat textures and
   anything repeated on three or more pages left out, as `tea-atlas-media.py`
   does). pdf.js decodes print-colour (CMYK) pictures itself, with the colour
   profile and decoders served from `/vendor/pdfjs/` (copied from `pdfjs-dist`
   by `scripts/pdfjs-assets-plugin.mjs`).
2. **Proposed sections** (`split.ts`), first method that works: the PDF's own
   bookmarks (a long part with no bookmarks inside is split by its large
   headings); otherwise a contents page (`12 Title`, `p. 12 Title`,
   `Title .... 12`, with "By ..." lines taken as the author); otherwise
   headings printed much larger than the body text. A document with one title
   and nothing else stays one article.
3. **Check and fix.** Each section shows its title (editable), page range (the
   start is editable), author, first lines, suggested topics and pictures.
   Join a section into the one above, start a new one at any page, remove a
   topic or add one, click a picture to leave it out. Topics are suggested by
   the same rule `tea-atlas.py` uses: an alias mentioned three times, or named
   in the title.
4. **Publish.** `buildPackage.ts` writes the same format-1 shape as the
   Global Tea Hut export (text rules ported from `tea-atlas.py`: running heads,
   reflow, headings, 茶人 bylines; page markers are printed page numbers).
   `publish.ts` sends, in order: pictures, articles, `added/<id>/manifest.json`
   and `added/sources.json`, then the index files the new source changes, with
   `home.json` last. The index is merged, not rebuilt (`mergeIndex.ts`): the
   new source goes at the end of the reading order, so nothing published moves.
   The merge produces byte for byte what `atlas-build.mjs` produces with the
   source added, and a test holds the two side by side.

**The door** is `/api/atlas-admin/...` (`worker/src/atlasAdmin.ts`): the site
owner only (`canManageTeaAtlas`, which also requires `canReadTeaAtlas`);
everyone else, readers with the tick included, gets the unknown-route 404,
decided before the bucket is touched. It writes only the shapes above.
`articles/` and `media/` are write-once (409 if the key exists), so it can
never overwrite a file of the package or of an earlier source; a publish that
stopped part way can simply be sent again. A new source's name must not match
an existing source or issue.

**Rebuilds keep added sources.** `npm run atlas:upload` downloads
`added/sources.json`, each manifest and its articles, and builds the index
with them after the package's sources (`buildAtlas(dir, { added })`). Their
articles and pictures are already in the bucket and are not sent again. If the
list cannot be read for any reason but "not there", the upload stops rather
than drop them from the index.

**Not yet:** an added source has no Obsidian notes (the `tea-atlas` scripts
write those from the package; an admin-added source exists only in the
bucket). Replacing or removing an added source is not built: publish under a
new name. Adding one issue to an existing source (a new Global Tea Hut issue)
goes through `tea-atlas`, not this tool.

**Optional AI step, OFF.** `src/atlas/add/suggestSplits.ts` holds a clearly
marked hook, `SUGGEST_SPLITS_WITH_AI = false`, for messy magazines: it would
send only each page's first lines (about 2k tokens a document, never article
text) and return page numbers and titles. It is not built and nothing calls it.

## Tests

`worker/tests/tea-atlas-access.test.ts`: a signed-out visitor, a normal member,
a staff member with every bundle but no tick, a platform admin, and an owner of
another shop all get the plain 404 on a page's data, the API and a picture; the
site owner and a ticked member get 200. Also pins the grant route and that
bundle edits keep the tick.

`worker/tests/tea-atlas-add-source.test.ts`: the add-source door is the plain
404 for a signed-out visitor, a ticked reader, staff with every bundle and a
platform admin, and opens for the site owner; articles and pictures are
write-once; merging a source into the index equals a full rebuild with it;
and the splitting and text rules on small made-up pages (bookmarks, long
parts, a magazine contents page, headings under a pull quote, a web article,
drop caps and columns, hyphens and running heads, 茶人 bylines, ids, topics).

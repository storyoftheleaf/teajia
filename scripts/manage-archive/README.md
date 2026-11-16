# Manage picture archive

Takes a picture of every Manage screen as it looks today, on a phone (390x844) and a laptop (1440x950), at 2x, so the current interface can be looked back at after rooms are rebuilt.

**The data is sample fixtures, not the shop's.** The API is mocked in each spec (the repo's `tests/helpers/compassHarness.ts` and `tests/helpers/inventoryMocks.ts`, plus `data.ts`, `rooms-data.ts` and `mock.ts` here). Nothing reaches the live shop. No application code, test or fixture is changed by this folder.

## Run it

```bash
npm run dev:test            # port 7777; check `lsof -i :7777` first, it exits silently if the port is taken
# in another terminal, from the repo root:
npx playwright test -c scripts/manage-archive/playwright.config.ts            # everything
npx playwright test -c scripts/manage-archive/playwright.config.ts stock      # one spec
```

The config starts `npm run dev:test` itself if nothing is listening. Never use `npm run dev` (it talks to the live API).

If Playwright's own browser is not installed (the cloud container), the config uses `/opt/pw-browsers/chromium`; set `PW_CHROMIUM=/path/to/chrome` to change it. ImageMagick's `convert` (with WebP) turns each PNG into a WebP at quality 80.

Output goes to `ARCHIVE_OUT` (default: `teajia-manage-archive/` in the system temp directory, see `lib.ts`): `<room>--<state>--<phone|laptop>.webp` and `index.json` (`file, room, state, size, route, note`, in viewing order). Images are not committed.

## Specs

| File | Rooms |
| --- | --- |
| `curate-old.spec.ts` | Old Curate (`/admin/compass`): Source, Library, Ledger, Samples and their states |
| `curate-new.spec.ts` | New Curate (`/admin/compass/v2`) |
| `tasting.spec.ts` | The tasting flow, every zone empty and with choices, from a Library card and from the capture form |
| `stock.spec.ts` | Stock, Drafts, Intake, Tea Glossary, Network, and Purchases |
| `rooms.spec.ts` | Today, Sales, People, Sessions (events, tastings, venues), guest screens, Publish, Settings |
| `shop.spec.ts` | The public shop list and tea pages |

Each state is opened from a clean browser state (`fresh` in `lib.ts`), because an overlay or draft left open by one picture otherwise comes back on reload and hides the next control. The first load after a cold start shows only a loader, so every spec loads one page first and discards it. A step whose control is not found logs `MISS` and skips that picture rather than failing the run.

## How a picture is sized

A plain picture is the screen as it is seen (phone 390x844, laptop 1440x950). A picture marked `full` grows the window to the tallest list the person can actually see, so a long page is captured whole. A list lying under an open sheet, dialog or full-screen flow does not count, because growing the window for it stretches the thing on top into a shape nobody sees (this is what first made the tasting pictures wrong). A dialog rendered inside the list it covers still fools that check, so dialogs are taken without `full`.

## The gallery page

`build-gallery.cjs` turns the output folder into one page. Curate exists in two versions, so it comes first as pairs, current on the left and v2 on the right (the `COMPARE` list in the script names which screens pair up). Every other room is shown phone beside laptop:

```bash
node scripts/manage-archive/build-gallery.cjs "$ARCHIVE_OUT" out/manage-archive.html out/files.json [notes.json]
```

It writes the page, a `pub/s/NNN.webp` copy of every picture under the page's folder (the short names the page refers to), and `files.json` (published name to original file). `notes.json` is optional: `{ "notPictured": ["..."] }` adds a closing list of screens the run could not reach.

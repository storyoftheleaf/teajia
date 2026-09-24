# Launch photographs: getting them onto the site

**For:** an agent picking this up cold. **Written:** 2026-09-24. **Owner of the pictures:** Adrian. **Your job:** take the files he hands you, prepare them, put each one in its place on the live site, and prove every one is showing.

Two lists say WHICH pictures, WHAT each shows, and WHAT SHAPE. They are the source of truth; this file is only the how.

- **Site list** (24 places outside the shop): [Teajia Shot List](https://claude.ai/artifact/Xef4FpLupisCWaMptNCyMM)
- **Shop list** (137 teas and teaware pieces, three squares each): [Teajia Shop Photos](https://claude.ai/artifact/N67p5t2KvCSHaSKFwgBcXE)

Read both with the Artifact tool's `read` action before starting. Their tick-boxes live in Adrian's browser, so they do not tell you what is done; the live site does (step 5).

## Done looks like

Every place on both lists shows a real photograph on teajia.com, checked on the live page at desktop and phone width, and the Teajia TODO line "Gather the launch photographs" is moved to `todo/archive.md` with this file moved to `todo/plans/archive/`. Partial progress is normal: photos will arrive in batches. Each batch is done when every file in it is live and checked.

## Rules before you touch anything

1. **This is the live shop.** A shop photo is public the moment the product is saved; a page photo is public the moment the page is published (step 4). There is no staging copy of the photos; the local sandbox (`npm run sandbox`) uploads to a local bucket, so it is for rehearsing the steps, never for the real upload.
2. **Adrian signs in, you never do.** Uploading needs an admin session. Use a browser where he is already signed in (ego-browser reuses his login). Never type a password, never copy a session token out of the browser, never paste one into a script.
3. **Nothing leaves his Mac with location data in it.** Phone photos carry GPS. The prepare step strips it; do not skip it for "just one".
4. **Never delete a photo that is already live** to make room. Replace in place. Removing is his call, per photo.
5. **Ask once, then run.** If a file name does not match any place, list the unmatched ones in one message; do not guess where a picture goes.

## Step 1: receive the files

Ask Adrian which folder he has put them in (suggest `~/Pictures/Teajia launch/`), then list it. Expected names:

- **Shop:** `<web address>-1.jpg`, `-2`, `-3`, using the tea's address exactly as the Shop Photos list prints it (e.g. `bamboo-leaf-1990-1.jpg`). Photo 1 is the main one.
- **Site:** `<page>-<slot>.jpg`, e.g. `advise-cover-sourcing.jpg`. The page and slot names are in the table in step 4.

Match every file to a place before preparing anything. Report: how many matched, and the names of any that did not.

## Step 2: prepare each file

Tools on this Mac, measured 2026-09-24: `sips` (built in) and `cwebp` (Homebrew). No ImageMagick, no exiftool. `cwebp -metadata none` drops all metadata including GPS.

```bash
mkdir -p ~/Pictures/Teajia\ launch/ready
cd ~/Pictures/Teajia\ launch
for f in *.jpg *.jpeg *.png *.heic *.HEIC; do
  [ -e "$f" ] || continue
  base="${f%.*}"
  sips -s format jpeg "$f" --out "/tmp/$base.jpg" >/dev/null
  cwebp -quiet -q 82 -resize 2000 0 -metadata none "/tmp/$base.jpg" -o "ready/$base.webp"
done
```

- Long edge 2000 px, WebP at quality 82. A 2000 px test image came out at 84 KB. The server does NOT resize (it stores what it is given, 10 MB cap), so an unprepared phone photo would load megabytes on every visit.
- iPhone HEIC files are refused by the upload (`jpg`, `png`, `webp` only); the `sips` line converts them.
- Check: open two or three of `ready/` in Preview and confirm they look right (not rotated, not washed out). If one is rotated, rotate the original and rerun it.

## Step 3: the shop photos (teas and teaware)

In the admin: **Manage → Stock**, find the item, open it. The edit panel has **three photo slots**: main, 2, 3. Drop the prepared file on a slot, adjust the crop, save. A fourth slot is the **bag photo**: that is the label on the supplier's bag, used at intake. Leave it alone.

- The panel crops and re-encodes on upload, so what you see in the crop box is what the shop shows.
- Upload two or three per item, never one: with a single picture the tea page cuts it into a wide strip 180 px tall; two or three show as square thumbnails that open full size.
- The panel writes to `products.image_url` (main) and `additional_images` (2 and 3), and uploads go to `https://media.teajia.co/accounts/<account>/products/<product id>/<slot>.<ext>`.

**Agent tools exist but only attach, they do not upload.** `set_tea_image` and `add_tea_images` on the Teajia MCP take a URL that is already hosted. They are useful to fix a wrong attachment, not for the first upload. On 2026-09-24 the Teajia MCP token in this setup was being refused (401), so check `npm run mcp:check` before relying on it.

**Batch rhythm:** do one kind at a time (all pressed teas, then loose, then pots...). After each batch, run step 5 for that batch before starting the next.

## Step 4: the site photos (outside the shop)

Most are **in-page photo slots**. Signed in as the owner, each page with slots carries a small owner bar. On teajia.com:

1. Open the page and switch editing on from the owner bar.
2. Drop the prepared file onto the frame, then drag the focal dot to choose what stays in view when it is cropped. The bar's **What still needs a photo** list shows every empty frame on that page.
3. **Publish.** A dropped photo goes into a DRAFT that only the owner sees; visitors see nothing new until it is published. The bar confirms with "Published. Live now." Every publish keeps a past version, so **Undo to a past version** can roll a page back.
4. Use **view as visitor** to check it the way the public will, before and after publishing.

The page's text lives in the same draft, so publishing also publishes any text edit left sitting in it. Before publishing, check the draft holds only your photos; if other edits are waiting, stop and ask Adrian.

| Page (address) | Page name | Slot | What it is |
|---|---|---|---|
| Home (`/`) | `home` | `table` | Hero, already real |
| Advise (`/advise`) | `advise` | `cover-conversation` | Start here, the tall cover |
| Advise | `advise` | `cover-design` | Tea House Design & Curation |
| Advise | `advise` | `cover-sourcing` | Tea Curation & Sourcing |
| Advise | `advise` | `cover-projects` | Selected Projects (shows once projects go live) |
| Advise | `advise` | `soon-projects`, `soon-journeys` | The two coming-soon panels |
| Craft (`/craft`) | `craft` | `cover-ritual` | Seven Steeps, already real |
| Craft | `craft` | `cover-discover`, `cover-reference` | Two covers now on stock stand-ins |
| Craft | `craft` | `soon-playlists`, `soon-brew`, `soon-journeys` | Coming-soon panels |
| Porcelain and Tea (`/read/porcelain-and-tea`) | `porcelain-and-tea` | `portrait`, `plate-1..3` | The portrait also feeds the home page's first plate |

**Three places are not slots.** Two need a small code change (branch, test, ship under the usual rules); one fills itself:

1. **Home, third plate** ("Twenty years in tea culture"): reads the static file `public/home/standin-consult.webp`. Either replace that file with the prepared picture (same name, WebP), or turn the plate into an `EditablePhoto` slot like the others so Adrian can change it himself. Prefer the slot.
2. **Home, second plate:** shows the featured tea's main shop photo. It fills itself once that tea has a photo (step 3). Nothing to do.
3. **About (`/about`), hero strip:** an empty frame in `src/AboutPage.tsx`, deliberately left without an `img`. Make it an `EditablePhoto` slot (page `about`, slot `hero`), 16:7 on desktop, 3:2 on a phone.

The stock stand-ins `public/home/standin-piece.webp` and `standin-tea.webp` stop showing on their own as each slot that borrows them gets a real picture. Do not delete the files until no slot falls back to them.

**People, places and sessions** are entered by their owners in their own editors (profile page, store settings, session form). They are not yours to upload unless Adrian hands you a specific person's photos and names the person.

## Step 5: prove each one is live

For every photo you placed, on **teajia.com, not the sandbox**:

1. Load the page at desktop width and at 390 px. The picture is there, not the dark plate or the stand-in.
2. Confirm the image address starts `https://media.teajia.co/` and the file is under about 300 KB in the Network panel.
3. For shop items: open the tea or teaware page and confirm two or three square thumbnails, and that clicking one opens it full size.
4. A stand-in still showing on a page slot most often means the draft was never published: check as a visitor, not as the owner. On a shop item it means the save did not land or the page is cached: reload once, then look again before redoing anything.

Report per batch in one line: how many placed, how many checked live, and any that failed with the reason.

## Where things are, if you need to look

- Upload endpoint: `POST /api/upload-image` in `worker/src/index.ts` (admin with the catalog bundle; 10 MB cap; returns the `media.teajia.co` URL).
- Page slots: `src/pages/read/EditablePhoto.tsx`, held in the page's draft by `src/pages/read/storyEdit.tsx` (`api.storyContent`) and published from `StoryEditorBar.tsx`.
- Product photo slots: `src/admin/components/ProductEditPanel.tsx` (slot keys `main`, `1`, `2`, `bag`).
- How the tea page lays out 1 vs 2 to 3 photos: `.alcove-thumb-btn` and `.alcove-thumb-btn-single` in `src/styles/card-utilities.css`.

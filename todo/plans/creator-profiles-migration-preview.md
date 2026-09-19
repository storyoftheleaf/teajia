# Migration 0021 preview: links learn their platform

Written 2026-09-19 for migration `worker/migrations/0021_links_learn_their_platform.sql`,
part of Lane A of `creator-profiles.md`. This is the seeded-shape preview
CLAUDE.md requires before a migration that moves data ships.

**These are made-up rows, seeded in a scratch `node:sqlite` database against
`worker/schema.sql`, not a read of the live shop.** Nobody on this session can
read the production database. The point of seeding shapes rather than
describing the SQL is that the SQL can look right and still miss a case; this
is proof, not description.

## What it changes, in plain words

Every contributor's "elsewhere" links (their WeChat, Instagram, website)
currently look like a name and a web address: `{"label": "Instagram", "url":
"https://instagram.com/..."}`. This migration rewrites each one into a
platform and a value: `{"platform": "instagram", "value": "..."}`, so the
profile page can show a WeChat icon next to a WeChat link and an Instagram
icon next to an Instagram link, instead of a plain list of names.

**Nobody's profile is public yet.** `is_published` defaults to off and the
page that would let someone write a link publicly has not shipped, so as far
as this session can tell, this migration is rewriting rows that do not exist
in the real shop. It is written and tested anyway, because "nothing to
rewrite" is a claim worth proving rather than assuming.

## The one judgment call worth reading before this ships

The plan text says: "website-shaped urls get platform: website, everything
else falls to other with its current label preserved as value." It does not
say what makes a url "website-shaped." This migration decided it: a url
counts as a website unless it belongs to a known social or messaging
service (Instagram, Facebook, Twitter/X, TikTok, Telegram, WhatsApp, WeChat).
If it does, the link becomes platform "other" and **the original web address
is dropped, kept only as the label text** ("Instagram", "WeChat"), because
the new shape's "other" is meant to show a short label, not a clickable url
nobody was meant to click on a profile card.

**That is a real loss of information on any row it touches**, and it is only
safe because, as far as this session can measure, no row exists yet to lose
anything from. If that changes before this migration runs (say a contributor
wrote a real Instagram link on their profile through the admin editor in the
time between this write-up and the migration actually applying), that link's
web address would not survive this migration, only its label. Worth Adrian's
eyes before this ships, not just Lane A's.

## Before / after, seeded shapes

Five made-up contributors, run through the actual migration file:

| id | display name | before | after |
|---|---|---|---|
| `wei-chen` | Wei Chen | `[]` | `[]` (untouched, nothing to convert) |
| `amara-osei` | Amara Osei | `[{"label":"Instagram","url":"https://instagram.com/amarateas"}]` | `[{"platform":"other","value":"Instagram"}]` |
| `kenji-tanaka` | Kenji Tanaka | `[{"label":"WeChat","url":"https://wechat.com/qr/tanaka_tea_kyoto"},{"label":"Instagram","url":"https://instagram.com/tanakateahouse"},{"label":"Website","url":"https://cloudmountaintea.example.com"}]` | `[{"platform":"other","value":"WeChat"},{"platform":"other","value":"Instagram"},{"platform":"website","value":"https://cloudmountaintea.example.com"}]` |
| `unlabeled-website` | Sample Shop Owner | `[{"label":"","url":"https://sampleshop.example.com"}]` | `[{"platform":"website","value":"https://sampleshop.example.com"}]` |
| `already-typed` | Already Migrated Person | `[{"platform":"instagram","value":"@already_typed"}]` | `[{"platform":"instagram","value":"@already_typed"}]` (untouched, already the new shape) |

Read straight off the seeded run (script kept at
`/tmp/preview_gen.mjs` on this machine for the session, not committed; the
same assertions are pinned permanently in
`worker/tests/creator-profiles-schema.test.ts` under "migration 0021: links
learn their platform" so this table can't drift from what the migration
actually does):

```
--- BEFORE ---
already-typed | [{"platform":"instagram","value":"@already_typed"}]
amara-osei | [{"label":"Instagram","url":"https://instagram.com/amarateas"}]
kenji-tanaka | [{"label":"WeChat","url":"https://wechat.com/qr/tanaka_tea_kyoto"},{"label":"Instagram","url":"https://instagram.com/tanakateahouse"},{"label":"Website","url":"https://cloudmountaintea.example.com"}]
unlabeled-website | [{"label":"","url":"https://sampleshop.example.com"}]
wei-chen | []
--- AFTER ---
already-typed | [{"platform":"instagram","value":"@already_typed"}]
amara-osei | [{"platform":"other","value":"Instagram"}]
kenji-tanaka | [{"platform":"other","value":"WeChat"},{"platform":"other","value":"Instagram"},{"platform":"website","value":"https://cloudmountaintea.example.com"}]
unlabeled-website | [{"platform":"website","value":"https://sampleshop.example.com"}]
wei-chen | []
```

## What it touches and what it leaves alone

- **Touches**: only `contributors.links`, and only rows where at least one
  entry in the array still carries the old `label` key. Nothing else on the
  `contributors` row moves; no other table is read or written.
- **Leaves alone**: a contributor with an empty `[]` links array, and a
  contributor whose links are already written in the new `{platform, value}`
  shape (so running this migration twice, or running it after a link has
  been hand-written in the new shape, changes nothing on the second pass).
  Nothing outside `contributors` is touched: no product, no price, no
  article.

## His check afterward

Open `/admin/contributors` for any contributor who has links set and confirm
the Elsewhere section on their `/people/:slug` page still shows the right
platform for each link (once the profile-page lane wires the new icons in;
until then, the admin editor's raw links field is the visible check). As far
as this session can tell there are zero real rows to check today, which
itself is worth confirming from the live admin list rather than taking this
document's word for it.

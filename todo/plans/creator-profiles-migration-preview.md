# Migration 0021 preview: links learn their platform

Written 2026-09-19, revised 2026-09-19 after a correction: the first version
of this migration dropped the web address on any link that fell to platform
"other", keeping only its old label. That has been fixed. This is the
seeded-shape preview CLAUDE.md requires before a migration that moves data
ships, for `worker/migrations/0021_links_learn_their_platform.sql`, Lane A of
`creator-profiles.md`.

**These are made-up rows, seeded in a scratch `node:sqlite` database against
`worker/schema.sql`, not a read of the live shop.** Nobody on this session can
read the production database. The point of seeding shapes rather than
describing the SQL is that the SQL can look right and still miss a case; this
is proof, not description.

## What it changes, in plain words

Every contributor's "elsewhere" links (their WeChat, Instagram, website)
currently look like a name and a web address: `{"label": "Instagram", "url":
"https://instagram.com/..."}`. This migration rewrites each one into a
platform and a value, `{"platform": "instagram", "value": "..."}`, so the
profile page can show a WeChat icon next to a WeChat link and an Instagram
icon next to an Instagram link instead of a plain list of names.

**No address is ever dropped.** A link the migration cannot confidently name
a platform for becomes platform "other", but its web address stays as the
value, and its old label, if it had one, rides along as an optional `label`
field on the same object ("Instagram" next to the address, not instead of
it). Nothing in this migration throws an address away.

**Nobody's profile is public yet.** `is_published` defaults to off and the
page that would let someone write a link publicly has not shipped, so as far
as this session can tell, this migration is rewriting rows that do not exist
in the real shop. It is written and tested anyway, because "nothing to
rewrite" is a claim worth proving rather than assuming.

## The one judgment call worth reading before this ships

The plan text says: "website-shaped urls get platform: website, everything
else falls to other." It does not define "website-shaped." This migration
decided it: a url counts as a website unless it belongs to a known social or
messaging service (Instagram, Facebook, Twitter/X, TikTok, Telegram,
WhatsApp, WeChat), in which case it becomes platform "other" instead. That
split only changes how a link is LABELLED on the page, never what address it
points at: both branches keep the url as `value`. If Adrian wants a
WeChat-shaped url to read as platform "wechat" rather than "other" with a
label, that is a naming refinement on top of this, not a fix to this
migration.

## Before / after, seeded shapes

Six made-up contributors, run through the actual migration file, twice, to
also prove it is a no-op the second time:

| id | display name | before | after (both runs, identical) |
|---|---|---|---|
| `wei-chen` | Wei Chen | `[]` | `[]` (untouched, nothing to convert) |
| `amara-osei` | Amara Osei | `[{"label":"Instagram","url":"https://instagram.com/amarateas"}]` | `[{"platform":"other","value":"https://instagram.com/amarateas","label":"Instagram"}]` |
| `kenji-tanaka` | Kenji Tanaka | `[{"label":"WeChat","url":"https://wechat.com/qr/tanaka_tea_kyoto"},{"label":"Instagram","url":"https://instagram.com/tanakateahouse"},{"label":"Website","url":"https://cloudmountaintea.example.com"}]` | `[{"platform":"other","value":"https://wechat.com/qr/tanaka_tea_kyoto","label":"WeChat"},{"platform":"other","value":"https://instagram.com/tanakateahouse","label":"Instagram"},{"platform":"website","value":"https://cloudmountaintea.example.com"}]` |
| `unlabeled-website` | Sample Shop Owner | `[{"label":"","url":"https://sampleshop.example.com"}]` | `[{"platform":"website","value":"https://sampleshop.example.com"}]` |
| `unlabeled-social` | Unlabeled Social Person | `[{"label":"","url":"https://instagram.com/nolabel"}]` | `[{"platform":"other","value":"https://instagram.com/nolabel"}]` (no label to carry, and no address lost either) |
| `already-typed` | Already Migrated Person | `[{"platform":"instagram","value":"@already_typed"}]` | `[{"platform":"instagram","value":"@already_typed"}]` (untouched, already the new shape) |

Read straight off the seeded run (script kept at `/tmp/preview_gen_v2.mjs` on
this machine for the session, not committed; the same assertions are pinned
permanently in `worker/tests/creator-profiles-schema.test.ts` under
"migration 0021: links learn their platform," including a run-it-twice test,
so this table can't drift from what the migration actually does):

```
--- BEFORE ---
already-typed | [{"platform":"instagram","value":"@already_typed"}]
amara-osei | [{"label":"Instagram","url":"https://instagram.com/amarateas"}]
kenji-tanaka | [{"label":"WeChat","url":"https://wechat.com/qr/tanaka_tea_kyoto"},{"label":"Instagram","url":"https://instagram.com/tanakateahouse"},{"label":"Website","url":"https://cloudmountaintea.example.com"}]
unlabeled-social | [{"label":"","url":"https://instagram.com/nolabel"}]
unlabeled-website | [{"label":"","url":"https://sampleshop.example.com"}]
wei-chen | []
--- AFTER FIRST RUN ---
already-typed | [{"platform":"instagram","value":"@already_typed"}]
amara-osei | [{"platform":"other","value":"https://instagram.com/amarateas","label":"Instagram"}]
kenji-tanaka | [{"platform":"other","value":"https://wechat.com/qr/tanaka_tea_kyoto","label":"WeChat"},{"platform":"other","value":"https://instagram.com/tanakateahouse","label":"Instagram"},{"platform":"website","value":"https://cloudmountaintea.example.com"}]
unlabeled-social | [{"platform":"other","value":"https://instagram.com/nolabel"}]
unlabeled-website | [{"platform":"website","value":"https://sampleshop.example.com"}]
wei-chen | []
--- AFTER SECOND RUN (must be identical to the first) ---
already-typed | [{"platform":"instagram","value":"@already_typed"}]
amara-osei | [{"platform":"other","value":"https://instagram.com/amarateas","label":"Instagram"}]
kenji-tanaka | [{"platform":"other","value":"https://wechat.com/qr/tanaka_tea_kyoto","label":"WeChat"},{"platform":"other","value":"https://instagram.com/tanakateahouse","label":"Instagram"},{"platform":"website","value":"https://cloudmountaintea.example.com"}]
unlabeled-social | [{"platform":"other","value":"https://instagram.com/nolabel"}]
unlabeled-website | [{"platform":"website","value":"https://sampleshop.example.com"}]
wei-chen | []
```

## What it touches and what it leaves alone

- **Touches**: only `contributors.links`, and only rows where at least one
  entry in the array still carries the old `url` key (the reliable signal of
  the old shape; a migrated row never has one, even after it has gained a
  `label` field). Nothing else on the `contributors` row moves; no other
  table is read or written.
- **Leaves alone**: a contributor with an empty `[]` links array, and a
  contributor whose links are already written in the new shape, label and
  all, so running this migration twice, or after a link has been hand-written
  in the new shape, changes nothing on the second pass, proven above. Nothing
  outside `contributors` is touched: no product, no price, no article.

## His check afterward

Open `/admin/contributors` for any contributor who has links set and confirm
every link's underlying web address still resolves to the same place it did
before (the admin editor's raw links field is the visible check until the
profile-page lane wires the new platform icons in). As far as this session
can tell there are zero real rows to check today, which itself is worth
confirming from the live admin list rather than taking this document's word
for it.

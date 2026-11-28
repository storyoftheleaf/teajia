# Teajia Homepage: Search Text, Link Preview and Homepage Shifts

Last updated: 2026-11-28
Status: live 2026-11-28 (PR below). Locked for 6 weeks, then review in Google Search Console (2026-01-09). The words live in `src/lib/siteMeta.ts`; `src/lib/siteMeta.test.ts` holds `index.html` to them.

## What Teajia is (Adrian's framing)
- A living home for tea culture: preserving the art of tea and carrying it into the future.
- Magazine / Tea Insight: lasting articles, teachings, conversations and wisdom. Not news.
- Selling and sourcing: fine teas, aged or new to you, and teaware.
- Platform tools: keep your tea chest, journal your tastings, host and join sits, share what you learn.
- Tea spaces: design a client's tea house, or inspire people to create their own.

## Final meta (Pythagorean 6 / Chaldean 4)
Numerology target: inner 4 matches TeaJia's Chaldean 4 (friendly with Birth 6). Outer 6 is the community, hosting and belonging face. Only letters count, so paste exactly.

Title (51 characters):
`Teajia · Tea Culture, Rare Tea and Tea House Design`

Description (149 characters):
`Tea is a living art. Learn from lasting teachings, shop and source fine teas old and new, keep your tea chest and journal, and create your tea space.`

Use the same title for: `<title>`, `og:title`, `twitter:title`
Use the same description for: `meta description`, `og:description`, `twitter:description`

### How the description maps to the four doors
| Phrase | Door | Covers |
|---|---|---|
| Tea is a living art | identity | culture, past into future |
| Learn from lasting teachings | Discover | magazine, teachings, conversations, wisdom |
| Shop and source fine teas old and new | Source | selling, sourcing, aged or new to you |
| Keep your tea chest and journal | Deepen | storing teas, tastings, host tools |
| Create your tea space | Create | hire Teajia, or be inspired to make your own |

## Homepage shifts

Done 2026-11-28 except 8 (the tagline word, waiting on Adrian). Item 10: for a crawler, the edge writes Home's headline, description and doors in place of the loading line (`homeShellBody` in `functions/_middleware.ts`); the app replaces it as it starts. Item 9: the Edit control is the owner's story editor and renders only for the owner (`StoryEditorBar`, `isOwner`).
1. Keep the H1 ("Tea deepens with what you bring to the table and what you leave behind."). Add the description, word for word, as a subline under it.
2. Door order: Discover, Source, Deepen, Create (follows the sentence).
3. Door texts:
   - Discover: `teachings, conversations and tea wisdom`
   - Source: `fine tea and teaware, old and new, found by hand`
   - Deepen: `journal your tastings, sit at a table, share what you found`
   - Create: `your tea space, designed with us or inspired to make your own`
4. Section labels above the H2s: `From the magazine`, `On the shelf`, `Tea house design` (replaces "The consult").
5. Tea house design section: two links side by side, `Work with us` and `Ideas for your own space`.
6. Host a table: add `Keep your tasting journal and tea chest here too.`
7. Section order below the doors: magazine, shelf, tea house design, tables.
8. Tagline: decide "Build for the future" or "Create for the future" and use it everywhere (site currently says Build).
9. Check the footer "EDIT" link only shows when signed in.
10. Pre-render the homepage. Simple crawlers currently see only "Loading Teajia…".

## Live state as of 2026-11-28 (before changes)
- Title: "Teajia · A Home for Tea"
- Description: "Source, study and share tea with those who gather around the leaf. Ancient teas, teaware, tea spaces and the stories behind them."
- og:image: https://teajia.com/og-image.png, twitter card summary_large_image
- Doors: Discover (stories, craft and tea wisdom), Deepen, Create, Source

## Process
1. Paste meta exactly.
2. Make the page match.
3. Pre-render.
4. Leave it for six weeks.
5. Review Search Console: queries and click rate. Change one phrase at a time.

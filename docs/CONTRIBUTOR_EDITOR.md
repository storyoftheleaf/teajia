# The contributor editor

`/admin/contributors`, Create contributor and Edit. Written 2026-09-28, before the
rebuild, at Adrian's request: "It needs to have image uploads. It needs to look much
better. We need a whole new style." This is the one written place for the screen's
style rules. When a line on the screen is corrected, the rule here changes in the
same commit.

## The idea: the card and the rest

Chosen 2026-09-28 from four directions (mockups: https://claude.ai/artifact/JsN5LuYQ7nzhuD7davHNNe).
Adrian: "to add or edit contributors is quite a huge process ... a bit overwhelming".
The old screen opened eight sections and about thirty fields at once. Now:

- **The card** holds only what the cover needs: the portrait with its focal point
  and crops, name, page address (new people only), role, place, name in their own
  script, and the line under the name as it will read. A new person saves from a
  name alone.
- **The rows** are every other part of the page, one line each: In my words, Hands on,
  Reach me, Where they belong, Behind the page. Each says what is in it ("4 of 8",
  "WeChat", "Needed to publish") and opens on its own in a sheet: from the right on a
  wide screen, from the bottom on a phone. On a wide screen the rows sit under the
  fields, beside the photo, so the whole card and its rows fit one laptop screen.
- **Sheets stay mounted while closed**, so an upload in flight or a pasted photo keeps
  landing. They sit between the header and the footer, so Save is always in reach.
  Escape closes the sheet first, then the editor. Focus goes to the sheet's X and
  back to the row.
- **Behind the page** holds what no reader sees: the fixed address, pronouns, private
  contact, their sign-in, unpublish and delete. The ten stored fields that neither
  the page nor the directory reads (business name, active since, portrait caption,
  the Now stamp and its date, pouring today, where to find, the voice clip) sit
  under a fold that says so. If one of them starts rendering, move it out of the
  fold in the same commit.
- Publishing without Where it began opens In my words, rather than naming the field
  and leaving you to find it.
- Labels use the page's own words: Now, Where it began, Who taught them, Closing line,
  Place, Own script, Their sign-in.

## What this screen will NOT use

1. No white, anywhere. Not on text, borders, rings, focal dots or scrims.
2. No gold. The accent is aged bronze (`tea-gold`), and it appears at full strength
   once per view: the Save button. Everything else bronze is a hairline at low alpha.
3. No boxed inputs. Fields are a hairline underline, the way the Read pages set type.
4. No visible borders on pills or tags. There are no pills or tags.
5. No pill buttons, no rounded-full anything except the avatar mask, which is round
   because the avatar is round.
6. No cream card with a drop shadow. Sections are separated by space and a hairline.
7. No drop caps. No em dashes in any copy.
8. No icons standing in for words. Every action is a word. The one glyph kept is the
   close X, which the app-wide close rule requires.
9. No uppercase sentences. Micro caps only for labels of three words or fewer.
10. No typed image URLs as the way in. A URL can still be pasted, but only behind
    "Use a web address instead", never as the default.

## The vocabulary it does use

- Display serif (Cormorant) for the name, section titles and actions.
- Lora for everything the person says.
- Plus Jakarta micro caps (`text-ui-10`, tracked) for field labels, three words at most.
- Actions are Cormorant words in the reading bronze with a hairline under them,
  the same as the `/people` sheets (`GOLD_TEXT_*` in `components/people/immersive`).
- Upload progress is a 2px bronze line along the bottom of the frame and a number.
- Focal point: a small ring in the text colour on a dark halo, dragged or tapped.
- Phone: one column, 44px targets, Cancel on the left and Save on the right in a
  footer that clears the bottom nav (`pb-nav-gap`).

# The contributor editor

`/admin/contributors`, Create contributor and Edit. Written 2026-09-28, before the
rebuild, at Adrian's request: "It needs to have image uploads. It needs to look much
better. We need a whole new style." This is the one written place for the screen's
style rules. When a line on the screen is corrected, the rule here changes in the
same commit.

## The idea

The editor is a proof of the public page at `/people/:slug`, not a form about it.
You set the page in the type it will be read in, and the page is always beside
you (desktop) or at the top of the sheet (phone), updating as you type.

- The name is typed in the display serif at cover size. The prose is typed in Lora
  at reading size. What you see while typing is what the reader sees.
- Sections carry the public page's own words where the page has them (In my words,
  Hands on, Reach me), so the editor and the page map onto each other.
- Photos are placed, not linked: drop, paste, pick or take one, watch it arrive,
  then tap where the face is. The crop shown is the crop the page will make.

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

# The contributor editor

`/admin/contributors` (Create contributor, Edit) and `/account/profile` (a tea master's own page). Written 2026-09-28, before the
rebuild, at Adrian's request: "It needs to have image uploads. It needs to look much
better. We need a whole new style." This is the one written place for the screen's
style rules. When a line on the screen is corrected, the rule here changes in the
same commit.

## The idea: the card and the rest, filled in by the person

Chosen 2026-09-28 from four directions (mockups: https://claude.ai/artifact/JsN5LuYQ7nzhuD7davHNNe).
Adrian: "to add or edit contributors is quite a huge process ... a bit overwhelming".
Then, looking at the first build, 2026-09-29: "Consider this as something that the
contributor themself is doing, not me ... reduce this down majorly ... This is for
people, not computers."

- **One editor, two doors.** The card and rows live in
  `src/admin/components/contributorEditor/PersonPage.tsx` and are used by the shop's
  editor (`/admin/contributors`) and by the tea master's own screen
  (`/account/profile`, `ProfileEditor.tsx`). Same questions, same words, both places.
- **Written to the person, in the second person.** Your name, Name in Chinese, What you
  do, Where you are. Your story asks three questions: How did tea begin for you? What
  are you working on now? A last line for your page. Photos of your work. How people
  reach you. Never a field name (no "own script", "current practice", "beginnings",
  "inspirations", "display name").
- **Only what the page shows is asked.** Pronouns, business name, active since,
  languages, portrait caption, the current stamp and its date, pouring today, where
  to find, the voice clip, who taught them and the separate small round photo are
  not on screen at all. Their stored values are sent back untouched on every save,
  so nothing written earlier is lost. If the page ever starts showing one of them,
  it comes back as a plain question in the same commit.
- **The small round photo follows the portrait**, unless someone once gave it its own.
- **Rows the shop alone sees** come after the three everyone sees: Shops (where they
  belong) and Page settings (address, their sign-in, private contact, unpublish,
  delete). A contributor never sees them.
- **A contributor places photos; the shop may also link one.** "Use a web address" is
  hidden on the contributor's screen. Their photos go through their own upload route
  (`PhotoUploadContext`), since the staff upload needs shop rights.
- **Sheets stay mounted while closed**, so an upload in flight keeps landing. In the
  shop's panel they sit between header and footer so Save stays in reach; on the
  contributor's page they cover the screen and end with Done. Escape closes the sheet
  first. Focus goes to the sheet's X and back to the row.
- Saving without how tea began opens Your story rather than naming a field.
- A contributor's own save may now change what they do and where their face is in the
  portrait (`role`, `portrait_focus` in `PROFILE_SELF_FIELDS`); on a live page those
  still go to the shop to approve first, like every other change.

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

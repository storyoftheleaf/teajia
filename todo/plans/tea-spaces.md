# Tea spaces

> Reference for the distinction between a tea house, space, session and host. The [current delivery plan](../../docs/CONSOLIDATED_DIRECTION.md) determines which work proceeds.

Adrian, 2026-11-27, in the planning thread:

> "Technically a tea space is a tea house. A tea space is a place inside of a tea house. A tea house could have multiple tea spaces inside of it. Let's focus on the spaces, not the houses. Because anyone can own a space."

> "In my house I have two spaces, they're different rooms designed differently."

He then chose "Yes, right after the switch-on" on the card "Focus on spaces: change the bar word 'tea house' to 'tea spaces'?", and said of the whole run of work, "Do all these to the best of your ability and ship." So the bar word change below has his explicit yes, and this ships when green.

The same morning he also settled: the line under a name on the people list is "Serves at tables", not "Pours at tables", and it may be tapped; he is the first host and one is enough; missing words and photographs get placeholders and never hold a build.

## The model

- A **tea space** is the unit: one room or one table where tea is served, with its own name, look and photographs.
- A **tea house** holds one or more tea spaces. A home counts. His own house holds two.
- **Anyone can own a space.** A host adds their own in their own account. No approval is needed to have one. Approval still decides reach, as before.
- A session is held in one space.

## What is already in the code

Read on `main` at 80248ba9. Confirm each before building on it.

- `venues` and `venue_spaces` (`worker/migrations/0000_initial_schema.sql`) already are this model. A venue has a name, address, `area_hint`, arrival notes and photographs. A venue space belongs to a venue and has a name, capacity, a description shown to guests, photographs and tea styles. The comments in the schema even use his flat and its named tables as the example. `events.venue_id` points a session at a venue.
- Routes to list, add, change and remove spaces exist in `worker/src/index.ts` (search `venue_spaces`), and `worker/src/mcpTools/shopRecords.ts` reads them for agents.
- `/spaces` is a live public page (`SpacesPage` in `src/App.tsx`). `/tea-houses` is the Launch 4 page, with his portfolio in `tea_house_pages` and `tea_house_contributions` (migration 0138), where a house is an account.
- The bar words live in `src/components/navSections.ts`: `BAR_WORDS.houses` is `'Tea house'`, and `housesDoor()` picks where it leads.
- A host's own place is `src/components/host/YourTablePlace.tsx`, headed "Your table", behind `YOUR_TABLE_PLACE_OPEN` (`src/lib/yourTablePlace.ts`). It lets a host name **one** saved place as their table, shown by area only.
- "Pours at tables" is `PoursLine` in `src/pages/ContributorsIndexPage.tsx`, fed by `pours` from `worker/src/peopleList.ts`.

So no new tables are needed for the model. The work is words, one page, lifting the "one place" limit, and joining the two ideas of a house (a venue in someone's account, and a house that is an account).

## What to build, in order

Each step can ship alone.

### 1. Words (small, first)

- `BAR_WORDS.houses` becomes `'Tea spaces'`, on the bar and the desktop rail together. Nothing else about the bar changes: same four places, same order, same shape. Run `npm run test:mobile` before and after. "Tea spaces" measures the same as "tea house" in the bar, so the small-phone step-down stays as it is.
- "Pours at tables" becomes "Serves at tables". Only this line. "Pouring" and "Poured with" on sessions were not asked about, so they stay.
- `YourTablePlace` is headed "Your tea space", and its sentences say "tea space" where they say "your table". The public line from `yourTableLine()` becomes "{Name}'s tea space, {area}".
- Update `CLAUDE.md`, `docs/PILLAR.md` and `docs/SECTIONS.md` in the same commit, as the pillar rule asks.

### 2. A host can have more than one space

- Lift the single choice in `YourTablePlace`: a host sees a short list of their spaces, each with its name, its area and one photograph, and an "Add a tea space" button. Adding asks for a name and an area, nothing more. Photographs go through the one photo editor (`usePhotoEditor()`, `freeShape`).
- When a host makes a table, they pick which of their spaces it is in. With one space it is chosen for them. With none, the table can still be made, as today.
- Privacy is unchanged and must be tested again: a private space shows its own name and area only. Never the address, the map link, the way in, or the name of the house it is in, until the host has said yes to that guest.

### 3. The tea spaces page

- The bar word leads to one page of spaces. Each card is a space: its photograph, its name, the area, and who serves there. Spaces that share a house sit together under the house's name, when the house is public.
- Only spaces whose owner chose to show them appear. A host's home space is off this page unless they turn it on, and even then it shows by area only.
- `/tea-houses` keeps working and lands on the same page, so no old link breaks. A public house keeps its own page, which now lists the spaces inside it. His portfolio (what he contributed to a house) stays on the house's page as built.
- His own house is the first entry: one house, two spaces. Use placeholder names, words and photographs that say plainly they are placeholders, in Manage and on the page, for him to replace.

### 4. "Serves at tables" opens somewhere

- The line becomes a tap. It opens that person's page at a short list: their own spaces first, then other spaces they have served in. Names only. No count, no dates, nothing that grows with how often.
- A private space in that list shows as its area only.

### 5. The same for agents, and the checks

- Every action added here gets its agent tool in `worker/src/mcpTools/` (list my spaces, add a space, set a table's space), with preview and confirm on writes.
- Browser checks: the bar on a 320 wide phone, the privacy cases in step 2, back and forward through the spaces page and a space (`useStepParam`, never `useState` alone).

## What not to do

- No migration that changes existing rows without the before and after page shown to him first. Steps 1 to 4 should need none. If joining the two ideas of a house needs one, stop at that point and show him.
- Nothing ranks spaces. Order is by hand or by name.
- Do not rename routes or ids for the sake of the word. Visible words change; `/spaces`, `/tea-houses`, `venue_spaces` and the `houses` bar id stay.

## Open, and not blocking

- Whether a space can be shared by two hosts (a couple, a studio). Today a space belongs to one account. Leave it.
- Whether a host's home space may ever show more than its area. Today no. Leave it.

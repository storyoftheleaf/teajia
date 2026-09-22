# The tea master's editing surface, in the profile's own language

Parked 2026-09-21. Drawn, not built. Adrian's call that day: "I like more
simply forms, this is too styled, are you rebuilding the wheel". The plain
forms at `/account/profile` stayed, and gained only what they lacked (Who
taught me, The last line, What I call it). This plan is the restyle, for when
he wants it.

## The boards

Design canvas: https://claude.ai/artifact/J1FyxzXFVQiYpteog1xCRQ. The map
board is built; the three doors are built. These seven are not:

1. **My page** (`Edit-Home`): the portrait as a small cover, then the page's
   own sections as rows, each dek saying what is there or what is missing.
   "See my page", "Copy my link", "Take my page down".
2. **In my words** (`Edit-Words`): the line under my name, a line I stand
   by, Now, Where it began, Who taught me, The last line. Hairline fields,
   no boxes, italic placeholder saying what would go there.
3. **Hands on** (`Edit-Photos`): the portrait cover with "Change my
   portrait", then the photos as rows (thumbnail, caption, Up Down Remove),
   "Add a photo", eight at most.
4. **The teas** (`Edit-Teas`): the collection cover with "What I call it"
   and "Choose the cover photo", then Find a tea and the chosen rows with
   "Why I chose it".
5. **From what I do** (`Edit-Written`): Words, Hosting, My table as read-only
   rows, each saying where it comes from.
6. **Pay** (`Edit-Pay`): My methods, Asking (Approve on the right, Decline
   below), Can see them, My open link. "Nothing on this page is ever public."
7. **Reach me** (`Edit-Reach`): WeChat with the QR, Instagram, my site,
   "Add a place".

## What the build would reuse

Everything the boards draw already has a working form and a working API:
`ProfileEditor`, `ProfileFavoritesEditor`, `PaymentMethodsEditor`,
`PayAccessPanel`, `ProfileShareLinks` under `src/components/profile/`, all
wired in `src/pages/AccountProfilePage.tsx`. The immersive vocabulary is
`src/components/people/immersive.tsx` (GroupHead, IndexRow, Cover, Kicker,
Dek, the gold text actions). A build is a re-skin of those components, not
new data and not new routes. Two pieces the boards assume that do not exist:
a self-written quote line (today the quote comes from a published article's
pull quote) and choosing the collection's cover photo from one's own page
(today it is the first gallery photo, else the portrait).

## When to pick it up

When Adrian asks for the tea master's page to feel like their public page,
or when a second tea master is invited and the plain forms read as admin
rather than as theirs. Not before.

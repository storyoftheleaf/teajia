# The buyer's journey: from first teas to ordering again

Written 2026-11-27 from the code as it stands. Nothing here is built. Names are proposals; they are Adrian's to choose.

## Today, step by step

**1. The link arrives.** Two doors.
- A collection link, `/c/:slug` (`PublicCollectionPage.tsx`, table `saved_collections`). It shows the shop filtered for that person. Add goes to the shop cart at the quoted price (`worker/src/collectionCart.ts`).
- An invoice link, `/people/:slug/pay?t=…` (`ProfilePaymentPage.tsx`, `PayInvoiceTeas.tsx`). It lists the invoice's teas the way the shop draws them, then the payment details.

**2. They buy or pay.** From a collection, the cart (`PublicCart.tsx`) sends the order and a Draft invoice is made; the buyer follows it at `/order/:ref` (`OrderStatusPage.tsx`). From an invoice link, they pay by the details shown.

**3. They make an account.** The collection page offers "Keep it in a free account". The invoice page offers "Save to my account" (`PayInvoiceKeep.tsx`). Both send them to sign up and bring them back to the same link.

**4. Their teas.** Signed in, a person has five separate places under Your Table:
- orders, `/account/orders` (invoices linked to them, plus samples)
- remember, `/account/collection` (hearted teas, `user_favorites`)
- collections sent to them, `/account/collections`
- Tea Chest, `/account/cellar` (tea they own, in grams)
- journal, `/account/journal` (tastings, `customer_tasting_journal`)

**5. Tasting and photos.** One tasting screen (`TastingSession.tsx`) opens from a shop tea's page, from remember and from the journal. Photos are stored by tea (`/api/family/teas/:productId/mine`), six per tea.

**6. What they like.** Each tasting sits in the journal. The tasting holds a verdict and a "would buy" answer, but the buyer has no view that gathers them.

**7. Ordering again.** Does not exist for a buyer. The journal links a tea back to its shop page, and that is all.

## What breaks the flow

1. **An invoice link never becomes theirs.** Opening the link while signed in only records that they may see the payment details (`payment_access_grants`). It does not link the invoice to their account (`customers.user_id`). So an invoice Adrian sends does not appear in their orders. A website order can be claimed (`/api/inquiries/:ref/claim`); an invoice link cannot.
2. **"Save to my account" saves hearts, not the purchase.** It adds the teas to `favoriteTeas`. What they bought, how much and when is not saved.
3. **The save is lost across sign-up.** After signing up they land back on the invoice and must press Save a second time.
4. **Private teas vanish.** Remember only shows teas in the public shop (`MyCollection.tsx` looks them up in the shop's inventory). A private tea on an invoice can be hearted and then never seen again.
5. **Photos are refused for private teas.** The photo door answers only for public shop teas (`worker/src/familyRoutes.ts`), so a friend who bought a private tea gets no camera.
6. **Their photos show in one place.** Only inside the tasting screen. Not on the invoice, the order, or the tea in their list.
7. **Bought teas are not tastable from the order.** `OrderDetailPage.tsx` lists names and prices. A line does not open the tea and does not offer a tasting. "Add to my Tea Chest" copies the name and loses the link to the shop tea (`worker/src/chestKeep.ts`).
8. **Five homes, no single list.** Bought, saved, sent, owned and tasted never meet on one tea.
9. **No way back to buying.** Nothing says "the same again".

## One flow

**One list, by tea.** A single page under Your Table where each tea appears once and carries what the person has with it: bought (amount, date, from whom), saved, sent to me (by whom), tasted (their note), and their photos. It is a view over the records that exist. No new store, no merged records, and nothing ranked or counted.

**How a person steps through it.**

1. Open the link. See the teas. Buy or pay.
2. One button, Save to my account. Signed out, it goes to sign-up and finishes the save by itself on return. The invoice, with its teas, is now theirs.
3. They land on their list. The teas from that invoice are there, marked as bought, private ones included.
4. Tap a tea. The shop's own tea card opens with its Wisdom entry and two actions: add a photo (one tap) and taste. Nothing prompts them; the doors are just there when they come.
5. Their photo and note show on that tea everywhere they see it: the list, the order, the invoice page.
6. A quiet filter on the list shows the teas they said they would have again.
7. On any bought tea, and on an order as a whole: order again. It fills the shop cart and goes through the normal checkout, so it stays a personal conversation.

Collections sent to them, and collections they send (`SendAsCollection.tsx`), start from this same list. The Tea Chest stays what it is: grams on hand.

## Builds in order

1. **An invoice link can be claimed.** Save to my account links the invoice to the signed-in person, first claim wins, the same rule the order page already uses. Touches `worker/src/index.ts` (beside `handleGetPayAccess` and `handleClaimInquiry`, as a new module), `src/lib/api.ts`, `PayInvoiceKeep.tsx`.
2. **The save survives sign-up.** The return address carries a marker and the save completes once on arrival, as the pay page already does for "ask". Touches `PayInvoiceKeep.tsx`, `ProfilePaymentPage.tsx`; the same wording on `OrderStatusPage.tsx` and `PublicCollectionPage.tsx` so all three doors read alike.
3. **One read of "my teas".** A worker read that returns each tea once with bought, saved, sent and tasted, including private teas the person bought or was sent. New `worker/src/myTeas.ts`, reusing `publicLinkTea.ts`; route in `worker/src/index.ts`.
4. **The list page.** Drawn with the shop's own rows and tea card (`TeaLedger`, `AlcoveModal`), as the invoice page does. Touches `src/pages/CollectionPage.tsx`, `src/components/AccountPanel/MyCollection.tsx`. Order lines in `OrderDetailPage.tsx` open the same card.
5. **Photo and tasting on a tea you bought.** The photo door also answers for a tea on the person's own invoice or a collection sent to them. The tea card in the list gets Add a photo (through the one photo editor) and Taste. Touches `worker/src/familyRoutes.ts`, `src/components/shop/linkTea.tsx`, the list page. Keeping a bought line in the Tea Chest keeps its link to the shop tea (`worker/src/chestKeep.ts`).
6. **Their photos and note on the tea.** Shown on the list row, the tea card, the order and the invoice page when signed in. Touches `PayInvoiceTeas.tsx`, `OrderDetailPage.tsx`, the list page.
7. **"Would have again" for buyers.** Show the existing answer on a buyer's tasting and add the filter to the list. Touches `TastingSession.tsx`, the list page. No scores, no suggestions.
8. **Order again.** On a tea and on an order: fill the cart with the same teas and amounts and open the normal checkout. A private tea is priced by the worker, never the browser. Touches `worker/src/collectionCart.ts`, `OrderDetailPage.tsx`, the list page, `src/lib/store.ts`.
9. **Docs in the same commits.** Rows 8 to 10 of `docs/agents/TEA-SYSTEM-MAP.md`, `docs/PILLAR.md`, and `todo/plans/your-table.md`.

Builds 1 and 2 fix what Adrian asked for today. Builds 3 to 6 make the home. Builds 7 and 8 close the loop.

## Questions for Adrian

**1. Where does the one list live, and what is it called?**
- a. The "remember" tile grows into it and keeps its word for now. Recommended: no new tile, no nav change.
- b. A new tile, with a name you choose ("my teas" is a working name only).
- c. Orders grows into it.

**2. The Your Table plan says journal, favourites, Tea Chest and journey stay separate. Is one list by tea allowed?**
- a. Yes, as a view only; the records stay separate underneath. Recommended.
- b. No; keep five places and add links between them.
- c. Merge them into one record.

**3. Who may claim an invoice from its link?**
- a. The first signed-in person who presses Save; you can undo it in Manage. Recommended for a closed beta among friends.
- b. Only a person whose email matches the customer on the invoice.
- c. You approve each one.

**4. A private tea someone bought: may they keep it in their list, photograph it and taste it?**
- a. Yes, seen only by them. Recommended.
- b. Yes, but no photos.
- c. No.

**5. Order again: at what price?**
- a. Today's shop price, shown before they send. Recommended.
- b. The price they paid last time.
- c. No price; it arrives as a request and you quote it.

**6. The words for the mark that says they liked it.**
- a. "Would have again". Recommended.
- b. "Would buy again".
- c. A heart only, which is today's save.

**7. May a tea master's invoice or collection be claimed and reordered the same way as yours?**
- a. Yes, one flow for every sender, the order going to whoever sent it. Recommended.
- b. Your shop first, tea masters later.

# The shared parts: look here before building anything

Teajia is one connected system. Every screen is built from the same shared
parts, so when Adrian tunes one of them (the photo editor, the shop's tea
page, the cart) the change lands everywhere at once. This file is the list of
those parts and where each one lives. (Adrian, 2026-11-27: "I would rather
have it be one module that everything links to and as I update that module it
updates site-wide.")

## The rule

1. **Before building a screen, part or feature, find it here first**, then
   search the code (`rg -l "<what it does>" src`) for anything that already
   does the job.
2. **Use the shared part.** If it is close but not quite right, extend the
   shared part (a new prop, a slot, an option) so every page gets the change.
   Never copy it into your feature and edit the copy.
3. **Show the original with an add-on on top**, never a rebuild of its
   content. A page that needs to show a tea opens the shop's own tea card and
   adds its one extra thing through a slot (see "A tea, as the shop shows
   it" below).
4. **A new shared part goes in this file** in the same commit that makes it.
5. **Something unused leaves.** A shared part nothing imports is deleted, so
   this list and the code agree.

The `review-pr` skill checks every pull request against this file (step 2b).
`src/admin/guards/onePhotoEditor.test.ts` fails a build that adds a second
cropper or a photo picker that skips the editor.

## Photos

| Need | Use | Lives in |
|---|---|---|
| Anyone adds a photo: crop, drag, zoom, straighten | `usePhotoEditor()`: `editPhoto(file)` / `editPhotos(files)` and render `{photoEditor}` | `src/components/shared/usePhotoEditor.tsx` |
| The editor itself (only reach for it when the hook can't do it, such as reframing a photo already saved) | `SquareCropModal` | `src/components/shared/SquareCropModal.tsx` |
| Open on the face | automatic for fixed shapes; the `centreFace` option | `src/components/shared/usePhotoEditor.tsx`, finder in `src/lib/faceFrame.ts` |
| A photo shown at its own shape (events, posts, teaware, shop photos) | `editPhoto(file, { freeShape: true })` | same hook |
| A person's photograph: thumbnail, zoom, shape choice, Crop | `PhotographThumb`, `PhotographZoom`, `PhotographShapeChoice`, `PhotographCrop` | `src/components/shared/Photographs.tsx` |
| Crop maths, framed output size | `cropToSquareBlob`, `framedOutputSize` | `src/lib/cropImage.ts` |
| Any stored image URL | `mediaUrl(url)` | `src/lib/mediaUrl.ts` |
| Shrinking before upload | `compressImage` | `src/lib/imageCompressor.ts` |

Photos the shop's analysis reads whole (package scans, imports, receipts,
evidence) skip the editor; the guard above lists each one with its reason.

## What a pasted link shows

| Need | Use | Lives in |
|---|---|---|
| The site's title, line, preview picture and Instagram address | `SITE_TITLE`, `SITE_DESCRIPTION`, `SITE_PREVIEW_IMAGE_PATH`, `INSTAGRAM_URL` (index.html carries the same words; a test holds them together) | `src/lib/siteMeta.ts` |
| A page's own preview for chat apps and search (Read, articles, products, collections, sessions, invoices, sits, /mcp) | one more branch in the edge function, and its path in `public/_routes.json` | `functions/_middleware.ts` |
| A preview picture | one more entry in `CARDS`, then `npm run share:site` | `scripts/share-site-cards.mjs` |

## A tea, as the shop shows it

| Need | Use | Lives in |
|---|---|---|
| A tea's full page or card: photo, facts, writing, tasting, amount, Add | `AlcoveCard` (and `ProductDetailContent`) | `src/components/shop/AlcoveCard.tsx`, parts in `src/components/shop/alcove/` |
| The same card over the current page | `AlcoveModal` | `src/components/shop/AlcoveModal.tsx` |
| **The shop's own tea page with an add-on on top** (the pattern for any other page that shows a tea) | `LinkTeaPage` with `top`, `footer`, `yoursLine`; it renders `ProductPage` itself | `src/components/shop/LinkTeaPage.tsx`, used by `PublicCollectionPage` and `PayInvoiceTeas` |
| The shop's card with a page's own footer instead of the shop's Add | `AlcoveCard` / `AlcoveModal` with `linkFooter` | `src/components/shop/AlcoveCard.tsx` |
| A tea on a private link (collection, invoice): photo, meta line, Wisdom writing | `useLinkTeaWriting`, `LinkTeaPhoto`, `LinkTeaEntry`, `linkTeaInventoryItem`, `useOpenLinkTea` | `src/components/shop/linkTea.tsx`, `useOpenLinkTea.ts` |
| A Curate or Stock record shown as the shop's card | `productToInventoryItem` then `AlcoveCard` | `src/admin/utils.ts`, `src/admin/components/TeaDetailsModal.tsx` |
| The facts box | `TeaFactsBox` | `src/components/shop/TeaFactsBox.tsx` |
| The type illustration when a tea has no photo | `TeaPlaceholder` | `src/components/shop/TeaPlaceholder.tsx` |
| Teaware's card | `TeawareAlcoveCard`, `TeawareGlyph` | `src/components/shop/` |
| A tea's writing (types, places, producers) | the Wisdom Base, never text written on the page | `docs/TEA_WISDOM_BASE.md` |
| A tea on a list or order | `TeaCard`, `TeaCardTitle`, `TeaCardMetric`, `TeaCardControlRow` | `src/components/tea/TeaCard.tsx` |
| Tea identity at the top of a detail panel | `TeaPanelSummary` | `src/components/tea/TeaPanelSummary.tsx` |

A page that needs a tea's description opens the shop's own page through
`LinkTeaPage` (or the card through `AlcoveModal`) and adds only its extra
through `top` or `footer`. If the slot it needs does not exist, add the slot
there, so the shop page keeps being the one place the tea is drawn.

## Prices, amounts, the cart

| Need | Use | Lives in |
|---|---|---|
| A price in the viewer's currency | `useShopPrice()` | `src/components/shop/shopPrice.ts` |
| Currency names and aliases (CNY is `Yuan`, TWD is `NT`) | `canonicalCurrency`, `knownCurrency`, `rateToUsd` | `src/lib/currency.ts` |
| Freight, markup, cost guard (server) | `shippingRate.ts`, `markup.ts`, `costCurrency.ts` | `worker/src/`; read `docs/claude/money.md` |
| An admin number field | `enteredNumber()`, `enteredCostCell()` | `src/admin/productUpdatePayload.ts` |
| Choosing grams or packs and adding to the cart | `TeaQuantityPicker`, `TeaWeighControl` | `src/components/shop/` |
| The cart's contents and actions | the cart in the store | `src/lib/store.ts` |
| An invoice's pay link to hand to someone (short, `teajia.com/i/<number>-<12 of the token>`) | `short_url` on the invoice's `payment`; built by `invoiceShortPath()` | `shared/invoiceShortLink.ts` |
| The cart panel (shop, owner order, buying basket, in process) | `CartPanel` with `mode` | `src/components/shared/CartPanel.tsx` (`PublicCart`, `AdminCart`, `BuyingBasket`, `InProcess` sit behind it) |
| One cart line | `CartItemRow` | `src/components/shared/CartItem.tsx` |
| The cart pill and the "added" moment | `CartIndicator`, `CartToast`, `CartFlyAnimation` | `src/components/shared/` |
| Send saved teas as a collection | `SendAsCollection` | `src/components/shop/SendAsCollection.tsx` |
| Collection cart prices (server) | `collectionCart.ts` | `worker/src/collectionCart.ts` |

There is one cart. A collection's or invoice's Add goes into it.

## Tasting

| Need | Use | Lives in |
|---|---|---|
| A tasting, or a longer continuation | `TastingSession` | `src/components/tasting/TastingSession.tsx` |
| The impression fields | `YourImpression` | `src/components/tasting/YourImpression.tsx` |
| The tasting a tea shows (owner, community, source) | `useProductTasting` | `src/hooks/useProductTasting.ts` |
| Tasting photographs | `TastingPhotographRow` | `src/components/tasting/TastingPhotographRow.tsx` |

The interactive reference for cards, panels and tasting is `/preview/tea-ui/`
(`npm run dev:test`), described in
[DESIGN_SYSTEM.md](DESIGN_SYSTEM.md#tea-cards-detail-panels-and-tasting).

## Sign in, sign up, and coming back

| Need | Use | Lives in |
|---|---|---|
| A link to sign in or sign up that brings the person back | `authPagePath('signin' \| 'signup', returnTo)` | `src/lib/authNavigation.ts` |
| Coming back to the tasting after joining | `tastingReturnPath` | same file |
| Continue with Google | `${API_URL}/api/auth/google?return=<path>` | `SignInPage.tsx`, `SignUpPage.tsx` |
| Who is signed in | `useAuth()` | `src/hooks/useAuth.ts` |
| The teas an invoice sent someone to keep, at the head of sign-in and sign-up | `KeepTeaserHead` with `keepTeaserFor(destination)` | `src/components/auth/KeepTeaserHead.tsx`, `src/lib/keepTeaser.ts` |
| An invoice's teas as one row a tea (two packs added up) | `invoiceKeepTeas(lines)` | `src/components/profile/PayInvoiceGuide.tsx` |

Never write `/signin?returnTo=...` by hand.

## Page frame, navigation, history

| Need | Use | Lives in |
|---|---|---|
| The words on the rail and the bottom bar | `navSections` (ask Adrian before changing) | `src/components/navSections.ts` |
| Manage rooms | `manageNav` | `src/components/manageNav.ts` |
| A tab, screen or open panel in the address | `useStepParam` | `src/hooks/useStepParam.ts` |
| Back in admin | `useAdminBack(fallback)`, `AdminHistoryBar` | `src/admin/hooks/useAdminBack.ts`, `src/admin/components/AdminHistoryBar.tsx` |
| Page header | `PageHeader`, `PageHeaderActions`, `PageHeaderTabs` | `src/components/shared/` |
| Tabs | `TabList`, `TabPanel` | `src/components/shared/Tabs.tsx` |

## Building blocks

| Need | Use | Lives in |
|---|---|---|
| Every style value (colours, sizes, corners, the seven button looks) | tokens | `src/styles/tokens.css` (read `docs/COLOR_RULES.md`) |
| Heading and body text | `TYPOGRAPHY_CLASSES` | `src/designTokens.ts` |
| A button | `Button` with `variant` | `src/components/shared/Button.tsx` |
| A centred dialog | `Modal` | `src/components/shared/Modal.tsx` |
| A sheet from the bottom, its options | `BottomSheet`, `SheetOption` | `src/components/shared/BottomSheet.tsx` |
| Are you sure | `ConfirmDialog` | `src/components/shared/ConfirmDialog.tsx` |
| A menu that opens from a button | `AnchoredMenu` | `src/components/shared/AnchoredMenu.tsx` |
| Nothing here yet | `EmptyState` | `src/components/shared/EmptyState.tsx` |
| Something didn't load | `LoadFailed` | `src/components/shared/LoadFailed.tsx` |
| Loading | `LoadingSpinner`, `SkeletonLoader`, `SectionSkeleton` | `src/components/shared/` |
| A short message | `useToast`, `ToastContainer` | `src/hooks/useToast.ts`, `src/components/shared/Toast.tsx` |
| A tooltip | `Tooltip` | `src/components/shared/Tooltip.tsx` |
| The tea cup icon (never a coffee cup) | `TeaCup` | `src/components/TeaCupIcon.tsx` |
| Every other icon | `Icons` or `lucide-react` | `src/components/Icons.tsx` |
| Search across the site | `GlobalSearch` | `src/components/shared/GlobalSearch.tsx` |
| Notes with voice | `NoteThread`, `useVoiceRecorder` | `src/components/shared/NoteThread.tsx`, `src/hooks/useVoiceRecorder.ts` |
| Rendered Markdown | `MarkdownView` | `src/components/shared/MarkdownView.tsx` |
| Supplier facts in a sheet | `SupplierSheet` | `src/components/shared/SupplierSheet.tsx` |

## Server side

| Need | Use | Lives in |
|---|---|---|
| A site problem for the builder | `recordHealthProblem`, `clearHealthProblem` | `worker/src/incidents.ts` |
| An agent tool | a module in `worker/src/mcpTools/`, tickets from `tickets.ts` | `docs/claude/mcp.md` |
| A product insert with its money columns | `nameProductColumns` | `docs/claude/money.md` |
| Voice transcription words | `shared/words.ts`, `shared/teaWords.ts` | `shared/` |

## Known second copies, being replaced

- **Curate** has two old folders, `src/components/TeaCompass/` (live at
  `/admin/compass`) and `src/components/CurateV2/` (at `/admin/compass/v2`),
  both frozen to fixes by `src/admin/guards/curateFoldersFrozen.test.ts`. New
  Curate work goes in `src/components/curate/`. Don't copy from either folder.
  The ordering, pricing and sample parts that Curate, Stock and the buying
  basket borrowed from `CurateV2/` (`placeOrder`, `shopOrders`,
  `curatePricing`, `orderBuy`, `saidFiling`, the sample `CaptureCard`) now
  live in `src/components/curate/`.

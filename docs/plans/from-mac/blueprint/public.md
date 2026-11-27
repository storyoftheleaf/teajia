# Public site and Your Table

The [public wireframes](public.json) describe the current desktop and phone layouts, route ownership, access and meaningful states. Rows run top to bottom and a vertical bar divides columns. Blueprint links connect related records and screens. A link represents a visible action only when the layout or state describes that action. The public editorial blueprint owns Read and public article layouts. Atlas is a private reference in this catalogue.

[App.tsx](../../src/App.tsx) and its mounted components determine current behavior. The [site map](../../docs/SITE_MAP.md) includes historical route intent. The [working plan](../../WORKING_PLAN.md) and [launch validation](../../docs/LAUNCH_VALIDATION.md) record outstanding operating checks.

## Navigation and identity

- Home opens Read, Craft, Advise and Shop and offers Start here. Its footer opens Sessions, People and Spaces. The desktop rail and mobile bottom navigation share the main destinations. The mobile menu has secondary doors for Sessions, People, Places and Tea Wisdom. Global search matches products, articles, sessions and eligible saved-on-device stories. [Home](../../src/pages/HomeV2Page.tsx) · [Phone navigation](../../src/components/BottomTabBar.tsx) · [Site menu](../../src/components/SiteMenu.tsx) · [Search](../../src/components/shared/GlobalSearch.tsx)
- Your Table opens from account identity or /account as the same desktop drawer and full phone sheet. Visitors have an explore view and members have personal tiles. Multiple memberships add switching. One shared Manage registry supplies the work entry to authorized roles. Platform fixes and separately granted Atlas access stay conditional. [Your Table](../../src/components/AccountPanel/index.tsx) · [Launchpad](../../src/components/AccountPanel/LaunchpadView.tsx) · [Manage registry](../../src/components/manageNav.ts)
- The focused card and published collection links omit ordinary navigation and footer. Product detail holds the mounted shop background on a grid tap, while the copied address opens its own full page. [Route composition](../../src/App.tsx) · [Product page](../../src/pages/ProductPage.tsx)
- Aliases are drawn with their destination. /learn forwards to Craft, /consult to Advise, /community to Find a Table, and /tea-atlas/* to /atlas/*. A verified renamed person retains the profile subroute. On a dedicated store host the root opens the corresponding storefront. The two Join routes use the same code form. /design/* is development-only. [App routes](../../src/App.tsx) · [Renamed people](../../src/pages/renamedPeople.tsx) · [Atlas forward](../../src/atlas/OldAtlasRedirect.tsx)

## Visitor and member handoffs

| Entry | What advances | Destination |
|---|---|---|
| Home, Craft, public article or Wisdom | Reviewed story path, precise reference ID or approved product relationship | Public Read, Wisdom or Shop. Visibility checks still apply at the destination. |
| Advise / For your space | Selected service, guidance details and visitor contact | An inquiry or external contact. Validate form delivery and email/WhatsApp separately. |
| People or storefront | Published person slug and hosted shop/venue association | Global person profile, store or scheduled event. Guest collaborations retain distinct attribution. |
| Tea Master Pay | Person and optional account/amount/currency/reference. Access uses owner identity, a permanent approval or a valid share token. | External provider instructions. Access requests appear in Your Table. A transfer completes externally. |
| Shop → Cart → Track order | Store and item identity, quantity and unit, estimate, delivery details, reply consent, then stable tracking token | Saved store-bound inquiry. WhatsApp opens after the save when chosen. The tracking route shows available inquiry, invoice or shipping state. |
| Order History → Order Detail | Authenticated buyer and order ID | The member’s own order detail. Sample history is a separate member data set. |
| Event → RSVP → Manage seat | Event slug, attendee and guest information, contact and token | Confirmed, requested or waitlist. Find RSVP can recover the token through the available account/contact path. |
| Manage seat → Completed session | Confirmed status, attendance, completed lifecycle, published recap and tea menu | Attendee archive and eligible tasting form. Public recap uses its own publication boundary. |
| Sample, structured session or product → Tasting | Sample, session or product identity and required attendee/member context | Tasting observation and a Journal association where supported. |
| Shared collection → Review picks | Publication ID, publisher, selected lines/amounts and reply details | Collection inquiry. Member saved/received record opens the original publication. |
| Shared tasting card → Sign in → Claim | Share token and validated return path | Claim endpoint and Card saved confirmation with Journal reentry. Persisted destination requires end-to-end verification. |
| Cellar → Public shelf | Explicitly selected owned lot and published shelf settings | Public shelf projection and optional mapped Tea Master identity. |
| Your Table → Atlas | Read grant and separate import grant when eligible | Private corpus. A denied reader sees the ordinary site 404 before the reader bundle loads. |

[Craft states](../../src/pages/craft/craftLive.ts) · [Advise inquiry](../../src/components/advise/InquiryForm.tsx) · [Tea Master profile](../../src/pages/ContributorProfilePage.tsx) · [Payment access](../../src/pages/ProfilePaymentPage.tsx) · [Cart](../../src/components/shared/PublicCart.tsx) · [Order status](../../src/pages/OrderStatusPage.tsx) · [RSVP](../../src/components/events/RSVPFormSheet.tsx) · [Reservation](../../src/components/events/GuestManagement/index.tsx) · [Public collection](../../src/pages/PublicCollectionPage.tsx) · [Share claim](../../src/pages/ShareCardPage.tsx) · [Cellar](../../src/components/AccountPanel/CellarView.tsx) · [Atlas gate](../../src/atlas/AtlasGate.tsx)

## Personal tea records

| Surface | Record and actions |
|---|---|
| Journal | Device-local tastings can exist without an account session. Members merge their private server entries. One tea entry can retain several dated tastings. The full route can focus a tea and entry from URL parameters. The Your Table tile opens the separate drawer implementation. |
| Favorites and Liked | These are saved products. The Shop Liked view and Your Table Remember destination both connect to kept teas. |
| Shared with you | Member list of publications saved or received across curators. Removing one from this list is a personal action. Publication itself follows the curator’s public lifecycle. |
| Cellar | Owned lots with quantities and explicit add/edit/remove. Public shelf and placement require deliberate actions. |
| Tea Master favorite teas | Contributor’s public selection. Entries start private until shared. |
| Journey, guest journey and passport | Account journey summarizes the person’s sessions and tasting history. Legacy /journey verifies contact. Passport token has its own attendance projection. |

[Journal page](../../src/pages/JournalPage.tsx) · [Journal drawer](../../src/components/AccountPanel/TastingJournalView.tsx) · [Favorites](../../src/pages/CollectionPage.tsx) · [Received collections](../../src/pages/SharedCollectionsPage.tsx) · [Cellar](../../src/components/AccountPanel/CellarView.tsx) · [Public favorite editor](../../src/components/profile/ProfileFavoritesEditor.tsx) · [Member journey](../../src/pages/AccountJourneyPage.tsx) · [Guest journey](../../src/pages/JourneyPage.tsx)

## Gaps to resolve

| Gap | Current behavior | Acceptance |
|---|---|---|
| C1 Restock follow-up | A sold-out product opens a composed WhatsApp or email message carrying the tea and shop. Operator ownership and follow-up remain open. | Open the sold-out URL as guest, verify its contact and tea/shop identity, and agree who follows up when stock returns. [Product](../../src/pages/ProductPage.tsx) · [Restock test](../../tests/sold-out-restock.spec.ts) |
| M3–M4 Sale and publication | Cart save, tracking and detail exist. The first paid operator loop and parity among visibility write paths still need proof. | Walk one tea from approved Stock into the storefront, inquiry, order, payment, fulfillment and buyer view. Check access and stock movements on retry. [Working plan](../../WORKING_PLAN.md#delivery-queue) · [Checkout test](../../tests/public-checkout.spec.ts) |
| K3–K4 Craft and Wisdom | Coming-soon Craft rows have no visitor link. Several still render at direct query addresses. Brewing by tea type has no destination. Tea taxonomy routes can exist without a public home placement. | Decide direct access for inert rows, approve the first guide and test its Craft, Wisdom and tea-entry links. [Craft states](../../src/pages/craft/craftLive.ts) · [Query views](../../src/components/LearnHub.tsx) · [Taxonomy paths](../../src/wisdom/reference/previewMode.ts) |
| E1 Public connections and Advise | People, Places and Find a Table have distinct entry points. Advise shows Upcoming Sessions as coming soon by default, while Home and site menu already link to Events. Projects and sourcing journeys point at a disabled portfolio. | Choose directory placement separately. Approve source material and make newly visible links land at their intended content. Verify one real venue, person and event action. [Connections plan](../../todo/plans/connections-page.md) · [Advise states](../../src/pages/advise/adviseLive.ts) · [Portfolio](../../src/components/AdvisePage.tsx) |
| E2 Event completion | Host RSVP closure and attendee follow-up use lifecycle state. The older completion endpoint lacks a mounted caller and follows a different state/write path. | Exercise one ordinary event and one structured tasting through host closure, attendee archive, notes and the chosen opt-in invoice policy. [Working plan](../../WORKING_PLAN.md#delivery-queue) · [Attendee archive](../../src/components/events/GuestManagement/PostEventView.tsx) |
| P1 Share claim | Confirmation says the tea is in Journal and sends the recipient there. The persisted identity and Curate consumer handoff still need reconciliation. | Repeat a claim after sign-in and on another device. Confirm one intended record and a useful return path. [Share page](../../src/pages/ShareCardPage.tsx) · [Curate consumer](../../docs/CURATE_CONSUMER_CONTRACT.md) |
| Received collections recovery | The private list presents a fetch failure as an empty list. Embedded mode stays silent without rows. | Make error and retry explicit, settle guest handling and test permitted, denied, removed and unavailable publications. [Collections page](../../src/pages/SharedCollectionsPage.tsx) · [Inbound test](../../tests/collections-inbound.spec.ts) |
| Atlas acceptance | Private viewer and separate importer gate exist. Owner-side live browse, search and image acceptance remains open. | Validate one authorized source, search and illustrated article. Exercise denied reader access and retired-route forwarding. [Atlas gate](../../src/atlas/AtlasGate.tsx) · [Atlas notes](../../docs/TEA_ATLAS.md) · [Open item](../../TODO.md) |

Current cart code uses native disclosures for an optional note and phone QR. The wireframes preserve those actions. Any future design should give them an approved visible or focused interaction and check the keyboard and phone states. [Cart renderer](../../src/components/shared/PublicCart.tsx)

## Evidence and proof boundary

- Existing specs cover [home](../../tests/home.spec.ts), [site menu](../../tests/site-menu.spec.ts), [public connections](../../tests/public-connections.spec.ts), [people](../../tests/people-smoke.spec.ts) and [Tea Master presence](../../tests/tea-master-presence.spec.ts).
- Contributor and Pay coverage includes [full profile](../../tests/creator-profile-full.spec.ts), [sparse profile](../../tests/creator-profile-sparse.spec.ts), [publication journey](../../tests/contributor-publishing-journey.spec.ts) and [payment gate](../../tests/creator-pay-gate.spec.ts). Auth coverage includes [Google return](../../tests/google-sign-in-return.spec.ts), [email code](../../tests/signin-email-code.spec.ts) and [event sign-in](../../tests/event-signin-navigation.spec.ts).
- Sessions and personal states have [recap photo essay](../../tests/event-photo-essay.spec.ts), [session tasting save](../../tests/session-tasting-save.spec.ts), [personal tea journey](../../tests/personal-tea-journey.spec.ts), [collection publishing](../../tests/collections-public.spec.ts), [sample workflows](../../tests/sample-workflows.spec.ts) and [private cache isolation](../../tests/private-cache-isolation.spec.ts) fixtures.
- This catalogue uses source inspection and identifies existing coverage. It records no new browser or production run. The working plan records a prior November 17 audit of 12 signed-out production routes at 390 and 1440 px. Actual phone, mainland network, real OTP delivery and paid sale checks remain open. [Working plan](../../WORKING_PLAN.md#ready-to-ship) · [Launch validation](../../docs/LAUNCH_VALIDATION.md)

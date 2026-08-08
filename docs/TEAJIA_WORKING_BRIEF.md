# Teajia — Working Brief

> A minimal but complete summary of the product intention, present state, priorities, and strongest recommendations from the July–August 2026 review.

**Updated:** 2026-08-08

## The purpose, correctly stated

Teajia began first as Adrian's own working tea system: a practical way to organize teas, purchasing, stock, customers, sales, and the knowledge surrounding each tea. It is intended to become useful in the active tea business when Adrian is ready to plug it into daily operations.

The broader community and multi-store network are a later expansion of that working foundation. They are not the condition by which the current project should be judged.

The fact that Teajia is not fully launched is **not a failure or a product risk by itself**. Adrian is already selling tea and deliberately developing the system between other projects. The useful question is not “why has it not launched?” but “what must be reliable before it becomes part of the real business?”

The enduring product principles are:

- Technology supports sourcing, preparation, commerce, learning, and memory before and after the tea table; it does not intrude during tea practice.
- Human curation and conversation remain central. WhatsApp-led ordering is intentional.
- Teajia is not a conventional social network, franchise system, or engagement machine.
- Do not add feeds, likes, followers, rankings, averaged reviews, streaks, badges, algorithmic recommendations, or auto-replenishment subscriptions.
- People may use only the part that serves them: shop, journal, events, education, inventory, or professional tools.

## What Teajia is now

Teajia is already a substantial tea operating platform with a public shop and a deep private operating layer.

### Present and materially built

- A curated catalog of roughly 139 teas and teaware items.
- Inventory, stock ledger, stock movements, low-stock thresholds, and sold-out handling.
- Purchase orders and a receiving path from incoming stock into inventory.
- Customers, inquiries, orders, invoices, fulfillment, and WhatsApp-led commerce.
- Events, samples, tasting memory, Journal, Cellar, Favorites, and personal tea records.
- Curate/Compass tools for sourcing, capturing samples, and promoting a sourced tea into the catalog.
- Editorial infrastructure, Learn material, brewing material, and a substantial glossary.
- Contributor, people, network, account, role, and multi-store foundations.
- Agent/voice tools for reading inventory and customers and safely performing stock and sales actions.

### Built as infrastructure but not yet exercised fully

- The second-store/Australia path and cross-store behavior.
- Outside contributor publishing.
- Customer signup, verification, and recovery delivery in the deployed environment.
- Daily use of the complete receive-stock → sell → invoice → payment → fulfill loop by Adrian.
- Broader network/community mechanisms with several real participants.

These are validation and adoption tasks, not evidence that the underlying project is misguided.

### Content reality

The Read/editorial system is built, but authentic editorial content has not yet been created at the intended level. Existing seeded articles and fictional contributor material should be treated as demonstration content, not Adrian's published voice. The glossary and structured Learn material are considerably more complete and can remain useful independently.

## What must work before daily business use

### Now — smallest path to a dependable operating tool

1. **Complete the payment loop in the admin interface.** Confirm whether the current Orders/Invoice UI can mark an invoice paid, including payment method and paid date. If it remains display-only, add the control; the backend and agent action already support it.
2. **Run one private end-to-end operating rehearsal.** Receive a real purchase order, verify resulting stock, create an order/invoice, record payment, fulfill it, confirm stock deduction, and inspect the ledger. This is rehearsal of the tool Adrian intends to use—not a public-launch test.
3. **Confirm Adrian's production access.** Verify password or Google sign-in, account selection, and recovery before the system is needed during a working day.
4. **Confirm production email delivery.** Test one real signup/verification message and one recovery message. Configure the deployed email secrets if needed.
5. **Remove, hide, or clearly label demonstration editorial content.** Do not allow fictional authors or placeholder articles to read as genuine Teajia editorial work.
6. **Review the real contributor material.** Approve, revise, or hold Barry's profile deliberately.

### Soon — operational confidence

- Perform the historical invoice-line repair preview and decide whether the old data needs correction.
- Resolve worker type errors in the active Curate/import pipeline before relying heavily on bulk intake.
- Verify backups/export and the recovery path for inventory and customer data.
- Test the core operating loop on Adrian's actual phone, on ordinary mobile data, and in poor connectivity.
- Decide whether invoices need automatic email delivery later; PDF download/share is adequate for the first working version.

### Later — proof of expansion

- Activate a real second operator and complete one sale in the second account.
- Publish one genuine outside contribution through the existing workflow.
- Run one two-account sourcing or wholesale rehearsal.
- Test account switching, permissions, shared tea identity, and guest portability with real people.

## Inventory: preserve what is good

The Inventory view's density is a strength. Adrian often browses because he recognizes a tea while scrolling rather than beginning with its exact name. Do **not** replace the dense ledger with large cards, excessive whitespace, forced search, or aggressive pagination.

The right mobile model is:

- many teas visible at once;
- fast vertical browsing;
- the tea name remains the visual anchor;
- horizontal detail remains available without making the list feel like a spreadsheet squeezed onto a phone;
- common actions are one tap away, while uncommon controls are folded away;
- row height should remain compact.

### Inventory recommendations

1. **Rebuild the mobile toolbar around one compact row.** Search, current lens/filter, and Add are primary. Move currency, grouping, sorting, columns, price mode, glossary, import/export, and maintenance into one clearly sectioned View/Actions sheet. Avoid two permanent toolbar rows consuming list space.
2. **Keep browsing and search complementary.** Search should expand quickly when needed but should not dominate the resting screen or imply that users must know the tea's name.
3. **Improve tap accuracy without increasing row height.** Make the name, stock, and source cells use the full available cell as their hit area and preserve the 44px invisible tap target.
4. **Make low stock visible in the scan path.** Give the tea name the same quiet warning tone as its low-stock number. Keep the treatment restrained; avoid badges or bright borders.
5. **Expose important state without adding columns.** Use a restrained icon or tint for hidden, personal, unverified, or otherwise exceptional teas only when that state affects the next action.
6. **Teach hidden gestures once, quietly.** If long-press opens quick edit, reveal it contextually after first use or in the existing action sheet—not through an onboarding tour.
7. **Preserve scroll position and context.** Opening a tea and returning should restore the same row, horizontal position, filter, sort, and search state.
8. **Delay row virtualization until it solves a measured problem.** The present catalog size does not justify risking scroll behavior. If the catalog grows enough to slow mobile rendering, virtualize with strong regression tests and preserve browse continuity.

### Inventory acceptance checks

- Test at 375–390px width on a real phone.
- At least one additional tea should be visible compared with the two-row toolbar layout.
- No accidental horizontal page overflow; only intentional inventory-detail movement may scroll horizontally.
- Search, Add, filters, sorting, currency, stock adjustment, and quick edit remain reachable with one hand.
- Returning from a tea preserves browsing position.
- The internal Inventory height chain and bottom-navigation clearance remain intact.

## Strong community and product ideas

The community should grow from useful tea practices and named human contributions, not from a generic “Community” page. Begin with a few real people using existing mechanisms. The following ideas are strongest because they extend things Teajia already has.

### Commerce and curation

- **The Split:** divide a rare cake or small lot into named shares; each holder receives the tea in their Cellar and becomes part of that tea's record.
- **Comparative Flights:** sell or offer three-tea learning flights—cultivar, roast, mountain, or vintage comparisons—paired with a short guide and side-by-side journal format.
- **The Gift Clerk:** let the public assistant interview an uncertain gift buyer, then hand Adrian a well-prepared WhatsApp inquiry rather than attempting automatic checkout.
- **Harvest Letters:** publish a seasonal note explaining what Adrian bought, refused, and learned, with the relevant teas linked directly.
- **Out of Print:** preserve sold-out tea pages as an archive of reviews, tastings, and provenance; connect a future harvest to the people who knew the previous one.
- **The Library Shelf:** reserve certain teas for tasting at the physical table rather than shipping them, reinforcing that presence remains more valuable than the website.

### Memory and hospitality

- **The Drinking Window:** let Adrian add a human-written “revisit around…” note to aging teas in a customer's Cellar.
- **The Table Record:** after a private session, send guests a quiet recap containing the teas, date, host, and journal starting points.
- **The Cellar Prompt:** privately remind Adrian when a regular may be nearing the end of a tea; Adrian decides whether to begin a conversation.
- **The Open Cellar:** allow an owner to share a temporary read-only Cellar view with a guest before a session.

### Community without social media

- **The Traveling Tin:** one physical tin travels among several named people; each contributes an attributed reading before passing it onward.
- **Open Tables:** allow trusted individuals—not only businesses—to offer a few seats for a tea gathering using existing event and recap tools.
- **Ask the Person Who Tasted It:** connect a named tasting note to an optional WhatsApp conversation with that person.
- **Introductions, not profiles:** add “ask for an introduction” to Find a Table; the result is a human connection, not a follow graph.
- **Trust through contribution:** consider a house part of the network after it has a real profile and a published contribution, rather than inventing badges or scores.
- **The Second Table in a Box:** prepare a non-code onboarding checklist and inherited starter catalog so the next tea house begins with provenance, curation, roles, and a connected story rather than an empty database.

### Physical/editorial extensions

- **Print the Annual:** turn the strongest Read pieces into a small physical annual once authentic writing exists.
- **Two Tables, One Tea:** show two named operators' notes side by side for the same tea, preserving disagreement rather than averaging it.
- **Make milestones editorial:** document the first real second-store sale or gathering as a genuine Read piece in the operator's own voice.

## Recommended sequence

1. Make Teajia dependable for Adrian's own inventory and sales practice.
2. Replace or hide demonstration editorial material.
3. Improve the phone Inventory experience while preserving its density and browsing character.
4. Use the system privately for real business work and correct what daily use reveals.
5. Add authentic content gradually from sourcing, tables, teas, and people already in Adrian's life.
6. Invite a handful of real participants into existing contributor, review, event, and network tools.
7. Only then deepen multi-store and community infrastructure in response to observed needs.

## The honest conclusion

Teajia is not “a community platform that failed to launch.” It is a highly developed private tea operating system with public shop, learning, memory, and future-network layers. Its central task is to become trustworthy and effortless in Adrian's actual tea business. Its larger opportunity is to preserve the things ordinary commerce software loses: provenance, curatorial judgment, the memory of a tea over time, and relationships formed around real tables.

Build time should therefore favor operational completeness, mobile usability, authentic content, and small real-world rituals. The community does not need a feed. It needs useful reasons for several named people to return, contribute, meet, remember, and buy tea through a system that still feels human.

# Teajia intake

Capture a new observation here with the affected tea, person or step and the evidence available. Move an accepted change to its journey in [Consolidated Direction](docs/CONSOLIDATED_DIRECTION.md). Record a completed real-world check in [Launch Validation](docs/LAUNCH_VALIDATION.md). Keep each item in one place.

## Awaiting facts

- [ ] Pick the words and picture a pasted teajia.com link shows; Home's own two lines are live as a placeholder, and the three options are drawn in the project's link-preview folder. Swap them in `src/lib/siteMeta.ts`, `index.html` and `npm run share:site`. _(band: you-required)_ _(effort: quick)_
- [ ] Before offering a photographed lot from the November closeout, confirm its identity from the original evidence (15 candidates, six unmatched and two conflicting matches); pots 12, 19, 30 and 33 need identifying views, including a continuous side-to-base view for 33. _(band: you-required)_ _(effort: moderate)_ [Photo handoff](https://github.com/storyoftheleaf/teajia/blob/4eb502f99c40509176472e9fede440243d23e3ef/docs/plans/from-mac/todo/teaware-photo-handoff.md)

- [ ] Recount the seven Wuyi lots flagged on 24 November before relying on their figures, and identify the unpriced Meizhan Yancha 2024 and the unnamed Yancha against the original list. _(band: you-required)_ _(effort: quick)_ [Lots and placeholder weights](https://github.com/storyoftheleaf/teajia/blob/4eb502f99c40509176472e9fede440243d23e3ef/TODO.md#L7)
- [ ] Confirm receiving companies, missing parcel weights and physical collection at the old warehouse against the purchase evidence and consolidator’s reply. _(band: you-required)_ _(effort: moderate)_
- [ ] Compare the purchase export with the Library, Ledger and logistics screens for known amounts, currencies and quantity units, leaving any missing figure blank. _(band: agent-runnable)_ _(effort: moderate)_
- [ ] Review the preview of unstated historical cost currencies supplier by supplier before correcting any rows. _(band: you-required)_ _(effort: moderate)_ [Money rules](docs/claude/money.md)
- [ ] If an edition includes the An Cha couple, confirm how the principal speaker and Dai Haizhong want to be named, how photographs may appear and which contact details each person agreed to share. _(band: you-required)_ _(effort: quick)_ [Interview-specific permissions, exclusions and feedback procedure](https://github.com/storyoftheleaf/teajia/blob/4eb502f99c40509176472e9fede440243d23e3ef/TODO.md#L27-L30)
- [ ] For a tea selected for an edition, resolve any held Wisdom claim against its source and keep disputed wording private until reviewed. _(band: you-required)_ _(effort: moderate)_ [Held teas and requested corrections](https://github.com/storyoftheleaf/teajia/blob/4eb502f99c40509176472e9fede440243d23e3ef/TODO.md#L9-L11)
- [ ] Reconcile the Family photograph-storage reading and the requested legal review of “How we use photographs” before expanding that collection. _(band: you-required)_ _(effort: moderate)_ [Original acceptance request](https://github.com/storyoftheleaf/teajia/blob/4eb502f99c40509176472e9fede440243d23e3ef/TODO.md#L12)

- [ ] Confirm the three placeholder lines for the email box: on joining "Teajia and the hosts I choose may email me about teas and tables.", in settings "Teajia may email me about new teas and tables." and "Hosts who may email me" (the order line is Adrian's). _(band: you-required)_ _(effort: quick)_ [The words](src/lib/emailConsent.ts)

## Requests with a trigger

- [ ] When any email other than an order email is built (Teajia letters or a host writing to guests), it sends only to people `mayEmailAboutTea` allows, for Teajia or for that host. _(band: agent-runnable)_ _(effort: quick)_ [Email answers](worker/src/emailConsent.ts)

- [ ] When automatic US postage is proposed, obtain the outbound rate, currency, packed-weight allowance, minimum and covered destinations. _(band: you-required)_ _(effort: quick)_
- [ ] When a real set or teaware range is ready to offer, confirm each member’s identity, availability, material, capacity and orderability before reopening its Shop tab. _(band: you-required)_ _(effort: moderate)_
- [ ] When Adrian selects a portfolio case or Tea Spaces service for publication, confirm its actual stages, offering, permissions and photographs. _(band: you-required)_ _(effort: moderate)_ [Advise portfolio and photo brief](https://github.com/storyoftheleaf/teajia/blob/4eb502f99c40509176472e9fede440243d23e3ef/TODO.md#L37-L44)
- [ ] If the tasting-note review flow is used to select a customer quotation, verify how the writer authorizes public wording, attribution and withdrawal before publishing. _(band: you-required)_ _(effort: quick)_
- [ ] At the next change to Atlas source management, assess owner correction and removal, the Obsidian copy and the separate Global Tea Hut refresh against the current importer. _(band: agent-runnable)_ _(effort: moderate)_ [Original source requests](https://github.com/storyoftheleaf/teajia/blob/4eb502f99c40509176472e9fede440243d23e3ef/TODO.md#L55-L58)
- [ ] Before changing schema defaults, verify which tenant, unit, freight, cost and policy defaults still reach writes and rehearse any table rebuild with existing data. _(band: agent-runnable)_ _(effort: moderate)_ [Historical findings and safeguards](https://github.com/storyoftheleaf/teajia/blob/4eb502f99c40509176472e9fede440243d23e3ef/TODO.md#L122-L143)

## New observations

- [ ] Answer the twelve questions in the Curate and Waiting plan (one list of what needs you, Curate version 2 removed) before slices 4 to 12, including the deletion of version 2; slice 1 is live and slices 2, 3, 7 and 12 need no answer. _(band: you-required)_ _(effort: moderate)_ [Curate and Waiting plan](todo/plans/curate-waiting-consolidation.md)

### Feature guide (owner walk-throughs)

<!-- scripts/intake-findings.mjs inserts owner findings immediately beneath this heading. Preserve each finding marker when triaging so a later sync can recognize it. -->

[The complete pre-consolidation intake](https://github.com/storyoftheleaf/teajia/blob/4eb502f99c40509176472e9fede440243d23e3ef/TODO.md) retains the earlier requests, named lots, source evidence, design proposals, acceptance notes and dated measurements. Reopen an old observation when it affects a chosen journey and current evidence reproduces it.

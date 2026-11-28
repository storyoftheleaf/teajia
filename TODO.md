# Teajia intake

Capture a new observation here with the affected tea, person or step and the evidence available. Move an accepted change to its journey in [Consolidated Direction](docs/CONSOLIDATED_DIRECTION.md). Record a completed real-world check in [Launch Validation](docs/LAUNCH_VALIDATION.md). Keep each item in one place.

## Awaiting facts

- [ ] Before offering a photographed lot from the November closeout, confirm its identity from the original evidence (15 candidates, six unmatched and two conflicting matches); pots 12, 19, 30 and 33 need identifying views, including a continuous side-to-base view for 33. _(band: you-required)_ _(effort: moderate)_ [Photo handoff](https://github.com/storyoftheleaf/teajia/blob/4eb502f99c40509176472e9fede440243d23e3ef/docs/plans/from-mac/todo/teaware-photo-handoff.md)

- [ ] Recount the seven Wuyi lots flagged on 24 November before relying on their figures, and identify the unpriced Meizhan Yancha 2024 and the unnamed Yancha against the original list. _(band: you-required)_ _(effort: quick)_ [Lots and placeholder weights](https://github.com/storyoftheleaf/teajia/blob/4eb502f99c40509176472e9fede440243d23e3ef/TODO.md#L7)
- [ ] Confirm receiving companies, missing parcel weights and physical collection at the old warehouse against the purchase evidence and consolidator’s reply. _(band: you-required)_ _(effort: moderate)_
- [ ] Compare the purchase export with the Library, Ledger and logistics screens for known amounts, currencies and quantity units, leaving any missing figure blank. _(band: agent-runnable)_ _(effort: moderate)_
- [ ] Review the preview of unstated historical cost currencies supplier by supplier before correcting any rows. _(band: you-required)_ _(effort: moderate)_ [Money rules](docs/claude/money.md)
- [ ] If an edition includes the An Cha couple, confirm how the principal speaker and Dai Haizhong want to be named, how photographs may appear and which contact details each person agreed to share. _(band: you-required)_ _(effort: quick)_ [Interview-specific permissions, exclusions and feedback procedure](https://github.com/storyoftheleaf/teajia/blob/4eb502f99c40509176472e9fede440243d23e3ef/TODO.md#L27-L30)
- [ ] For a tea selected for an edition, resolve any held Wisdom claim against its source and keep disputed wording private until reviewed. _(band: you-required)_ _(effort: moderate)_ [Held teas and requested corrections](https://github.com/storyoftheleaf/teajia/blob/4eb502f99c40509176472e9fede440243d23e3ef/TODO.md#L9-L11)
- [ ] Reconcile the Family photograph-storage reading and the requested legal review of “How we use photographs” before expanding that collection. _(band: you-required)_ _(effort: moderate)_ [Original acceptance request](https://github.com/storyoftheleaf/teajia/blob/4eb502f99c40509176472e9fede440243d23e3ef/TODO.md#L12)

## Requests with a trigger

- [ ] When automatic US postage is proposed, obtain the outbound rate, currency, packed-weight allowance, minimum and covered destinations. _(band: you-required)_ _(effort: quick)_
- [ ] When a real set or teaware range is ready to offer, confirm each member’s identity, availability, material, capacity and orderability before reopening its Shop tab. _(band: you-required)_ _(effort: moderate)_
- [ ] When Adrian selects a portfolio case or Tea Spaces service for publication, confirm its actual stages, offering, permissions and photographs. _(band: you-required)_ _(effort: moderate)_ [Advise portfolio and photo brief](https://github.com/storyoftheleaf/teajia/blob/4eb502f99c40509176472e9fede440243d23e3ef/TODO.md#L37-L44)
- [ ] If the tasting-note review flow is used to select a customer quotation, verify how the writer authorizes public wording, attribution and withdrawal before publishing. _(band: you-required)_ _(effort: quick)_
- [ ] At the next change to Atlas source management, assess owner correction and removal, the Obsidian copy and the separate Global Tea Hut refresh against the current importer. _(band: agent-runnable)_ _(effort: moderate)_ [Original source requests](https://github.com/storyoftheleaf/teajia/blob/4eb502f99c40509176472e9fede440243d23e3ef/TODO.md#L55-L58)
- [ ] Before changing schema defaults, verify which tenant, unit, freight, cost and policy defaults still reach writes and rehearse any table rebuild with existing data. _(band: agent-runnable)_ _(effort: moderate)_ [Historical findings and safeguards](https://github.com/storyoftheleaf/teajia/blob/4eb502f99c40509176472e9fede440243d23e3ef/TODO.md#L122-L143)

## New observations

### Feature guide (owner walk-throughs)

<!-- scripts/intake-findings.mjs inserts owner findings immediately beneath this heading. Preserve each finding marker when triaging so a later sync can recognize it. -->

### Walking an invoice as a newcomer (2026-11-28, sandbox, phone and desktop)

- [ ] A second person who joins from the same invoice link (a partner, a friend it was forwarded to) gets their tea saved but the invoice is silently not kept, because the first keeper wins and the refusal is swallowed. Decide whether they should see a line saying it is already with someone. _(band: you-required)_ _(effort: quick)_
- [ ] Google's consent screen for sign-in returns to `teajia-api.lightcodes.workers.dev`; check what name and domain Google shows a newcomer there, and whether the consent screen names Teajia. _(band: you-required)_ _(effort: quick)_
- [ ] A contributor whose page tier is `family` has no pay sheet (`familyPageAllowsPay` allows only none or `master`), so an invoice sent with their name on it opens to "Payment page unavailable". Confirm that is intended before any family member sends an invoice. _(band: you-required)_ _(effort: quick)_
- [ ] On desktop the rail lights "tea table" while a person is on an invoice's pay page (`/people/...`). Nav words are Adrian's to change. _(band: you-required)_ _(effort: quick)_

[The complete pre-consolidation intake](https://github.com/storyoftheleaf/teajia/blob/4eb502f99c40509176472e9fede440243d23e3ef/TODO.md) retains the earlier requests, named lots, source evidence, design proposals, acceptance notes and dated measurements. Reopen an old observation when it affects a chosen journey and current evidence reproduces it.

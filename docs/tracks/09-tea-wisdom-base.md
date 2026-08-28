# Track 9: Tea Wisdom Base

> One answer to "what is this tea", held once and read everywhere. Design in [TEA_WISDOM_BASE.md](../TEA_WISDOM_BASE.md).

Status: the base exists and the import reads from it. Fourteen surfaces still carry their own tea-type list, and three of the four touch points are unbuilt.

## Shipped

- [x] **Shared vocabulary with a dialect bridge.** `normalizeTeaType` resolves every spelling ever written into a record, which is what makes retiring the other lists safe one screen at a time.
- [x] **79 cultivars and 83 growing regions recovered.** An abandoned research corpus rescued into `data/tea-wisdom-source` with a repeatable build. Two junk files discarded.
- [x] **Import reads the base.** Type, form, year, region, country, Chinese name and cultivar fill from known teas before any AI is asked.
- [x] **Cultivar carries end to end.** Analysis prompt through review to both the compass entry and the product.

## Only Adrian can do these

- [ ] **Push and apply.** _(you-required)_ The work sits on a branch and the `cultivar` column is not on the live database yet. Held deliberately rather than shipped unattended.
- [ ] **Confirm production notes and description now fill.** _(you-required)_ The analysis prompt was taught to write them; only a real import proves it.

## Active queue

- [ ] **Retire the shop and public tea-type lists.** _(agent-runnable)_ `src/types.ts`, `ShopSearch`, `TeaInventory`, `tags.ts`, `designTokens` each carry their own list. Import from `src/wisdom` and wrap stored values in `normalizeTeaType`.

- [ ] **Retire the admin tea-type lists.** _(agent-runnable)_ `inventory/config.ts`, `CatalogView`, `CollectionEditView`, `InventoryEditor`, `themeUtils`, `TeaIllustration`, `intakeMapping` each carry their own. Same treatment.

- [ ] **Point capture at the base.** _(agent-runnable)_ `CaptureCard`, `TypeGrid`, `FormRow`, `DetailsRow` and `InputParser` hold a parallel variety index and region list that now duplicate the wisdom base.

- [ ] **Collapse the four keyword engines into one derived index.** _(agent-runnable)_ `intakeMapping`, `InputParser`, the worker's translation terms, and the import form hints each independently know that 饼 means cake. Derive one index from the wisdom entries so adding a tea teaches all of them.

- [ ] **Grow the base from the 266 tea write-ups.** _(agent-runnable)_ `products/` holds Adrian's own terroir and processing prose. Mine it for varieties, regions and cultivars the base does not yet hold.

- [ ] **Wisdom admin.** _(agent-runnable)_ Cultivars, regions and varieties editable the way stock items are. Where AI drafts wait to be read and promoted, and how the base grows without touching code.

- [ ] **Lineage on a tea being sold.** _(agent-runnable)_ The shared background under the operator's own words on the product page, marked as reference rather than voice.

- [ ] **Public cultivar pages.** _(agent-runnable)_ A page per plant with its lineage tree, where it grows, what it tastes like, and the teas in the shop made from it.

- [ ] **The open copy and the submit line.** _(agent-runnable)_ Downloadable dataset with an open license, a public mirror, and a plain address for corrections. The standard is stated as a direction: this is not everything, the goal is to be everything.

- [ ] **Authorship rungs.** _(agent-runnable)_ Drafted, reviewed, authored. Visible per entry so AI drafting is neither hidden nor apologised for.

- [ ] **Move the 316 varieties into the wisdom folder.** _(agent-runnable)_ They still live in `src/data/teaVarieties.ts` outside the base they belong to.

- [ ] **Join the glossary and sensory vocabulary in.** _(agent-runnable)_ 47 glossary terms and 136 tasting terms exist and are already single-sourced, but nothing links a cultivar to either.

## Small corrections

- [ ] **Import editor still has plain boxes where capture has pickers.** _(agent-runnable)_ Origin region, year, season and storage in the import review are bare inputs; the capture card has proper pickers for the same fields.

- [ ] **Purpose wording disagrees with itself.** _(agent-runnable)_ Product edit reads Working / Sample holding / Personal; import now reads Shop stock / Personal collection / Sample.

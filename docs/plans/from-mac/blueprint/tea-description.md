# Write a Teajia product description with Adrian

Use this when Adrian asks you to write or revise a Shop description for a tea. Read the [house style](../../docs/PRODUCT_DESCRIPTION_STYLE.md) first. Follow the exact tea and product links in [the phone walkthrough](tea-to-shop.md). The output is an approved set of public product fields tied to one holding, with the drafting evidence kept privately. A public listing remains a separate action.

## 1. Open the right tea and read what is recorded

Resolve the active Teajia shop, supplier if known, Curate encounter ID, linked Stock product ID, and the existing description. Prove the pair from its durable link rather than matching a name or the first search result. If the user is tasting an existing sample, open its linked tea without creating another encounter. Record the exact tea and product identities before editing. Check whether the product is already visible in Shop, since a normal edit to its description can immediately affect customers.

Use **Curate → Library → open the tea → Build this tea** on the tea detail panel. Open **Working material** for the saved tea fields, typed notes and transcriptions, and a scoped AR Create selection when already authorized and available. For an existing Stock holding without a Curate link, use its current product fields, attribution and source history. An uncertain match goes to Adrian. Keep the original words and private source links accessible only to their authorized account.

Build a brief private record from the evidence. Include these four lines even when evidence is sparse.

| Line | What belongs here |
|---|---|
| Verified objective facts | Tea type, form, place, producer and processing details that can be traced to the correct tea. Note the source and the wording or locator. Use vendor facts only when the evidence and attribution are strong enough for this specific lot. |
| Adrian's tasting and own words | His actual observations and any lines he explicitly wants recorded in Tasting, Mood or Experience. Preserve attribution. Correct a transcription with him where the wording or names matter. |
| Claims to confirm or omit | Uncertain origin, year, pressing, elevation, age, batch equivalence, supplier claims or rights. A documented general fact about a town does not establish a claim about this particular tea. |
| Public media and listing facts | Chosen images with rights and attribution, the intended public name, exact product link and current visibility. The buying cost, receipts, private supplier contact and freight stay in their own records. |

## 2. Use the tasting as a collaboration step

Ask one question when it changes the record. Start with the actual uncertainty. For example, “Does that date on the label mean harvest or packing?” or “Which part of your tasting would you like saved as the shop tasting?” A phone tasting can produce a private Journal entry, a sample use record or a curated shop tasting profile. Confirm the intended destination. Preserve a personal retaste and an existing shop profile independently unless Adrian explicitly updates each.

The agent writes objective place, identity and craft. Adrian supplies perceived flavor, texture, body, finish, Mood and Experience. Keep taste and flavor in the tasting fields even when directly quoted or already present in a draft. Retain Adrian's actual words for subjective fields when he approves them. If there is no human tasting evidence, leave those fields blank. If he has given enough objective evidence, draft without waiting for a tasting answer.

## 3. Draft and present a review he can finish

Write two to four short, plain paragraphs if the evidence warrants them. Name the verified tea and place, then state the specific craft or material details that matter. A short factual description may be the complete answer for a sparse record. Add only terse, sourced lore where useful. Leave out invented or unresolved process, named trees, exact year, elevation, vintage, health claims, marketing superlatives, purchasing notes, gram counts and any private source text. Preserve the [house style](../../docs/PRODUCT_DESCRIPTION_STYLE.md), including its instruction on punctuation and its distinct tasting fields.

Show Adrian the candidate copy as it would read on the shop page. Under it, show a compact private list of which facts support it, what was omitted and the proposed images or tasting-field changes. Ask for his approval or one unresolved fact. Revise only the approved fields and keep the quoted sources private.

In **Build this tea**, select material and choose **Draft description from selected material** when useful. Review the citations and edit the proposal. The source check establishes a quote trail. The current provider fixture can accept cited sensory language such as finish, so enforce the house rule at review until the product guard does. Use **Find tea details** only for genuinely missing verified facts and select each to accept. Use **Save this description → Save accepted changes** only after Adrian approves that exact result and those separate fields. Use **Discard changes** when the result needs more work. Refresh the review if the source, tea or saved description changed, or the session switched accounts. The description flow in this workspace saves the Curate entry. Inspect the designated Stock product afterward to see what actually propagated.

## 4. Apply and prove the exact Stock result

Verify the linked Stock holding in **Manage → Stock** using the product ID. The Stock editor calls the description field **Introduction**. A product created from captured material can inherit a description and images at creation. A later Curate description change is not evidence that the existing product copy changed. If approval covers this private product edit, compare the before/after and apply the approved text to **Introduction** on the same product when needed. Confirm the correct field by fresh read. Keep the rights-cleared hero and gallery, and verify any automatically carried images pass the same check. Never paste a private attachment URL into a customer field. If the product is already public, prepare the exact proposed edit for an explicit decision about live application.

Read the product on the intended phone. Verify description, actual approved tasting fields, image, name and locale. Leave its public visibility alone during a draft review. At separately approved listing or update, read the actual signed-out Shop listing and ensure it displays the chosen description and media with no raw transcripts, private source URLs, contact or purchase data. Preserve the prior copy as review evidence so an accidental change can be corrected. Record who approved what and the private product/reference IDs in the existing task or notes.

## Synthetic worked example

The following is invented test input for a fixture, not a claim about any listed tea.

- **Confirmed record:** the fixture packing slip identifies Rehearsal Oolong as a loose-leaf oolong from Pinglin, Taiwan. A separate fixture note confirms it was rolled before drying.
- **Unconfirmed:** a supplier mentioned a high-elevation garden without a lot-specific location. Leave the claim out.
- **Adrian's synthetic observation:** “Soft pear after the first pour.” If Adrian wants to publish those words in the fixture, place them in the chosen tasting field with his attribution. They do not become description copy.
- **Candidate About This Tea:** “Rehearsal Oolong is a loose-leaf oolong from Pinglin, Taiwan.

  The leaves were rolled before drying.”
- **Approval to request:** “Does that wording match your tea, and is the selected label-free photo the one you want readers to see?” The normal consent to write a private draft still leaves a distinct decision to list it.

Use the [tea record contract](../../docs/TEA_RECORD_CONNECTIONS.md) for source selection and stale review, the [consumer contract](../../docs/CURATE_CONSUMER_CONTRACT.md) for identity and visibility, the [Stock introduction editor](../../src/admin/components/ProductEditPanel.tsx) for the product write, and the [description fixture](../../worker/tests/curate-tea-description.test.ts) for provider behavior. Retest the whole handoff in the signed-out view before reporting the description as live.

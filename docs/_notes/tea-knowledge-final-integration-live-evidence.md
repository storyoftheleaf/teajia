# Tea knowledge final integration: live evidence

## Yi Bang importer rehearsal, 2026-08-08

Source:

`https://yunnansourcing.com/products/2025-yunnan-sourcing-yi-bang-wild-arbor-raw-pu-erh-tea-cake`

The live vendor page was read before the rehearsal. The factual paste contained the source URL, the full product name, raw pu-erh type, April 2025 first flush, Yi Bang village in northern Yiwu, primitive small-leaf wild-arbor material, Yunnan Sourcing producer and vendor wording, 250 g cake weight, USD 76 cake and USD 10.30 sample variants, a factual description, and processing notes covering copper-wok fixing, sun withering, hand rolling, sun drying, 40 kg stone pressing, low-temperature drying near 35 C, and post-press moisture dissipation.

The untouched live result did not reach review. `Start import` saved the draft, then returned `We couldn't analyze this record. Your pasted text is saved. Try again.` A single `Retry import` returned the same saved-error state. The browser console contained no errors or warnings.

Static inspection recorded before any implementation found a separate contract defect: `description` is represented end to end, but Curate import analysis has no `processingNotes` field in its output schema, decoder, canonical record, destination mapping, or review UI. The review row also withholds the stored source excerpt and field provenance, and producer is not visible for review. These gaps prevent the required untouched field verification even if the deployed analyzer succeeds.

No sourcing run or vendor was created. No finalization action was used. The failed draft was explicitly abandoned with Delete import before implementation began.

## Replacement rehearsal after deployment

The deployed Worker analyzed the same untouched paste with the deterministic record parser. The persisted replacement draft was reopened after the production frontend reloaded, then inspected without editing or saving the tea.

Verified fields:

- Name: `2025 Yunnan Sourcing "Yi Bang" Wild Arbor Raw Pu-erh Tea Cake`
- Category: tea
- Type: Sheng
- Year: 2025
- Origin country: China
- Origin region: `Yi Bang village, northern Yiwu, Mengla County, Xishuangbanna, Yunnan`
- Cultivar or plant wording: `primitive small-leaf population`
- Producer: `Yunnan Sourcing Brand Pu-erh`
- Vendor: `Yunnan Sourcing`, shown as the suggested vendor and not created
- Form and purchase: one 250 g cake at USD 76 per pack, not the 25 g sample
- Description: `Full-mouthed and pungently aromatic with the elegant power of Yi Bang's primitive small-leaf population. Bright orchard fruit, wildflower honey, fresh bamboo and citrus peel; clear yellow-gold liquor with a thick, viscous body; lively fruit over gentle grain and cane sweetness, measured young bitterness, long hui-gan and steady shengjin.`
- Processing notes: `Hand-picked; hand-fixed in a copper wok; sun-withered; hand-rolled; sun-dried; stone-pressed in Yiwu with 40 kg stone presses; finished with a low-temperature bake at approximately 35 C; held several weeks after pressing so residual moisture could dissipate.`
- Source excerpt: `From Yi Bang village in northern Yiwu, made entirely from wild-arbor trees roughly 60-80 years old. The Li family's matriarch hand-fixed the leaf in a copper wok, and picking and processing ran over a week at peak spring. Pressed into 250 g cakes in Yiwu using 40 kg stone presses, then finished with a low-temperature approximately 35 C bake.`
- Field provenance: Source fact was visible for the name, type, year, origin region, cultivar wording, producer, description and processing notes.

The browser check passed at 1440 by 900 and 390 by 844. Both widths had zero horizontal overflow and zero browser console entries. The derived Chinese name `乔木` was marked From base and is broader than the pasted plant wording; it was left untouched because it is not part of this bounded extraction repair.

The replacement draft was abandoned with Delete import after verification. The replacement import card disappeared, while the unrelated pre-existing 0/3 reviewed import remained. No product, inventory holding, receipt, vendor or sourcing run was created.

## Sensory-field alignment rehearsal after deployment

The production Worker and frontend were deployed again after the follow-up field-model review. The same exact 1,620-character Yi Bang paste was analyzed without edits. The live review again preserved the complete source description, processing notes and source excerpt, together with the producer, Sheng type, 2025 year, origin, plant wording, one 250 g cake and USD 76 per-pack price.

The deterministic parser routes the vendor's sensory claims into the existing product tasting structure as an unconfirmed `common` profile:

- Body: `full`
- Finish: `finish-long`, `hui-gan`, `salivating`
- Flavor: `floral`, `honey`, `fruity`, `citrus`, `fresh`, `sweet`, `bitter`
- Liquor color: `gold`
- Clarity: `clear`
- Hui gan: true

The exact-record regression verifies that the future product payload uses a neutral identity description, keeps processing notes separate, serializes this tasting profile into the existing `tasting` field and sets `tasting_source` to `common`. The importer cannot assign `owner` or `community`. The source description and excerpt remain unchanged on the audit record. No unsupported feeling or tang gan terms are inferred.

The visible live review passed at 1440 by 900 and 390 by 844 with zero horizontal overflow and zero browser console entries. The live draft was then abandoned with Delete import. The card disappeared. No review fields were saved, no import was finalized, and no product, inventory holding, receipt, vendor or sourcing run was created.

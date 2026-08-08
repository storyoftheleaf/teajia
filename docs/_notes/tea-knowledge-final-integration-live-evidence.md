# Tea knowledge final integration: live evidence

## Yi Bang importer rehearsal, 2026-08-08

Source:

`https://yunnansourcing.com/products/2025-yunnan-sourcing-yi-bang-wild-arbor-raw-pu-erh-tea-cake`

The live vendor page was read before the rehearsal. The factual paste contained the source URL, the full product name, raw pu-erh type, April 2025 first flush, Yi Bang village in northern Yiwu, primitive small-leaf wild-arbor material, Yunnan Sourcing producer and vendor wording, 250 g cake weight, USD 76 cake and USD 10.30 sample variants, a factual description, and processing notes covering copper-wok fixing, sun withering, hand rolling, sun drying, 40 kg stone pressing, low-temperature drying near 35 C, and post-press moisture dissipation.

The untouched live result did not reach review. `Start import` saved the draft, then returned `We couldn't analyze this record. Your pasted text is saved. Try again.` A single `Retry import` returned the same saved-error state. The browser console contained no errors or warnings.

Static inspection recorded before any implementation found a separate contract defect: `description` is represented end to end, but Curate import analysis has no `processingNotes` field in its output schema, decoder, canonical record, destination mapping, or review UI. The review row also withholds the stored source excerpt and field provenance, and producer is not visible for review. These gaps prevent the required untouched field verification even if the deployed analyzer succeeds.

No sourcing run or vendor was created. No finalization action was used. The failed draft was explicitly abandoned with Delete import before implementation began.

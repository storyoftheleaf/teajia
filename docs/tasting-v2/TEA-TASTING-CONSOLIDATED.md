# Tea tasting — consolidated selections and content rules

Updated 22 October 2026. Content handoff for the unified tasting thread. No UI or production changes are authorized by this document. This file is the consolidated reading entry point; immutable copies of the inputs are beside it in `sources/`.

## Current interface amendment — separate aroma and flavor

22 October 2026: the section previously titled Feel now displays **Body & texture**, described as body, texture, salivation, drying and throat sensations. Internal `feel` keys remain stable.

Flavor & aroma contains separate **Aroma** and **Flavor** wheel views, using the same vocabulary but independent selections and per-note intensity/timing/comments. Each view retains its family position while switching. Basic tastes, returning sweetness and aftertaste belong to Flavor. An explicit **Copy aroma notes to flavor** action adds only missing note names, without overwriting existing flavor notes or copying intensity/timing/comments. Future edits and removals remain independent. This supersedes the older per-note Aroma/Taste/Both entry workflow below.

Existing explicitly located Aroma/Both records are preserved in the corresponding views; earlier unspecified notes remain in their original Flavor record without inventing aroma selections. Original source documents remain unchanged.

## 1. Authority and resolved conflicts

The user's latest decisions in **Research tea tasting framework** control assessment and visibility. Taste.md supplies sensory meaning. The wheel's vocabulary and profiles supply its content and attribution. The unmodified original Taste.md is embedded at the end for preservation; where it conflicts with the following rules, these rules take precedence.

- Overall: Exceptional — One of the better teas I’ve had; Good — A tea I’d happily return to; Average — Fine, but nothing stands out; Disappointing — Something detracts from the experience. Optional personal judgment, never computed from intensity or number of selections.
- Four sections: Flavor & aroma / Feel / Energy / Storage.
- Strength: a strong point for me. Weakness: something detracts. Both: Strength and Weakness selected together. Ordinary: neither a notable strength nor flaw. Unmarked defaults to Undecided for navigation; do not manufacture a recorded assessment from absence.
- Ordinary sections do not enter guided exploration. Undecided has access to all vocabulary. Changing assessment changes suggestions, never deletes observations or details.
- No forced completeness, automatic selections, or inferred quality. A selection has no default intensity.
- This content does not request UI changes, accordions or a new interaction. Preserve the existing approved shell.

## 2. Reading the visibility tables

**S** = shown for Strength. **W** = shown for Weakness. **S+W** = shown in either single assessment. **Both always shows the union**, deduplicated. Undecided shows all. Ordinary does not show a guided section; its previous data remains stored.

Visibility means relevance, not an automatic appraisal of the selected observation. S+W qualities belong in a descriptively named group, not under an automatic “Positive” or “Drawbacks” label. The wheel is a descriptive browser: all families and notes remain available regardless of assessment. Flavor expression prompts can be filtered separately.

Existing selections hidden by a filter remain in the saved record. Custom language is always allowed in an explored section. An observation may optionally be marked welcome/unwelcome if useful, but it is not required. Intensity never means quality.

## 3. Flavor & aroma

The smells and flavors of the tea, basic tastes, and what remains or develops after swallowing. All family and note selections below show for S+W and Both. These are comparisons, not ingredients. Selecting a child does not automatically select its family.

| Family | Description | Specific selections |
|---|---|---|
| Floral | Resembling fresh or dried flowers. | Orchid · Jasmine · Rose · Osmanthus · Orange blossom · Dried flowers |
| Fresh fruit | Resembling fresh fruit or its peel. | Peach · Apricot · Plum · Apple · Pear · Lychee · Citrus peel · Berry |
| Dried fruit | Resembling fruit after drying or concentrating. | Raisin · Date · Fig · Prune · Dried apricot · Dried longan |
| Sweet & creamy aromas | Honey-like, sugar-like, or creamy aromas, whether or not the sip tastes sweet. | Honey · Caramel · Brown sugar · Molasses · Vanilla · Cream |
| Nuts & grain | Resembling nuts, cereals, or bread. | Chestnut · Almond · Walnut · Sesame · Toasted rice · Malt · Bread crust |
| Roast & cocoa | Roasted, smoky, or cocoa-like character. | Roasted · Charcoal · Cocoa · Smoke · Burnt |
| Vegetal | Resembling green plants, vegetables, or dried grasses. | Fresh grass · Leafy greens · Pea · Green bean · Seaweed · Hay |
| Herbs & spice | Resembling culinary herbs or spices. | Mint · Dried herbs · Cinnamon · Clove · Ginger · Pepper · Anise |
| Wood & resin | Resembling wood, resin, or incense. | Dry wood · Cedar · Sandalwood · Pine resin · Camphor · Incense |
| Earth & fungi | Earthy, mushroom-like, or leathery associations. | Mushroom · Leather |
| Stone & metal | Stone-like or metallic sensory comparisons. | Wet stone · Chalk · Metallic |

Broad Earth & fungi records **Earthy**; broad Stone & metal records **Mineral-like**. Other families can be recorded by their family name. Familiar notes mean “resembles [named reference]”; definitions below clarify the less familiar or ambiguous terms.

| Term | Description |
|---|---|
| Osmanthus | Fragrant flower often compared with apricot. |
| Dried longan | Dried fruit with a sweet, dark-fruit association. |
| Camphor | Sharp, aromatic wood-like association; not a claim camphor is present. |
| Roasted | Browned or toasted-food association. |
| Charcoal | Dry charcoal association. |
| Smoke | Fire-smoke association. |
| Burnt | Scorched-food association; typically a drawback, but remains available in the descriptive wheel. |
| Chalk | Chalk-like flavor; physical powderiness or grittiness belongs in Feel. |
| Mineral-like | Stone/metal sensory comparison; no claim about mineral content or origin. |

| Group | Selections and meanings | Visibility | Selection rule |
|---|---|---|---|
| Basic tastes | Sweet: sugar-like; Bitter: bitter taste; Sour/tart: acidic/tangy; Umami: savory/broth-like; Salty: salt-like | S+W | Multiple |
| Clarity | Distinct: individual impressions recognizable | S | One clarity answer |
| Clarity | Hard to distinguish: impressions difficult to separate | W | One clarity answer |
| Complexity | Several layers: several distinguishable impressions; One main character: one dominant impression | S+W | One complexity answer; neither inherently better |
| Harmony | Work together: flavors fit harmoniously | S | One harmony answer |
| Harmony | Clash: elements conflict | W | One harmony answer |
| Returning sweetness · Hui gan | Not noticed / Subtle / Moderate / Pronounced; sweetness appears or becomes clearer after swallowing | S+W | One optional answer |
| Aftertaste duration | Brief: fades soon / Moderate: remains a while / Lingering: remains well afterwards | S+W | One optional answer |

Returning sweetness differs from sweetness merely remaining. Aftertaste reuses an existing taste/flavor observation with its timing, not a duplicate “sweet finish” entry. Savory is a search synonym for Umami; astringency belongs in Feel.

Per-note details, optional and shown in all assessments: **Where: Aroma / Taste / Both** (basic tastes: Taste only); **Intensity: Subtle / Moderate / Pronounced**; **When: Early / Middle / Late / Aftertaste** (multiple moments allowed). Intensity/location describe the individual note, not the entire section. Do not use the Feel/Energy/Storage observation intensity interaction for the wheel by implication.

## 4. Feel

Weight, texture and physical sensations in the mouth and throat.

| Group | Selection | Description | Visibility |
|---|---|---|---|
| Body | Light / Medium / Full | Little / intermediate / substantial weight in the liquid; Light is not automatically watery | S+W |
| Texture | Smooth | Little friction or roughness | S |
| Texture | Rough | Noticeable friction or unevenness | W |
| Texture | Oily | Slick, lubricating sensation; does not claim actual oil | S+W |
| Coating | Not noticed / Noticeable | Whether a layer-like sensation remains after swallowing | S+W |
| Drying | Not noticed / Slight / Moderate / Strong | Whether and how much mouth or throat feels drier | S+W |
| Salivation · Sheng jin | Not noticed / Gentle / Abundant | No detected increase / some / much more mouth-watering | S+W |
| Throat comfort | Comfortable | Swallowing and the throat feel comfortable | S |
| Throat comfort | Irritated | Uncomfortable irritation during or after swallowing | W |
| Throat comfort | Tight | A constricted or tightening throat sensation | W |
| Local sensations | Cooling / Warming / Tingling / Numbing | Coolness, warmth, tingles or reduced sensation in mouth/throat | S+W |

Body, coating, drying and salivation each take one answer for the moment described. Textures and local sensations can coexist. Throat descriptions may coexist at different places/moments; do not erase a mixed experience. Drying and salivation can coexist. Oily is not Coating; Smooth does not imply either.

Optional observation detail: Mouth / Throat / Both; intensity Slight / Moderate / Strong; timing Early / Middle / Late / After drinking; persistence Brief / Moderate / Lingering. Timing labels are a proposed normalization for local sensations, not a newly approved UI control. Avoid a second intensity question when drying already records one.

## 5. Energy

Subjective felt state during and after the tea, sometimes called cha qi. Describes experience, not proof tea alone caused it.

| Group | Selection | Description | Visibility |
|---|---|---|---|
| Mental clarity | Clear-headed | Thinking feels less muddled | S |
| Mental clarity | Foggy | Thinking feels muddled or less clear | W |
| Attention | Focused | Easier to stay with one thing | S |
| Attention | Distracted | Attention keeps wandering | W |
| Mood | Calm | Feeling settled or at ease | S+W |
| Mood | Uplifted | Mood feels lighter or brighter | S |
| Mood | Restless | Difficulty settling | W |
| Activation | Energized | More activated or ready to act | S+W |
| Activation | Drowsy | Sleepy or less alert; may be welcome | S+W |
| Physical sensations | Warmth / Coolness / Tingling | Whole-body sensations, distinct from mouth/throat sensations | S+W |
| Physical sensations | Jittery | Shaky or uncomfortably overstimulated | W |
| Physical sensations | Stomach discomfort | Uncomfortable stomach sensation | W |
| Explicit absence | No clear change | No change noticed during the period described; not an intensity of zero | S+W |

Multiple observations may coexist: Calm and Energized, Clear-headed and Distracted, or changes at different moments. No clear change must not silently delete earlier descriptions; qualify or revise the time period.

Per-observation intensity: Slight / Moderate / Strong. Whole-energy optional development, visible for S+W and Both:

| Question | Selections | Meaning |
|---|---|---|
| When did it start? | While drinking / After drinking | Onset |
| How did it change? | Stayed steady / Built gradually / Came in waves | Progression |
| How long did it last? | Brief / Sustained / Long-lasting | Subjective duration, not measured thresholds |
| Ongoing? | Still feeling it | Still present at recording; eventual duration unknown |

One answer per question, independently optional; ongoing is separate. These are the current mockup’s approved labels, overriding different duration wording in the source. No style-based energy presets or inferred caffeine, age, provenance, therapeutic effects or mechanism.

## 6. Storage

Sensory character associated by the person with storage. Not proof of age, humidity, contamination, location or safety.

| Group | Selection | Description | Visibility |
|---|---|---|---|
| Recognizable character | Dry wood | Dry woody aroma/flavor association | S+W |
| Recognizable character | Camphor | Sharp aromatic wood-like association | S+W |
| Recognizable character | Incense | Incense-like aroma | S+W |
| Recognizable character | Leather | Leather-like association | S+W |
| Recognizable character | Earthy | Broad earth-like association | S+W |
| Recognizable character | Mushroom | Mushroom-like association | S+W |
| Recognizable character | Smoke | Fire-smoke association | S+W |
| Other aromas | Musty | Closed, stale, damp-room/fabric association; not a mold diagnosis | S+W |
| Other aromas | Paper/cardboard-like | Paper, old books or cardboard; dry/damp nuance may be personal wording | S+W |
| Other aromas | Ferment-like aroma | Fermented-material association; does not establish its cause | S+W |
| Other aromas | Fishy | Fish-like aroma association | W |
| Other aromas | Perfume-like | Perfume association, distinct from simply floral | W |
| Other aromas | Plastic-like | Plastic association; does not prove packaging caused it | W |
| Unidentified | Other unfamiliar odor | An odor the person cannot name; do not automatically add beside a named odor | S+W |
| Explicit absence | No distinct storage character | None detected; not certification of cleanliness | S+W |
| Effect on other character | Leaves it clear | Other tea character remains discernible | S |
| Effect on other character | Partly masks it | Some other character is obscured | W |
| Effect on other character | Mostly masks it | Much of the other character is obscured | W |

Multiple aroma observations; one optional masking answer for the character being described. Intensity Slight / Moderate / Strong is independent of masking. Musty is context-dependent per the vocabulary source, not automatically a flaw. Fishy and Perfume-like are editorial drawback defaults, not universal judgments; personal descriptions remain possible in any assessment.

Reuse the same sensory meaning as Flavor; add a storage association only when the person makes it. Do not duplicate the observation or infer storage merely from Wood/Earthy/Camphor. Sour taste remains Sour/tart in Flavor even when associated with storage.

**Do not reintroduce Clears / Softens / Persists / Becomes more apparent as controls.** They remain preserved in the historical source but were rejected for this construct.

## 7. Personal wording and existing records

Keep custom wording available in every explored section and preserve all existing selections verbatim. Standard options simplify future selection, not historical records. The list below retains current mockup terms and source-document refinements without presenting all as competing standard buttons.

| Area | Preserved wording | Guidance |
|---|---|---|
| Flavor/expression | Fragrant, Muted, Clear definition, Layered, Integrated, Rich, Harsh bitterness, Unbalanced, Unpleasant aftertaste, Light roast, Toasted, Dark chocolate, Forest floor, Slate | Related search terms may suggest standards; never silently relabel saved observations. Fragrant/Muted concern intensity, Layered complexity, Integrated flavor harmony. |
| Feel | Silky, Velvety, Creamy, Soft, Coarse, Gritty, Watery, Puckering, Astringent, Scratchy, Catching, Dry throat, Opening, Throat opens, Smooth passage, Salivating, Tightness | Preserve nuance. Opening is not implied by Comfortable; Watery is not Light. |
| Legacy combined label | Oily/coating | Preserve the original record; future selections split Oily and Coating. Do not infer that both were noticed. |
| Energy | Present, Contemplative, Spacious, Grounded, Tense, Drained, Heaviness, Lightness, Relaxation, Chest sensation, Comfortably warming, Uncomfortable heaviness | Personal descriptions, not automatic translations into Calm or Energized. |
| Storage | Pleasant aged character, Clean woodiness, Well integrated, Preserved freshness, Damp cardboard, Stale/flat, Sour/ferment-like, Foreign odor, Overwhelming storage, Earth, Forest floor, Cellar-like, Old books/paper, Smoky carryover, Perfumed carryover, Packaging-like | Preserve old labels. Do not silently turn a generic packaging odor into Plastic, or Sour/ferment-like into a purely aromatic observation. |

For legacy suggestion sets only: Tense, Drained, Scratchy, Catching, Tightness, Uncomfortable heaviness, Harsh bitterness, Unbalanced, Unpleasant aftertaste, Stale/flat and Overwhelming storage are drawback-oriented; Pleasant aged character, Preserved freshness and Comfortably warming are strength-oriented. Other personal wording is context-dependent. Both shows their union if legacy suggestions are retained. None must be forced back into the standard list.

Presence, amount and preference remain separate. Optional “Less than I wanted” and “Too much for me” qualify a named quantity such as sweetness, body or drying; they are not universal suffixes for every descriptor. “Less sweetness than I wanted” does not automatically select Sweet as detected.

## 8. Tea-style starting words

Editorial suggestions, never preselected observations or requirements. All flavor words remain accessible. Use recorded tea style, not a guess from its name, date or price. Generic Oolong uses broad families; unknown style stays neutral. No energy/storage assessment presets.

| Recorded style | Starting selections |
|---|---|
| Pan-fired green | Chestnut · Toasted rice · Green bean · Fresh grass · Floral |
| Steamed green | Seaweed · Leafy greens · Fresh grass · Umami · Sweet |
| Yellow | Chestnut · Hay · Honey · Sweet · Floral |
| Young white | Floral · Hay · Honey · Pear · Sweet |
| Mature white | Date · Dried apricot · Honey · Dried herbs · Dry wood |
| Light oolong | Orchid · Jasmine · Cream · Peach · Pear |
| Roasted oolong / Wuyi | Roasted · Charcoal · Walnut · Cocoa · Cinnamon · Wet stone |
| Dancong | Orchid · Osmanthus · Honey · Peach · Citrus peel |
| More oxidized / bug-bitten oolong | Honey · Fresh fruit · Raisin · Peach · Floral |
| Red / black | Malt · Honey · Cocoa · Dried fruit · Brown sugar |
| Young sheng | Floral · Fresh grass · Apricot · Honey · Bitter |
| Mature sheng | Dry wood · Camphor · Incense · Dried fruit · Earthy |
| Shou | Earthy · Mushroom · Dry wood · Date · Cocoa |
| Other dark tea | Earthy · Mushroom · Dry wood · Leather · Dried herbs |

## 9. Reference profiles and evidence

The wheel also contains attributed demonstration reference profiles. These must remain distinct from editorial starting words and the drinker’s observations. Their exact snapshot is embedded below; its “expert” key is source metadata, not proof that every tea has those flavors. The source attribution is retained, not independently revalidated in this consolidation. Roasted Dongding is a roasted ball-style oolong: do not relabel it Wuyi merely because both share an editorial starting set.

```json
{
  "demo_teas": [
    {
      "id": "unknown",
      "name": "Unspecified tea",
      "style": "Unknown style"
    },
    {
      "id": "paochong",
      "name": "Wenshan Paochong",
      "style": "Light oolong",
      "expert": [
        "Floral",
        "Sweet"
      ]
    },
    {
      "id": "beauty",
      "name": "Oriental Beauty",
      "style": "More oxidized / bug-bitten oolong",
      "expert": [
        "Honey",
        "Fresh fruit"
      ]
    },
    {
      "id": "dongding",
      "name": "Roasted Dongding",
      "style": "Roasted oolong / Wuyi",
      "expert": [
        "Roasted",
        "Nuts & grain",
        "Sweet"
      ],
      "classification": "Roasted ball-style oolong"
    },
    {
      "id": "light",
      "name": "Light oolong",
      "style": "Light oolong"
    },
    {
      "id": "wuyi",
      "name": "Wuyi rock oolong",
      "style": "Roasted oolong / Wuyi"
    },
    {
      "id": "dancong",
      "name": "Dancong",
      "style": "Dancong"
    },
    {
      "id": "green",
      "name": "Pan-fired green tea",
      "style": "Pan-fired green"
    },
    {
      "id": "steamed",
      "name": "Steamed green tea",
      "style": "Steamed green"
    },
    {
      "id": "yellow",
      "name": "Yellow tea",
      "style": "Yellow"
    },
    {
      "id": "white",
      "name": "Young white tea",
      "style": "Young white"
    },
    {
      "id": "agedwhite",
      "name": "Mature white tea",
      "style": "Mature white"
    },
    {
      "id": "black",
      "name": "Red / black tea",
      "style": "Red / black"
    },
    {
      "id": "sheng",
      "name": "Young sheng",
      "style": "Young sheng"
    },
    {
      "id": "agedsheng",
      "name": "Mature sheng",
      "style": "Mature sheng"
    },
    {
      "id": "shou",
      "name": "Shou puer",
      "style": "Shou"
    },
    {
      "id": "dark",
      "name": "Other dark tea",
      "style": "Other dark tea"
    },
    {
      "id": "oolong",
      "name": "Oolong · unspecified",
      "style": "Oolong · unspecified"
    }
  ],
  "expert_source": {
    "url": "https://pmc.ncbi.nlm.nih.gov/articles/PMC8070119/",
    "scope": "Taiwan specialty teas only; Appendix A and section 3.3; UI words are adapted to Taste vocabulary."
  },
  "other_profiles": "Editorial suggestions from Taste.md; not labeled expert profiles."
}
```

## 10. Optional whole-session study and context

These apply to the whole tea, independent of section assessment; do not bury them in Energy or Flavor.

| Group | Selections | Description |
|---|---|---|
| Endurance | Fades early / Holds across infusions / Still going when I stopped | How satisfying presence holds through the session |
| Development | Opens gradually / Changes distinctly / Stays steady / Peaks then fades | Whole-tea development across infusions, distinct from energy progression |
| Coherence | Integrated / Uneven / Disjointed | How aroma, taste, feel and the complete experience fit together |

One optional answer per group for the period described. Infusion count optional. Brewing context: dose, vessel volume, vessel, temperature, water, timing, infusions tasted. Personal starting state, food and other caffeine optional. These are context, never quality scores. Preserve private notes and voice-note entry points in the existing construct; this document adds no recording functionality.

## 11. Sources, preservation and handoff

Consolidation is a product content proposal, not a validated scientific scale. The source’s references and caveats remain in the appendix. No new web research was performed; attribution has been preserved exactly where available.

Source chats:
- Research tea tasting framework — 01a15e1e-b940-7c80-84bf-62aad86f2c8c (latest user decisions).
- Tea tasting vocabulary and selection… — 01a15ea9-82a0-7531-aa19-428c55510418 (sensory content).
- Taste — flavor wheel screen — 01a15f07-7b17-77c2-b74c-b49980822cf3 (wheel content and profiles).
- Destination: Tea tasting — unified experience — 01a161f7-8d3a-7672-9c8c-c72811fb20b0.

Preserved alongside this file:
- [Taste.md](sources/Taste.md) — original `/Users/adrianrasmussen/.codex/visualizations/2026/10/21/01a15ea9-82a0-7531-aa19-428c55510418/Taste.md`.
- [vocabulary.json](sources/vocabulary.json) — original `/Users/adrianrasmussen/Documents/Codex/2026-10-21/taste-flavor-wheel/outputs/vocabulary.json`.
- [tea-starting-points.json](sources/tea-starting-points.json) — original `/Users/adrianrasmussen/Documents/Codex/2026-10-21/taste-flavor-wheel/outputs/tea-starting-points.json`.
- [reference-profiles.json](sources/reference-profiles.json) — original `/Users/adrianrasmussen/Documents/Codex/2026-10-21/taste-flavor-wheel/outputs/reference-profiles.json`.
- [interaction-brief.md](sources/interaction-brief.md) — original `/Users/adrianrasmussen/Documents/Codex/2026-10-21/taste-flavor-wheel/outputs/interaction-brief.md`.
- [design-findings.md](sources/design-findings.md) — original `/Users/adrianrasmussen/Documents/Codex/2026-10-21/taste-flavor-wheel/outputs/design-findings.md`.

The vocabulary JSON is the wheel’s 11-family list. tea-starting-points.json preserves all 14 style suggestions. reference-profiles.json preserves demo-tea classification and research attribution. interaction-brief.md and design-findings.md preserve rationale; they are background, not authorization to override latest user decisions. Source snapshots and hashes are recorded in sources/manifest.json.

Live visual prototypes remain at their original paths; they are not additional vocabulary authorities:
- Current shell: ../tasting-assess-explore.html
- Wheel: /Users/adrianrasmussen/Documents/Codex/2026-10-21/taste-flavor-wheel/outputs/flavor-aroma.html
- Palette study: /Users/adrianrasmussen/Documents/Codex/2026-10-21/taste-flavor-wheel/outputs/color-directions.html

Do not import work/before-*.html or older mockups as competing lists. They are historical implementations. The wheel palette remains its own design decision. Review future source changes against the preserved snapshots before updating this reference; never assume a live file still matches this version.

Integration checks: Both works; hidden selections survive; ordinary skips exploration; all neutral descriptors remain usable under either appraisal; no preset becomes an observation; Oily and Coating remain distinct; note-specific intensity stays note-specific; missing stays missing; personal wording survives. Preserve all source files.

## Appendix A — original vocabulary document (historical source, verbatim)

The following is preserved for completeness and source attribution. Its conflicting assessment/visibility directives are superseded by sections 1–2 above. Its across-infusion storage controls are excluded. Its research links are inherited sources, not newly checked claims.

---

# Taste

A standalone foundation for describing and studying tea.

Status: proposed content specification for a separate build. This document defines the language and its meaning; screen design belongs to a separate brief. It does not authorize changes to Teajia.

Content revision: 21 October 2026 — all four sections reviewed for beginner clarity; Oily retained as a standard texture.

## 1. Purpose

Help someone describe what they experienced, understand the words they choose, and recognize patterns over time.

A short record should still be useful. A detailed record should add precision without making the person learn a specialist vocabulary first. Familiar words come first; traditional terms explain a useful distinction rather than acting as a test of expertise.

The four sections are:

| Section | The question it answers |
|---|---|
| Flavor & aroma | What do I smell and taste, including what remains afterwards? |
| Feel | What does the tea feel like in my mouth and throat? |
| Energy | What do I notice in my state during and after the session? |
| Storage | What sensory character do I associate with the tea's storage? |

No section substitutes for another. Beautiful aroma does not establish substantial body. Powerful energy does not establish quality. Earthy character does not establish poor storage.

## 2. Three separate kinds of information

### Overall impression

Optional, personal, and independent of the individual sections.

| Impression | Meaning |
|---|---|
| Exceptional | One of the better teas I’ve had. |
| Good | A tea I’d happily return to. |
| Average | Fine, but nothing stands out. |
| Disappointing | Something detracts from the experience. |

Do not calculate this from the number of positive words, the intensity of an experience, or an average of section judgments.

### One assessment per section

| Assessment | Meaning |
|---|---|
| Strength | This is a strong point of the tea for me. |
| Ordinary | This is neither a strong point nor a flaw. |
| Weakness | Something here detracts from the experience. |
| Undecided | I am not ready to judge this aspect. |

Untouched means no assessment was recorded. It is different from Ordinary and Undecided.

Strength and Weakness cannot both be the assessment of the same section. However, its observations may describe positives and drawbacks together. An assessment is the person's judgment of the section overall, not a claim that every detail agrees.

Ordinary means neither a notable strength nor a notable flaw; it is not an arithmetic balance of positives and negatives. Choose Undecided if their balance is still unclear.

### Observations

An observation names an experience: orchid aroma, full body, scratchiness, calmness, a cellar-like impression.

When useful, the person can identify an observation as a positive, a drawback, or simply something noticed. Do not infer that appraisal from the word or require it for every observation.

Three distinctions matter:

- **Presence:** I notice bitterness.
- **Intensity:** The bitterness is pronounced.
- **Appraisal:** The bitterness contributes structure, or there is too much of it for me.

These are different answers. Strong is never a synonym for good.

## 3. How much vocabulary belongs here

Use a small set of understandable groups with enough specific words to describe meaningful differences. Avoid long ladders of near-synonyms and rare references that exist mainly to sound knowledgeable.

Each flavor family is a valid observation in its own right. “Floral” is enough; someone does not have to identify a flower. Specific notes add precision when the person recognizes them.

Common words such as honey and peach do not need definitions. Ambiguous, tactile, interpretive, and traditional terms do. Definitions should normally fit in one sentence.

The option sets below form the initial vocabulary. Custom wording is equally valid. Add a standard term when real use shows a recurring distinction, rather than trying to anticipate every tea.

**Beginner test:** keep choices that describe a useful, understandable difference. Different aspects should answer different questions; choices within an aspect should be distinguishable by a familiar example or a short explanation. A longer definition alone does not justify near-synonyms. Simplification must not erase a distinct sensation: Oily, for example, is not the same as Smooth or Coating. Personal wording adds finer nuance without an expandable Basic/Advanced interface.

Use three levels of description: **section → group → observation**. A specific flavor note refines its family; it is not a fourth required level. “Floral” and “Orchid” may coexist if deliberately recorded, but the family is never automatically added or counted as a second observation. Do not treat more words as a more complete or better tasting.

Observations can be combined unless they answer the same single-choice question. Overall impression, section assessment, body weight, and each optional intensity or duration accept one answer for the moment being described. Different moments can have different answers. Missing detail stays unknown; selecting a word supplies no default intensity, timing, or appraisal.

Shared scales are subjective: **Subtle** is faint, **Moderate** clearly noticeable, and **Pronounced** prominent. For duration, **Brief** fades soon, **Moderate** stays for a while, and **Lingering** remains well afterwards. They are comparisons within a person's experience, not fixed measurements.

## 4. Flavor & aroma

**Description:** The smells and flavors of the tea, its basic tastes, and what remains or develops after swallowing.

### Flavor families and notes

These are sensory comparisons, not claims that an ingredient was added.

| Family | Plain description | Specific notes |
|---|---|---|
| Floral | Resembling fresh or dried flowers. | Orchid, Jasmine, Rose, Osmanthus, Orange blossom, Dried flowers |
| Fresh fruit | Resembling fresh fruit or its peel. | Peach, Apricot, Plum, Apple, Pear, Lychee, Citrus peel, Berry |
| Dried fruit | Resembling fruit after drying or concentrating. | Raisin, Date, Fig, Prune, Dried apricot, Dried longan |
| Sweet & creamy aromas | Honey-like, sugar-like, or creamy aromas, whether or not the sip tastes sweet. | Honey, Caramel, Brown sugar, Molasses, Vanilla, Cream |
| Nuts & grain | Resembling nuts, cereals, or bread. | Chestnut, Almond, Walnut, Sesame, Toasted rice, Malt, Bread crust |
| Roast & cocoa | Roasted, smoky, or cocoa-like character. | Roasted, Charcoal, Cocoa, Smoke, Burnt |
| Vegetal | Resembling green plants, vegetables, or dried grasses. | Fresh grass, Leafy greens, Pea, Green bean, Seaweed, Hay |
| Herbs & spice | Resembling culinary herbs or spices. | Mint, Dried herbs, Cinnamon, Clove, Ginger, Pepper, Anise |
| Wood & resin | Resembling wood, resin, or incense. | Dry wood, Cedar, Sandalwood, Pine resin, Camphor, Incense |
| Earth & fungi | Earthy, mushroom-like, or leathery associations. | Mushroom, Leather |
| Stone & metal | Stone-like or metallic sensory comparisons. | Wet stone, Chalk, Metallic |

Every family can be recorded broadly. Earthy is the broad observation for Earth & fungi, not another child to select alongside it. “Mineral-like” is the plain broad label for Stone & metal; it does not establish mineral content, soil chemistry, or origin. Toasted, Dark chocolate, Forest floor, and Slate remain valid personal descriptions, rather than competing standard choices beside Roasted, Cocoa, Earthy, and Wet stone. Search can connect related language without silently replacing what someone wrote.

Keep useful distinctions with short references: **Roasted** resembles browned or toasted food; **Charcoal** resembles a dry charcoal association; **Smoke** resembles fire smoke; **Burnt** resembles scorched food. They may overlap, but are not just degrees of intensity. If a person cannot separate them, the broad Roast & cocoa observation is sufficient. **Chalk** is a chalk-like flavor association here; a powdery or gritty physical sensation belongs in Feel.

Less familiar references: **Osmanthus** is a small fragrant flower often compared with apricot; **dried longan** is a dried fruit with a sweet, dark fruit association; **camphor** is a sharp, aromatic wood-like association. These comparisons do not claim those substances are present. Anyone unfamiliar with a reference can use its broad family or their own words.

### Basic tastes

| Taste | Meaning |
|---|---|
| Sweet | Sugar-like taste in the sip. |
| Bitter | Bitter taste, whether welcome or unwelcome. |
| Sour / tart | Acidic or tangy taste. |
| Umami | A savory, broth-like taste. |
| Salty | Salt-like taste. |

Savory is a search synonym for Umami, not a competing duplicate. Astringency belongs in Feel because it describes drying or friction rather than a basic taste.

### Expression

These optional descriptions answer three different questions. They are not a checklist.

| Question | Options | Meaning |
|---|---|---|
| Can I make out the notes? | Distinct / Hard to distinguish | Whether individual impressions are recognizable. |
| How much is happening? | Several layers / One main character | Several distinguishable impressions, or one dominant character. Neither is automatically better. |
| Do the flavors fit together? | Work together / Clash | Whether the elements seem harmonious or conflicting. |

Fragrant and Muted need not compete with a separate intensity scale. Describe how noticeable the aroma is using Subtle / Moderate / Pronounced, or use personal wording if that scale does not fit.

### Returning sweetness and aftertaste

| Observation | Meaning |
|---|---|
| Returning sweetness · Hui gan | Sweetness appears or becomes clearer after swallowing, sometimes as bitterness fades. |
| Aftertaste | Any taste or aromatic impression that remains after swallowing. Use the existing taste or flavor word and identify it as aftertaste. |

Optional returning-sweetness descriptions: **Not noticed / Subtle / Moderate / Pronounced**.

Optional aftertaste duration: **Brief / Moderate / Lingering**.

“Sweet finish” means Sweet in the aftertaste; it does not need a duplicate standard term. Sweetness simply remaining is different from sweetness returning. Hui gan and Sweet return name the same concept. Neither initial bitterness nor a fixed waiting time is required.

“Not noticed” explicitly records an absence in this session. Leaving returning sweetness or aftertaste unrecorded says nothing about whether it occurred.

### Optional precision

For an individual flavor note:

- **Where noticed:** Aroma / Taste / Both.
- **Intensity:** Subtle / Moderate / Pronounced.
- **When noticed:** Early / Middle / Late / Aftertaste.

Here Aroma means what someone smells; Taste means the character perceived in the sip, including aromas experienced while drinking. Basic tastes only apply to taste. An unspecified location remains unspecified, rather than becoming Both.

A person can record pronounced orchid aroma and subtle fruit in the taste. Give details to the observation they describe, rather than assigning one intensity to the whole section.

## 5. Feel

**Description:** The weight, texture, and physical sensations of the tea in the mouth and throat.

Each group answers a different question. Close metaphors should not compete with broad descriptions, but genuinely different sensations remain available.

| Aspect | Plain question | Standard options |
|---|---|---|
| Body | Does the liquid feel light or substantial? | Light / Medium / Full |
| Texture | How does it move across the mouth? | Smooth, Rough, Oily |
| Coating | Does a sensation of a layer remain after swallowing? | Not noticed / Noticeable |
| Drying | Does the mouth or throat feel drier? | Not noticed / Subtle / Moderate / Pronounced |
| Salivation · Sheng jin | Does the mouth water more? | Not noticed / Gentle / Abundant |
| Throat comfort | How does the throat feel when swallowing or afterwards? | Comfortable / Irritated / Tight |
| Other local sensations | Is there another clear physical sensation? | Cooling, Warming, Tingling, Numbing |

**Body is substance; texture is friction and slickness; coating is what remains.** Smooth means little roughness; Rough means noticeable friction or unevenness; Oily means a slick, lubricating feel. These words do not claim actual oil is present. Smooth and Oily can coexist; they are not competing points on one scale. Roughness and oily slickness can also occur together, or at different moments.

A tea can be Full and Rough, or Light and Smooth. A coating can feel smooth, rough, or drying. Never assume Coating means Oily, Smooth, rich, or pleasant. Oily does not automatically imply a coating remains afterwards.

Drying and increased salivation can coexist. They answer different questions and may occur at different places or moments. Throat comfort also differs from mouth texture: a smooth-feeling sip can still irritate the throat.

Optional detail can identify **Mouth / Throat / Both**, timing, intensity, and persistence (**Brief / Moderate / Lingering**). Do not ask for a second copy of a drying or coating observation just to name its location. The standard choices describe the main impression; personal wording can describe changes or mixed sensations.

### Keep nuance without making synonyms compete

| Personal wording | How to handle it |
|---|---|
| Silky, Velvety, Creamy, Soft | Keep the person's words. Smooth is the broad standard observation when they mean low friction; do not force Creamy or Velvety into Smooth if they mean something else. |
| Coarse, Gritty | Rough is enough for the broad standard observation. Preserve the finer description without counting it as another independent quality. |
| Watery | A personal description of insufficient substance. Do not equate it automatically with Light, which can be satisfying. |
| Puckering, Astringent | Personal refinements of drying/tightening sensations. Astringency is searchable language, not another required choice beside Drying. |
| Scratchy, Catching, Dry throat | Preserve the wording; Irritated is the broad comfort description when it fits. Dry throat can instead be Drying with Throat as its location. |
| Opening, Throat opens | Preserve a felt relaxation or spaciousness. Comfortable alone does not imply Opening; the specific experience remains recordable in the person's own words. |

These are descriptions, not automatic translations or medical findings. Tang gan, or liquor feel, is covered by body and texture; it does not need another yes/no judgment. Exclude the ambiguous label Taut.

## 6. Energy

**Description:** The person's felt state during and after the session. Sometimes discussed as cha qi.

The question is “What changed in how I felt?” This records an experience without claiming that tea alone caused it.

| Aspect | Plain question | Standard options |
|---|---|---|
| Mental clarity | Does thinking feel clear or muddled? | Clear-headed, Foggy |
| Attention | Is it easier or harder to stay with one thing? | Focused, Distracted |
| Mood | How does my mood feel? | Calm, Uplifted, Restless |
| Activation | Do I feel more activated or sleepy? | Energized, Drowsy |
| In the body | What physical change do I notice? | Warmth, Coolness, Tingling, Jittery, Stomach discomfort |
| Explicit absence | Have I noticed a change? | No clear change |

Definitions where ordinary language may not be enough:

| Word | Meaning |
|---|---|
| Clear-headed | Thinking feels less muddled. |
| Focused | It is easier to keep attention on one thing. |
| Distracted | Attention keeps wandering. |
| Uplifted | Mood feels lighter or brighter. |
| Energized | More activated or ready to act. |
| Restless | Difficulty settling. |
| Jittery | Shaky or uncomfortably overstimulated. |

Clear-headed and Focused answer different questions: clear thinking does not guarantee steady attention. Restless means difficulty settling; Jittery specifically names a shaky or overstimulated physical feeling. Keep Present, Contemplative, Spacious, Grounded, Tense, Drained, Heaviness, Lightness, Relaxation, and chest sensations available as personal wording rather than a dense set of overlapping standard choices. Do not automatically translate them into Calm or Energized.

Optional details:

- **Intensity:** Subtle / Moderate / Pronounced.
- **Onset:** While drinking / After drinking.
- **Development:** Stays steady / Builds gradually / Comes in waves.
- **Duration:** Brief / Moderate / Lingering. A note can say it was still present when recording stopped; do not guess its eventual duration.

Calm and Energized can coexist. Drowsiness, heaviness, or powerful activation can be welcome or unwelcome. No clear change applies to the period described; if a change emerges later, qualify the timing or revise the observation. Do not silently delete earlier descriptions.

Mouth/throat cooling belongs in Feel; whole-body coolness belongs here. Qualify the location when the same word could mean either.

Do not infer caffeine dose, tree age, provenance, pesticide cleanliness, therapeutic benefits, or an energy mechanism from these observations. No clear change is an explicit answer; an untouched section records no answer.

## 7. Storage

**Description:** Sensory character that the person associates with storage, including character they welcome and character they dislike.

This is an interpretive lens. It cannot independently establish age, storage location, humidity, contamination, or safety.

| Group | Standard observations |
|---|---|
| Shared with flavor | Dry wood, Camphor, Incense, Leather, Earthy, Mushroom, Smoke |
| Other aroma associations | Musty, Paper / cardboard-like, Ferment-like aroma, Fishy, Perfume-like, Plastic-like |
| An odor I cannot name | Other unfamiliar odor |
| Explicit absence | No distinct storage character |

The shared words keep their flavor meanings. Storage adds the person's association with storage, not a new copy of the sensation. Smoke does not become a second “Smoky carryover” observation just because the person thinks it was picked up in storage.

| Term | Meaning |
|---|---|
| Musty | Resembles a closed, stale, damp room or fabric. A sensory comparison, not a mold diagnosis. |
| Paper / cardboard-like | Resembles paper, old books, or cardboard. Personal wording can specify dry, damp, or another nuance. It need not also be Musty. |
| Ferment-like aroma | Resembles fermented material; does not establish the process responsible. Sour taste remains Sour / tart under Flavor & aroma and may carry a storage association. |
| Perfume-like | Resembles perfume; differs from simply recognizing a flower in the aroma. Its source remains unconfirmed. |
| Plastic-like | Resembles plastic rather than paper/cardboard. It does not establish that packaging caused it. |
| Other unfamiliar odor | A broad description when an odor seems separate from the tea's character but the person cannot name it. Do not add it automatically alongside a named odor. |

Optional details:

- **Effect on other character:** Leaves it clear / Partly masks it / Mostly masks it.
- **Intensity:** Subtle / Moderate / Pronounced.
- **Across infusions:** Clears / Softens / Persists / Becomes more apparent.

Storage can be a Strength in intentionally matured tea. No distinct storage character does not certify cleanliness.

Cellar-like and Forest floor remain valid personal descriptions. Do not force beginners to distinguish them from Musty and Earthy as parallel standard choices. Cellar-like is not automatically musty or unwelcome. Likewise, Old books and Damp cardboard refine the paper association without becoming obligatory neighboring choices.

Stale or Flat is valid personal wording for reduced character, not another odor. Link it to the relevant flavor/expression observation and a storage association if the person makes one; it does not prove deterioration or a storage cause. A pronounced storage aroma can leave the rest of the tea clear, so intensity and masking remain separate.

Wood, earth, and camphor can also be flavor observations. Use the same underlying sensory meaning, with an explicit storage association when the person makes one. Do not duplicate the note or automatically infer storage character from a flavor selection.

“Wet-stored”, “Hong Kong storage”, exact age, and humidity belong to sourced provenance information, not conclusions generated from sensory words.

## 8. Which words help explain a strength or weakness?

Some descriptors usually explain a positive, some usually explain a drawback, and some can explain either. The table guides relevance, not automatic judgment. All words remain available; no assessment, style, or suggestion may rule out an observation.

| Section | Usually helps explain a strength | Usually helps explain a weakness | Context-dependent |
|---|---|---|---|
| Flavor & aroma | Distinct, Work together | Hard to distinguish, Clash, Burnt | Flavor families, Several layers / One main character, basic tastes, roast, smoke, aftertaste |
| Feel | Smooth, Comfortable | Rough, Irritated, Tight | Body, Oily, coating, drying, warming, cooling, salivation |
| Energy | Clear-headed, Focused, Uplifted | Foggy, Distracted, Jittery, Stomach discomfort | Calm, Energized, Drowsy, warmth, coolness, tingling |
| Storage | Leaves other character clear | Mostly masks other character, Plastic-like | Wood, Camphor, Earthy, Musty, Paper / cardboard-like, intensity, persistence |

Relevant positives and drawbacks may both be available while the section keeps one assessment. Do not require an expandable “Add a drawback” or “Add a positive” mechanism.

For example, the same pronounced bitterness can give a tea welcome structure or be excessive for the person drinking it. Full body can feel satisfying or heavy. Preserve the sensation and the person's interpretation separately.

Absence also needs honest language. **Not noticed** means undetected; **Less than I wanted** means insufficient for the person's preference, and does not establish absence. **Too much for me** records excess. These optional descriptions belong to the named quality: “Less sweetness than I wanted” must not become Sweet observed. Do not apply quantity qualifiers indiscriminately to words such as Scratchy or Orchid.

## 9. Tea-style starting points

When the tea's style is known, use its recorded style to prioritize useful words without predicting the person's experience. The standalone build must also support an unknown tea or style.

These are editorial suggestions, never preselected observations or validated profiles of every tea in a style. No style makes a word unavailable.

| Known style | Useful starting words |
|---|---|
| Pan-fired green | Chestnut, Toasted rice, Green bean, Fresh grass, Floral |
| Steamed green | Seaweed, Leafy greens, Fresh grass, Umami, Sweet |
| Yellow | Chestnut, Hay, Honey, Sweet, Floral |
| Young white | Floral, Hay, Honey, Pear, Sweet |
| Mature white | Date, Dried apricot, Honey, Dried herbs, Dry wood |
| Light oolong | Orchid, Jasmine, Cream, Peach, Pear |
| Roasted oolong / Wuyi | Roasted, Charcoal, Walnut, Cocoa, Cinnamon, Wet stone |
| Dancong | Orchid, Osmanthus, Honey, Peach, Citrus peel |
| More oxidized / bug-bitten oolong | Honey, Fresh fruit, Raisin, Peach, Floral |
| Red / black | Malt, Honey, Cocoa, Dried fruit, Brown sugar |
| Young sheng | Floral, Fresh grass, Apricot, Honey, Bitter |
| Mature sheng | Dry wood, Camphor, Incense, Dried fruit, Earthy |
| Shou | Earthy, Mushroom, Dry wood, Date, Cocoa |
| Other dark tea | Earthy, Mushroom, Dry wood, Leather, Dried herbs |

If only “Oolong” is known, use broad families rather than assuming roast, oxidation, or milk-like character. Unknown styles use neutral starting points. Do not infer sensory maturity from a date alone.

Energy has no style preset. Storage character and section assessments are never prefilled from type, price, age, or supplier claims.

## 10. Whole-session study

These observations matter, but do not belong inside one of the four sections merely to give them a home. They are optional shared session information.

| Aspect | Options | Meaning |
|---|---|---|
| Endurance | Fades early / Holds across infusions / Still going when I stopped | How the tea maintains a satisfying presence through the session. |
| Development | Opens gradually / Changes distinctly / Stays steady / Peaks then fades | How the experience develops across infusions. |
| Coherence | Integrated / Uneven / Disjointed | How aroma, taste, feel, and the overall experience fit together. |

An optional infusion count provides context. There is no universal number of infusions that proves a tea is good.

Whole-tea coherence is broader than integrated flavor: a tea can have harmonious flavors but feel disconnected as a complete experience.

Brewing information is context, not a quality dimension: dose, vessel volume, vessel, temperature, water, timing, and infusions tasted. The person's starting state, food, and other caffeine can also be noted when useful. None is required.

## 11. Examples

### Ordinary flavor, exceptional energy

**Overall:** Exceptional. **Flavor & aroma:** Ordinary. **Feel:** Strength. **Energy:** Strength. **Storage:** untouched.

“Full body and a comfortable, opening throat sensation. Calm and clear-headed afterwards; the feeling stayed with me.”

No elaborate flavor description is needed to justify the overall impression.

### A strength with a drawback

**Overall:** Good. **Feel:** Strength.

“Full and silky, with a little scratchiness in the later cups.”

The section has one assessment. Both the welcome texture and unwelcome sensation remain in the record.

### Wonderful aroma, problematic storage character

**Overall:** Disappointing. **Flavor & aroma:** Strength. **Storage:** Weakness.

“Pronounced orchid aroma, but a persistent musty impression obscures the sip.”

This describes the experience. It does not establish contamination or the tea's storage history.

### Bitterness that works

**Overall:** Good. **Flavor & aroma:** Strength. **Feel:** Undecided.

“Pronounced bitterness, apricot in the sip, and clear returning sweetness. Some puckering; not yet sure how I feel about the texture.”

The record can remain useful and unfinished in judgment.

## 12. Keeping the language useful

- Maintain one meaning per standard term. Synonyms support discovery without becoming duplicate choices; preserve custom wording rather than silently replacing it.
- A tasting describes one session. Comparisons over time need their dates and brewing context, without treating either as required input.
- Keep sourced facts about a tea separate from what the person observed. A tasting word does not prove a production method, provenance, age, or health effect.
- No required sequence, number of observations, or completion score. Precision is available, never a condition of making a useful record.

## 13. Research basis and limits

The organization and option sets are a product proposal informed by sensory research and tea practice. They are not a validated scientific scale or a transcription of an official wheel.

- [Taiwan Tea and Beverage Research Station: flavor-wheel overview](https://www.tbrs.gov.tw/en/ws.php?id=4869). Supports understandable sensory references and a common language for professionals and consumers.
- [Su et al., 2021: Taiwan specialty-tea sensory wheels](https://pmc.ncbi.nlm.nih.gov/articles/PMC8070119/). Supports differentiating aroma, taste, and mouthfeel, with style-specific vocabularies.
- [Chong et al., 2019: oral tribology and sweet aftertaste](https://pubmed.ncbi.nlm.nih.gov/31554068/). Research context for sweet aftertaste.
- [Chong et al., 2022: tea compound–saliva interactions](https://pmc.ncbi.nlm.nih.gov/articles/PMC8828886/). Supports caution about individual differences in responses.
- [Tea-induced astringency study](https://pubmed.ncbi.nlm.nih.gov/18590751/). Research context for drying and puckering as mouthfeel.
- [TeaDB: Pu’erh Storage Schools](https://teadb.org/puerh-storage/). Specialist context for the ambiguity of storage categories and deliberate humid storage.
- [Global Tea Hut: Understanding Cha Qi](https://archive.globalteahut.org/article/447). Practitioner language and cultural context, not scientific validation of proposed mechanisms.

The next content review should test whether people understand these distinctions and can describe familiar, unusual, and mixed experiences. Merge or add terms from that evidence. Neither speed nor comprehensibility has yet been validated with users.

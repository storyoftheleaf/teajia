# Tea Wisdom Base

> One answer to "what is this tea", held once, read by every surface.

## Why it exists

Teajia had three different things called "a tea" and only two of them were real data:

1. **The tea as a concept.** Liu Bao is a dark tea from Guangxi, basket-fermented, ages well. True for everyone, forever. **This had no home.**
2. **The tea as a record.** A capture entry or a stock item. Real table, per account.
3. **The tea as quantity.** 500g at this cost. Real table, per account.

Because layer 1 had no home, every screen that needed it invented a local copy. The audit found **fifteen tea-type lists in four incompatible dialects** (Red vs Black vs Puerh vs Aged/Hei/Yancha), **four separate keyword engines** each independently knowing that 饼 means cake, and encyclopedic content hardcoded inside page layouts where nothing could read it.

The wisdom base is layer 1 given a home.

## The rule

**Nothing here is account-scoped.** A cultivar is true regardless of who holds it. What a shop stocks, priced, and tasted stays in the shop's own records and never moves here.

The inverse rule matters as much: **no surface keeps its own copy.** The moment a screen caches a tea-type list, the fifteen-lists problem starts again.

## Shape

```
src/wisdom/
  vocabulary.ts          the controlled words + dialect normalizer
  regions.ts             83 researched origins merged with the working list
  cultivars.ts           79 plants, matching, lineage walking, story loading
  types.ts               the record shapes
  index.ts               resolveTea() — the one call every surface makes
  generated/             built by scripts/build-wisdom.mjs, never hand-edited
  stories/cultivars.json 128 KB of prose, loaded on demand

data/tea-wisdom-source/  the raw research CSVs, kept so the build is repeatable
scripts/build-wisdom.mjs source CSVs -> generated files
```

### Weight split

The lean index (names, region, lineage, parentage) is safe to import anywhere. The prose is held apart and fetched only when a reader asks, so a screen that needs a name never drags 128 KB of research along.

### The dialect bridge

`normalizeTeaType` accepts any spelling ever written into a record and returns the one canonical word. This is what makes retiring the other fourteen lists safe: old records keep working, new writes converge. Bare "puerh" is deliberately unresolvable, because it cannot be split into Sheng or Shou without a human.

Canonical words:

| Axis | Values |
|---|---|
| Type | Green, White, Yellow, Oolong, Red, Dark, Sheng, Shou, Herbal |
| Form | Loose, Cake, Brick, Tuo, Ball, Bag |
| Season | Spring, Summer, Fall, Winter |
| Storage | Dry, Wet/Traditional, HK, Malaysian, Natural |

### The one call

```ts
resolveTea({ names: [english, original, chinese], known: { type, form, region, country, year } })
```

Returns the type, form, variety, cultivar, region, country and year it can establish, plus `derived` naming which fields it answered rather than the record. **Values the record already carries always win.** Callers fill only what is blank, so the wisdom base can never overwrite a vendor's own words or an operator's correction.

## What is in it today

| Holding | Count | Source |
|---|---|---|
| Tea varieties | 316 | Hand-built, powers capture autocomplete |
| Cultivars | 79 | Research corpus, all with description, 65 with breeding lineage |
| Growing regions | 83 researched + 84 working | Research corpus merged with the capture list |
| Glossary terms | 47 | Existing, not yet joined in |
| Sensory terms | 136 | Existing, already single-sourced |

Deliberately discarded from the research corpus: a 7,161-row cultivar-by-type matrix that was 91% empty with the rest a default rating and paired Da Hong Pao with Matcha, and a tea-types export belonging to a different product.

## The four touch points

**1. Import (built).** A pasted vendor record resolves against the wisdom base before any AI is asked. Type, form, year, region, country, Chinese name and cultivar fill themselves when the tea is recognised. A `cultivar` field now carries end to end: the analysis prompt asks for it, it survives normalization and review, and it lands on both the capture entry and the stock item. Under the field, a quiet line shows what the wisdom base knows about the named plant, so lineage is visible rather than taken on trust.

**2. Wisdom admin (next).** Cultivars, regions and varieties become editable the same way stock items are. This is where AI drafts wait to be read and promoted, and how the base grows without touching code.

**3. The tea being sold (next).** A stock item points at a cultivar. The shop page shows the shared background beneath the operator's own words, marked as reference rather than voice. Written once, improved everywhere.

**4. The public reference (next).** A page per cultivar with its lineage tree, where it grows, what it tastes like, and the teas in the shop made from it. Then the reverse link back.

Touch points 3 and 4 are the same records wearing different clothes. That is why this is one project.

## Authorship

Most prose here was AI-drafted from research. That must be visible, never hidden and never apologised for. Three rungs per entry:

- **Drafted** — published, sourced, not yet read by a human
- **Reviewed** — read and corrected, with a date
- **Authored** — written in Adrian's own words, marked as such

The 266 existing tea write-ups sit permanently on the top rung and should look different, because they are why the rest is trusted.

## Governance

Not a wiki. One editor, with an inbox. Corrections arrive through a single plain address and Adrian applies them, crediting the sender in the entry's note. This is the only contribution model that survives being one person.

The standard is stated as a direction, not a claim:

> This is not everything. The goal is to be everything. If you know something that isn't here, send it.

## Rules for anyone extending this

1. **Never add a tea-type list.** Import from `src/wisdom`. If a value is missing, add it to the vocabulary.
2. **Never overwrite what a record carries.** Fill blanks only.
3. **Never guess.** A blank lineage beats a wrong one. `matchCultivar` returns null rather than approximating.
4. **Never hand-edit `generated/`.** Change the source CSVs and re-run the build.
5. **Keep prose out of the lean index.** New long-form content goes to `stories/`.
6. **Nothing account-scoped enters this folder.** Price, stock, and tasting belong to the shop.

## Migration path for the remaining dialects

Fourteen local tea-type lists still exist. Each retires the same way: import from `src/wisdom`, wrap any stored value in `normalizeTeaType`, delete the local array. Records already written in an old dialect keep resolving, so the retirement can happen one screen at a time rather than in one pass.

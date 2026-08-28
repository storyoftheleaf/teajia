# Teajia Product Description Style Guide

> The permanent, always-referenced standard for writing product descriptions on
> teajia.com. Every intake AND every rewrite follows this. It is customer-facing
> copy — the voice of the shop — so it reads like a knowledgeable tea friend,
> not like a database or an internal note.

## Purpose of a description

The storefront "About This Tea" section is the **only** product copy a customer
reads before deciding. It must make them feel the tea: where it comes from,
what kind of leaf it is, how it drinks. It answers:
- **Where** is it from (origin / terroir — real place, real elevations only).
- **What** it is (processing/craft — ripe vs raw, whole-leaf vs loose, cake vs brick).
- **How** it drinks (character — body, sweetness, texture, finish).

## The voice (Adrian's house voice — this is the core rule)

- **Quietly sensory.** Sensation first, description second. Say what the tea is
  (sweet, thick, mineral, camphor) before why you should like it.
- **No superlatives** ("best", "world-class", "extraordinary", "amazing",
  "premium", "prized", "the most sought-after", "transcends"). State the
  character plainly; let the leaf speak.
- **No hype or marketing puffery.** No "drinkable gold", no exclamation marks.
- **Understated, precise, poetic only where earned.** A short evocative phrase
  is welcome ("velvet stillness") but never decorative filler.
- **Plain, confident prose.** Short sentences. No fluff, no hedging, no
  "perhaps you will find".

## Structure

Write 2–4 short paragraphs. If the repo file uses `## Terroir / Processing /
Mood / Experience`, the **customer-facing description is a tight synthesis** of
these — not the raw sections and not the internal notes.

1. **Open with the place or the tea.** One line naming the origin/village and
   what the tea is. (e.g. "Mahei (麻黑) is the ancient-tree village at the heart
   of the Yiwu region." / "Wuliang Mountain, in Jingdong County, Pu'er City…")
2. **One line on the leaf/process** — ancient-tree, large-leaf, wo dui fermented,
   compressed into a cake, etc.
3. **One line on how it sits** — body, weight, general nature (a full-bodied red,
   a quiet settled shou). Use honest, specific sensory terms sparingly.

## The core rule — AI writes objective fact only; the subjective parts are human

- **An AI only writes the objective sections:** the intro (what the tea
  factually is), `## Terroir` (origin, place, elevation, craft of the land),
  and `## Processing` (leaf type, method, process). These are verifiable facts.
- **`## Mood` and `## Experience` are SUBJECTIVE and must be human-written.**
  An "experience" is something the actual drinker felt; an AI has no genuine
  subjective access to it, so an AI-authored Mood/Experience is fabrication.
- **Leave `## Mood` / `## Experience` EMPTY (or absent) until Adrian writes
  them.** Do not invent them, do not have a model guess them, no "to be
  written" boilerplate.
- The felt character of a cup belongs to the person who drank it.

## Tastes and flavors NEVER go in the description

- Taste/flavor notes (malt, honey, camphor, earthy, smooth, mineral, sweet,
  apricot, etc.) are **separate catalog data** — they belong in the product's
  tasting field (`tastingNotes` / the tasting app), NOT woven into the
  description prose.
- The description carries **place, craft, and character**. If a line reads like
  a tasting note, move it to the tasting field.

## NEVER put in a description (these are internal, not public)

- Receipt numbers, purchase dates, invoice references.
- Gram/quantity/cake counts ("7 cakes × 357g", "1kg from receipt").
- "Stock needs verification", "needs verification", any stock/status note.
- Vendor/supplier notes, shipping, or cost.
- Anything that belongs in the admin stock/quantity fields as **data**.

## Rewriting rule

If a description contains ANY of the above or reads like hype, rewrite it in
this style. When rewriting, a strong prose model is preferred for the writing
itself. Keep tasting terms from the taxonomy (somatic, specific) — never invent
origins, elevations, or lore that the library doesn't support.

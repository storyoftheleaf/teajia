# TeajiA Tasting Taxonomy — Usage Guide

## Overview

Two files power the entire tasting system:

1. **tasting-taxonomy.json** — The library of 102 terms across 6 categories. This is the single source of truth. Your admin interface reads from it to show available terms. Your frontend reads from it to resolve term IDs into display labels. You edit this file when you want to add, remove, or rename terms globally.

2. **Each tea product file** — Stores arrays of term IDs under a `tasting` object. Six optional arrays, one per category. Empty or missing arrays mean that category doesn't display.

---

## The Two Files in Practice

### Taxonomy file (one file, shared)

```
tasting-taxonomy.json
├── flavor (42 terms in 10 groups)
├── body (8 terms in 2 groups)
├── finish (14 terms in 3 groups)
├── feeling (14 terms in 4 groups)
├── liquor-color (10 terms in 1 group)
└── brewing (14 terms in 4 groups)
```

### Tea product file (one per tea)

```json
{
  "id": "da-hong-pao-2019",
  "name": "Da Hong Pao",
  "origin": "Wuyi Mountains, Fujian",
  "tasting": {
    "flavor": ["charcoal", "stone-fruit", "dark-chocolate", "mineral"],
    "body": ["full", "oily"],
    "finish": ["finish-long", "hui-gan", "throat-opening"],
    "feeling": ["grounding", "feeling-warming"],
    "liquor-color": ["amber"],
    "brewing": ["high-temp", "short-steeps", "gaiwan"]
  }
}
```

---

## How It Flows

### 1. You drink a tea and enter notes

Your admin interface loads the taxonomy, shows you the tag picker organized by category and group. You tap terms while you drink. The interface stores an array of term IDs on the tea product.

For categories you skip, no array is stored. The product only carries data you actually entered.

### 2. A custom term comes to mind

You type "wet stone path" because that's what you genuinely experience. The system creates a new term:

```json
{ "id": "wet-stone-path", "label": "Wet stone path", "custom": true, "category": "flavor" }
```

It's immediately usable on this tea. A small indicator in your admin shows it's not yet in the official taxonomy. Later, you can promote it (add it to tasting-taxonomy.json) or leave it as a one-off.

### 3. The product page renders

Your frontend loads the taxonomy once and builds a lookup map (term ID to label). For each tea, it checks which tasting categories have entries and renders only those:

```
Flavor    Charcoal, stone fruit, dark chocolate, mineral
Body      Full, oily
Finish    Long, hui gan, throat opening
Feeling   Grounding, warming
Color     Amber
Brewing   High temperature, short steeps, gaiwan
```

Categories with no entries don't appear. No empty states. No "N/A."

### 4. Cross-referencing works

A visitor taps "hui gan" on the Da Hong Pao page. Your site queries all tea products where `tasting.finish` includes `"hui-gan"` and shows them. Same logic works for any term in any category: all "grounding" teas, all "amber" teas, all teas that "open slowly."

This is a simple array filter. No complex query language needed.

### 5. The taxonomy evolves

Six months in, you realize "baked" and "toasted" overlap too much. You remove "baked" from the taxonomy and do a find-and-replace across your tea files, changing "baked" to "toasted." One operation, everything updates.

Or you discover a flavor that keeps showing up as a custom term across multiple teas. You promote it: add it to tasting-taxonomy.json with a proper ID, and it's now part of the official library.

---

## Term ID Conventions

- Lowercase, hyphenated: `dark-chocolate`, `toasted-rice`, `throat-opening`
- When a term appears in multiple categories with different meaning, prefix it: `finish-short` vs `short-steeps`, `finish-cooling` vs `feeling-cooling`
- Liquor color IDs are distinct from flavor IDs: `honey-color` vs `honey`
- Custom terms follow the same convention: `wet-stone-path`, `autumn-leaves`

---

## Display Order

Categories always display in this order when present:

1. Flavor
2. Body
3. Finish
4. Feeling
5. Liquor color
6. Brewing suggestion

Within each category, terms display in the order they were selected (the array order in the product file). This lets you control emphasis: the first term listed feels like the primary note.

---

## What This Doesn't Cover

- **Product data beyond tasting** (price, images, description, tea type, shipping) lives in your product schema, separate from the tasting system
- **The admin interface** for entering notes — that's your build, pulling from the taxonomy JSON
- **Visual design** of how tasting notes appear on product pages — that's frontend work, using the TeajiA brand system
- **The tag system** for magazine articles and cross-linking (the 40 content tags) — separate from tasting terms, though some concepts overlap

---

## File Locations (Suggested)

```
/data/tasting-taxonomy.json     — The term library
/data/teas/da-hong-pao-2019.json — Individual tea products
/data/teas/bai-mu-dan-2024.json
/data/teas/...
```

Or if you prefer a single file for all teas:

```
/data/tasting-taxonomy.json     — The term library
/data/teas.json                  — All tea products in one array
```

The single-file approach is simpler until you have 50+ teas. Then individual files become easier to manage.

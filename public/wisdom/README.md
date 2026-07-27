# Teajia Tea Wisdom Base, open dataset

## What this is

A public export of Teajia's tea wisdom base: 79 cultivars with
breeding lineage and descriptions, 167 growing regions,
316 tea varieties, and the controlled vocabulary that ties
them together (24 terms across type, form, season and
storage). This is the account-agnostic layer behind teajia.com, true
regardless of who stocks or sells a tea. It is not a product catalog, a shop
export, or Adrian's own tasting notes.

## The standard

This is not everything. The goal is to be everything. If you know something
that isn't here, send it to hello@teajia.com.

## License

CC BY 4.0. See LICENSE.txt. Adrian's own tea write-ups and tasting notes are
not included in this dataset and remain his.

## Citation

Teajia Tea Wisdom Base (teajia.com), version 1.0.0, generated
2026-07-27, CC BY 4.0.

## Files

- `tea-wisdom.json`: everything in one file, with a `meta` block carrying
  the version, a record count per entity, and the generation date.
- `tea-wisdom-cultivars.csv`, `tea-wisdom-regions.csv`,
  `tea-wisdom-varieties.csv`, `tea-wisdom-vocabulary.csv`: flat, one file
  per entity type, for spreadsheet tools.
- `LICENSE.txt`

## Schema

### cultivars

| Field | Meaning |
|---|---|
| id | Stable slug, unique |
| name | English name |
| chineseName | Chinese name, when recorded |
| altNames | Other spellings, semicolon-separated in CSV |
| originCountry, originRegion | Where the cultivar was developed |
| developedYear | Year of development, when recorded |
| parentage | Breeding lineage, e.g. "TRES-2022 x Tainung #80" |
| description, plantType, environment, processing, oxidation, roasting, versatility | Prose fields, drafted from research |
| distribution, expressions, sensory | Nested detail (JSON file only: growing distribution, named expressions, sensory notes) |
| authorshipRung | `drafted`, `reviewed`, or `authored`. See below. |

### regions

| Field | Meaning |
|---|---|
| id | Stable slug, unique |
| name | Region name |
| country | Country |
| province | Province or prefecture, when the name alone is ambiguous |
| altitude, climate | Growing conditions, when recorded |

### teaVarieties

| Field | Meaning |
|---|---|
| id | Stable slug, unique (type and name combined) |
| type | One of the controlled tea types |
| name | Variety name |
| chineseName | Chinese name, when recorded |
| altNames | Other spellings, semicolon-separated in CSV |
| region | Typical origin, when recorded |

### vocabulary

| Field | Meaning |
|---|---|
| axis | Type, Form, Season, or Storage |
| value | The controlled word itself |

## Authorship rungs

Every cultivar entry carries one of three rungs, stated plainly rather than
hidden:

- `drafted`: published, sourced, not yet read by a human. This is the
  default, and covers nearly everything in this release.
- `reviewed`: read and corrected by a human, with a date.
- `authored`: written in a human's own words.

Check `authorshipRung` on a cultivar record before treating its description
as verified. An unreviewed entry is not wrong, only unverified.

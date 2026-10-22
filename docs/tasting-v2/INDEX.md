# Tasting v2

Published preview: [/tasting-v2/](/tasting-v2/). This is a separate, local-browser tasting preview; it does not replace the account journal or sync with it. Voice note is a preview control.

- [Selections and descriptions](TEA-TASTING-CONSOLIDATED.md)
- [Original integration review](INTEGRATION-REVIEW.md)
- [Preserved vocabulary](sources/Taste.md)
- [Flavor families](sources/vocabulary.json)
- [Tea-style starting points](sources/tea-starting-points.json)
- [Attributed profiles](sources/reference-profiles.json)
- [Interaction brief](sources/interaction-brief.md)
- [Design findings](sources/design-findings.md)
- [Source provenance](sources/manifest.json)

## Editing

Editable implementation: `prototypes/tasting-v2/work/`. Run `python3 prototypes/tasting-v2/work/build.py` to regenerate `public/tasting-v2/index.html`. Both are committed. The original source mockups remain preserved outside the repository; absolute paths in historical references identify those inputs, not runtime dependencies.

Independent Aroma and Flavor wheels share vocabulary, not selections or detail values. Copying aroma notes adds missing names to Flavor without overwriting flavor details. Body & texture retains internal feel keys. All other approved interactions and compact layouts are preserved.

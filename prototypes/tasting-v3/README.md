# Tasting V3

Standalone preview at https://teajia.com/tasting-v3/. V2 is preserved.

Combines the complete V2 tasting shell with the approved dusk-gradient wheel. Aroma and Flavor notes stay separate. Save stores a browser-local draft, not an account journal record. First load can inherit the V2 browser draft; subsequent saves use a separate V3 key.

Build: `python3 prototypes/tasting-v3/work/build.py`.
Verify against a local public server with `TASTING_V3_URL=http://127.0.0.1:8797/tasting-v3/ node prototypes/tasting-v3/verify.cjs` and `node prototypes/tasting-v3/visual-verify.cjs` (Playwright required).

The wheel component is self-contained. wheel-source.css and wheel-theme.css preserve the approved prototype styling before selector scoping; wheel-component.css is the integrated scoped stylesheet. Vocabulary and sourced starting points are carried forward from V2. Visible Sweet–creamy is a single-line display label; its stored vocabulary name stays Sweet & creamy for draft compatibility.

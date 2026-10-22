# Tasting v2 release checks

22 October 2026. Browser verification used the published asset path `/tasting-v2/` served locally with the site fonts. Passed at 320, 390 and 900px: actual wheel wedge taps, separate aroma/flavor selection and intensity, copying missing notes without overwriting existing notes, independent removal, save/reload and no horizontal overflow or browser errors. Current full-size screenshot reviewed after site fonts loaded.

Reproduce: serve `public/` on 127.0.0.1:8796, then run `node prototypes/tasting-v2/verify.cjs`. Override TASTING_V2_URL for another preview URL. Test browser context is fresh; no existing user's data is modified.

This page is a local-browser preview, not a replacement or database migration for the account tasting journal. It has a separate browser storage key. Sources and content definitions are under this directory; editable code is under prototypes/tasting-v2/work.

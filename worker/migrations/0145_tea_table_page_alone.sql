-- A4 review, finding 1 (2026-11-26). Taking a tasting off the Tea Table
-- keeps it on the person's own page only when they had chosen their page by
-- itself (the "On my page" wording) before it went on the table. When the
-- Tea Table share was the only reason it was public, taking it off makes it
-- private everywhere. This column says which: the moment the person chose
-- their page alone, NULL when they never did. A new column only; no row
-- changes. Rows shared on the older wording are stamped when they next go on
-- the table (worker/src/familyRoutes.ts, shareTasting).
ALTER TABLE member_tasting_shares ADD COLUMN page_alone_at TEXT;

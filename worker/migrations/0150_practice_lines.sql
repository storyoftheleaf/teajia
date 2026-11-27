-- A person's page says their practice, not a title (Adrian, 2026-11-26;
-- todo/plans/guests-and-tea-masters-launch-4-run.md; src/lib/practiceLines.ts).
-- Three nullable columns on the person's page. ADD COLUMN only: no existing
-- row is touched, and every page reads as it did until its owner answers.
--
-- practice_since:  the year they came to tea ("With tea since"), no levels.
-- practice_drawn:  one short line, in their words, on what draws them to tea.
-- practice_doings: what they do, as keys from the fixed list in
--                  src/lib/practiceLines.ts, comma separated ("pours,teaches").
-- Nothing is computed, ranked or counted from these.
ALTER TABLE contributors ADD COLUMN practice_since INTEGER CHECK (practice_since IS NULL OR practice_since BETWEEN 1930 AND 2200);
ALTER TABLE contributors ADD COLUMN practice_drawn TEXT CHECK (practice_drawn IS NULL OR length(practice_drawn) BETWEEN 1 AND 140);
ALTER TABLE contributors ADD COLUMN practice_doings TEXT CHECK (practice_doings IS NULL OR length(practice_doings) BETWEEN 1 AND 200);

-- A tea master's own name and the name their business trades under are two
-- different facts. Adrian's example: "Mei Lin" pours the tea, "Cloud
-- Mountain Tea" is what she sells it as. contributors.display_name already
-- carries the person; this column carries the business, shown under the
-- name on the masthead only when it is set.
--
-- Nullable, no default. Most contributors will never set one, and NULL here
-- means exactly what it says: nobody has a trading name distinct from their
-- own, not that one was forgotten and answered with an empty string.

ALTER TABLE contributors ADD COLUMN business_name TEXT;

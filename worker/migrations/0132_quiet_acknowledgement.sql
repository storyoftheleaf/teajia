-- Launch 4, quiet acknowledgement (todo/plans/guests-and-tea-masters.md,
-- "Quiet acknowledgement"). One column only. No existing row is changed:
-- every photograph already taken reads 0, so no name is shown until its
-- photographer says yes.

-- Whether the photographer lets "photograph by <first name>" travel with a
-- family photograph. 0, the default, shows no name.
ALTER TABLE member_photographs ADD COLUMN credit_name_shown INTEGER NOT NULL DEFAULT 0 CHECK (credit_name_shown IN (0, 1));

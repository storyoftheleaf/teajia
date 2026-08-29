-- Re-align articles.category to the new editorial-register vocabulary.
-- Old vocabulary mixed display labels (Origin Story, Technique, Tea & Food)
-- with legacy slugs (tea-feature, pairing, etc). New set:
--   Interview / Teaching / Journey / Reflection / Story / Field Notes
--
-- Mapping rationale:
--   Interview      -> Interview     (kept as-is, case-normalized)
--   Origin Story   -> Story         (narrative profile)
--   Technique      -> Teaching      (instruction/transmission)
--   tea-feature    -> Story         (legacy slug; treat as profile)
--   science        -> Teaching      (legacy slug; instruction-leaning)
--   curated        -> Reflection    (legacy slug; editorial selection)
--   pairing        -> Field Notes   (legacy slug; short observational form)
--
-- Anything not matched above is set to NULL so the editor can choose
-- intentionally on next edit. Eyebrow on the card hides when NULL.

UPDATE articles SET category = 'Interview'
  WHERE LOWER(TRIM(category)) IN ('interview');

UPDATE articles SET category = 'Story'
  WHERE LOWER(TRIM(category)) IN ('origin story', 'tea-feature');

UPDATE articles SET category = 'Teaching'
  WHERE LOWER(TRIM(category)) IN ('technique', 'science');

UPDATE articles SET category = 'Reflection'
  WHERE LOWER(TRIM(category)) IN ('curated');

UPDATE articles SET category = 'Field Notes'
  WHERE LOWER(TRIM(category)) IN ('pairing');

-- Null out anything that doesn't map (Culture, Tea & Food, Photo Essay,
-- empty strings, etc). Adrian will re-set these intentionally.
UPDATE articles SET category = NULL
  WHERE category IS NOT NULL
    AND category NOT IN ('Interview', 'Teaching', 'Journey', 'Reflection', 'Story', 'Field Notes');

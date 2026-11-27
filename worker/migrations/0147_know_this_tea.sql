-- Launch 5, M8: "Does anyone know this tea?" on the Tea Table
-- (todo/plans/guests-and-tea-masters-launch-5-run.md; src/lib/knowThisTea.ts).
-- Two new tables only. No existing row is touched.
--
-- Like tea_table_keeps and tea_table_holds, these belong to the Tea Table,
-- which is the whole network's, not one shop's, so they carry no account_id.

-- A photograph of a tea someone cannot name, put on the Tea Table with a line
-- about where they got it. The asker takes it off (taken_off_at, and its
-- photograph files are removed); the platform owner hides it (hidden_at).
-- Named is the asker's own word, with the tea in the shop when it is there;
-- thanked_note_id is the note whose writer the asker thanked.
CREATE TABLE IF NOT EXISTS tea_table_questions (
  id TEXT PRIMARY KEY,
  asker_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  where_from TEXT NOT NULL CHECK (length(where_from) BETWEEN 1 AND 280),
  full_key TEXT NOT NULL,
  small_key TEXT NOT NULL,
  small_width INTEGER NOT NULL,
  small_height INTEGER NOT NULL,
  shape TEXT NOT NULL DEFAULT 'square' CHECK (shape IN ('square','upright','across')),
  asked_at TEXT NOT NULL DEFAULT (datetime('now')),
  taken_off_at TEXT,
  hidden_at TEXT,
  hidden_by TEXT REFERENCES users(id),
  named_name TEXT CHECK (named_name IS NULL OR length(named_name) BETWEEN 1 AND 120),
  named_product_id TEXT,
  named_at TEXT,
  thanked_note_id TEXT
);
CREATE INDEX IF NOT EXISTS idx_tea_table_questions_asked ON tea_table_questions(asked_at);
CREATE INDEX IF NOT EXISTS idx_tea_table_questions_asker ON tea_table_questions(asker_user_id, asked_at);

-- What someone who knows the tea tells the asker. Private: read by the asker
-- alone, never counted, never sent anywhere. One note per person per
-- question; writing again replaces it. name_shown is that person's yes to
-- their first name showing on the piece if the asker thanks them.
CREATE TABLE IF NOT EXISTS tea_table_question_notes (
  id TEXT PRIMARY KEY,
  question_id TEXT NOT NULL REFERENCES tea_table_questions(id) ON DELETE CASCADE,
  writer_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  words TEXT NOT NULL CHECK (length(words) BETWEEN 1 AND 600),
  product_id TEXT,
  name_shown INTEGER NOT NULL DEFAULT 0 CHECK (name_shown IN (0,1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (question_id, writer_user_id)
);

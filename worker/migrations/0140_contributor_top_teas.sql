CREATE TABLE IF NOT EXISTS contributor_top_teas (
  contributor_id TEXT NOT NULL REFERENCES contributors(id) ON DELETE CASCADE,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  slot TEXT NOT NULL CHECK (slot IN (
    'Green', 'White', 'Yellow', 'Oolong', 'Red', 'Dark', 'Sheng', 'Shou', 'Herbal', 'own', 'elsewhere'
  )),
  name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 160),
  note TEXT CHECK (length(note) <= 600),
  photo_id TEXT NOT NULL UNIQUE,
  product_id TEXT REFERENCES products(id) ON DELETE SET NULL,
  PRIMARY KEY (contributor_id, slot)
);

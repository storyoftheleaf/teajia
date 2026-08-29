-- Sample data: one upcoming event + one tasting journal entry for dev/demo.
-- Safe to re-run (INSERT OR IGNORE).

-- ── Sample event ──────────────────────────────────────────────────────────────
INSERT OR IGNORE INTO events (
  id, account_id, slug, title, subtitle, description,
  event_date, event_end_date, location_name, area_hint,
  total_capacity, claim_window_minutes, timezone, status,
  mood_hints, guidelines_text, event_format
) VALUES (
  'evt_sample_liu_bao',
  'acc_teajia_bali',
  'aged-liu-bao-may-2026',
  'Aged Liu Bao · Guided Tasting',
  'Six teas across four decades',
  'A flight of Liu Bao spanning the 1980s through today. We move slowly — same vessel, same water, four expressions of the same leaf aged in different cellars. Bring a quiet mind.',
  '2026-05-10 14:00:00',
  '2026-05-10 17:00:00',
  'Studio Bali',
  'Ubud',
  8,
  60,
  'Asia/Makassar',
  'active',
  '["Quiet","Gongfu","Six teas","Bring a friend"]',
  'Arrive on time. No perfume. Silence during pouring. Phones away during the session.',
  'private_tasting'
);

-- ── Sample tasting journal entry (linked to dev-admin user) ──────────────────
INSERT OR IGNORE INTO customer_tasting_journal (
  id, account_id, user_id,
  product_id, product_name, product_type,
  tasting, personal_note, rating,
  event_id, event_title, created_at
) VALUES (
  'tj_sample_liu_bao_1985',
  'acc_teajia_bali',
  'dev-admin-aaa',
  'sample-liu-bao-1985',
  'Aged Liu Bao 1985',
  'Dark',
  '{"rating":9,"overallImpression":"Wet earth and old library wood. Camphor finish that stays for minutes.","primaryNotes":["camphor","cellar-earth","dried-plum"],"huiGan":true}',
  'Every infusion opened a little differently. The eighth steep still had depth.',
  9,
  'evt_sample_liu_bao',
  'Aged Liu Bao · Guided Tasting',
  '2026-05-10T14:45:00.000Z'
);

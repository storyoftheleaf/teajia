-- ── Sample products ──────────────────────────────────────────────────────────
INSERT OR IGNORE INTO products (id, account_id, product_name, given_name, type, origin_region, origin_country, status, tasting_notes, description, stock_grams)
VALUES
  ('prod_seed_001', 'acc_teajia_bali', 'High Mountain Oolong', 'Alishan', 'Oolong', 'Alishan', 'Taiwan', 'Active', '["floral","creamy","persistent finish"]', 'High-elevation oolong grown at 1,200m. Buttery texture with orchid fragrance.', 500),
  ('prod_seed_002', 'acc_teajia_bali', 'Old Tree Puerh 2018', '古树普洱', 'Puerh', 'Yunnan', 'China', 'Active', '["earthy","camphor","dark fruit"]', 'Single-garden old-growth puerh, 2018 pressing. Deep and evolving.', 300),
  ('prod_seed_003', 'acc_teajia_bali', 'White Silver Needle', '白毫银针', 'White', 'Fuding', 'China', 'Active', '["melon","honey","light"]', 'Delicate first-flush silver needles. Subtle sweetness, clean finish.', 200),
  ('prod_seed_004', 'acc_teajia_bali', 'Dancong Phoenix', '凤凰单枞', 'Oolong', 'Chaozhou', 'China', 'Active', '["stone fruit","osmanthus","roasted"]', 'Medium roast dancong with layered stone-fruit and floral character.', 400);

-- ── Customer linked to dev user ───────────────────────────────────────────────
INSERT OR IGNORE INTO customers (id, account_id, user_id, name, email, phone, tags, source, created_at)
VALUES ('cust_dev_001', 'acc_teajia_bali', 'dev-admin-aaa', 'Adrian', 'aaa', '+1-000-000-0000', '["regular","curator"]', 'direct', '2025-09-15T10:00:00');

-- ── Events ───────────────────────────────────────────────────────────────────
INSERT OR IGNORE INTO events (id, slug, title, subtitle, description, event_date, location_name, address_text, total_capacity, status, account_id, timezone)
VALUES
  ('evt_seed_001', 'autumn-oolong-2025', 'Autumn Oolong Session', 'High mountain harvest tasting', 'An intimate gathering exploring Taiwanese high-mountain oolongs from the autumn harvest.', '2025-10-12T16:00:00', 'Teajia Studio', 'Bali, Indonesia', 12, 'archived', 'acc_teajia_bali', 'Asia/Makassar'),
  ('evt_seed_002', 'winter-puerh-2025', 'Winter Puerh Circle', 'Aged shou & sheng comparison', 'A slow afternoon with aged puerh — comparing shou and sheng from Yunnan old-growth trees.', '2025-12-07T15:00:00', 'Teajia Studio', 'Bali, Indonesia', 10, 'archived', 'acc_teajia_bali', 'Asia/Makassar'),
  ('evt_seed_003', 'spring-white-2026', 'Spring White Tea Morning', 'First-flush silver needle ritual', 'A morning session of stillness with Fuding silver needles and a guided tasting of white tea processing.', '2026-02-22T09:30:00', 'Teajia Garden', 'Ubud, Bali', 8, 'archived', 'acc_teajia_bali', 'Asia/Makassar');

-- ── Tea menus ─────────────────────────────────────────────────────────────────
INSERT OR IGNORE INTO event_tea_menu (id, event_id, product_id, custom_name, brew_order)
VALUES
  ('menu_001_a', 'evt_seed_001', 'prod_seed_001', NULL, 1),
  ('menu_001_b', 'evt_seed_001', 'prod_seed_004', NULL, 2),
  ('menu_002_a', 'evt_seed_002', 'prod_seed_002', NULL, 1),
  ('menu_003_a', 'evt_seed_003', 'prod_seed_003', NULL, 1);

-- ── Attendees ─────────────────────────────────────────────────────────────────
INSERT OR IGNORE INTO event_attendees (id, event_id, customer_id, full_name, phone_number, status, attended, magic_token, source, created_at)
VALUES
  ('att_001', 'evt_seed_001', 'cust_dev_001', 'Adrian', '+1-000-000-0000', 'confirmed', 1, 'tok_seed_001', 'direct', '2025-10-10T12:00:00'),
  ('att_002', 'evt_seed_002', 'cust_dev_001', 'Adrian', '+1-000-000-0000', 'confirmed', 1, 'tok_seed_002', 'direct', '2025-12-05T11:00:00'),
  ('att_003', 'evt_seed_003', 'cust_dev_001', 'Adrian', '+1-000-000-0000', 'confirmed', 1, 'tok_seed_003', 'direct', '2026-02-20T09:00:00');

-- ── Tasting notes ─────────────────────────────────────────────────────────────
INSERT OR IGNORE INTO event_tasting_notes (id, event_id, attendee_id, tea_menu_id, rating, impression, is_favorite)
VALUES
  ('note_001', 'evt_seed_001', 'att_001', 'menu_001_a', 5, 'The Alishan opened with a wave of orchid that I did not expect — it lingered long after the cup was empty. Something about high altitude makes time slower.', 1),
  ('note_002', 'evt_seed_001', 'att_001', 'menu_001_b', 4, 'The dancong had roasted edges that softened into stone fruit. It reminded me of dried apricot warmed in the sun.', 0),
  ('note_003', 'evt_seed_002', 'att_002', 'menu_002_a', 5, 'The old-tree puerh was like drinking forest floor — camphor, dark fruit, and something ancient. I understood why people age tea for decades.', 1),
  ('note_004', 'evt_seed_003', 'att_003', 'menu_003_a', 4, 'Morning light, silver needles. The sweetness was almost imperceptible — melon, honey, then nothing. A tea for silence.', 0);

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import { migrationFiles, MIGRATIONS_DIR } from './migratedSqlite';
import { seedIdentity, SqliteD1 } from './sqliteD1';

export function switches(open: boolean) {
  const setting = String(open);
  return {
    FIRST_TABLE_OPEN: 'true',
    FEW_HOSTS_OPEN: setting, ANYONE_HOSTS_OPEN: setting,
    TEA_TABLE_OPEN: setting, FAVOURITES_OPEN: setting, YOUR_TABLE_PAGE_OPEN: setting,
    HOST_ARTICLES_OPEN: setting, TOP_TEAS_OPEN: setting, TEA_HOUSES_OPEN: setting,
    YOUR_TABLE_PLACE_OPEN: setting, HOME_BAR_OPEN: setting,
    HOST_CREDIT_OPEN: setting, CIRCLES_OPEN: setting, HOST_TOKENS_OPEN: setting,
    TABLE_CARD_OPEN: setting, KNOW_THIS_TEA_OPEN: setting,
  };
}

function seedChest(sqlite: DatabaseSync) {
  // d8577c1b worker/src/index.ts:1921 (signup) and :16006 (add to chest).
  sqlite.exec(`
    INSERT INTO users (id, email, username, name, password_hash, role)
    VALUES ('chest-reader', 'chest@example.test', 'chest-reader', 'Tea reader', 'test', 'user');
    INSERT INTO personal_cellar_items
      (id, owner_user_id, name, type, year, origin, notes, grams, image_url,
       chest_label, chest_cost_amount, chest_cost_currency)
    SELECT 'old-chest', 'chest-reader', 'Old white tea', 'White', 2020, NULL,
           'First tin', 45, NULL, 'Home', 0, 'CNY'
    WHERE NOT EXISTS (SELECT 1 FROM accounts WHERE personal_inventory_user_id = 'chest-reader');
  `);
}

// The optional observer sees the populated starting point and every migration boundary.
export function oldShop(observe?: (sqlite: DatabaseSync, version: string) => void) {
  const db = new SqliteD1('migrations', '0127');
  const sqlite = db.sqlite;
  try {
    seedChest(sqlite);
    seedSales(db);
    seedPublic(sqlite);
    seedSession(sqlite);
    observe?.(sqlite, '0127');
    for (const file of migrationFiles()) {
      const version = file.slice(0, 4);
      if (version <= '0127' || version > '0147') continue;
      sqlite.exec(readFileSync(join(MIGRATIONS_DIR, file), 'utf8'));
      observe?.(sqlite, version);
    }
    return { sqlite, db };
  } catch (error) {
    db.close();
    throw error;
  }
}

// Replays the cart request and its conversion from d8577c1b, worker/src/index.ts
// lines 15420, 15784 and 15802. That writer linked only the inquiry to the invoice.
function seedSales(db: SqliteD1) {
  seedIdentity(db, { userId: 'sales-owner', accountId: 'sales-shop', role: 'owner' });
  db.sqlite.exec(`
    UPDATE accounts SET owner_user_id = 'sales-owner' WHERE id = 'sales-shop';
    INSERT INTO products
      (id, account_id, owner_user_id, slug, product_name, type, status, stock_grams,
       stock_known_at, quantity_purchased, is_public, shown_in_shop, cost_amount, cost_currency,
       cost_currency_source, markup_multiplier, shipping_rate_per_kg)
      VALUES ('sales-tea','sales-shop','sales-owner','sales-oolong','Old oolong','Oolong','Active',
        100,datetime('now'),100,1,1,20,'USD','stated',NULL,NULL);
    INSERT INTO inquiries
      (id,account_id,name,email,phone,items,total_usd,currency,message,source,ref_number,tracking_token_hash,request_fingerprint)
      VALUES ('sales-inquiry','sales-shop','Old buyer','buyer@example.test',NULL,
        '[{"category":"tea","id":"sales-tea","name":"Old oolong","packGrams":25,"packs":1,"pricePerGram":0.5,"quantityGrams":25,"storeSlug":"sales-shop","totalPrice":12.5}]',
        12.5,'USD',NULL,'cart','OLD-25',
        'fd8bac45ca4a6fce6444fc769d3f77a93d789e56b0ca9a29324719d23bce48bc',
        '33a10c3c03724a1cad68228f9bb2925c1cd155f76558304432c886504ea45701');
    UPDATE accounts SET invoice_seq = invoice_seq + 1 WHERE id = 'sales-shop';
    INSERT INTO invoices
      (id,account_id,invoice_number,customer_name,customer_whatsapp,customer_id,display_currency,
       shipping_cost_usd,status,inventory_deducted,notes,payment_status)
      VALUES ('sales-invoice','sales-shop','00001','Old buyer',NULL,NULL,'USD',0,'Draft',0,
        'From order request OLD-25. Prices recalculated from the current catalogue; review before sending.
Reply to: buyer@example.test
Old oolong: 25 g','unpaid');
    INSERT INTO invoice_line_items
      (id,account_id,invoice_id,product_id,custom_name,quantity,price_at_sale,quantity_unit)
      VALUES ('sales-line','sales-shop','sales-invoice','sales-tea','Old oolong (25 g)',25,0.5,'g');
    UPDATE inquiries SET converted_invoice_id = 'sales-invoice', status = 'replied'
      WHERE id = 'sales-inquiry' AND account_id = 'sales-shop' AND converted_invoice_id IS NULL;
  `);
}

function seedPublic(sqlite: DatabaseSync) {
  // The journal belongs to the email, the share and the photograph to the user id.
  // d8577c1b index.ts:20287, familyRoutes.ts:365 and :521, familyPages.ts:116.
  sqlite.exec(`
    INSERT INTO users (id, email, name, password_hash, role, email_verified_at)
      VALUES ('legacy-author', 'legacy-author@test.dev', 'Mei Shen', 'x', 'user', '2026-10-01');
    INSERT INTO accounts (id, slug, name, status, public_enabled)
      VALUES ('legacy-house', 'legacy-house', 'Old house', 'active', 1),
             ('other-legacy-house', 'other-legacy-house', 'Other house', 'active', 1);
    INSERT INTO accounts (id, slug, name, kind, status, public_enabled, owner_user_id, personal_inventory_user_id)
      VALUES ('legacy-personal', 'legacy-personal', 'Mei’s chest', 'master', 'active', 0, 'legacy-author', 'legacy-author');
    INSERT INTO account_members (account_id, user_id, role, status)
      VALUES ('legacy-personal', 'legacy-author', 'owner', 'active');
    INSERT INTO products (id, account_id, type, product_name, slug, status, is_public, shown_in_shop,
                          stock_grams, cost_amount, cost_currency, shipping_rate_per_kg, markup_multiplier)
      VALUES ('legacy-leaf', 'legacy-house', 'Oolong', 'Old oolong', 'old-oolong', 'Active', 1, 1, 100, 12, 'Yuan', NULL, NULL);
    INSERT INTO products (id, account_id, type, product_name, slug, status, is_public, shown_in_shop,
                          stock_grams, cost_amount, cost_currency, shipping_rate_per_kg, markup_multiplier)
      VALUES ('retired-tea', 'legacy-house', 'White', 'Retired tea', 'retired-tea', 'Active', 1, 1, 30, 5, 'Yuan', NULL, NULL);
    INSERT INTO user_favorites (user_id, item_id) VALUES ('legacy-author', 'retired-tea');
    INSERT INTO customer_tasting_journal
      (id, account_id, user_id, product_id, product_name, product_type, product_image, note, tastings, compass_entry_id, archived, created_at)
      VALUES ('legacy-journal', NULL, 'legacy-author@test.dev', 'legacy-leaf', 'Old oolong', 'Oolong', NULL, '{}',
              '[{"id":"first-sitting","createdAt":"2026-10-01T00:00:00Z","tasting":{"notes":["Sweet finish"]}}]', NULL, 0, '2026-10-01');
    INSERT INTO member_photographs
      (id, account_id, product_id, author_user_id, journal_entry_id, page, full_key, small_key,
       full_bytes, small_bytes, full_width, full_height, small_width, small_height)
      VALUES ('legacy-photo', 'legacy-house', 'legacy-leaf', 'legacy-author', 'legacy-journal', 'taste',
              'family-photos/old-full.jpg', 'family-photos/old-small.jpg', 19000, 1300, 1920, 1440, 480, 360);
    INSERT INTO member_tasting_shares (journal_entry_id, account_id, product_id, author_user_id, share_state, shared_at, updated_at)
      VALUES ('legacy-journal', 'legacy-house', 'legacy-leaf', 'legacy-author', 'page', datetime('now'), datetime('now'));
    UPDATE member_photographs SET share_state = 'page', updated_at = datetime('now') WHERE id = 'legacy-photo';
    INSERT INTO contributors (id, account_id, user_id, display_name, page_tier, is_published, created_at, updated_at)
      VALUES ('legacy-mei', 'legacy-house', 'legacy-author', 'Mei Shen', 'family', 1, datetime('now'), datetime('now'));
    -- Existing owner's tier change, d8577c1b familyPages.ts:180.
    UPDATE contributors SET page_tier = 'master', updated_at = datetime('now') WHERE id = 'legacy-mei';
    -- Both paths of the old shop heart, d8577c1b index.ts:15895 and :15904.
    INSERT OR IGNORE INTO user_favorites (user_id, account_id, item_id) VALUES ('legacy-author', 'legacy-house', 'legacy-leaf');
    INSERT OR IGNORE INTO user_favorites (user_id, item_id) VALUES ('legacy-author', 'legacy-leaf');
  `);
  // The person's holding and fixed pack, d8577c1b index.ts:16416.
  sqlite.exec(`
      UPDATE accounts SET public_enabled = 1, personal_seller_approved_at = datetime('now') WHERE id = 'legacy-personal';
      UPDATE users SET seller_approved_at = datetime('now') WHERE id = 'legacy-author';
      INSERT INTO products (id, account_id, product_name, given_name, type, status, stock_grams, quantity_purchased,
        is_public, shown_in_shop, owner_user_id, cost_amount, cost_currency, shipping_rate_per_kg, markup_multiplier)
        VALUES ('legacy-holding', 'legacy-personal', 'Spring leaf', 'Spring leaf', 'White', 'Active', 25, 50,
                0, 0, 'legacy-author', 20, 'Yuan', NULL, NULL);
      INSERT INTO products (id, account_id, product_name, given_name, type, status, slug, stock_grams, quantity_purchased,
        is_public, shown_in_shop, owner_user_id, cost_amount, cost_currency, shipping_rate_per_kg, markup_multiplier,
        personal_offer_source_id, sold_in_whole_units, piece_weight_g, fixed_retail_price_usd, personal_offer_pack_price_usd,
        personal_offer_price_amount, personal_offer_price_currency)
        VALUES ('legacy-pack', 'legacy-personal', 'Spring leaf pack', 'Spring leaf pack', 'White', 'Active', 'legacy-spring-pack',
                25, 25, 1, 1, 'legacy-author', 10, 'Yuan', NULL, NULL, 'legacy-holding', 1, 25, 1, 25, 25, 'USD');
      INSERT OR IGNORE INTO user_favorites (user_id, account_id, item_id) VALUES ('chest-reader', 'legacy-personal', 'legacy-pack');
    `);
  // The old saved-location form had no cap, d8577c1b index.ts:14662.
  const keepPlace = sqlite.prepare(`INSERT INTO saved_locations (id, account_id, name, address, map_link, guidelines, venue_guide)
    VALUES (?, 'legacy-personal', ?, '7 Garden Street', NULL, NULL, NULL)`);
  for (let n = 1; n <= 51; n++) {
    keepPlace.run('legacy-place-' + n, 'Garden ' + String(n).padStart(2, '0'));
  }
}

export const oldSeatCredential = 'cd'.repeat(32);

function seedSession(sqlite: DatabaseSync) {
  // d8577c1b: index.ts handleCreateEvent and handleRSVP, eventDomain.ts
  // reservePartySeats, and memberPrivateSits.ts createSit and saveNote.
  sqlite.exec(`
    INSERT INTO users (id, email, username, name, password_hash, role)
      VALUES ('legacy-guest', 'guest@example.test', 'legacy-guest', 'Lin Chen', 'test', 'user');
    INSERT INTO accounts (id, slug, name, status, public_enabled, is_platform_owner)
      VALUES ('legacy-shop', 'legacy-shop', 'Review shop', 'active', 1, 1);
    INSERT INTO member_private_sits (id, owner_user_id, request_id, sit_date, title, description, tea_id, tea_name)
      VALUES ('legacy-sit', 'legacy-guest', 'morning-request', '2026-01-02', 'Morning by the window', NULL, NULL, 'Rock tea');
    INSERT INTO member_private_sit_notes (sit_id, user_id, note) VALUES ('legacy-sit', 'legacy-guest', 'Plum');
  `);
  const event = sqlite.prepare(`INSERT INTO events
    (id, account_id, slug, title, subtitle, description, flyer_image_url, event_date, event_end_date,
     location_name, address_text, map_link, guidelines_text, venue_guide, total_capacity, claim_window_minutes,
     timezone, status, lifecycle_status, session_flow, playlist_url, location_id, event_format, venue_id,
     active_space_ids, gathering_type, area_hint, mood_hints, briefing_cards, requires_approval)
    VALUES (?, 'legacy-shop', ?, ?, NULL, NULL, NULL, ?, NULL, NULL, NULL, NULL, NULL, NULL, 2, 60,
     'Asia/Taipei', ?, ?, NULL, NULL, NULL, 'private_tasting', NULL, NULL, NULL, NULL, NULL, NULL, ?)`);
  for (const [id, approval] of [['legacy-request', 1], ['legacy-instant', 0]] as const) {
    event.run(id, id, id, '2099-01-02T12:00', 'active', 'published', approval);
  }
  // The admin form stores local wall time with T. Midnight in Taipei on
  // today's UTC calendar date is always at least eight hours in the past.
  const utcDay = new Date().toISOString().slice(0, 10);
  event.run('legacy-ended-today', 'legacy-ended-today', 'Ended this morning', utcDay + 'T00:00', 'active', 'published', 1);
  event.run('legacy-past', 'legacy-past', 'Past session', '2026-01-02T12:00', 'archived', 'archived', 1);
  // The old edit endpoint accepted a cleared timezone (index.ts:13734).
  sqlite.exec("UPDATE events SET timezone = NULL, updated_at = datetime('now') WHERE id = 'legacy-instant'");
  // d8577c1b index.ts:14540. A custom tea has neither product nor photo.
  sqlite.exec(`INSERT INTO event_tea_menu
    (id, account_id, event_id, product_id, custom_name, custom_description, reveal_date, brew_order)
    VALUES ('old-pour', 'legacy-shop', 'legacy-past', NULL, 'Roasted tea', NULL, NULL, 1)`);
  // The original RSVP received a confirmed seat. The host later marked the
  // guest present and the guest claimed the seat to contribute to the book.
  sqlite.exec(`
    INSERT INTO event_attendees
      (id, account_id, event_id, customer_id, full_name, phone_number, email, plus_one, plus_one_name,
       access_tier, magic_token, photo_consent, notes, tea_preference, bringing_tea, guest_requests,
       contact_method, source, show_in_guest_list, status)
      VALUES ('legacy-attendee', 'legacy-shop', 'legacy-past', NULL, 'Lin Chen', NULL, 'guest@example.test', 0,
       NULL, 'standard', 'legacy-seat-token', 0, NULL, NULL, NULL, NULL, 'email', 'direct', 0, 'confirmed');
    INSERT INTO event_party_members
      (id, account_id, event_id, participation_id, full_name, is_primary, invitation_id, seat_status)
      VALUES ('legacy-seat', 'legacy-shop', 'legacy-past', 'legacy-attendee', 'Lin Chen', 1, NULL, 'confirmed');
    UPDATE event_attendees SET attended = 1, user_id = 'legacy-guest' WHERE id = 'legacy-attendee';
    INSERT INTO after_sit_access (attendee_id, event_id, account_id, credential_hash, expires_at)
      VALUES ('legacy-attendee', 'legacy-past', 'legacy-shop', '${createHash('sha256').update(oldSeatCredential).digest('hex')}', unixepoch() + 86400);
  `);
  // d8577c1b: privateKeptSetups.ts, privateKeptSetupPhotos.ts,
  // sessionGuestBook.ts prepareGuestBookNote, sessionGuestBookPhotos.ts saveGuestBookPhoto.
  sqlite.exec(`
    INSERT INTO private_kept_setups (account_id, user_id, event_id, event_title, event_date, teas_json, saved_at)
      VALUES ('legacy-shop', 'legacy-guest', 'legacy-past', 'Past session', '2026-01-02T12:00', '[]', '2026-01-03');
    INSERT INTO private_kept_setup_photos (account_id, user_id, event_id, id, tea_id, object_key, created_at)
      VALUES ('legacy-shop', 'legacy-guest', 'legacy-past', 'legacy-photo', NULL, 'old-photo.jpg', '2026-01-03');
    INSERT INTO session_guest_book (id, account_id, event_id, attendee_id, user_id, note, status, updated_at,
      tea_id, public_recap, signed_name)
      VALUES ('legacy-note', 'legacy-shop', 'legacy-past', 'legacy-attendee', 'legacy-guest', 'Gentle finish',
        'pending', '2026-01-03', NULL, 0, NULL);
    INSERT INTO session_guest_book_photos (id, account_id, event_id, attendee_id, user_id, photo_id, alt_text, status, offered_at)
      VALUES ('legacy-offer', 'legacy-shop', 'legacy-past', 'legacy-attendee', 'legacy-guest',
        'legacy-photo', 'Tea setup', 'pending', '2026-01-03');
    UPDATE session_guest_book SET status = 'included' WHERE id = 'legacy-note';
    UPDATE session_guest_book_photos SET status = 'included' WHERE id = 'legacy-offer';
  `);
}

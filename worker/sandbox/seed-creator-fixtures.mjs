/**
 * Seeds the LOCAL sandbox database with three placeholder creator profiles,
 * so /people and /people/:slug have something real to render instead of an
 * empty state. Companion to todo/plans/creator-profiles-fixtures.md.
 *
 * Why a separate script and not part of refresh.mjs: refresh.mjs's
 * DATA_TABLES list deliberately excludes contributors, contributor_accounts,
 * profile_favorites, payment_methods, contributor_gallery_images, users, and
 * customers, on purpose, for privacy. A fresh sandbox always has zero
 * creators. This script fills that gap without touching that boundary or the
 * refresh script's live-vs-repo verification step.
 *
 * ALL portrait, gallery and QR-image URLs below are direct Unsplash stock
 * photo links used as placeholders. None of them are real people, real QR
 * codes, or anything that should ship public. Swap them before this fixture
 * data is ever shown outside the sandbox.
 *
 * Run via: npm run sandbox:seed-creators  (from worker/, or from the repo
 * root via npm run sandbox:seed-creators, which delegates here)
 *
 * Idempotent: every fixture row is deleted by its fixed id before being
 * re-inserted, so running this twice, or running it after a schema change,
 * leaves the same three fixtures rather than piling up duplicates.
 */
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

const ACCOUNT_ID = 'acc_teajia_bali';

/**
 * Kenji's own house: a small master account so the profile's "His house"
 * section and the hosting card have a real store to point at. The Bali
 * account is the platform, not a tea master's room, so it cannot play the
 * part (host_account requires kind 'master').
 */
const HOUSE_ACCOUNT_ID = 'acc-sbx-tanaka-tea-house';

/**
 * A fixed, meaningless dev password, the same for all three fixture users:
 * "creator-fixture". Legacy SHA-256 hex, the shape verifyPasswordHash accepts,
 * so the pay-gate proof can sign in as Amara (approved) and as Wei Chen (not).
 */
const FIXTURE_PASSWORD = 'creator-fixture';
const FIXTURE_PASSWORD_HASH = createHash('sha256').update(FIXTURE_PASSWORD).digest('hex');

/**
 * Kenji's open pay link token, fixed so creator-pay-gate.spec.ts can follow
 * it: 32 hex characters, the shape payAccessDomain.isShareTokenShaped wants.
 * Sandbox only. A real token is minted by the worker, never typed.
 */
const KENJI_SHARE_TOKEN = 'f1e2d3c4b5a6978877665544332211aa';
const KENJI_SHARE_LINK_ID = 'psl-sbx-kenji-open';
const AMARA_GRANT_ID = 'pag-sbx-amara-kenji';
const COLLECTION_ID = 'col-sbx-kenji-saturday';
const COLLECTION_SLUG = 'saturday-at-the-house-fixture';
const PUBLICATION_ID = 'cpub-sbx-kenji-saturday';

// -- Fixture identities -----------------------------------------------------

const USERS = [
  { id: 'sbx-user-wei-chen', email: 'wei.chen.fixture@sandbox.local', name: 'Wei Chen (fixture)' },
  { id: 'sbx-user-amara-osei', email: 'amara.osei.fixture@sandbox.local', name: 'Amara Osei (fixture)' },
  { id: 'sbx-user-kenji-tanaka', email: 'kenji.tanaka.fixture@sandbox.local', name: 'Kenji Tanaka (fixture)' },
];

const CONTRIBUTOR_IDS = ['wei-chen', 'amara-osei', 'kenji-tanaka'];

// Tea profiles queried live from this sandbox copy's product catalogue
// (account acc_teajia_bali) on 2026-09-19, restricted to rows that pass
// every filter handleGetPublicProfileFavorites applies (published tea
// profile, active/public/shown listing, active/public/shown product,
// a legacy_product_id, and a public+active account). Verify at seed time
// with the query documented in the README rather than trusting this list
// forever, since the sandbox copy changes on every refresh.
const AMARA_FAVORITE_TEAS = [
  { id: 'prof_dddd11d2-7357-4d91-86e8-52a99bb47c51', note: 'A favorite for slow afternoons. The gushu character holds up to a dozen steeps.' },
  { id: 'prof_e5e7c9ec-d66b-48de-9197-272ffdb638e0', note: 'One of the first teas that taught me what old-tree Yiwu actually tastes like.' },
  { id: 'prof_dfb90ef0-fe35-4bc2-a1c5-17084f1f66d4', note: 'Soft and floral, the kind of tea I keep coming back to in the rainy season.' },
];

const KENJI_FAVORITE_TEAS = [
  { id: 'prof_186380ba-6839-448f-baaf-2b84ef7e5556', note: 'A red tea I pour for guests who think they only like green.' },
  { id: 'prof_9b5b05f1-a6d6-4651-9126-0fe42c5c5e86', note: 'Aged through the tropics before it ever reached me. The story is in the cup.' },
  { id: 'prof_b11a8bad-89d9-4518-9406-25145d4c6e2c', note: 'Earthy without going flat. This is what I reach for on cold mornings.' },
  { id: 'prof_a3e29766-eaa5-49c1-9ac7-15fc9d0fe3d2', note: 'Bought a full basket on a hunch years ago. Still glad I did.' },
  { id: 'prof_6876236c-bcc5-49d8-b918-5c5db02ca2a5', note: 'An easy, forgiving brew. Good for someone new to dark tea.' },
  { id: 'prof_cb7efd7b-9da6-4dc8-be76-3c7e69bdb02e', note: 'The oldest tea on my own shelf. I do not sell much of it.' },
];

const KENJI_GALLERY = [
  { id: 'gal-kenji-1', url: 'https://images.unsplash.com/photo-1544787219-7f47ccb76574?w=1200&q=80', caption: 'Pouring tea into a cup, hands close', position: 0 },
  { id: 'gal-kenji-2', url: 'https://images.unsplash.com/photo-1563911302283-d2bc129e7570?w=1200&q=80', caption: 'Seated at the tea table mid-session', position: 1 },
  { id: 'gal-kenji-3', url: 'https://images.unsplash.com/photo-1571934811356-5cc061b6821f?w=1200&q=80', caption: 'Weighing and preparing leaves', position: 2 },
  { id: 'gal-kenji-4', url: 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=1200&q=80', caption: 'A teaching gesture over the tray', position: 3 },
  { id: 'gal-kenji-5', url: 'https://images.unsplash.com/photo-1597481499750-3e6b22637e12?w=1200&q=80', caption: 'Steam rising from the gaiwan', position: 4 },
];

const EVENT_ID = 'evt-sbx-kyoto-tasting';
const EVENT_CONTRIBUTOR_ID = 'evc-sbx-kenji-lead-host';
const EVENT_COHOST_ID = 'evc-sbx-amara-co-host';
const ARTICLE_WORDS_ID = 'art-sbx-kenji-words';
const ARTICLE_FEATURING_ID = 'art-sbx-featuring-amara';

// -- SQL helpers --------------------------------------------------------------

/** SQLite string-literal escaping: double any single quote. */
const q = (value) => `'${String(value).replace(/'/g, "''")}'`;
const json = (value) => q(JSON.stringify(value));

const run = (sql) => {
  execFileSync(
    'npx',
    ['wrangler', 'd1', 'execute', 'teajia-db', '--local', '--command', sql.replace(/\s+/g, ' ').trim()],
    { stdio: ['ignore', 'inherit', 'inherit'] },
  );
};

// -- 1. Clean slate, in dependency order -------------------------------------
// Every fixture row is deleted by its fixed id first, so re-running this
// script is safe. Children before parents, since not every FK here cascades.

run(`DELETE FROM payment_access_grants WHERE contributor_id IN (${CONTRIBUTOR_IDS.map(q).join(', ')})`);
run(`DELETE FROM payment_share_links WHERE contributor_id IN (${CONTRIBUTOR_IDS.map(q).join(', ')})`);
run(`DELETE FROM collection_publications WHERE id = ${q(PUBLICATION_ID)}`);
run(`DELETE FROM collection_items WHERE collection_id = ${q(COLLECTION_ID)}`);
run(`DELETE FROM collections WHERE id = ${q(COLLECTION_ID)}`);
run(`DELETE FROM event_contributors WHERE id IN (${q(EVENT_CONTRIBUTOR_ID)}, ${q(EVENT_COHOST_ID)})`);
run(`DELETE FROM events WHERE id = ${q(EVENT_ID)}`);
run(`DELETE FROM articles WHERE id IN (${q(ARTICLE_WORDS_ID)}, ${q(ARTICLE_FEATURING_ID)})`);
run(`DELETE FROM contributor_gallery_images WHERE contributor_id IN (${CONTRIBUTOR_IDS.map(q).join(', ')})`);
run(`DELETE FROM profile_favorites WHERE contributor_id IN (${CONTRIBUTOR_IDS.map(q).join(', ')})`);
run(`DELETE FROM payment_methods WHERE contributor_id IN (${CONTRIBUTOR_IDS.map(q).join(', ')})`);
run(`DELETE FROM contributor_accounts WHERE contributor_id IN (${CONTRIBUTOR_IDS.map(q).join(', ')})`);
run(`DELETE FROM contributors WHERE id IN (${CONTRIBUTOR_IDS.map(q).join(', ')})`);
run(`DELETE FROM account_members WHERE user_id IN (${USERS.map(u => q(u.id)).join(', ')})`);
run(`DELETE FROM users WHERE id IN (${USERS.map(u => q(u.id)).join(', ')})`);
run(`DELETE FROM accounts WHERE id = ${q(HOUSE_ACCOUNT_ID)}`);

// -- 2. Users (contributors.user_id needs a row to point at) -----------------

for (const user of USERS) {
  // email_verified_at is set: sign-in refuses an unverified address, and the
  // pay-gate proof signs in as two of these three.
  run(`INSERT INTO users (id, email, name, password_hash, role, session_version, email_verified_at, created_at)
       VALUES (${q(user.id)}, ${q(user.email)}, ${q(user.name)}, ${q(FIXTURE_PASSWORD_HASH)}, 'user', 0, datetime('now'), datetime('now', '-14 months'))`);
}

// -- 2b. account_members (validateContributorReferences in worker/src/index.ts
//        requires an active member row for this account before the admin
//        editor will accept a contributor's user_id on save) ---------------

for (const user of USERS) {
  run(`INSERT INTO account_members (id, account_id, user_id, role, joined_at, status)
       VALUES (lower(hex(randomblob(16))), ${q(ACCOUNT_ID)}, ${q(user.id)}, 'viewer', datetime('now'), 'active')`);
}

// -- 3. Contributors ----------------------------------------------------------

// 3a. Wei Chen -- sparse: portrait + one paragraph, everything else absent.
run(`INSERT INTO contributors (
       id, account_id, user_id, display_name, role, now_text, links, is_published, created_at, updated_at
     ) VALUES (
       ${q('wei-chen')}, ${q(ACCOUNT_ID)}, ${q('sbx-user-wei-chen')}, ${q('Wei Chen')}, ${q('Tea Master')},
       ${q('I started sourcing oolong from Wuyi Shan in 2019. I am still learning the mountain every season.')},
       ${json([])}, 1, datetime('now'), datetime('now')
     )`);
run(`UPDATE contributors SET portrait_url = ${q('https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=800&q=80')} WHERE id = ${q('wei-chen')}`);

// 3b. Amara Osei -- medium: a working profile without the full spread.
run(`INSERT INTO contributors (
       id, account_id, user_id, display_name, business_name, role, pronouns, location_line,
       beginnings, now_text, inspirations, links, is_published, created_at, updated_at
     ) VALUES (
       ${q('amara-osei')}, ${q(ACCOUNT_ID)}, ${q('sbx-user-amara-osei')}, ${q('Amara Osei')}, ${q('Osei Tea Imports')},
       ${q('Tea Master')}, ${q('she/her')}, ${q('Portland, Oregon')},
       ${q("I grew up on gunpowder green at my grandmother's table in Accra, where tea was poured before every hard conversation and after every good one.\n\nI moved to Portland in 2014 and spent three years selling tea at farmers markets before I opened a proper shopfront.")},
       ${q('I am sourcing directly from smallholder gardens this year, and slowly building relationships that do not depend on a broker in between.')},
       ${q("My first teacher was my grandmother. My second was a decade of getting steeping times wrong in public.")},
       ${json([{ platform: 'instagram', value: '@amarateas' }])}, 1, datetime('now'), datetime('now')
     )`);
run(`UPDATE contributors SET portrait_url = ${q('https://images.unsplash.com/photo-1531123897727-8f129e1688ce?w=800&q=80')} WHERE id = ${q('amara-osei')}`);

// 3c. Kenji Tanaka -- full: every section filled.
// chinese_name is left NULL on purpose: the column is a Chinese-script name
// field per its own name, and Kenji is not a Chinese contributor, so writing
// Japanese script into it would misuse the column rather than fill a gap.
// Flagged in the plan as a design question, not resolved here.
const kenjiLinks = json([
  { platform: 'wechat', value: 'tanaka_tea_kyoto', qr_image_url: 'https://images.unsplash.com/photo-1595079676339-1534801ad6cf?w=400&q=80' },
  { platform: 'instagram', value: '@tanakateahouse' },
  { platform: 'website', value: 'https://example.com' },
]);
run(`INSERT INTO contributors (
       id, account_id, user_id, display_name, business_name, role, pronouns, location_line, active_since,
       beginnings, now_text, inspirations, closing, links, is_published, created_at, updated_at
     ) VALUES (
       ${q('kenji-tanaka')}, ${q(ACCOUNT_ID)}, ${q('sbx-user-kenji-tanaka')}, ${q('Kenji Tanaka')}, ${q('Tanaka Tea House')},
       ${q('Tea Master · Host')}, ${q('he/him')}, ${q('Kyoto, Japan')}, ${q('2015')},
       ${q("I trained for six years under a sencha producer in Uji before I opened my own room in Kyoto.\n\nThe first tea I ever served a stranger was a badly bruised gyokuro. I still have the notebook page where I wrote down what went wrong.")},
       ${q('I pour on Saturday evenings at Tanaka Tea House, four guests at most. This year is about teaching, not just pouring: two small classes a month.\n\nI still source most of my sencha from the same two families I started with in 2015.')},
       ${q("A visiting Taiwanese tea master showed me that a tea room does not need to be quiet to be serious.\n\nMy own teacher's rule: never pour a tea you have not tasted that same week.")},
       ${q('If you only remember one thing from an afternoon here, let it be how the third steep tasted, not the first.')},
       ${kenjiLinks}, 1, datetime('now'), datetime('now')
     )`);
run(`UPDATE contributors SET portrait_url = ${q('https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=800&q=80')} WHERE id = ${q('kenji-tanaka')}`);

// -- 4. contributor_accounts (needed for event_contributors' FK, and for the
//      account association the public page reads) --------------------------

for (const contributorId of CONTRIBUTOR_IDS) {
  run(`INSERT INTO contributor_accounts (contributor_id, account_id, public_role, is_host, display_order, created_at, updated_at)
       VALUES (${q(contributorId)}, ${q(ACCOUNT_ID)}, ${q('Tea Master')}, 0, 0, datetime('now'), datetime('now'))`);
}

// 4b. Kenji's house: a public master account he hosts, so "His house" renders.
run(`INSERT INTO accounts (id, slug, name, kind, status, public_enabled, tagline, location_city, location_country, created_at)
     VALUES (${q(HOUSE_ACCOUNT_ID)}, ${q('tanaka-tea-house')}, ${q('Tanaka Tea House')}, 'master', 'active', 1,
       ${q('Small sessions, four guests at most, on Saturday evenings.')}, ${q('Kyoto')}, ${q('Japan')}, datetime('now'))`);
run(`INSERT INTO contributor_accounts (contributor_id, account_id, public_role, is_host, display_order, created_at, updated_at)
     VALUES (${q('kenji-tanaka')}, ${q(HOUSE_ACCOUNT_ID)}, ${q('Tea Master')}, 1, 1, datetime('now'), datetime('now'))`);

// -- 5. Gallery images (Kenji only) -------------------------------------------

for (const image of KENJI_GALLERY) {
  run(`INSERT INTO contributor_gallery_images (id, contributor_id, image_url, caption, position, created_at, updated_at)
       VALUES (${q(image.id)}, ${q('kenji-tanaka')}, ${q(image.url)}, ${q(image.caption)}, ${image.position}, datetime('now'), datetime('now'))`);
}

// -- 6. Favorites (tea selection) ---------------------------------------------

AMARA_FAVORITE_TEAS.forEach((tea, index) => {
  run(`INSERT INTO profile_favorites (contributor_id, tea_profile_id, note, position, is_public, created_at, updated_at)
       VALUES (${q('amara-osei')}, ${q(tea.id)}, ${q(tea.note)}, ${index}, 1, datetime('now'), datetime('now'))`);
});

KENJI_FAVORITE_TEAS.forEach((tea, index) => {
  run(`INSERT INTO profile_favorites (contributor_id, tea_profile_id, note, position, is_public, created_at, updated_at)
       VALUES (${q('kenji-tanaka')}, ${q(tea.id)}, ${q(tea.note)}, ${index}, 1, datetime('now'), datetime('now'))`);
});

// -- 7. Payment methods --------------------------------------------------------

// Amara: one method, deliberately unpublished, to prove an unpublished
// method stays invisible on an otherwise-published profile.
run(`INSERT INTO payment_methods (
       id, contributor_id, account_id, method_type, label, recipient_name, account_identifier,
       instructions, external_url, qr_image_url, position, is_published, created_at, updated_at
     ) VALUES (
       ${q('pm-amara-bank-unpub')}, ${q('amara-osei')}, NULL, 'bank_transfer', ${q('Bank transfer (Portland)')},
       ${q('Amara Osei')}, ${q('Osei Tea Imports, account ending 4821')},
       ${q('Reference your order number. Confirms within one business day.')}, NULL, NULL, 0, 0,
       datetime('now'), datetime('now')
     )`);

run(`INSERT INTO payment_methods (
       id, contributor_id, account_id, method_type, label, recipient_name, account_identifier,
       instructions, external_url, qr_image_url, position, is_published, created_at, updated_at
     ) VALUES (
       ${q('pm-kenji-bank')}, ${q('kenji-tanaka')}, NULL, 'bank_transfer', ${q('Bank transfer (Kyoto)')},
       ${q('Kenji Tanaka')}, ${q('Tanaka Tea House, account ending 0092')},
       ${q('Include your name as the transfer reference.')}, NULL, NULL, 0, 1,
       datetime('now'), datetime('now')
     )`);
run(`INSERT INTO payment_methods (
       id, contributor_id, account_id, method_type, label, recipient_name, account_identifier,
       instructions, external_url, qr_image_url, position, is_published, created_at, updated_at
     ) VALUES (
       ${q('pm-kenji-link')}, ${q('kenji-tanaka')}, NULL, 'payment_link', ${q('Pay online')},
       ${q('Kenji Tanaka')}, NULL, NULL, ${q('https://example.com/pay/tanaka-tea-house')}, NULL, 1, 1,
       datetime('now'), datetime('now')
     )`);

// -- 8. An upcoming event, hosted by Kenji ------------------------------------
// events is not in refresh.mjs's copied table list either (confirmed empty
// in this sandbox copy), so a throwaway placeholder event is created here
// rather than assumed to already exist.

run(`INSERT INTO events (
       id, slug, title, subtitle, event_date, location_name, flyer_image_url, status, lifecycle_status, public_visibility, account_id
     ) VALUES (
       ${q(EVENT_ID)}, ${q('sbx-kyoto-tasting-fixture')}, ${q('Gongfu evening')}, ${q('Four places at the table')},
       datetime('now', '+30 days', 'start of day', '+19 hours'), ${q('Tanaka Tea House')},
       ${q('https://images.unsplash.com/photo-1563911302283-d2bc129e7570?w=800&q=80')},
       'active', 'published', 'public', ${q(ACCOUNT_ID)}
     )`);

run(`INSERT INTO event_contributors (id, account_id, event_id, contributor_id, role, is_public, display_order)
     VALUES (${q(EVENT_CONTRIBUTOR_ID)}, ${q(ACCOUNT_ID)}, ${q(EVENT_ID)}, ${q('kenji-tanaka')}, 'lead_host', 1, 0)`);
// Amara pours alongside, so the event page's "Hosted by" shows a lead and a
// co-host; her profile's Hosting row picks the event up too (co_host counts).
run(`INSERT INTO event_contributors (id, account_id, event_id, contributor_id, role, is_public, display_order)
     VALUES (${q(EVENT_COHOST_ID)}, ${q(ACCOUNT_ID)}, ${q(EVENT_ID)}, ${q('amara-osei')}, 'co_host', 1, 1)`);

// -- 9. Articles: one self-authored with a pull-quote, one that features a
//      different fixture creator in subject_ids ("featured in") -------------

run(`INSERT INTO articles (
       id, account_id, title, subtitle, author_id, slug, status, subject_ids, cover_image_url, reading_time_mins,
       pull_quote, pull_quote_subject, published_at, created_at, updated_at
     ) VALUES (
       ${q(ARTICLE_WORDS_ID)}, ${q(ACCOUNT_ID)}, ${q('What Three Steeps Taught Me')}, ${q('Notes from the tea room')},
       ${q('kenji-tanaka')}, ${q('kenji-tanaka-words-fixture')}, 'published', ${json(['kenji-tanaka'])},
       ${q('https://images.unsplash.com/photo-1544787219-7f47ccb76574?w=1200&q=80')}, 6,
       ${q('Tea is not a performance. It is just attention, poured out and shared.')}, ${q('kenji-tanaka')},
       datetime('now', '-3 days'), datetime('now'), datetime('now')
     )`);

// Written by Amara, quoting Kenji: the "Quoted in" row on his page, landing
// on the passage (#quote-kenji-tanaka), and a "Words" entry on hers.
run(`INSERT INTO articles (
       id, account_id, title, subtitle, author_id, slug, status, subject_ids, cover_image_url, reading_time_mins,
       pull_quote, pull_quote_subject, published_at, created_at, updated_at
     ) VALUES (
       ${q(ARTICLE_FEATURING_ID)}, ${q(ACCOUNT_ID)}, ${q('Four Houses, One Kettle')}, ${q('A room full of new drinkers')},
       ${q('amara-osei')}, ${q('four-houses-one-kettle-fixture')}, 'published', ${json(['kenji-tanaka', 'amara-osei'])},
       ${q('https://images.unsplash.com/photo-1571934811356-5cc061b6821f?w=1200&q=80')}, 4,
       ${q('The second steep is the honest one. The first is what the leaf wants you to think.')}, ${q('kenji-tanaka')},
       datetime('now', '-10 days'), datetime('now'), datetime('now')
     )`);

// -- 10. Kenji's collection: the destination the profile's tea section points
//        at. The same six teas as his selection, published as an open link. --

run(`INSERT INTO collections (id, account_id, title, note, hero_image_url, status, created_by_user_id, curator_user_id, curator_display_name, created_at, updated_at)
     VALUES (${q(COLLECTION_ID)}, ${q(ACCOUNT_ID)}, ${q('Saturday at the house')},
       ${q('The six teas Kenji pours on Saturday evenings, in the order he pours them.')},
       ${q('https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=1200&q=80')},
       'active', ${q('sbx-user-kenji-tanaka')}, ${q('sbx-user-kenji-tanaka')}, ${q('Kenji Tanaka')}, datetime('now'), datetime('now'))`);
KENJI_FAVORITE_TEAS.forEach((tea, index) => {
  // The product behind each tea profile, read from the sandbox's own listings
  // rather than hardcoded: collection_items points at products, not profiles.
  run(`INSERT INTO collection_items (id, collection_id, product_id, position, item_note, created_at)
       SELECT ${q(`ci-sbx-kenji-${index}`)}, ${q(COLLECTION_ID)}, pl.legacy_product_id, ${index}, ${q(tea.note)}, datetime('now')
         FROM product_listings pl
        WHERE pl.profile_id = ${q(tea.id)} AND pl.legacy_product_id IS NOT NULL
        ORDER BY pl.is_curated DESC, pl.updated_at DESC LIMIT 1`);
});
run(`INSERT INTO collection_publications (id, collection_id, target_type, target_id, slug, recipients_json, published_at, created_by_user_id)
     VALUES (${q(PUBLICATION_ID)}, ${q(COLLECTION_ID)}, 'person', NULL, ${q(COLLECTION_SLUG)}, NULL, datetime('now', '-2 days'), ${q('sbx-user-kenji-tanaka')})`);

// -- 11. Pay is private: one approved account and one share link for Kenji --
// Amara asked from his page and he approved, so signed in as her the pay
// sheet opens; Wei Chen has no grant, so signed in as him it stays gated.

run(`INSERT INTO payment_access_grants (id, account_id, contributor_id, grantee_user_id, granted_via, status, requested_at, approved_at)
     VALUES (${q(AMARA_GRANT_ID)}, ${q(ACCOUNT_ID)}, ${q('kenji-tanaka')}, ${q('sbx-user-amara-osei')}, 'request', 'approved',
       datetime('now', '-9 days'), datetime('now', '-8 days'))`);
run(`INSERT INTO payment_share_links (id, account_id, contributor_id, invoice_id, token, created_by_user_id, created_at)
     VALUES (${q(KENJI_SHARE_LINK_ID)}, ${q(ACCOUNT_ID)}, ${q('kenji-tanaka')}, NULL, ${q(KENJI_SHARE_TOKEN)}, ${q('sbx-user-kenji-tanaka')}, datetime('now', '-8 days'))`);

console.log('Creator fixtures seeded: wei-chen (sparse), amara-osei (medium), kenji-tanaka (full).');
console.log(`Pay is private: Amara's account is approved for Kenji; Kenji's open pay link is /people/kenji-tanaka/pay?t=${KENJI_SHARE_TOKEN}`);
console.log(`Fixture users sign in with their email and the password "${FIXTURE_PASSWORD}" (sandbox only).`);
console.log('Placeholder Unsplash images throughout; swap before anything ships public.');

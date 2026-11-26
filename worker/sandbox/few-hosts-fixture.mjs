// A few hosts: one approved host and one finished hosted table, for every
// Launch 2 worker to reuse (todo/plans/guests-and-tea-masters-launch-2-run.md,
// slice H1).
//
// Fabricated data only, for the offline fixture shop.
//   - Sign in as ana / ana (user id fh-user-ana). Adrian has approved her as a
//     host (users.host_approved_at and the same mark on her account).
//   - Her personal account fh-account-ana (slug fh-ana-table) is private:
//     public_enabled = 0, kind 'master', owner and personal_inventory_user_id
//     both ana. It is not Bali's and has no shop page.
//   - In it, one finished hosted table "Ana's table, a test sit"
//     (event id fh-event, slug fh-ana-table-test): door 'link',
//     requires_approval 0, public_visibility 'unlisted', network_discovery 0,
//     host_user_id ana, 6 seats.
//   - One confirmed guest, "Rui Guest" (attendee fh-seat-rui, guest page
//     /m/fh-magic-rui), marked attended, with no account and no contact.
//   - A tea menu of two plain names (fh-menu-1, fh-menu-2), no product record.
//   - A second table, a week ahead and open (slice H4): "Ana's next table"
//     (event fh-event-next), by request, 4 seats, with two guests waiting
//     for her yes: "Mei Asks" (fh-seat-mei, a phone number, a note, asked not
//     to be photographed) and "Tao Asks" (fh-seat-tao, no contact).
// The Launch 2 routes stay closed unless the sandbox starts with
// FEW_HOSTS_OPEN=true (src/lib/fewHosts.ts).
import { createHash } from 'node:crypto';

const sha = value => createHash('sha256').update(value).digest('hex');

export const fewHosts = {
  host: { id: 'fh-user-ana', username: 'ana', password: 'ana', email: 'ana@sandbox.test', name: 'Ana Host' },
  accountId: 'fh-account-ana',
  accountSlug: 'fh-ana-table',
  eventId: 'fh-event',
  eventSlug: 'fh-ana-table-test',
  guest: { attendeeId: 'fh-seat-rui', magicToken: 'fh-magic-rui', name: 'Rui Guest' },
  teas: ['fh-menu-1', 'fh-menu-2'],
  next: {
    eventId: 'fh-event-next',
    eventSlug: 'fh-ana-table-next',
    waiting: [
      { attendeeId: 'fh-seat-mei', seatId: 'fh-party-mei', magicToken: 'fh-magic-mei', name: 'Mei Asks' },
      { attendeeId: 'fh-seat-tao', seatId: 'fh-party-tao', magicToken: 'fh-magic-tao', name: 'Tao Asks' },
    ],
  },
};

const f = fewHosts;

export const fewHostsStatements = [
  // The host, approved by the sandbox operator (the platform owner).
  `INSERT INTO users (id, email, name, password_hash, role, username, session_version, email_verified_at, created_at,
     host_approved_at, host_approved_by)
   VALUES ('${f.host.id}', '${f.host.email}', '${f.host.name}', '${sha(f.host.password)}', 'user',
     '${f.host.username}', 0, datetime('now'), datetime('now'), datetime('now', '-7 days'), 'sandbox-operator')`,
  // Her personal account, private, made the way ensurePersonalInventoryAccount makes one.
  `INSERT INTO accounts (id, slug, name, kind, status, public_enabled, owner_user_id, personal_inventory_user_id,
     invoice_prefix, contact_email, host_approved_at, host_approved_by)
   VALUES ('${f.accountId}', '${f.accountSlug}', 'Ana Host’s Tea Chest', 'master', 'active', 0, '${f.host.id}', '${f.host.id}',
     'TEA', '${f.host.email}', datetime('now', '-7 days'), 'sandbox-operator')`,
  `INSERT INTO account_members (account_id, user_id, role, status)
   VALUES ('${f.accountId}', '${f.host.id}', 'owner', 'active')`,
  // The table, finished. A hosted table always sets door, requires_approval to
  // match it, unlisted, never in the network list, and its host.
  `INSERT INTO events (id, account_id, slug, title, event_date, status, lifecycle_status, total_capacity, timezone,
     requires_approval, public_visibility, network_discovery, host_user_id, door, location_name, area_hint)
   VALUES ('${f.eventId}', '${f.accountId}', '${f.eventSlug}', 'Ana’s table, a test sit', date('now', '-3 days'),
     'closed', 'completed', 6, 'Asia/Makassar', 0, 'unlisted', 0, '${f.host.id}', 'link', 'Ana’s home', 'Ubud')`,
  `INSERT INTO event_tea_menu (id, account_id, event_id, product_id, custom_name, brew_order) VALUES
     ('${f.teas[0]}', '${f.accountId}', '${f.eventId}', NULL, 'Spring green from a friend', 1),
     ('${f.teas[1]}', '${f.accountId}', '${f.eventId}', NULL, 'Aged oolong, the last of the tin', 2)`,
  `INSERT INTO event_attendees (id, account_id, event_id, full_name, email, phone_number, magic_token, status, attended) VALUES
     ('${f.guest.attendeeId}', '${f.accountId}', '${f.eventId}', '${f.guest.name}', NULL, NULL, '${f.guest.magicToken}', 'confirmed', 1)`,
  // The next table, by request, with two guests waiting for her yes. Each
  // has the primary party seat a request makes, so a yes goes through the
  // guarded allocator exactly as a real request would.
  `INSERT INTO events (id, account_id, slug, title, event_date, status, lifecycle_status, total_capacity, timezone,
     requires_approval, public_visibility, network_discovery, host_user_id, door, location_name, area_hint)
   VALUES ('${f.next.eventId}', '${f.accountId}', '${f.next.eventSlug}', 'Ana’s next table', strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '+7 days'),
     'active', 'published', 4, 'Asia/Makassar', 1, 'unlisted', 0, '${f.host.id}', 'request', 'Ana’s home', 'Ubud')`,
  `INSERT INTO event_attendees (id, account_id, event_id, full_name, email, phone_number, magic_token, status, notes, photo_consent) VALUES
     ('${f.next.waiting[0].attendeeId}', '${f.accountId}', '${f.next.eventId}', '${f.next.waiting[0].name}', NULL, '+62 812 0000 0001',
       '${f.next.waiting[0].magicToken}', 'requested', 'First time at a tea table.', 0),
     ('${f.next.waiting[1].attendeeId}', '${f.accountId}', '${f.next.eventId}', '${f.next.waiting[1].name}', NULL, NULL,
       '${f.next.waiting[1].magicToken}', 'requested', NULL, 1)`,
  `INSERT INTO event_party_members (id, account_id, event_id, participation_id, full_name, is_primary, seat_status) VALUES
     ('${f.next.waiting[0].seatId}', '${f.accountId}', '${f.next.eventId}', '${f.next.waiting[0].attendeeId}', '${f.next.waiting[0].name}', 1, 'requested'),
     ('${f.next.waiting[1].seatId}', '${f.accountId}', '${f.next.eventId}', '${f.next.waiting[1].attendeeId}', '${f.next.waiting[1].name}', 1, 'requested')`,
];

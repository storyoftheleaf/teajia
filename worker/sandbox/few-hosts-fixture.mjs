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
];

// The review run's extra rows (todo/plans/guests-and-tea-masters-review-run.md, O1).
//
// Fabricated data only, for the offline fixture shop, loaded only when the
// rig prepares a state folder (TEAJIA_REVIEW_FIXTURES=true), so no earlier
// walk sees a row it did not expect.
//
// The walks need one table in each time. Ana already has one finished
// (fh-event) and one a week ahead (fh-event-next). This adds the third:
//   - "Ana's table, on now" (event rv-event-now, slug rv-ana-table-now),
//     in her private account, door 'link', started 30 minutes ago and
//     ending in 90 minutes, 4 seats, with one confirmed guest, "Lin Now"
//     (attendee rv-seat-lin, guest page /m/rv-magic-lin), and one plain tea.
// Times are relative to the moment the state folder is prepared.
import { fewHosts } from './few-hosts-fixture.mjs';

export const reviewFixture = {
  now: { eventId: 'rv-event-now', eventSlug: 'rv-ana-table-now', guest: { attendeeId: 'rv-seat-lin', magicToken: 'rv-magic-lin', name: 'Lin Now' }, tea: 'rv-menu-now' },
};

const f = fewHosts;
const r = reviewFixture.now;
const iso = offset => `strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '${offset}')`;

export const reviewStatements = [
  `INSERT INTO events (id, account_id, slug, title, event_date, event_end_date, status, lifecycle_status, total_capacity, timezone,
     requires_approval, public_visibility, network_discovery, host_user_id, door, location_name, area_hint)
   VALUES ('${r.eventId}', '${f.accountId}', '${r.eventSlug}', 'Ana’s table, on now', ${iso('-30 minutes')}, ${iso('+90 minutes')},
     'active', 'published', 4, 'Asia/Makassar', 0, 'unlisted', 0, '${f.host.id}', 'link', 'Ana’s home', 'Ubud')`,
  `INSERT INTO event_tea_menu (id, account_id, event_id, product_id, custom_name, brew_order) VALUES
     ('${r.tea}', '${f.accountId}', '${r.eventId}', NULL, 'A roasted oolong for the afternoon', 1)`,
  `INSERT INTO event_attendees (id, account_id, event_id, full_name, email, phone_number, magic_token, status, attended) VALUES
     ('${r.guest.attendeeId}', '${f.accountId}', '${r.eventId}', '${r.guest.name}', NULL, NULL, '${r.guest.magicToken}', 'confirmed', 0)`,
];

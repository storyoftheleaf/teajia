/**
 * The people list: who is on it, in which group, in what order.
 * Plan: todo/plans/teajia-family.md, "The people list" (Adrian, 2026-11-21).
 *
 * 1. No photograph, no place on the list. The person's page still answers at
 *    its own address; only the list leaves them out. A photograph placed on
 *    their page counts, and so does one they shared from a tasting: the newest
 *    of those stands as their picture on the list until they place their own.
 * 2. Three groups, in this order: This season (tea creators, tea masters and
 *    the pages from before the family), Founding members (the owner's pick,
 *    made once), The family.
 * 3. The family is ordered quietly. Position is the only reward: no number,
 *    badge or label leaves this file. The figures used to order people are
 *    dropped before the list is sent.
 * 4. The owner's hand stays on it: a pin puts a person at the top of their
 *    group; the one-tap hide (family_hides) takes a page away altogether.
 *
 * 5. Who pours (quiet acknowledgement, todo/plans/guests-and-tea-masters.md):
 *    a plain yes when the person is publicly credited as a host, co-host or
 *    guest host on at least one session that has been completed. It is a yes
 *    or a no and nothing more: never a count, never a weight in the order,
 *    and a session still ahead does not make it yes.
 *
 * The order is worked out inside the one query the list already runs, from
 * two indexed counts per person, so no page load pays for it but the list's own.
 */
import { PHOTO_NOT_HIDDEN, TASTING_NOT_HIDDEN } from './familyPersonTastings';

/** How far back activity counts. Older than this and it has faded. */
export const PEOPLE_LIST_WINDOW_DAYS = 90;
/** One of a person's photographs chosen by the shop for a tea page outweighs anything they do themselves. */
export const PEOPLE_LIST_SHOP_PICK_WEIGHT = 3;
/** How many of the family show before "See everyone". The page reads this number from the contract. */
export { PEOPLE_LIST_FAMILY_SHOWN } from '../../src/lib/familyContract';
import type { PeopleListGroup } from '../../src/lib/familyContract';

const MEDIA_PREFIX = 'https://media.teajia.co/';
const WINDOW = `datetime('now', '-${PEOPLE_LIST_WINDOW_DAYS} days')`;

/**
 * Whether the person has poured at a table: publicly credited as host,
 * co-host or guest host on a session that is over (completed, or completed and
 * since archived) and whose date has passed. An EXISTS, so it stops at the
 * first one and nothing is counted. Needs the contributors row aliased `c`.
 */
export const PEOPLE_LIST_POURS_COLUMN =
  `EXISTS (SELECT 1 FROM event_contributors pec
     JOIN events pe ON pe.id = pec.event_id AND pe.account_id = pec.account_id
    WHERE pec.contributor_id = c.id AND pec.is_public = 1
      AND pec.role IN ('lead_host', 'co_host', 'guest_host')
      AND pe.lifecycle_status IN ('completed', 'archived')
      AND pe.event_date <= datetime('now'))`;

/**
 * The columns the order needs. Needs the contributors row aliased `c`.
 * list_days_shared: the days in the window on which they shared a tasting, so
 * sharing five teas in one day counts once and posting more earns nothing extra.
 * list_shop_picks: their photographs the shop put on a tea page in the window.
 */
export const PEOPLE_LIST_COLUMNS =
  `c.founding_member, c.list_pinned_at,
   (SELECT COUNT(DISTINCT date(COALESCE(s.shared_at, s.updated_at))) FROM member_tasting_shares s
     WHERE s.author_user_id = c.user_id AND s.share_state IN ('page', 'offered')
       AND COALESCE(s.shared_at, s.updated_at) >= ${WINDOW} AND ${TASTING_NOT_HIDDEN}) AS list_days_shared,
   (SELECT COUNT(*) FROM member_photographs p
     WHERE p.author_user_id = c.user_id AND p.shop_use IN ('placed', 'lead')
       AND p.shop_decided_at >= ${WINDOW} AND ${PHOTO_NOT_HIDDEN}) AS list_shop_picks,
   (SELECT p.small_key FROM member_photographs p
     WHERE p.author_user_id = c.user_id AND p.share_state IN ('page', 'offered')
       AND p.removed_by_member_at IS NULL AND ${PHOTO_NOT_HIDDEN}
     ORDER BY p.created_at DESC, p.id DESC LIMIT 1) AS list_tasting_photo_key,
   ${PEOPLE_LIST_POURS_COLUMN} AS list_pours`;

type Listed = {
  display_name: string;
  card_image_url?: string | null;
  avatar_url?: string | null;
  page_tier?: string | null;
  family_last_active?: string | null;
  founding_member?: unknown;
  list_pinned_at?: unknown;
  list_days_shared?: unknown;
  list_shop_picks?: unknown;
  list_tasting_photo_key?: unknown;
  list_pours?: unknown;
};

const GROUP_ORDER: Record<PeopleListGroup, number> = { season: 0, founding: 1, family: 2 };

function groupOf(person: Listed): PeopleListGroup {
  if (Number(person.founding_member) === 1) return 'founding';
  return person.page_tier === 'family' ? 'family' : 'season';
}

const byName = (a: Listed, b: Listed) => a.display_name.localeCompare(b.display_name);

/** Pinned people first, in the order they were pinned. */
function byPin(a: Listed, b: Listed): number {
  const pinA = typeof a.list_pinned_at === 'string' && a.list_pinned_at ? a.list_pinned_at : null;
  const pinB = typeof b.list_pinned_at === 'string' && b.list_pinned_at ? b.list_pinned_at : null;
  if (pinA && pinB) return pinA.localeCompare(pinB);
  if (pinA) return -1;
  if (pinB) return 1;
  return 0;
}

const quietScore = (person: Listed) =>
  Number(person.list_days_shared || 0) + PEOPLE_LIST_SHOP_PICK_WEIGHT * Number(person.list_shop_picks || 0);

/**
 * The list as the page shows it: only people with a photograph, grouped and
 * ordered, each carrying its group and nothing that says why it sits where it does.
 */
export function arrangePeopleList<T extends Listed>(people: T[]): Array<Omit<T, 'founding_member' | 'list_pinned_at' | 'list_days_shared' | 'list_shop_picks' | 'list_tasting_photo_key' | 'list_pours'> & { list_group: PeopleListGroup; pours: boolean }> {
  return people
    // A photograph on their page stands first; without one, the newest they shared from a tasting.
    .map(person => (person.card_image_url || person.avatar_url || typeof person.list_tasting_photo_key !== 'string' || !person.list_tasting_photo_key
      ? person
      : { ...person, card_image_url: `${MEDIA_PREFIX}${person.list_tasting_photo_key}` }))
    .filter(person => Boolean(person.card_image_url || person.avatar_url))
    .map(person => ({ person, group: groupOf(person) }))
    .sort((a, b) =>
      GROUP_ORDER[a.group] - GROUP_ORDER[b.group]
      || byPin(a.person, b.person)
      || (a.group === 'family'
        ? quietScore(b.person) - quietScore(a.person)
          || String(b.person.family_last_active ?? '').localeCompare(String(a.person.family_last_active ?? ''))
        : 0)
      || byName(a.person, b.person))
    .map(({ person, group }) => {
      const { founding_member: _f, list_pinned_at: _p, list_days_shared: _d, list_shop_picks: _s, list_tasting_photo_key: _k, list_pours: pours, ...shown } = person;
      return { ...shown, list_group: group, pours: Number(pours) === 1 || pours === true };
    });
}

/** What the owner's editor reads back: the two choices, nothing else. */
export function peopleListPlace(row: { founding_member?: unknown; list_pinned_at?: unknown }): { founding: boolean; pinned: boolean } {
  return { founding: Number(row.founding_member) === 1, pinned: typeof row.list_pinned_at === 'string' && row.list_pinned_at !== '' };
}

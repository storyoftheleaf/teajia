// Who hosts a session: one rule, read by "Hosted by" on the public page, the
// order credit (orderSessionSource.ts) and who may hold a guest's link
// (guestLinkHolders.ts). Launch 2, audit A2, finding F8.
//
// The host is events.host_user_id when it is set. Otherwise it is the
// session's lead host as the public page names them: the first lead_host
// contributor (by display order) that is shown on the session (is_public = 1)
// and whose page is published. A lead host the public page does not name is
// nobody's host, so it neither takes the credit nor holds guest links.
import { FAMILY_PAGE_NOT_HIDDEN_SQL } from './familyPersonTastings';

// A person page counts as published when it was published, or (unless
// somebody pressed Unpublish, which writes unpublished_at) when it is the
// named author of a published article. On 2026-09-28 Adrian unpublished Chen
// Wei and the page stayed up, because Chen Wei is the named author of five
// published articles. An explicit decision to take a person down must take
// them down; publishing them again clears unpublished_at.
export const CONTRIBUTOR_EFFECTIVELY_PUBLISHED_SQL =
  `(c.is_published = 1 OR (c.unpublished_at IS NULL AND EXISTS (
      SELECT 1 FROM articles ar WHERE ar.author_id = c.id AND ar.status = 'published'
    ))) AND ${FAMILY_PAGE_NOT_HIDDEN_SQL}`;

/** SQL for one column of the session's public lead host, for an events alias. */
export function publicLeadHostSql(event: string, column: 'c.id' | 'c.user_id' | 'c.display_name'): string {
  return `(SELECT ${column} FROM event_contributors ec JOIN contributors c ON c.id = ec.contributor_id
      WHERE ec.event_id = ${event}.id AND ec.account_id = ${event}.account_id AND ec.role = 'lead_host'
        AND ec.is_public = 1 AND ${CONTRIBUTOR_EFFECTIVELY_PUBLISHED_SQL}
      ORDER BY ec.display_order ASC, ec.id ASC LIMIT 1)`;
}

/** SQL for the session's host user, for an events alias. Null when the host has no user. */
export function sessionHostUserSql(event: string): string {
  return `COALESCE(${event}.host_user_id, ${publicLeadHostSql(event, 'c.user_id')})`;
}

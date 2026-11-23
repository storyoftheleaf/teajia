import { currentAfterSitLink } from './afterSitCredential';
import { privateAttendeeSeatMatch } from './privateSessionReflections';
import { eraseKeptSetup } from './privateKeptSetupPhotos';

type Scope = { accountId: string; userId: string };
type Tea = { id: string; name: string; productId?: string };
type KeptSetupRow = {
  event_id: string;
  event_title: string;
  event_date: string;
  teas_json: string;
  saved_at: string;
};

const teaName = "COALESCE(NULLIF(trim(m.custom_name), ''), NULLIF(trim(p.given_name), ''), NULLIF(trim(p.product_name), ''))";
export const namedSetupTeas = `
  SELECT m.id, ${teaName} AS name, p.id AS product_id
  FROM event_tea_menu m
  LEFT JOIN products p ON p.id = m.product_id AND p.account_id = m.account_id
  WHERE m.event_id = a.event_id AND m.account_id = a.account_id
    AND (m.reveal_date IS NULL OR datetime(m.reveal_date) <= datetime('now'))
    AND ${teaName} IS NOT NULL
  ORDER BY m.brew_order ASC NULLS LAST, m.id ASC
`;
type SetupAccess = string | { credentialHash: string };

function setupEligibility(scope: Scope, access: SetupAccess) {
  const legacy = typeof access === 'string';
  return {
    sql: `${legacy ? 'a.magic_token = ?' : currentAfterSitLink}
      AND ${privateAttendeeSeatMatch} ${legacy ? `AND EXISTS (${namedSetupTeas})` : ''}`,
    binds: [legacy ? access : access.credentialHash, scope.accountId, scope.userId, scope.userId],
  };
}

export async function getKeptSetup(db: D1Database, scope: Scope, access: SetupAccess) {
  const { sql, binds } = setupEligibility(scope, access);
  return db.prepare(
    `SELECT a.event_id, k.saved_at
     FROM event_attendees a
     LEFT JOIN private_kept_setups k ON k.event_id = a.event_id
       AND k.account_id = a.account_id AND k.user_id = ?
     WHERE ${sql}`
  ).bind(scope.userId, ...binds).first<{ event_id: string; saved_at: string | null }>();
}

export async function saveKeptSetup(db: D1Database, scope: Scope, access: SetupAccess) {
  const { sql, binds } = setupEligibility(scope, access);
  await db.batch([
    db.prepare(
      `UPDATE event_attendees AS a SET user_id = ?
       WHERE a.user_id IS NULL AND ${sql}`
    ).bind(scope.userId, ...binds),
    db.prepare(
      `INSERT INTO private_kept_setups (account_id, user_id, event_id, event_title, event_date, teas_json, saved_at)
       SELECT a.account_id, ?, a.event_id, e.title, e.event_date,
              (SELECT json_group_array(json_patch(
                json_object('id', tea.id, 'name', tea.name),
                json_object('productId', tea.product_id)
              )) FROM (${namedSetupTeas}) AS tea), ?
       FROM event_attendees a JOIN events e ON e.id = a.event_id AND e.account_id = a.account_id
       WHERE ${sql}
       ON CONFLICT(account_id, user_id, event_id) DO NOTHING`
    ).bind(scope.userId, new Date().toISOString(), ...binds),
  ]);
  return getKeptSetup(db, scope, access);
}

export async function removeKeptSetupFromGuestLink(db: D1Database, scope: Scope, token: string) {
  const attendee = await db.prepare(
    'SELECT event_id FROM event_attendees WHERE magic_token = ? AND account_id = ? AND user_id = ?'
  ).bind(token, scope.accountId, scope.userId).first<{ event_id: string }>();
  return attendee ? eraseKeptSetup(db, scope, attendee.event_id) : true;
}

export async function listKeptSetups(db: D1Database, scope: { accountId: string | null; userId: string }) {
  const { results } = await db.prepare(
    `SELECT event_id, event_title, event_date, teas_json, saved_at
     FROM private_kept_setups WHERE user_id = ? AND (? IS NULL OR account_id = ?)
     ORDER BY saved_at DESC LIMIT 100`
  ).bind(scope.userId, scope.accountId, scope.accountId).all<KeptSetupRow>();
  return results.map(({ teas_json, ...row }) => ({ ...row, teas: JSON.parse(teas_json) as Tea[] }));
}

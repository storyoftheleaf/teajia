/**
 * Seeds the LOCAL sandbox database with one owner-tier operator so an agent can
 * sign in to /admin and click things without touching the live shop.
 *
 * This account exists only in worker/.wrangler/state (gitignored, local disk).
 * It is never deployed, never exported, and the live database has no row like
 * it. The password is a fixed dev string on purpose: the point of the sandbox
 * is that nothing here is worth protecting.
 *
 * Run via: npm run sandbox:seed  (from worker/)
 */
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

const EMAIL = 'sandbox@localhost';
const USERNAME = 'sandbox';
const PASSWORD = 'sandbox';
const USER_ID = 'sandbox-operator';
/** Legacy SHA-256 hex, the shape verifyPasswordHash() accepts for old rows. */
const HASH = createHash('sha256').update(PASSWORD).digest('hex');

const ACCOUNTS = ['acc_teajia_bali', 'acc_teajia_australia'];

const statements = [
  `DELETE FROM account_members WHERE user_id = '${USER_ID}'`,
  `DELETE FROM users WHERE id = '${USER_ID}'`,
  // email_verified_at must be set: sign-in refuses an unverified address, and
  // there is no inbox on a local sandbox to click a link in.
  `INSERT INTO users (id, email, name, password_hash, role, username, platform_role,
     admin_request_status, can_create_collections, shelf_enabled, session_version,
     email_verified_at, created_at)
   VALUES ('${USER_ID}', '${EMAIL}', 'Sandbox Operator', '${HASH}', 'owner', '${USERNAME}',
     'platform_owner', 'approved', 1, 1, 0,
     datetime('now'), datetime('now'))`,
  ...ACCOUNTS.map(accountId =>
    `INSERT INTO account_members (id, account_id, user_id, role, joined_at, status)
     VALUES (lower(hex(randomblob(16))), '${accountId}', '${USER_ID}', 'owner', datetime('now'), 'active')`
  ),
];

for (const sql of statements) {
  execFileSync(
    'npx',
    ['wrangler', 'd1', 'execute', 'teajia-db', '--local', '--command', sql.replace(/\s+/g, ' ')],
    { stdio: ['ignore', 'ignore', 'inherit'] },
  );
}

console.log(`Sandbox operator ready: sign in as "${USERNAME}" / "${PASSWORD}" at http://localhost:7777/admin`);
console.log(`Owner on: ${ACCOUNTS.join(', ')}`);

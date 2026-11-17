import { createHash } from 'node:crypto';

export const sandboxUsername = 'sandbox';
export const sandboxPassword = 'sandbox';
export const sandboxUserId = 'sandbox-operator';
export const sandboxAccountIds = ['acc_teajia_bali', 'acc_teajia_australia'];

/** Legacy SHA-256 hex, the shape verifyPasswordHash() accepts for old rows. */
const passwordHash = createHash('sha256').update(sandboxPassword).digest('hex');

export const sandboxOperatorStatements = [
  `DELETE FROM account_members WHERE user_id = '${sandboxUserId}'`,
  `DELETE FROM users WHERE id = '${sandboxUserId}'`,
  // The sandbox has no inbox. Mark this fixture email verified for sign-in.
  `INSERT INTO users (id, email, name, password_hash, role, username, platform_role,
     admin_request_status, can_create_collections, shelf_enabled, session_version,
     email_verified_at, created_at)
   VALUES ('${sandboxUserId}', 'sandbox@localhost', 'Sandbox Operator', '${passwordHash}', 'owner',
     '${sandboxUsername}', 'platform_owner', 'approved', 1, 1, 0, datetime('now'), datetime('now'))`,
  ...sandboxAccountIds.map(accountId =>
    `INSERT INTO account_members (id, account_id, user_id, role, joined_at, status)
     VALUES (lower(hex(randomblob(16))), '${accountId}', '${sandboxUserId}', 'owner', datetime('now'), 'active')`
  ),
];

export const WISDOM_VERIFICATION_ENTRY_KINDS = [
  'cultivar',
  'region',
  'producer',
  'style',
  'mark',
  'namedTea',
] as const;

export type WisdomVerificationEntryKind = typeof WISDOM_VERIFICATION_ENTRY_KINDS[number];

export interface WisdomVerificationReceipt {
  entry_kind: WisdomVerificationEntryKind;
  entry_id: string;
  content_hash: string;
  verified_at: string;
}

type VerificationDatabase = Pick<D1Database, 'prepare'>;

const ENTRY_KIND_SET = new Set<string>(WISDOM_VERIFICATION_ENTRY_KINDS);
const ENTRY_ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,127}$/;
const CONTENT_HASH_PATTERN = /^[a-f0-9]{64}$/;

export function validWisdomVerificationTarget(
  entryKind: string,
  entryId: string,
): entryKind is WisdomVerificationEntryKind {
  return ENTRY_KIND_SET.has(entryKind) && ENTRY_ID_PATTERN.test(entryId);
}

export function validWisdomVerificationHash(value: unknown): value is string {
  return typeof value === 'string' && CONTENT_HASH_PATTERN.test(value);
}

function publicReceipt(row: Record<string, unknown> | null): WisdomVerificationReceipt | null {
  if (!row) return null;
  return {
    entry_kind: row.entry_kind as WisdomVerificationEntryKind,
    entry_id: row.entry_id as string,
    content_hash: row.content_hash as string,
    verified_at: row.verified_at as string,
  };
}

export async function getWisdomVerification(
  db: VerificationDatabase,
  accountId: string,
  entryKind: WisdomVerificationEntryKind,
  entryId: string,
): Promise<WisdomVerificationReceipt | null> {
  const row = await db.prepare(
    `SELECT entry_kind, entry_id, content_hash, verified_at
     FROM wisdom_entry_verifications
     WHERE account_id = ? AND entry_kind = ? AND entry_id = ?`,
  ).bind(accountId, entryKind, entryId).first<Record<string, unknown>>();
  return publicReceipt(row);
}

export async function putWisdomVerification(
  db: VerificationDatabase,
  input: {
    accountId: string;
    entryKind: WisdomVerificationEntryKind;
    entryId: string;
    contentHash: string;
    verifiedByUserId: string;
    verifiedAt: string;
    id: string;
  },
): Promise<WisdomVerificationReceipt> {
  await db.prepare(
    `INSERT INTO wisdom_entry_verifications
       (id, account_id, entry_kind, entry_id, content_hash, verified_by_user_id, verified_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(account_id, entry_kind, entry_id) DO UPDATE SET
       content_hash = excluded.content_hash,
       verified_by_user_id = excluded.verified_by_user_id,
       verified_at = excluded.verified_at`,
  ).bind(
    input.id,
    input.accountId,
    input.entryKind,
    input.entryId,
    input.contentHash,
    input.verifiedByUserId,
    input.verifiedAt,
  ).run();

  return {
    entry_kind: input.entryKind,
    entry_id: input.entryId,
    content_hash: input.contentHash,
    verified_at: input.verifiedAt,
  };
}

export async function deleteWisdomVerification(
  db: VerificationDatabase,
  accountId: string,
  entryKind: WisdomVerificationEntryKind,
  entryId: string,
): Promise<WisdomVerificationReceipt | null> {
  const existing = await getWisdomVerification(db, accountId, entryKind, entryId);
  if (!existing) return null;
  await db.prepare(
    `DELETE FROM wisdom_entry_verifications
     WHERE account_id = ? AND entry_kind = ? AND entry_id = ?`,
  ).bind(accountId, entryKind, entryId).run();
  return existing;
}

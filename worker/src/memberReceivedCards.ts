type CardScope = { accountId: string; userId: string };
type Share = {
  id: string;
  source_entry_id: string;
  shared_metadata: string | null;
  tea_key: string | null;
};

function metadata(value: string | null): Record<string, unknown> {
  try {
    const parsed = JSON.parse(value || '{}');
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch { return {}; }
}
const text = (value: unknown) => typeof value === 'string' && value.trim() ? value : null;

export function receivedCard(row: Record<string, unknown>) {
  return {
    id: row.receipt_id,
    entry_id: row.entry_id,
    name: row.name,
    chinese_name: row.chinese_name,
    type: row.type,
    form: row.form,
    year: row.year,
    origin_region: row.origin_region,
    category: row.category,
    material: row.material,
    capacity_ml: row.capacity_ml,
    claimed_at: row.claimed_at,
  };
}

/** Only a receipt written by this claim path qualifies a Compass record as received. */
export async function listReceivedCards(db: D1Database, scope: CardScope, receiptId?: string) {
  const query = db.prepare(
    `SELECT r.id AS receipt_id, r.entry_id, r.claimed_at,
            e.name, e.chinese_name, e.type, e.form, e.year, e.origin_region,
            e.category, e.material, e.capacity_ml
     FROM compass_claim_receipts r
     JOIN tea_compass_entries e ON e.id = r.entry_id AND e.account_id = r.account_id AND e.user_id = r.user_id
     WHERE r.account_id = ? AND r.user_id = ?
       AND e.deleted_at IS NULL AND e.archived_at IS NULL AND e.merged_into_id IS NULL
       ${receiptId ? 'AND r.id = ?' : ''}
     ORDER BY r.claimed_at DESC, r.id DESC LIMIT 100`
  );
  const result = await query.bind(scope.accountId, scope.userId, ...(receiptId ? [receiptId] : [])).all<Record<string, unknown>>();
  return result.results.map(receivedCard);
}

async function receiptIdentity(scope: CardScope, sourceId: string) {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify([
    scope.accountId, scope.userId, sourceId,
  ])));
  return Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, '0')).join('');
}

/** D1 batch is atomic. Deterministic IDs and uniqueness make concurrent claims converge. */
export async function claimReceivedCard(db: D1Database, scope: CardScope, share: Share, direct = false) {
  const identity = await receiptIdentity(scope, share.source_entry_id);
  const entryId = 'received_' + identity;
  const receiptId = 'claim_' + identity;
  const meta = metadata(share.shared_metadata);
  const now = new Date().toISOString();
  const prior = await db.prepare(
    'SELECT entry_id FROM compass_claim_receipts WHERE account_id = ? AND user_id = ? AND source_entry_id = ?'
  ).bind(scope.accountId, scope.userId, share.source_entry_id).first();

  const year = typeof meta.year === 'number' || typeof meta.year === 'string' ? meta.year : null;
  const capacity = typeof meta.capacityMl === 'number' && Number.isFinite(meta.capacityMl) ? meta.capacityMl : null;
  const permission = direct ? "(s.status = 'pending' OR (s.status = 'accepted' AND s.claimed_by_user_id = ?)) AND s.target_account_id = ?" : "s.status = 'pending'";
  const permissionBinds = direct ? [scope.userId, scope.accountId] : [];
  const available = `EXISTS (SELECT 1 FROM compass_shares s WHERE s.id = ? AND ${permission})`;

  await db.batch([
    db.prepare(
      `INSERT INTO tea_compass_entries
         (id, user_id, account_id, name, chinese_name, type, form, year, season, origin_region,
          category, teaware_category, material, capacity_ml, photos, tea_key, source_entry_id,
          status, notes, quantity, price_currency, created_at, updated_at)
       SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '[]', ?, ?, 'incoming', '', 1, 'NT', ?, ?
       WHERE ${available}
         AND NOT EXISTS (SELECT 1 FROM compass_claim_receipts WHERE account_id = ? AND user_id = ? AND source_entry_id = ?)
       ON CONFLICT(id) DO NOTHING`
    ).bind(
      entryId, scope.userId, scope.accountId, text(meta.name) || 'Tea', text(meta.chineseName),
      text(meta.type), text(meta.form), year, text(meta.season), text(meta.originRegion),
      text(meta.category) || 'tea', text(meta.teawareCategory), text(meta.material), capacity,
      text(meta.teaKey) || share.tea_key, share.source_entry_id, now, now,
      share.id, ...permissionBinds, scope.accountId, scope.userId, share.source_entry_id,
    ),
    db.prepare(
      `INSERT INTO compass_claim_receipts (id, account_id, user_id, source_entry_id, share_id, entry_id, claimed_at)
       SELECT ?, ?, ?, ?, ?, e.id, ?
       FROM tea_compass_entries e
       WHERE e.id = ? AND e.account_id = ? AND e.user_id = ? AND e.source_entry_id = ?
         AND e.status = 'incoming' AND e.source_invoice_id IS NULL AND e.source_invoice_line_id IS NULL
         AND ${available}
       ON CONFLICT(account_id, user_id, source_entry_id) DO NOTHING`
    ).bind(
      receiptId, scope.accountId, scope.userId, share.source_entry_id, share.id, now,
      entryId, scope.accountId, scope.userId, share.source_entry_id, share.id, ...permissionBinds,
    ),
    db.prepare(
      `UPDATE compass_shares AS s SET claimed_by_user_id = ?, claimed_at = ?${direct ? ", status = 'accepted'" : ''}
       WHERE id = ? AND ${direct ? permission : "status = 'pending'"}
         AND EXISTS (SELECT 1 FROM compass_claim_receipts WHERE id = ? AND account_id = ? AND user_id = ?)`
    ).bind(scope.userId, now, share.id, ...permissionBinds, receiptId, scope.accountId, scope.userId),
  ]);

  const entry = await db.prepare(
    `SELECT e.* FROM compass_claim_receipts r JOIN tea_compass_entries e
       ON e.id = r.entry_id AND e.account_id = r.account_id AND e.user_id = r.user_id
     WHERE r.id = ? AND r.account_id = ? AND r.user_id = ?`
  ).bind(receiptId, scope.accountId, scope.userId).first();
  if (!entry) return null;
  return { entry, receipt_id: receiptId, already_claimed: Boolean(prior), share_id: share.id };
}

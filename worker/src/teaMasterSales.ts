import { isTeaType } from '../../src/wisdom/vocabulary';

// ── Currency canonicalization ──
// The exchange_rates table keys CNY as 'Yuan' (not the ISO code 'CNY'). Callers
// may pass 'CNY', 'CN¥', 'RMB', 'yuán', etc. Map every alias to the canonical
// key so the rate always resolves and pricing never silently falls back to USD.
const CURRENCY_ALIASES: Record<string, string> = {
  'cny': 'Yuan',
  'rmb': 'Yuan',
  'renminbi': 'Yuan',
  'yuan': 'Yuan',
  'yuán': 'Yuan',
  '¥': 'Yuan',
  'cn¥': 'Yuan',
  'mop': 'HKD',       // Macau pataca trades near the HK dollar; treat as HKD
  'cnh': 'Yuan',      // offshore yuan — same rate family
};
export function canonicalCurrency(cur: string | null | undefined): string | null {
  if (!cur) return null;
  return CURRENCY_ALIASES[cur.toLowerCase()] ?? cur;
}

export type SalePermissionReason = 'account_owner' | 'location_stock' | 'own_stock' | 'active_grant' | 'grant_required';

export interface SalesGrantTerms {
  id: string;
  accountId: string;
  productId: string;
  sellerUserId: string;
  priceFloor: number | null;
  quantityLimit: number | null;
  startsAt: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
}

type GrantValidationReason =
  | 'grant_account_mismatch'
  | 'grant_product_mismatch'
  | 'grant_seller_mismatch'
  | 'grant_inactive'
  | 'price_below_floor'
  | 'quantity_limit_exceeded';

const timestamp = (value: string): number => {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
};

export function isGrantActive(grant: SalesGrantTerms, now: string | Date = new Date()): boolean {
  if (grant.revokedAt) return false;
  const nowValue = now instanceof Date ? now.getTime() : timestamp(now);
  if (!Number.isFinite(nowValue)) return false;
  if (grant.startsAt && (!Number.isFinite(timestamp(grant.startsAt)) || timestamp(grant.startsAt) > nowValue)) return false;
  if (grant.expiresAt && (!Number.isFinite(timestamp(grant.expiresAt)) || timestamp(grant.expiresAt) <= nowValue)) return false;
  return true;
}

export function validateGrantTerms(input: {
  grant: SalesGrantTerms;
  accountId: string;
  productId: string;
  sellerUserId: string;
  quantity: number;
  unitPrice: number;
  now?: string | Date;
}): { ok: true } | { ok: false; reason: GrantValidationReason } {
  if (input.grant.accountId !== input.accountId) return { ok: false, reason: 'grant_account_mismatch' };
  if (input.grant.productId !== input.productId) return { ok: false, reason: 'grant_product_mismatch' };
  if (input.grant.sellerUserId !== input.sellerUserId) return { ok: false, reason: 'grant_seller_mismatch' };
  if (!isGrantActive(input.grant, input.now)) return { ok: false, reason: 'grant_inactive' };
  if (input.grant.priceFloor != null && input.unitPrice < input.grant.priceFloor) return { ok: false, reason: 'price_below_floor' };
  if (input.grant.quantityLimit != null && input.quantity > input.grant.quantityLimit) return { ok: false, reason: 'quantity_limit_exceeded' };
  return { ok: true };
}

export function resolveSalePermission(input: {
  actorRole: string;
  actorUserId: string;
  stockOwnerUserId: string | null;
  activeGrant: SalesGrantTerms | null;
}): { allowed: true; reason: SalePermissionReason; grantId?: string } | { allowed: false; reason: SalePermissionReason } {
  if (input.actorRole === 'owner') return { allowed: true, reason: 'account_owner' };
  if (input.stockOwnerUserId == null) return { allowed: true, reason: 'location_stock' };
  if (input.stockOwnerUserId === input.actorUserId) return { allowed: true, reason: 'own_stock' };
  if (input.activeGrant) return { allowed: true, reason: 'active_grant', grantId: input.activeGrant.id };
  return { allowed: false, reason: 'grant_required' };
}

const currency = (value: number): number => Math.round((value + Number.EPSILON) * 100) / 100;

export function calculateSettlement(input: {
  gross: number;
  ownerShareType: 'percent' | 'fixed';
  ownerShareValue: number;
}): { ownerAmount: number; sellerAmount: number } {
  if (!Number.isFinite(input.gross) || input.gross < 0 || !Number.isFinite(input.ownerShareValue)) {
    throw new RangeError('Settlement values must be finite and gross must be non-negative');
  }
  const rawOwner = input.ownerShareType === 'percent'
    ? input.gross * input.ownerShareValue / 100
    : input.ownerShareValue;
  const ownerAmount = currency(Math.min(input.gross, Math.max(0, rawOwner)));
  return { ownerAmount, sellerAmount: currency(Math.max(0, input.gross - ownerAmount)) };
}

export class SalesInvariantError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    readonly details: Record<string, unknown> = {},
  ) {
    super(code);
  }
}

export interface InvoiceSaleLineInput {
  id?: string;
  product_id?: string | null;
  custom_name?: string | null;
  quantity: number;
  price_at_sale: number;
}

export interface AuthorizedInvoiceLine extends InvoiceSaleLineInput {
  product_id: string | null;
  stock_owner_user_id: string | null;
  sales_grant_id: string | null;
  owner_share_type: 'percent' | 'fixed';
  owner_share_value: number;
}

export function resolvePaymentRecipientUserId(
  lines: Array<Pick<AuthorizedInvoiceLine, 'product_id' | 'stock_owner_user_id'>>,
): string | null {
  const owners = new Set(lines.filter(line => line.product_id).map(line => line.stock_owner_user_id));
  return owners.size === 1 ? [...owners][0] : null;
}

function grantFromRow(row: Record<string, unknown>): SalesGrantTerms {
  return {
    id: String(row.id), accountId: String(row.account_id), productId: String(row.product_id),
    sellerUserId: String(row.seller_user_id),
    priceFloor: row.price_floor == null ? null : Number(row.price_floor),
    quantityLimit: row.quantity_limit == null ? null : Number(row.quantity_limit),
    startsAt: row.starts_at == null ? null : String(row.starts_at),
    expiresAt: row.expires_at == null ? null : String(row.expires_at),
    revokedAt: row.revoked_at == null ? null : String(row.revoked_at),
  };
}

export async function authorizeInvoiceLines(env: { DB: D1Database }, input: {
  accountId: string;
  actorUserId: string;
  actorRole: string;
  lines: InvoiceSaleLineInput[];
  now?: string | Date;
}): Promise<AuthorizedInvoiceLine[]> {
  const authorized: AuthorizedInvoiceLine[] = [];
  const quantityByProduct = new Map<string, number>();
  for (const line of input.lines) {
    if (!line.product_id) continue;
    quantityByProduct.set(line.product_id, (quantityByProduct.get(line.product_id) ?? 0) + Number(line.quantity));
  }
  for (const line of input.lines) {
    const quantity = Number(line.quantity);
    const unitPrice = Number(line.price_at_sale);
    if (!Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(unitPrice) || unitPrice < 0) {
      throw new SalesInvariantError(400, 'invalid_invoice_line');
    }
    if (!line.product_id) {
      authorized.push({ ...line, product_id: null, stock_owner_user_id: null, sales_grant_id: null, owner_share_type: 'percent', owner_share_value: 100 });
      continue;
    }
    let product: Record<string, unknown> | null;
    try {
      product = await env.DB.prepare(
        'SELECT id, owner_user_id, status, type FROM products WHERE id = ? AND account_id = ?'
      ).bind(line.product_id, input.accountId).first() as Record<string, unknown> | null;
    } catch {
      throw new SalesInvariantError(503, 'sales_authorization_unavailable');
    }
    if (!product) throw new SalesInvariantError(404, 'product_not_found', { product_id: line.product_id });
    if (product.status !== 'Active' || !isTeaType(String(product.type ?? ''))) {
      throw new SalesInvariantError(400, 'product_not_sale_eligible', { product_id: line.product_id });
    }
    const stockOwnerUserId = product.owner_user_id == null ? null : String(product.owner_user_id);
    let grantRow: Record<string, unknown> | null = null;
    if (input.actorRole !== 'owner' && stockOwnerUserId && stockOwnerUserId !== input.actorUserId) {
      try {
        grantRow = await env.DB.prepare(
          `SELECT * FROM sales_grants
           WHERE account_id = ? AND product_id = ? AND seller_user_id = ? AND revoked_at IS NULL
             AND (starts_at IS NULL OR starts_at <= datetime('now'))
             AND (expires_at IS NULL OR expires_at > datetime('now'))
           ORDER BY created_at DESC, id DESC LIMIT 1`
        ).bind(input.accountId, line.product_id, input.actorUserId).first() as Record<string, unknown> | null;
      } catch {
        throw new SalesInvariantError(503, 'sales_authorization_unavailable');
      }
    }
    const grant = grantRow ? grantFromRow(grantRow) : null;
    const permission = resolveSalePermission({
      actorRole: input.actorRole, actorUserId: input.actorUserId, stockOwnerUserId, activeGrant: grant,
    });
    if (!permission.allowed) throw new SalesInvariantError(403, 'sale_grant_required', { product_id: line.product_id });
    if (grant) {
      const validation = validateGrantTerms({
        grant, accountId: input.accountId, productId: line.product_id,
        sellerUserId: input.actorUserId, quantity: quantityByProduct.get(line.product_id) ?? quantity, unitPrice, now: input.now,
      });
      if (!validation.ok) throw new SalesInvariantError(400, validation.reason, { product_id: line.product_id });
    }
    authorized.push({
      ...line, product_id: line.product_id, stock_owner_user_id: stockOwnerUserId,
      sales_grant_id: grant?.id ?? null,
      owner_share_type: grantRow?.owner_share_type === 'fixed' ? 'fixed' : 'percent',
      owner_share_value: grantRow == null ? 100 : Number(grantRow.owner_share_value),
    });
  }
  return authorized;
}

export async function validateInvoiceLineSnapshots(env: { DB: D1Database }, input: {
  accountId: string;
  sellerUserId: string;
  sellerRole: string;
  lines: AuthorizedInvoiceLine[];
}): Promise<void> {
  for (const line of input.lines) {
    const quantity = Number(line.quantity);
    const unitPrice = Number(line.price_at_sale);
    const shareValue = Number(line.owner_share_value);
    if (!Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(unitPrice) || unitPrice < 0) {
      throw new SalesInvariantError(409, 'invalid_invoice_sale_snapshot');
    }
    if (!['percent', 'fixed'].includes(line.owner_share_type) || !Number.isFinite(shareValue) || shareValue < 0) {
      throw new SalesInvariantError(409, 'invalid_invoice_sale_snapshot');
    }
    if (!line.product_id) {
      if (line.stock_owner_user_id != null || line.sales_grant_id != null) {
        throw new SalesInvariantError(409, 'invalid_invoice_sale_snapshot');
      }
      continue;
    }
    let product: Record<string, unknown> | null;
    try {
      product = await env.DB.prepare(
        'SELECT id,owner_user_id FROM products WHERE id=? AND account_id=?'
      ).bind(line.product_id, input.accountId).first() as Record<string, unknown> | null;
    } catch {
      throw new SalesInvariantError(503, 'sales_authorization_unavailable');
    }
    if (!product) throw new SalesInvariantError(409, 'invalid_invoice_sale_snapshot', { product_id: line.product_id });
    const productOwner = product.owner_user_id == null ? null : String(product.owner_user_id);
    if (productOwner !== (line.stock_owner_user_id ?? null)) {
      throw new SalesInvariantError(409, 'invalid_invoice_sale_snapshot', { product_id: line.product_id });
    }

    let historicalGrant: Record<string, unknown> | null = null;
    if (line.sales_grant_id) {
      try {
        historicalGrant = await env.DB.prepare(
          `SELECT id FROM sales_grants
           WHERE id=? AND account_id=? AND product_id=? AND seller_user_id=?`
        ).bind(line.sales_grant_id, input.accountId, line.product_id, input.sellerUserId).first() as Record<string, unknown> | null;
      } catch {
        throw new SalesInvariantError(503, 'sales_authorization_unavailable');
      }
      if (!historicalGrant) throw new SalesInvariantError(409, 'invalid_invoice_sale_snapshot', { product_id: line.product_id });
    }
    const permission = resolveSalePermission({
      actorRole: input.sellerRole,
      actorUserId: input.sellerUserId,
      stockOwnerUserId: productOwner,
      activeGrant: historicalGrant ? { id: String(historicalGrant.id) } as SalesGrantTerms : null,
    });
    if (!permission.allowed) throw new SalesInvariantError(409, 'invalid_invoice_sale_snapshot', { product_id: line.product_id });
  }
}

export function buildInvoiceReservationStatements(env: { DB: D1Database }, input: {
  accountId: string;
  invoiceId: string;
  lines: AuthorizedInvoiceLine[];
  expiresAt: string;
}): D1PreparedStatement[] {
  const quantities = new Map<string, number>();
  for (const line of input.lines) {
    if (!line.product_id) continue;
    quantities.set(line.product_id, (quantities.get(line.product_id) ?? 0) + Number(line.quantity));
  }
  const statements: D1PreparedStatement[] = [
    env.DB.prepare('DELETE FROM stock_holds WHERE invoice_id = ? AND account_id = ?').bind(input.invoiceId, input.accountId),
  ];
  for (const [productId, quantity] of quantities) {
    statements.push(env.DB.prepare(
      `INSERT INTO stock_holds (id, account_id, invoice_id, product_id, held_grams, expires_at)
       SELECT ?, ?, ?, ?,
         CASE WHEN p.stock_grams - COALESCE((
           SELECT SUM(h.held_grams) FROM stock_holds h
           WHERE h.account_id = ? AND h.product_id = ? AND h.invoice_id != ?
             AND (h.expires_at IS NULL OR h.expires_at > datetime('now'))
         ), 0) >= ? THEN ? ELSE -1 END,
         ?
       FROM products p WHERE p.id = ? AND p.account_id = ?`
    ).bind(
      crypto.randomUUID(), input.accountId, input.invoiceId, productId,
      input.accountId, productId, input.invoiceId, quantity, quantity, input.expiresAt,
      productId, input.accountId,
    ));
  }
  return statements;
}

export async function replaceInvoiceReservations(env: { DB: D1Database }, input: {
  accountId: string;
  invoiceId: string;
  lines: AuthorizedInvoiceLine[];
  expiresAt: string;
}): Promise<void> {
  try {
    await env.DB.batch(buildInvoiceReservationStatements(env, input));
  } catch (error) {
    if (/insufficient available stock/i.test(String((error as Error)?.message || error))) {
      throw new SalesInvariantError(409, 'insufficient_available_stock');
    }
    throw new SalesInvariantError(503, 'stock_reservation_unavailable');
  }
}

export function buildSettlementStatements(env: { DB: D1Database }, input: {
  accountId: string;
  invoice: Record<string, unknown>;
  lines: Array<Record<string, unknown>>;
}): D1PreparedStatement[] {
  const sellerUserId = String(input.invoice.sold_by_user_id || '');
  if (!sellerUserId) throw new SalesInvariantError(409, 'invoice_seller_snapshot_missing');
  return input.lines.filter(line => line.product_id).map(line => {
    const gross = currency(Number(line.quantity) * Number(line.price_at_sale));
    const shareType = line.owner_share_type === 'fixed' ? 'fixed' : 'percent';
    const shareValue = line.owner_share_value == null ? 100 : Number(line.owner_share_value);
    const amounts = calculateSettlement({ gross, ownerShareType: shareType, ownerShareValue: shareValue });
    return env.DB.prepare(
      `INSERT INTO sales_settlements
       (id,account_id,invoice_id,line_item_id,product_id,stock_owner_user_id,seller_user_id,grant_id,gross_amount,owner_amount,seller_amount,status)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,'owed')`
    ).bind(
      crypto.randomUUID(), input.accountId, input.invoice.id, line.id, line.product_id,
      line.stock_owner_user_id ?? null, sellerUserId, line.sales_grant_id ?? null,
      gross, amounts.ownerAmount, amounts.sellerAmount,
    );
  });
}

export function buildSettlementReversalStatements(env: { DB: D1Database }, input: {
  accountId: string;
  invoiceId: string;
}): D1PreparedStatement[] {
  return [env.DB.prepare(
    `UPDATE sales_settlements SET status='reversed', reversed_at=datetime('now'), updated_at=datetime('now')
     WHERE account_id=? AND invoice_id=? AND status!='reversed'`
  ).bind(input.accountId, input.invoiceId)];
}

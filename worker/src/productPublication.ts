import { needsPublicationReview, publicationRefusal, type PublicationRefusal, type PublicationState } from '../../src/lib/productPublication';
import { addPricingFields, shopFreightPerKgUsd } from './productPricing';

type ProductColumns = Record<string, unknown>;
type PublicationEnv = { DB: D1Database };

function numericColumn(value: unknown): number | undefined {
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && value.trim()) return Number(value);
  return undefined;
}

function countedQuantity(product: ProductColumns): number | undefined {
  return numericColumn(product.type === 'Teaware' ? product.quantity_units : product.stock_grams);
}

export function openingStockKnownAt(product: ProductColumns): string | null {
  const counted = countedQuantity(product);
  if (counted == null || !Number.isFinite(counted) || counted < 0) return null;
  if (product.stock_known_at === null) return null;
  return typeof product.stock_known_at === 'string' && product.stock_known_at.trim()
    ? product.stock_known_at
    : new Date().toISOString();
}

function incomingQuantity(product: ProductColumns): number {
  const receiptQuantity = Number(product.incoming_quantity) || 0;
  return receiptQuantity > 0 ? receiptQuantity
    : product.in_transit ? Math.max(Number(product.in_transit_grams) || 0, 1) : 0;
}

export function publicationPatchFromColumns(body: ProductColumns): Partial<PublicationState> {
  return {
    ...(body.is_public !== undefined ? { isPublic: Boolean(body.is_public) } : {}),
    ...(body.shown_in_shop !== undefined ? { shownInShop: Boolean(body.shown_in_shop) } : {}),
    ...(body.status !== undefined ? { status: body.status } : {}),
  };
}

async function checkCandidate(env: PublicationEnv, accountId: string, product: ProductColumns): Promise<PublicationRefusal | null> {
  let price = numericColumn(product.fixed_retail_price_usd);
  if (product.fixed_retail_price_usd == null) {
    const { results } = await env.DB.prepare('SELECT currency, rate_to_usd FROM exchange_rates')
      .all<{ currency: string; rate_to_usd: number }>();
    const rates = new Map(results.map(row => [row.currency, row.rate_to_usd]));
    const shopDefaultPerKgUsd = await shopFreightPerKgUsd(env, accountId, rates);
    price = addPricingFields(product, rates, shopDefaultPerKgUsd).retail_price_per_gram_usd;
  }
  return publicationRefusal({
    givenName: product.given_name,
    supplierName: product.product_name,
    type: product.type,
    retailPrice: price,
    onHand: countedQuantity(product),
    stockKnownAt: product.stock_known_at,
  }, incomingQuantity(product));
}

export function checkNewProductPublication(env: PublicationEnv, accountId: string, product: ProductColumns): Promise<PublicationRefusal | null> {
  return checkCandidate(env, accountId, product);
}

const OPEN_INCOMING_SQL = `COALESCE((
  SELECT SUM(MAX(line.expected_quantity - line.received_quantity - line.cancelled_quantity, 0))
    FROM inventory_receipt_lines line
    JOIN inventory_receipts receipt ON receipt.id = line.receipt_id AND receipt.account_id = line.account_id
   WHERE line.product_id = p.id AND line.account_id = p.account_id
     AND receipt.state IN ('planned', 'ordered', 'in_transit', 'partially_received')
), 0)`;

const PUBLICATION_SNAPSHOT_SQL = `json_array(
  p.status, p.is_public, p.shown_in_shop, p.type, p.given_name, p.product_name,
  p.stock_grams, p.quantity_units, p.stock_known_at, p.in_transit, p.in_transit_grams,
  p.fixed_retail_price_usd, p.cost_amount, p.cost_currency, p.shipping_rate_per_kg, p.quantity_purchased,
  ${OPEN_INCOMING_SQL}
)`;

export async function checkProductPublication(
  env: PublicationEnv, accountId: string, id: string, patch: Partial<PublicationState>,
): Promise<{ refusal: PublicationRefusal | null; assertion?: D1PreparedStatement; clearDraftVisibility?: boolean }> {
  if (patch.isPublic !== true && patch.shownInShop !== true && patch.status !== 'Active' && patch.status !== 'Sold Out' && patch.status !== 'Archived') return { refusal: null };
  const product = await env.DB.prepare(
    `SELECT p.*, ${OPEN_INCOMING_SQL} AS incoming_quantity, ${PUBLICATION_SNAPSHOT_SQL} AS publication_snapshot
       FROM products p WHERE p.id = ? AND p.account_id = ?`
  ).bind(id, accountId).first<ProductColumns & { publication_snapshot: string }>();
  if (!product) return { refusal: null };
  if (needsPublicationReview({
    status: product.status, isPublic: Boolean(product.is_public), shownInShop: Boolean(product.shown_in_shop),
  }, patch)) {
    const refusal = await checkCandidate(env, accountId, product);
    if (refusal) return { refusal };
  }

  // The same D1 assertion pattern used by Curate mutations rolls back all
  // mirror writes if the product or open inbound quantity changed after review.
  const assertion = env.DB.prepare(
    `SELECT json(CASE WHEN EXISTS(
      SELECT 1 FROM products p WHERE p.id = ? AND p.account_id = ? AND ${PUBLICATION_SNAPSHOT_SQL} = ?
    ) THEN 'true' ELSE 'stale_publication_snapshot' END)`
  ).bind(id, accountId, product.publication_snapshot);
  return { refusal: null, assertion, clearDraftVisibility: product.status === 'Draft' && patch.status === 'Archived' };
}

export async function writeProductPublication(
  env: PublicationEnv, statements: D1PreparedStatement[], assertion?: D1PreparedStatement,
): Promise<{ code: string; error: string } | null> {
  try {
    if (assertion) await env.DB.batch([assertion, ...statements]);
    else if (statements.length > 1) await env.DB.batch(statements);
    else await statements[0].run();
  } catch (error) {
    if (assertion && String(error).includes('malformed JSON')) {
      return { code: 'product_publication_changed', error: 'Stock or listing details changed. Review the product and try publishing again.' };
    }
    throw error;
  }
  return null;
}

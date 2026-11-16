import type { CurateGuard } from './curateMutations';

type Row = Record<string, any>;
type Change = { entity: 'tea' | 'product' | 'product_listing'; id: string; before: Row; after: Row };

/**
 * What a tea merge does to the Stock product link.
 *
 * A Curate tea and its Stock product point at each other twice:
 * `tea_compass_entries.draft_product_id` and `products.source_compass_entry_id`
 * (unique per account), with the listing mirror carrying the second. A merge
 * used to archive the duplicate and leave both pointers on it, so the
 * surviving tea showed as unlinked. Now:
 *
 * - Only the merged-away tea has a product: the link moves to the survivor,
 *   the product and its listing point at the survivor, and the merged-away tea
 *   lets go. The survivor's name follows the rule linking has always used
 *   (migration 0048): a survivor with a chosen name keeps it and the product
 *   takes it; one without adopts the product's.
 * - Both teas have a product (or the merged-away tea has more than one): nothing
 *   moves. Choosing which product is the real one is the owner's decision, not
 *   a merge's, and moving one link would orphan the other. The merged-away tea
 *   keeps its link, so its product stays findable (holdings already count the
 *   whole merge family), and the preview says so.
 * - Arrivals, receipt lines, purchase lines and the stock ledger are not
 *   rewritten: they are history, and an order's arrival names its tea in its
 *   key and its order line. Accepting an arrival instead follows the merge to
 *   the tea that now holds the product (`receiptHoldingTeaId` below), so a
 *   pending arrival for the merged-away tea is received into the moved product
 *   rather than creating a duplicate on an archived tea.
 *
 * Every write is a recorded change in the merge's own batch, so `curate_undo`
 * puts each one back. The order of the changes is chosen so the given-name
 * triggers find the names already in place, forward and on undo, and write
 * nothing the snapshots do not expect.
 */
export async function teaMergeProductLink(db: D1Database, accountId: string, source: Row, target: Row, now: string): Promise<{
  /** Changes to apply BEFORE the merged-away tea's own change, in order. */
  changes: Change[];
  guards: CurateGuard[];
  /** Fields to set on the merged-away tea. */
  source: Row;
  /** The product whose row this merge rewrites, if any. */
  movedProductId: string | null;
  details: Record<string, unknown>;
}> {
  const productsWhere = 'account_id = ? AND (id IN (?, ?) OR source_compass_entry_id IN (?, ?))';
  const productsValues = [accountId, source.draft_product_id ?? '', target.draft_product_id ?? '', source.id, target.id];
  const products = (await db.prepare(`SELECT * FROM products WHERE ${productsWhere}`).bind(...productsValues).all<Row>()).results ?? [];
  // A product appearing between preview and confirmation makes the preview
  // stale rather than letting it run against a set nobody saw.
  const guards: CurateGuard[] = [
    { sql: `(SELECT COUNT(*) FROM products WHERE ${productsWhere}) = ?`, values: [...productsValues, products.length], confirmationOnly: true },
  ];
  const linkedTo = (tea: Row) => products.filter(product => product.id === tea.draft_product_id || product.source_compass_entry_id === tea.id);
  const sourceProducts = linkedTo(source);
  const targetProducts = linkedTo(target);
  const changes: Change[] = [];
  const sourceAfter: Row = {};
  const stamped = (row: Row, fields: Row): Row => ({ ...row, ...fields, ...(Object.hasOwn(row, 'updated_at') ? { updated_at: now } : {}) });
  const unchangedTarget: Change = { entity: 'tea', id: target.id, before: target, after: target };

  if (sourceProducts.length === 0) {
    changes.push(unchangedTarget);
    return { changes, guards, source: sourceAfter, movedProductId: null, details: { moved_product_id: null } };
  }
  if (sourceProducts.length > 1 || targetProducts.length > 0 || target.draft_product_id) {
    changes.push(unchangedTarget);
    return {
      changes, guards, source: sourceAfter, movedProductId: null,
      details: {
        moved_product_id: null,
        kept_on_merged_tea: sourceProducts.map(product => product.id),
        survivor_products: targetProducts.map(product => product.id),
        message: 'Both teas have a Stock product, so neither link is moved. The merged-away tea keeps its product, which still counts in the surviving tea\'s holdings. If one product is a duplicate, decide which to keep and correct it in Stock.',
      },
    };
  }

  const product = sourceProducts[0];
  const hasNames = Object.hasOwn(target, 'given_name') && Object.hasOwn(product, 'given_name');
  // The survivor's chosen name wins; without one it adopts the product's.
  const survivorNamesProduct = hasNames && target.given_name != null && target.given_name !== product.given_name;
  const name = survivorNamesProduct ? target.given_name : product.given_name;

  const targetAfter: Row = stamped(target, { draft_product_id: product.id });
  if (hasNames) targetAfter.given_name = name;
  const productAfter: Row = { ...product };
  if (product.source_compass_entry_id === source.id) productAfter.source_compass_entry_id = target.id;
  if (survivorNamesProduct) productAfter.given_name = name;
  const productChanged = Object.keys(productAfter).some(key => productAfter[key] !== product[key]);
  const productChanges: Change[] = [];
  if (productChanged) {
    if (Object.hasOwn(product, 'updated_at')) productAfter.updated_at = now;
    productChanges.push({ entity: 'product', id: product.id, before: product, after: productAfter });
    if (productAfter.source_compass_entry_id !== product.source_compass_entry_id) {
      const listing = await db.prepare('SELECT * FROM product_listings WHERE account_id = ? AND legacy_product_id = ?').bind(accountId, product.id).first<Row>();
      if (listing && listing.source_compass_entry_id === source.id) {
        productChanges.push({ entity: 'product_listing', id: listing.id, before: listing, after: stamped(listing, { source_compass_entry_id: target.id }) });
      }
    }
  }
  if (source.draft_product_id === product.id) sourceAfter.draft_product_id = null;
  // Renaming the product renames every tea still pointing at it (0048), and
  // the merged-away tea still does when that happens; record it.
  if (survivorNamesProduct && Object.hasOwn(source, 'given_name')) sourceAfter.given_name = name;

  // Survivor first when it renames the product, so the triggers' rename lands
  // while the product still points at the merged-away tea and undo finds the
  // product's old name restored before the merged-away tea links back. Product
  // first otherwise, so linking the survivor finds the names already equal.
  if (survivorNamesProduct) changes.push({ entity: 'tea', id: target.id, before: target, after: targetAfter }, ...productChanges);
  else changes.push(...productChanges, { entity: 'tea', id: target.id, before: target, after: targetAfter });
  return {
    changes, guards, source: sourceAfter, movedProductId: productChanged ? product.id : null,
    details: { moved_product_id: product.id, from: source.id, to: target.id, message: 'The Stock product linked to the merged-away tea now belongs to the surviving tea.' },
  };
}

/**
 * The tea whose holding an arrival for `teaId` is received into. Itself while
 * it has its own product (as always, including a merged-away tea that kept its
 * product because the survivor had one too). Otherwise the merge is followed
 * to the first tea that has one, or to the live tea at the end of the chain,
 * so nothing is created on, or linked back to, an archived duplicate.
 */
export async function receiptHoldingTeaId(db: D1Database, accountId: string, teaId: string): Promise<string> {
  let id = teaId;
  const seen = new Set<string>();
  while (!seen.has(id) && seen.size < 20) {
    seen.add(id);
    if (await db.prepare('SELECT id FROM products WHERE account_id = ? AND source_compass_entry_id = ?').bind(accountId, id).first()) return id;
    const tea = await db.prepare('SELECT merged_into_id FROM tea_compass_entries WHERE id = ? AND account_id = ?').bind(id, accountId).first<{ merged_into_id: string | null }>();
    if (!tea?.merged_into_id) return id;
    id = tea.merged_into_id;
  }
  return id;
}

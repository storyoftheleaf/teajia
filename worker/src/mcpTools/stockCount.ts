/**
 * `count_stock`: the agent door onto the stock count Manage already has.
 *
 * Adrian's usual message is "I have 118 g of the Gushu Red", which is a count,
 * not a delivery and not a sale. `add_stock` and `remove_stock` move stock by a
 * difference, so on a tea whose stock was never entered (or is stale) an agent
 * would have to do the arithmetic against a number nobody trusts, and the
 * ledger would say "purchase receipt" for what was really a weigh-in.
 *
 * So this records a recount through `applyStockMovement`, the same path the
 * Manage stock edit takes (`Manual: old→new`): the ledger keeps the difference,
 * `stock_verified_at` and `stock_known_at` are stamped, `recheck_stock` clears,
 * the listing mirror follows, and a sold-out tea with stock again goes back on
 * sale. The path is handed in as `env.stockMovements` because importing
 * index.ts from here would be a cycle; this file owns only the preview and the
 * ticket.
 *
 * The preview pins the balance it showed. If the stock moves between preview
 * and confirm (a sale, a second count), the movement is refused and nothing is
 * written, because a count read back as "was 40 g, now 118 g" must not land on
 * a shelf that had already gone to 0.
 */
import { decodeStockMovement } from '../inventoryDomain';
import { cleanPlaceName, countAtPlace, createStockPlace, describeSplit, findPlace, isRefusal, listStockPlaces, readStockSplit, type StockSplit } from '../stockPlaces';
import type { ToolAuth, ToolDefinition, ToolEnv, ToolModule } from './registry';
import { consumeTicket, INVALID_TICKET, issueTicket, previewEnvelope, type TicketPayload } from './tickets';

interface CountStockTicket extends TicketPayload {
  kind: 'count_stock';
  productId: string;
  unit: 'g' | 'unit';
  before: number;
  counted: number;
  note: string;
  idempotencyKey: string;
  /** A count at one place (worker/src/stockPlaces.ts): the place, and what the split was when previewed. */
  place?: { id: string | null; name: string; before: number; notPlacedBefore: number } | null;
}

const NEW_PLACE = 'new-place';

/** The split with a place that does not exist yet added at the end, holding nothing. */
function withPlace(split: StockSplit, id: string | null, name: string): { split: StockSplit; id: string } {
  if (id) return { split, id };
  return { split: { ...split, places: [...split.places, { place_id: NEW_PLACE, name, amount: 0 }] }, id: NEW_PLACE };
}

type ProductRow = {
  id: string;
  type: string | null;
  given_name: string | null;
  product_name: string | null;
  chinese_name: string | null;
  stock_grams: number | null;
  quantity_units: number | null;
  stock_known_at: string | null;
  stock_verified_at: string | null;
  status: string | null;
  personal_offer_source_id: string | null;
};

const text = (v: unknown, max: number): string | null => {
  const s = typeof v === 'string' ? v.trim().slice(0, max) : '';
  return s || null;
};

const label = (p: ProductRow) => p.given_name || p.product_name || p.id;
const unitWord = (unit: 'g' | 'unit') => (unit === 'g' ? 'g' : 'pieces');

async function toolCountStock(env: ToolEnv, auth: ToolAuth, args: any): Promise<unknown> {
  const productId = text(args?.product_id, 80);
  const confirm = text(args?.confirm, 100);
  if (confirm) {
    const t = await consumeTicket<CountStockTicket, 'count_stock'>(env, confirm, 'count_stock', auth);
    // The ticket names the tea; a different product_id beside it means the
    // caller has lost track of which preview this is, so nothing is written.
    if (!t || (productId && t.productId !== productId)) return INVALID_TICKET;
    if (!env.stockMovements) return { error: 'stock_counting_unavailable', message: 'The shop could not reach its stock ledger. Nothing was changed.' };
    let balance = t.counted; let placeId: string | null = null;
    if (t.place) {
      // The place is made on confirm, never on preview, so a "no" leaves no trace.
      const place = t.place.id ? findPlace(await listStockPlaces(env.DB, auth.accountId), t.place.id) : await createStockPlace(env.DB, auth.accountId, t.place.name);
      if (!place || isRefusal(place)) return { error: 'place_gone', message: `${t.place.name} is no longer one of the shop's places. Nothing was changed; preview the count again.` };
      const split = await readStockSplit(env.DB, auth.accountId, t.productId, t.before);
      const at = split.places.find(row => row.place_id === place.id);
      if (!at || at.amount !== t.place.before || split.not_placed !== t.place.notPlacedBefore) {
        return { error: 'stock_changed_since_preview', message: `Where this tea is kept changed after the preview. Nothing was changed; preview the count again.` };
      }
      const counted = countAtPlace(split, place.id, t.counted, t.unit);
      if (isRefusal(counted)) return { error: 'count_refused', message: counted.message };
      balance = counted.total; placeId = place.id;
    }
    const input = decodeStockMovement({
      movement_type: 'recount', unit: t.unit, balance, expected_balance: t.before,
      idempotency_key: t.idempotencyKey, note: t.note,
      ...(placeId ? { place_id: placeId, place_balance: t.counted } : {}),
    });
    const result = await env.stockMovements.apply({ accountId: auth.accountId, userId: auth.userId, email: auth.userEmail }, t.productId, input);
    const value = (result.value ?? {}) as Record<string, any>;
    if (result.status === 409 && value.error === 'Stock balance changed') {
      return {
        error: 'stock_changed_since_preview',
        message: `The stock moved after the preview (it is now ${value.current_balance} ${unitWord(t.unit)}). Nothing was changed; preview the count again.`,
        current_balance: value.current_balance ?? null,
      };
    }
    if (result.status >= 400) return { error: 'count_refused', message: String(value.error ?? 'The count was refused. Nothing was changed.') };
    return {
      committed: true,
      action: 'count_stock',
      product_id: t.productId,
      unit: unitWord(t.unit),
      balance_before: value.before_balance ?? t.before,
      balance_after: value.after_balance ?? t.counted,
      difference: (value.after_balance ?? t.counted) - (value.before_balance ?? t.before),
      ledger_id: value.id ?? null,
      already_recorded: value.already_applied === true,
      ...(value.stock_places ? { stock_places: value.stock_places } : {}),
    };
  }

  if (!productId) throw new Error('product_id is required. Find it with search_tea.');
  const counted = Number(args?.counted);
  if (args?.counted === undefined || args?.counted === null || args?.counted === '' || !Number.isFinite(counted) || counted < 0) {
    throw new Error('counted is required: what is on the shelf now, 0 or more.');
  }

  const product = await env.DB.prepare(
    `SELECT id, type, given_name, product_name, chinese_name, stock_grams, quantity_units, stock_known_at,
            stock_verified_at, status, personal_offer_source_id
       FROM products WHERE id = ? AND account_id = ?`
  ).bind(productId, auth.accountId).first<ProductRow>();
  if (!product) return { error: 'not_found', message: 'No tea with that id in this shop. Find it with search_tea.' };
  if (product.personal_offer_source_id) {
    return { error: 'personal_offer', message: 'This is a personal offer. Count the private holding it was made from instead.' };
  }

  const unit: 'g' | 'unit' = product.type === 'Teaware' ? 'unit' : 'g';
  if (unit === 'unit' && !Number.isInteger(counted)) throw new Error('Teaware is counted in whole pieces.');
  // A NULL balance is stored stock nobody entered; the ledger treats it as 0,
  // and so does the preview, but it says so rather than calling it a fact.
  const stored = unit === 'g' ? product.stock_grams : product.quantity_units;
  const before = Number(stored ?? 0);
  const known = stored != null && product.stock_known_at != null;
  const extra = text(args?.note, 300);
  const name = label(product);

  // A count at one place: that place now holds `counted`; the total follows.
  let place: CountStockTicket['place'] = null; let after = counted; let placeLine = ''; let split: StockSplit | null = null;
  const placeName = cleanPlaceName(args?.place);
  if (placeName) {
    const places = await listStockPlaces(env.DB, auth.accountId);
    const found = findPlace(places, placeName);
    const current = await readStockSplit(env.DB, auth.accountId, productId, before, places);
    const fitted = withPlace(current, found?.id ?? null, found?.name ?? placeName);
    const at = fitted.split.places.find(row => row.place_id === fitted.id)!;
    const counting = countAtPlace(fitted.split, fitted.id, counted, unit);
    if (isRefusal(counting)) throw new Error(counting.message);
    place = { id: found?.id ?? null, name: at.name, before: at.amount, notPlacedBefore: current.not_placed };
    after = counting.total; split = counting;
    const drawn = Math.max(0, Math.min(counted - at.amount, current.not_placed));
    placeLine = `${at.name}${found ? '' : ' (a new place)'} goes from ${at.amount} to ${counted} ${unitWord(unit)}`
      + (drawn > 0 ? `, ${drawn} ${unitWord(unit)} of it from stock not placed yet` : '') + '.';
  }
  const note = place
    ? `Counted at ${place.name} by ${text(args?.agent, 60) ?? 'an agent'}: ${place.before}→${counted}${extra ? `. ${extra}` : ''}`
    : `Counted by ${text(args?.agent, 60) ?? 'an agent'}: ${before}→${counted}${extra ? `. ${extra}` : ''}`;

  const token = await issueTicket<CountStockTicket>(env, {
    kind: 'count_stock', accountId: auth.accountId, productId, unit, before, counted, note,
    idempotencyKey: crypto.randomUUID(), place,
  }, auth.tokenId);

  return previewEnvelope({
    action: 'count_stock',
    read_back: place
      ? `${placeLine} ${name} then has ${after} ${unitWord(unit)} in all (it has ${before} ${unitWord(unit)} now).`
      : known
        ? `Set ${name} to ${counted} ${unitWord(unit)} on hand (the shop has ${before} ${unitWord(unit)}).`
        : `Set ${name} to ${counted} ${unitWord(unit)} on hand. The shop had no counted stock for it before.`,
    product: { id: product.id, name, chinese_name: product.chinese_name ?? null, status: product.status ?? null },
    unit: unitWord(unit),
    balance_before: before,
    balance_before_was_known: known,
    balance_after: after,
    difference: after - before,
    ...(place && split ? { place: { name: place.name, is_new: !place.id, before: place.before, after: counted }, stock_places: describeSplit({ ...split, places: split.places.map(row => (row.place_id === NEW_PLACE ? { ...row, place_id: 'new' } : row)) }, unit) } : {}),
    last_counted_at: product.stock_verified_at ?? null,
    ...(after > 0 && product.status === 'Sold Out' ? { goes_back_on_sale: true } : {}),
    note,
  }, token);
}

const defs: ToolDefinition[] = [
  {
    name: 'count_stock',
    scope: 'stock:write',
    description: 'Set a shelf tea\'s stock to what is actually there now, e.g. Adrian weighed it and has 118 g. Records a stock count, the same as changing the stock number in Manage: the ledger keeps the difference, the tea is marked counted, and a sold-out tea with stock again goes back on sale. Grams for tea, whole pieces for teaware. With place, it counts one storage place (the shop keeps one total, split privately by place; see list_stock_places). Use add_stock for a delivery and remove_stock for tea used, given away or wasted, so the ledger says why. Two steps: read the preview back, and send confirm only after Adrian said yes. If the stock moves in between, nothing is written and you preview again.',
    inputSchema: {
      type: 'object',
      properties: {
        product_id: { type: 'string', description: 'Product id from search_tea or get_tea.' },
        counted: { type: 'number', minimum: 0, description: 'What is on hand now: grams for tea, pieces for teaware. 0 is a real count.' },
        place: { type: 'string', description: 'Optional: where this count was made, e.g. "Art studio". Then counted is what that place holds, and the total follows: more than the place had comes first out of stock not placed yet. A name the shop does not have yet becomes a new place on confirm. Leave out to count the whole tea.' },
        note: { type: 'string', description: 'Optional, e.g. "weighed after the Ubud session".' },
        agent: { type: 'string', description: 'Who is counting, e.g. Claude, so the ledger says where the number came from.' },
        confirm: { type: 'string', description: 'The confirmation_token from the preview, sent only after Adrian said yes.' },
      },
      required: ['product_id'],
      additionalProperties: false,
    },
    annotations: { destructiveHint: false, idempotentHint: true },
  },
];

export const stockCountTools: ToolModule = {
  area: 'stock-count',
  defs,
  handlers: { count_stock: toolCountStock },
};

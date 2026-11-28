/**
 * Where a tea's stock is kept, for agents (worker/src/stockPlaces.ts owns the
 * rules). The shop keeps one total per tea; these tools read and change its
 * private split between the shop's own places, never the total:
 *
 *   list_stock_places          the places, and with product_id one tea's split.
 *   move_stock_between_places  move an amount from one place (or "not placed
 *                              yet") to another. A new place name is made on
 *                              confirm.
 *   save_stock_place           rename, reorder or retire a place.
 *
 * count_stock, add_stock and remove_stock take a `place` for movements that
 * change the total at one place.
 */
import {
  createStockPlace, describeSplit, findPlace, isRefusal, listStockPlaces, moveBetween, namePlace, readProductStock,
  readStockSplit, saveProductSplit, updateStockPlace, type PlaceRef,
} from '../stockPlaces';
import type { ToolAuth, ToolDefinition, ToolEnv, ToolModule } from './registry';
import { consumeTicket, INVALID_TICKET, issueTicket, previewEnvelope, type TicketPayload } from './tickets';

interface MovePlacesTicket extends TicketPayload {
  kind: 'move_stock_between_places';
  productId: string;
  total: number;
  from: PlaceRef | null;
  to: PlaceRef | null;
  amount: number;
  note: string | null;
}

interface SavePlaceTicket extends TicketPayload {
  kind: 'save_stock_place';
  placeId: string;
  name: string;
  position: number;
  archive: boolean;
}

const NOT_PLACED = new Set(['not placed', 'not placed yet', 'unplaced', 'none', '']);
const text = (v: unknown, max: number): string | null => {
  const s = typeof v === 'string' ? v.trim().slice(0, max) : '';
  return s || null;
};
const isNotPlaced = (v: unknown) => v === undefined || v === null || (typeof v === 'string' && NOT_PLACED.has(v.trim().toLowerCase()));

async function toolListStockPlaces(env: ToolEnv, auth: ToolAuth, args: any): Promise<unknown> {
  const places = await listStockPlaces(env.DB, auth.accountId);
  const productId = text(args?.product_id, 80);
  if (!productId) return { places: places.map(place => ({ id: place.id, name: place.name })) };
  const stock = await readProductStock(env.DB, auth.accountId, productId);
  if (!stock) return { error: 'not_found', message: 'No tea with that id in this shop. Find it with search_tea.' };
  const split = await readStockSplit(env.DB, auth.accountId, productId, stock.total, places);
  return { places: places.map(place => ({ id: place.id, name: place.name })), product: { id: productId, name: stock.name }, stock_places: describeSplit(split, stock.unit) };
}

async function toolMoveStockBetweenPlaces(env: ToolEnv, auth: ToolAuth, args: any): Promise<unknown> {
  const productId = text(args?.product_id, 80);
  const confirm = text(args?.confirm, 100);
  if (confirm) {
    const t = await consumeTicket<MovePlacesTicket, 'move_stock_between_places'>(env, confirm, 'move_stock_between_places', auth);
    if (!t || (productId && t.productId !== productId)) return INVALID_TICKET;
    const make = async (ref: PlaceRef | null) => {
      if (!ref) return null;
      if (ref.id) return findPlace(await listStockPlaces(env.DB, auth.accountId), ref.id);
      const made = await createStockPlace(env.DB, auth.accountId, ref.name);
      return isRefusal(made) ? null : made;
    };
    const from = await make(t.from); const to = await make(t.to);
    if ((t.from && !from) || (t.to && !to)) return { error: 'place_gone', message: 'One of those places is no longer the shop\'s. Nothing was changed; preview again.' };
    const result = await saveProductSplit(env.DB, { accountId: auth.accountId, email: auth.userEmail }, t.productId,
      { kind: 'move', from: from?.id ?? null, to: to?.id ?? null, amount: t.amount }, { expectedTotal: t.total, note: t.note });
    if (result.status === 409 && result.value.error === 'Stock balance changed') {
      return { error: 'stock_changed_since_preview', message: `The tea's stock moved after the preview (it is now ${result.value.current_balance}). Nothing was changed; preview again.` };
    }
    if (result.status >= 400) return { error: 'move_refused', message: `${String(result.value.error)} Nothing was changed.` };
    return { committed: true, action: 'move_stock_between_places', product_id: t.productId, ...result.value };
  }

  if (!productId) throw new Error('product_id is required. Find it with search_tea.');
  const amount = Number(args?.amount);
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('amount is required: how much to move, more than 0.');
  const stock = await readProductStock(env.DB, auth.accountId, productId);
  if (!stock) return { error: 'not_found', message: 'No tea with that id in this shop. Find it with search_tea.' };
  if (stock.product.personal_offer_source_id) return { error: 'personal_offer', message: 'This is a personal offer. Place the private holding it was made from instead.' };
  if (stock.unit === 'unit' && !Number.isInteger(amount)) throw new Error('Teaware moves in whole pieces.');

  const from = isNotPlaced(args?.from) ? null : await namePlace(env.DB, auth.accountId, args.from);
  const to = isNotPlaced(args?.to) ? null : await namePlace(env.DB, auth.accountId, args.to);
  if (!from && !to) throw new Error('Name at least one place: from, to, or both.');
  if (from && !from.id) return { error: 'unknown_place', message: `The shop has no place called ${from.name}. See list_stock_places.` };

  // Read the split as it would be with a new destination added, so the preview
  // is what the confirm will write.
  const split = await readStockSplit(env.DB, auth.accountId, productId, stock.total);
  const toId = to ? (to.id ?? 'new') : null;
  const withNew = to && !to.id ? { ...split, places: [...split.places, { place_id: 'new', name: to.name, amount: 0 }] } : split;
  const after = moveBetween(withNew, from?.id ?? null, toId, amount, stock.unit);
  if (isRefusal(after)) return { error: after.error, message: after.message, available: after.available ?? null };

  const note = text(args?.note, 300);
  const token = await issueTicket<MovePlacesTicket>(env, {
    kind: 'move_stock_between_places', accountId: auth.accountId, productId, total: stock.total, from, to, amount, note,
  }, auth.tokenId);
  const unitWord = stock.unit === 'g' ? 'g' : 'pieces';
  return previewEnvelope({
    action: 'move_stock_between_places',
    read_back: `Move ${amount} ${unitWord} of ${stock.name} from ${from?.name ?? 'not placed yet'} to ${to ? `${to.name}${to.id ? '' : ' (a new place)'}` : 'not placed yet'}. The total stays ${stock.total} ${unitWord}.`,
    product: { id: productId, name: stock.name },
    total: stock.total,
    stock_places_before: describeSplit(withNew, stock.unit),
    stock_places_after: describeSplit(after, stock.unit),
    note,
  }, token);
}

async function toolSaveStockPlace(env: ToolEnv, auth: ToolAuth, args: any): Promise<unknown> {
  const confirm = text(args?.confirm, 100);
  if (confirm) {
    const t = await consumeTicket<SavePlaceTicket, 'save_stock_place'>(env, confirm, 'save_stock_place', auth);
    if (!t) return INVALID_TICKET;
    const result = await updateStockPlace(env.DB, auth.accountId, t.placeId, t.archive ? { archived: true } : { name: t.name, position: t.position });
    if (result.status >= 400) return { error: 'save_refused', message: String((result.value as any).error) };
    return { committed: true, action: 'save_stock_place', ...result.value };
  }
  const places = await listStockPlaces(env.DB, auth.accountId);
  const place = findPlace(places, args?.place);
  if (!place) return { error: 'unknown_place', message: 'Name one of the shop\'s places (list_stock_places). A new place is made by moving or counting stock there.' };
  const archive = args?.retire === true;
  const name = text(args?.rename_to, 60) ?? place.name;
  const position = args?.position === undefined ? place.position : Number(args.position);
  if (!Number.isInteger(position) || position < 0) throw new Error('position must be a whole number, 0 or more (0 is first).');
  let held = 0;
  if (archive) {
    const rows = await env.DB.prepare('SELECT COUNT(*) AS n FROM product_stock_places WHERE account_id = ? AND place_id = ? AND amount > 0').bind(auth.accountId, place.id).first<{ n: number }>();
    held = Number(rows?.n ?? 0);
  }
  const token = await issueTicket<SavePlaceTicket>(env, { kind: 'save_stock_place', accountId: auth.accountId, placeId: place.id, name, position, archive }, auth.tokenId);
  return previewEnvelope({
    action: 'save_stock_place',
    read_back: archive
      ? `Retire ${place.name}.${held ? ` ${held} tea${held === 1 ? '' : 's'} kept there will read as not placed yet; their totals do not change.` : ''}`
      : `${name !== place.name ? `Rename ${place.name} to ${name}` : `Keep ${place.name}`}${position !== place.position ? `, listed at position ${position}` : ''}.`,
    place: { id: place.id, name: place.name },
  }, token);
}

const defs: ToolDefinition[] = [
  {
    name: 'list_stock_places',
    scope: 'inventory:read',
    description: 'The shop\'s storage places (e.g. Art studio, the shop), and with product_id where that tea\'s stock is kept: each place\'s amount and what is not placed yet. The shop keeps one stock number per tea; the places split it privately and always add up to it. Customers never see places.',
    inputSchema: {
      type: 'object',
      properties: { product_id: { type: 'string', description: 'Optional product id from search_tea, to see that tea\'s split.' } },
      additionalProperties: false,
    },
  },
  {
    name: 'move_stock_between_places',
    scope: 'stock:write',
    description: 'Move some of a tea\'s stock from one storage place to another, e.g. 462 g to "Art studio". The total does not change. from or to may be "not placed yet" (the default when left out). A new place name becomes a place on confirm. To change the total at a place, use count_stock, add_stock or remove_stock with place. Two steps: read the preview back, and send confirm only after Adrian said yes.',
    inputSchema: {
      type: 'object',
      properties: {
        product_id: { type: 'string', description: 'Product id from search_tea or get_tea.' },
        amount: { type: 'number', exclusiveMinimum: 0, description: 'How much to move: grams for tea, pieces for teaware.' },
        from: { type: 'string', description: 'The place it is at now. Leave out for stock not placed yet.' },
        to: { type: 'string', description: 'The place it goes to. Leave out to mark it not placed.' },
        note: { type: 'string', description: 'Optional.' },
        confirm: { type: 'string', description: 'The confirmation_token from the preview, sent only after Adrian said yes.' },
      },
      required: ['product_id'],
      additionalProperties: false,
    },
    annotations: { destructiveHint: false, idempotentHint: false },
  },
  {
    name: 'save_stock_place',
    scope: 'stock:write',
    description: 'Rename a storage place, change its place in the shop\'s order (0 is first; sales that name no place come off the first place once stock not placed yet runs out), or retire it (its stock then reads as not placed yet; no total changes). Two steps: preview, then confirm after Adrian said yes.',
    inputSchema: {
      type: 'object',
      properties: {
        place: { type: 'string', description: 'The place\'s current name or id.' },
        rename_to: { type: 'string' },
        position: { type: 'integer', minimum: 0 },
        retire: { type: 'boolean' },
        confirm: { type: 'string' },
      },
      additionalProperties: false,
    },
    annotations: { destructiveHint: false, idempotentHint: true },
  },
];

export const stockPlaceTools: ToolModule = {
  area: 'stock-places',
  defs,
  handlers: {
    list_stock_places: toolListStockPlaces,
    move_stock_between_places: toolMoveStockBetweenPlaces,
    save_stock_place: toolSaveStockPlace,
  },
};

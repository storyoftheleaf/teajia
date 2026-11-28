/**
 * Manage's door onto where each tea's stock is kept (worker/src/stockPlaces.ts).
 * Everything here is the shop's own back office: the stock permission, the
 * account in the header, never a public read.
 */
import {
  createStockPlace, describeSplit, isRefusal, listStockPlaces, readProductStock, readStockSplit,
  saveProductSplit, updateStockPlace, type SplitEdit,
} from './stockPlaces';

type Handler<E> = (request: Request, env: E, params: Record<string, string>) => Promise<Response>;
type StockCtx = { accountId: string; email?: string | null };
type Deps<E> = { requireStock: (request: Request, env: E) => Promise<StockCtx | { error: Response }> };

function privateJson(value: unknown, status = 200) {
  const response = Response.json(value, { status });
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
}

const readBody = async (request: Request) => (await request.json().catch(() => null)) as Record<string, unknown> | null;

export function stockPlaceRoutes<E extends { DB: D1Database }>(deps: Deps<E>): [string, string, Handler<E>][] {
  const list: Handler<E> = async (request, env) => {
    const ctx = await deps.requireStock(request, env); if ('error' in ctx) return ctx.error;
    return privateJson({ places: await listStockPlaces(env.DB, ctx.accountId) });
  };

  const create: Handler<E> = async (request, env) => {
    const ctx = await deps.requireStock(request, env); if ('error' in ctx) return ctx.error;
    const body = await readBody(request);
    const place = await createStockPlace(env.DB, ctx.accountId, body?.name);
    if (isRefusal(place)) return privateJson({ error: place.message }, 400);
    return privateJson({ place }, 201);
  };

  const update: Handler<E> = async (request, env, params) => {
    const ctx = await deps.requireStock(request, env); if ('error' in ctx) return ctx.error;
    const body = await readBody(request) ?? {};
    const result = await updateStockPlace(env.DB, ctx.accountId, params.id, { name: body.name, position: body.position, archived: body.archived });
    return privateJson(result.value, result.status);
  };

  const productSplit: Handler<E> = async (request, env, params) => {
    const ctx = await deps.requireStock(request, env); if ('error' in ctx) return ctx.error;
    const stock = await readProductStock(env.DB, ctx.accountId, params.id);
    if (!stock) return privateJson({ error: 'Product not found' }, 404);
    const split = await readStockSplit(env.DB, ctx.accountId, params.id, stock.total);
    return privateJson({ product_id: params.id, stock_places: describeSplit(split, stock.unit) });
  };

  const setProductSplit: Handler<E> = async (request, env, params) => {
    const ctx = await deps.requireStock(request, env); if ('error' in ctx) return ctx.error;
    const body = await readBody(request);
    if (!body) return privateJson({ error: 'A JSON body is required' }, 400);
    let edit: SplitEdit;
    if (Array.isArray(body.amounts)) {
      edit = { kind: 'set', amounts: body.amounts.map((entry: any) => ({ place_id: String(entry?.place_id ?? ''), amount: Number(entry?.amount) })) };
    } else if (body.amount !== undefined) {
      edit = { kind: 'move', from: typeof body.from_place_id === 'string' && body.from_place_id ? body.from_place_id : null, to: typeof body.to_place_id === 'string' && body.to_place_id ? body.to_place_id : null, amount: Number(body.amount) };
    } else {
      return privateJson({ error: 'Send amounts, or amount with from_place_id and to_place_id' }, 400);
    }
    const expected = body.expected_total === undefined || body.expected_total === null ? null : Number(body.expected_total);
    const note = typeof body.note === 'string' ? body.note.trim().slice(0, 300) || null : null;
    const result = await saveProductSplit(env.DB, ctx, params.id, edit, { expectedTotal: expected, note });
    return privateJson(result.value, result.status);
  };

  return [
    ['GET', '/api/stock-places', list],
    ['POST', '/api/stock-places', create],
    ['PUT', '/api/stock-places/:id', update],
    ['GET', '/api/products/:id/stock-places', productSplit],
    ['PUT', '/api/products/:id/stock-places', setProductSplit],
  ];
}

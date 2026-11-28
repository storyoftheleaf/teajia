/**
 * The Tea Wisdom Base for agents, read from the open dataset the site already
 * publishes at teajia.com/wisdom/ (index.json, then one JSON record per entry,
 * built from data/tea-wisdom-source). Reading it over the site keeps the
 * records out of the worker bundle, which has a size limit, and means an agent
 * reads exactly what the public reads.
 *
 * - `search_wisdom` and `get_wisdom_entry` answer tea questions; mcp.ts also
 *   offers them on the public connector, where shoppers' assistants ask.
 * - `wisdom_records_for_tea` (owner) says which of a Stock tea's place,
 *   cultivar and producer already have a Wisdom record and which do not, the
 *   first question before composing its entry. The full list of what an entry
 *   needs is still `node scripts/tea-wisdom-compose/needs.mjs`, which reads the
 *   drafts in the repository too.
 */
import type { ToolAuth, ToolDefinition, ToolEnv, ToolModule } from './registry';

interface Holding { name: string; label?: string; record?: string; page?: string; ids?: string[] }
interface WisdomIndex { holdings: Holding[] }

const INDEX_FRESH_FOR_MS = 10 * 60 * 1000;
let cached: { at: number; base: string; index: WisdomIndex } | null = null;

export function wisdomBase(env: { APP_URL?: string }): string {
  const raw = (env.APP_URL || 'https://www.teajia.com').replace(/\/+$/, '');
  return /^https:\/\//.test(raw) ? raw : 'https://www.teajia.com';
}

async function loadIndex(env: { APP_URL?: string }, fetcher: typeof fetch = fetch): Promise<WisdomIndex | null> {
  const base = wisdomBase(env);
  if (cached && cached.base === base && Date.now() - cached.at < INDEX_FRESH_FOR_MS) return cached.index;
  try {
    const res = await fetcher(`${base}/wisdom/index.json`, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) return null;
    const index = await res.json() as WisdomIndex;
    if (!Array.isArray(index?.holdings)) return null;
    cached = { at: Date.now(), base, index };
    return index;
  } catch {
    return null;
  }
}

/** Tests only. */
export function resetWisdomIndexForTests() { cached = null; }

const slug = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const folderOf = (h: Holding) => (h.record ? new URL(h.record.replace('{id}', 'x')).pathname.split('/')[2] : null);
const linkFor = (base: string, h: Holding, id: string) => (h.page ? h.page.replace('https://teajia.com', base).replace('{id}', id) : `${base}/wisdom`);

/**
 * The site path of a tea's own Wisdom page (a named tea), or null. Used where a
 * tea shows by name only, so a guest can still read about it.
 */
export async function namedTeaPath(names: readonly (string | null | undefined)[], env: { APP_URL?: string } = {}): Promise<string | null> {
  const wanted = names.flatMap(name => {
    const id = slug(String(name ?? ''));
    return id ? [id, id.replace(/^(19|20)\d\d-/, '')] : [];
  });
  if (!wanted.length) return null;
  const index = await loadIndex(env);
  const known = new Set(index?.holdings.find(h => h.name === 'namedTeas')?.ids ?? []);
  const hit = wanted.find(id => known.has(id));
  return hit ? `/wisdom/named/${hit}` : null;
}

export async function searchWisdom(env: { APP_URL?: string }, args: any) {
  const query = typeof args?.query === 'string' ? slug(args.query) : '';
  if (!query) return { error: 'query_required' };
  const limit = Math.min(Math.max(Number(args?.limit) || 10, 1), 30);
  const index = await loadIndex(env);
  if (!index) return { error: 'wisdom_unavailable', message: 'The Wisdom Base could not be read just now.' };
  const base = wisdomBase(env);
  const words = query.split('-').filter(Boolean);
  const hits: Array<{ holding: string; id: string; page: string; score: number }> = [];
  for (const h of index.holdings) {
    for (const id of h.ids ?? []) {
      const exact = id === query ? 3 : id.startsWith(query) ? 2 : words.every(w => id.includes(w)) ? 1 : 0;
      if (exact) hits.push({ holding: h.name, id, page: linkFor(base, h, id), score: exact });
    }
  }
  hits.sort((a, b) => b.score - a.score || a.id.length - b.id.length);
  return {
    matches: hits.slice(0, limit).map(({ score: _s, ...m }) => m),
    note: 'Read one with get_wisdom_entry (holding and id). Licensed CC BY 4.0; cite teajia.com/wisdom.',
  };
}

export async function getWisdomEntry(env: { APP_URL?: string }, args: any) {
  const holdingName = typeof args?.holding === 'string' ? args.holding.trim() : '';
  const id = typeof args?.id === 'string' ? args.id.trim() : '';
  if (!holdingName || !/^[a-z0-9-]{1,120}$/.test(id)) return { error: 'holding_and_id_required' };
  const index = await loadIndex(env);
  if (!index) return { error: 'wisdom_unavailable', message: 'The Wisdom Base could not be read just now.' };
  const h = index.holdings.find(x => x.name === holdingName);
  if (!h || !(h.ids ?? []).includes(id)) return { error: 'not_found', message: 'No Wisdom record with that holding and id. Use search_wisdom.' };
  const folder = folderOf(h);
  if (!folder) return { error: 'not_found' };
  const base = wisdomBase(env);
  try {
    const res = await fetch(`${base}/wisdom/${folder}/${id}.json`, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) return { error: 'not_found', message: 'That record is listed but not published as its own file yet.', page: linkFor(base, h, id) };
    return { holding: h.name, id, page: linkFor(base, h, id), record: await res.json() };
  } catch {
    return { error: 'wisdom_unavailable', message: 'The Wisdom Base could not be read just now.' };
  }
}

async function wisdomRecordsForTea(env: ToolEnv, auth: ToolAuth, args: any) {
  const productId = typeof args?.product_id === 'string' ? args.product_id.trim() : '';
  if (!productId) return { error: 'product_id_required' };
  const p = await env.DB.prepare(
    'SELECT id, product_name, given_name, type, origin_country, origin_region, cultivar, vendor FROM products WHERE id = ? AND account_id = ?',
  ).bind(productId, auth.accountId).first<Record<string, any>>();
  if (!p) return { error: 'not_found', message: 'No tea with that id in this shop.' };
  const index = await loadIndex(env);
  if (!index) return { error: 'wisdom_unavailable', message: 'The Wisdom Base could not be read just now.' };
  const base = wisdomBase(env);
  const ids = (name: string) => new Set(index.holdings.find(h => h.name === name)?.ids ?? []);
  const holding = (name: string) => index.holdings.find(h => h.name === name)!;
  const check = (holdingName: string, value: unknown) => {
    const text = typeof value === 'string' ? value.trim() : '';
    if (!text) return { holding: holdingName, value: null, status: 'not_stated_on_the_tea' };
    const parts = text.split(/[,/(]/).map(s => slug(s)).filter(Boolean);
    const known = ids(holdingName);
    const hit = parts.find(part => known.has(part));
    return hit
      ? { holding: holdingName, value: text, status: 'in_wisdom_base', id: hit, page: linkFor(base, holding(holdingName), hit) }
      : { holding: holdingName, value: text, status: 'missing', suggested_id: parts[0] ?? null };
  };
  const checks = [
    check('regions', p.origin_region),
    check('regions', p.origin_country),
    check('cultivars', p.cultivar),
    check('producers', p.vendor),
  ];
  return {
    tea: { id: p.id, name: p.given_name || p.product_name, type: p.type },
    checks,
    missing: checks.filter(c => c.status === 'missing').map(c => `${c.holding}: ${c.value}`),
    note: 'Write what is missing in the Wisdom Base first (docs/TEA_WISDOM_BASE.md), then compose the entry with /tea-wisdom. The full list, drafts included, is node scripts/tea-wisdom-compose/needs.mjs.',
  };
}

export const WISDOM_PUBLIC_DEFS = [
  {
    name: 'search_wisdom',
    description: 'Search the Teajia Tea Wisdom Base (cultivars, growing regions, producers, marks, styles, named teas) by name. Returns matching record ids and their pages. Open knowledge, CC BY 4.0.',
    inputSchema: {
      type: 'object',
      properties: { query: { type: 'string', description: 'e.g. "da hong pao", "yiwu", "menghai".' }, limit: { type: 'number', default: 10 } },
      required: ['query'],
    },
  },
  {
    name: 'get_wisdom_entry',
    description: 'One Tea Wisdom record in full: what is known about a cultivar, region, producer, mark, style or named tea, with its page on teajia.com.',
    inputSchema: {
      type: 'object',
      properties: { holding: { type: 'string', description: 'From search_wisdom, e.g. cultivars or regions.' }, id: { type: 'string' } },
      required: ['holding', 'id'],
    },
  },
] as const;

const defs: ToolDefinition[] = [
  ...WISDOM_PUBLIC_DEFS.map(d => ({ ...d, scope: 'inventory:read' as const, inputSchema: d.inputSchema as unknown as Record<string, unknown> })),
  {
    name: 'wisdom_records_for_tea',
    scope: 'inventory:read',
    description: 'For a Stock tea: whether its growing region, country, cultivar and producer already have a Tea Wisdom record, and which are missing. Check this before composing its Tea Wisdom entry.',
    inputSchema: { type: 'object', properties: { product_id: { type: 'string' } }, required: ['product_id'], additionalProperties: false },
  },
];

export const wisdomRecordTools: ToolModule = {
  area: 'wisdom-records',
  defs,
  handlers: {
    search_wisdom: (env, _auth, args) => searchWisdom(env, args),
    get_wisdom_entry: (env, _auth, args) => getWisdomEntry(env, args),
    wisdom_records_for_tea: wisdomRecordsForTea,
  },
};

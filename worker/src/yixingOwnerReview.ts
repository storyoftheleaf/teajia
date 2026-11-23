/** The private pot review is kept apart from shop records, drafts and publication. */
const ACCOUNT = 'acc_teajia_bali';
const API = '/api/admin/yixing';
const PREFIX = 'owner-review/' + ACCOUNT + '/yixing/v1/';
const FIELDS = ['clay', 'color', 'shape'] as const;
type Kind = typeof FIELDS[number];
type Decision = Record<Kind, string> & { note: string; revision: number };
type Decisions = Record<string, Decision>;
interface Board {
  version: number;
  ownerUserId: string;
  pots: { id: string }[];
  reference: { entries: { id: string; kind: Kind }[] };
}
type Scope = { accountId: string; userId: string };
type Env = { DB: D1Database; ATLAS_BUCKET?: R2Bucket };

function privateResponse(body: BodyInit | null, status: number, type: string) {
  return new Response(body, { status, headers: {
    'Content-Type': type, 'Cache-Control': 'private, no-store',
    'Vary': 'Authorization, X-Teajia-Account', 'X-Robots-Tag': 'noindex, nofollow, noarchive',
    'X-Content-Type-Options': 'nosniff',
  } });
}

function json(data: unknown, status = 200) {
  return privateResponse(JSON.stringify(data), status, 'application/json');
}

function decisionFrom(input: unknown, board: Board): Decision | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const row = input as Record<string, unknown>;
  if (typeof row.revision !== 'number' || !Number.isSafeInteger(row.revision) || row.revision < 0
    || typeof row.note !== 'string' || [...row.note].length > 1600) return null;
  for (const kind of FIELDS) {
    if (typeof row[kind] !== 'string' || (row[kind] && !board.reference.entries.some(e => e.kind === kind && e.id === row[kind]))) return null;
  }
  return { clay: row.clay as string, color: row.color as string, shape: row.shape as string, note: row.note.trim(), revision: row.revision };
}

async function readDecisions(bucket: R2Bucket, key: string) {
  const object = await bucket.get(key);
  const decisions = object ? await object.json<Decisions>() : {};
  if (!decisions || typeof decisions !== 'object' || Array.isArray(decisions)) throw new Error('Invalid review decisions');
  return { decisions, etag: object?.etag };
}

async function saveDecision(request: Request, board: Board, potId: string, bucket: R2Bucket, key: string) {
  if (!board.pots.some(pot => pot.id === potId)) return json({ error: 'Pot not found' }, 404);
  if (!request.headers.get('Content-Type')?.startsWith('application/json')) return json({ error: 'Send a JSON review' }, 415);
  if (Number(request.headers.get('Content-Length')) > 16384) return json({ error: 'Review is too large' }, 413);
  const text = await request.text();
  if (text.length > 16384) return json({ error: 'Review is too large' }, 413);
  let value: unknown;
  try { value = JSON.parse(text); } catch { return json({ error: 'Invalid JSON review' }, 400); }
  const next = decisionFrom(value, board);
  if (!next) return json({ error: 'Choose a reference for each confirmed field and keep the note under 1,601 characters.' }, 400);

  // Conditional writes protect both simultaneous edits to one pot and edits to
  // separate pots in the same private board. Retry only the latter.
  for (let attempt = 0; attempt < 3; attempt++) {
    const { decisions, etag } = await readDecisions(bucket, key);
    if (next.revision !== (decisions[potId]?.revision ?? 0)) break;
    const saved = { ...next, revision: next.revision + 1 };
    const result = await bucket.put(key, JSON.stringify({ ...decisions, [potId]: saved }), {
      onlyIf: etag ? { etagMatches: etag } : { etagDoesNotMatch: '*' },
      httpMetadata: { contentType: 'application/json' },
    });
    if (result) return json(saved);
  }
  return json({ error: 'The review changed. Reopen this pot before saving.' }, 409);
}

export async function serveYixingOwnerReview(
  request: Request, env: Env, getAccount: () => Promise<Scope | { error: Response }>,
): Promise<Response> {
  const head = request.method === 'HEAD';
  function error(message: string, status: number) {
    return privateResponse(head ? null : JSON.stringify({ error: message }), status, 'application/json');
  }
  try {
    const account = await getAccount();
    if ('error' in account) return privateResponse(head ? null : account.error.body, account.error.status, 'application/json');
    if (account.accountId !== ACCOUNT) return error('Owner access required', 403);
    const member = await env.DB.prepare(
      `SELECT 1 AS permitted FROM account_members m JOIN accounts a ON a.id = m.account_id
       JOIN users u ON u.id = m.user_id
       WHERE m.user_id = ? AND m.account_id = ? AND m.status = 'active' AND a.status = 'active'
         AND (m.role = 'owner' OR u.platform_role = 'platform_owner')`,
    ).bind(account.userId, ACCOUNT).first();
    if (!member) return error('Owner access required', 403);
    const bucket = env.ATLAS_BUCKET;
    if (!bucket) return error('Review storage unavailable', 503);
    const object = await bucket.get(PREFIX + 'board.json');
    if (!object) return error('Review unavailable', 503);
    const board = await object.json<Board>();
    if (!board.ownerUserId || account.userId !== board.ownerUserId) return error('Owner access required', 403);
    const path = new URL(request.url).pathname.slice(API.length);
    const decisionsKey = PREFIX + 'decisions/' + encodeURIComponent(account.userId) + '.json';
    if (!path && head) return privateResponse(null, 200, 'application/json');
    if (!path && request.method === 'GET') {
      const { decisions } = await readDecisions(bucket, decisionsKey);
      return json({ version: board.version, pots: board.pots, reference: board.reference, decisions });
    }
    const media = /^\/media\/([a-f0-9]{64}\.jpg)$/.exec(path);
    if (media && (request.method === 'GET' || head)) {
      const key = PREFIX + 'media/' + media[1];
      const object = head ? await bucket.head(key) : await bucket.get(key);
      if (!object) return error('Photo not found', 404);
      return privateResponse('body' in object ? (object as R2ObjectBody).body : null, 200, 'image/jpeg');
    }
    const pot = /^\/pots\/(pots-[0-9]{2})$/.exec(path);
    if (pot && request.method === 'PUT') return await saveDecision(request, board, pot[1], bucket, decisionsKey);
    return error('Review route not found', 404);
  } catch {
    return error('Private review unavailable', 503);
  }
}

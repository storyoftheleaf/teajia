import { findYixingShapeEvidence, serveYixingShapeLibrary, type ShapeReferenceEvidence } from './yixingShapeLibrary';
import { overlayPhotoGallery, readPhotoGallery, serveYixingPhotoBatch, type ReviewPhoto } from './yixingPhotoBatch';

/** The private pot review is kept apart from shop records, drafts and publication. */
const ACCOUNT = 'acc_teajia_bali';
const API = '/api/admin/yixing';
const ROOT = 'owner-review/' + ACCOUNT + '/yixing/';
const PREFIX = ROOT + 'v1/';
const SHAPES_PREFIX = ROOT + 'shapes/v1/';
const FIELDS = ['clay', 'color', 'shape'] as const;
type Kind = typeof FIELDS[number];
type ShapeVerdict = ShapeReferenceEvidence & { verdict: 'confirmed' | 'rejected' };
type ShapeChange = ShapeVerdict | { formId: string; asset: string; verdict: 'withdraw' };
type Decision = Record<Kind, string> & {
  note: string;
  revision: number;
  rejectedClays?: string[];
  confirmedShape?: ShapeVerdict;
  rejectedShapes?: Record<string, ShapeVerdict>;
};
type Decisions = Record<string, Decision>;
interface Board {
  version: number;
  ownerUserId: string;
  pots: { id: string; photos?: ReviewPhoto[] }[];
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
  const decision: Decision = { clay: row.clay as string, color: row.color as string, shape: row.shape as string, note: row.note.trim(), revision: row.revision };
  if (row.rejectedClays !== undefined) {
    const rejected = row.rejectedClays;
    const clays = new Set(board.reference.entries.filter(entry => entry.kind === 'clay').map(entry => entry.id));
    if (!Array.isArray(rejected) || rejected.length > clays.size || new Set(rejected).size !== rejected.length
      || !rejected.every(id => typeof id === 'string' && clays.has(id) && id !== decision.clay)) return null;
    decision.rejectedClays = rejected;
  }
  return decision;
}

async function readDecisions(bucket: R2Bucket, key: string) {
  const object = await bucket.get(key);
  const decisions = object ? await object.json<Decisions>() : {};
  if (!decisions || typeof decisions !== 'object' || Array.isArray(decisions)) throw new Error('Invalid review decisions');
  return { decisions, etag: object?.etag };
}

async function readReviewInput(request: Request): Promise<{ value: unknown } | { error: Response }> {
  if (!request.headers.get('Content-Type')?.startsWith('application/json')) {
    return { error: json({ error: 'Send a JSON review' }, 415) };
  }
  if (Number(request.headers.get('Content-Length')) > 16384) return { error: json({ error: 'Review is too large' }, 413) };
  const text = await request.text();
  if (text.length > 16384) return { error: json({ error: 'Review is too large' }, 413) };
  try { return { value: JSON.parse(text) }; } catch { return { error: json({ error: 'Invalid JSON review' }, 400) }; }
}

async function updateDecision(
  bucket: R2Bucket, key: string, potId: string, revision: number,
  apply: (previous: Decision | undefined) => Decision | Response,
) {
  // Both review routes share this revision. Separate pots may retry an R2
  // conflict, but a stale edit to the same pot must be reopened.
  for (let attempt = 0; attempt < 3; attempt++) {
    const { decisions, etag } = await readDecisions(bucket, key);
    const previous = decisions[potId];
    if (revision !== (previous?.revision ?? 0)) break;
    const updated = apply(previous);
    if (updated instanceof Response) return updated;
    const saved = { ...updated, revision: revision + 1 };
    const result = await bucket.put(key, JSON.stringify({ ...decisions, [potId]: saved }), {
      onlyIf: etag ? { etagMatches: etag } : { etagDoesNotMatch: '*' },
      httpMetadata: { contentType: 'application/json' },
    });
    if (result) return json(saved);
  }
  return json({ error: 'The review changed. Reopen this pot before saving.' }, 409);
}

async function saveDecision(request: Request, board: Board, potId: string, bucket: R2Bucket, key: string) {
  const input = await readReviewInput(request);
  if ('error' in input) return input.error;
  const next = decisionFrom(input.value, board);
  if (!next) return json({ error: 'Check your reference choices and rejected clays. Keep the note under 1,601 characters.' }, 400);

  return updateDecision(bucket, key, potId, next.revision, previous => {
    const updated = { ...next };
    // Older clients send only confirmed fields. Confirming a clay supersedes its rejection.
    if (next.rejectedClays === undefined && previous?.rejectedClays) {
      updated.rejectedClays = previous.rejectedClays.filter(id => id !== next.clay);
    }
    if (previous?.confirmedShape) updated.confirmedShape = previous.confirmedShape;
    if (previous?.rejectedShapes) updated.rejectedShapes = previous.rejectedShapes;
    return updated;
  });
}

function applyShapeChange(previous: Decision | undefined, change: ShapeChange): Decision | Response {
  const updated: Decision = previous ? { ...previous } : { clay: '', color: '', shape: '', note: '', revision: 0 };
  const rejected = { ...updated.rejectedShapes };
  const confirmed = updated.confirmedShape?.formId === change.formId ? updated.confirmedShape : undefined;

  if (change.verdict === 'withdraw') {
    const existing = confirmed ?? (Object.hasOwn(rejected, change.formId) ? rejected[change.formId] : undefined);
    if (existing?.asset !== change.asset) return json({ error: 'Choose a saved shape verdict to withdraw.' }, 400);
    if (confirmed) delete updated.confirmedShape;
    else delete rejected[change.formId];
  } else if (change.verdict === 'confirmed') {
    updated.confirmedShape = change;
    delete rejected[change.formId];
  } else {
    if (confirmed) delete updated.confirmedShape;
    rejected[change.formId] = change;
  }
  if (Object.keys(rejected).length) updated.rejectedShapes = rejected;
  else delete updated.rejectedShapes;
  return updated;
}

async function saveShapeVerdict(request: Request, potId: string, bucket: R2Bucket, key: string) {
  const input = await readReviewInput(request);
  if ('error' in input) return input.error;
  if (!input.value || typeof input.value !== 'object' || Array.isArray(input.value)) {
    return json({ error: 'Choose a shape, source photo, and verdict.' }, 400);
  }
  const { formId, asset, action, revision } = input.value as Record<string, unknown>;
  if (typeof formId !== 'string' || !/^[a-z][a-z0-9-]{0,127}$/.test(formId)
    || typeof asset !== 'string' || !/^assets\/[a-z0-9][a-z0-9-]{0,127}\.jpg$/.test(asset)
    || (action !== 'confirm' && action !== 'reject' && action !== 'withdraw')
    || typeof revision !== 'number' || !Number.isSafeInteger(revision) || revision < 0 || revision === Number.MAX_SAFE_INTEGER) {
    return json({ error: 'Choose a shape, source photo, and verdict.' }, 400);
  }
  let change: ShapeChange;
  if (action === 'withdraw') {
    change = { formId, asset, verdict: 'withdraw' };
  } else {
    const evidence = await findYixingShapeEvidence(bucket, SHAPES_PREFIX, formId, asset);
    if (!evidence) return json({ error: 'Choose a source photo from that shape in the library.' }, 400);
    change = { ...evidence, verdict: action === 'confirm' ? 'confirmed' : 'rejected' };
  }
  return updateDecision(bucket, key, potId, revision, previous => applyShapeChange(previous, change));
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
    if (path === '/photo-batch') return await serveYixingPhotoBatch(request, bucket, PREFIX, board.pots, json);
    if (path === '/shapes' || path.startsWith('/shapes/')) {
      return await serveYixingShapeLibrary(request, bucket, path.slice('/shapes'.length), SHAPES_PREFIX, privateResponse);
    }
    const decisionsKey = PREFIX + 'decisions/' + encodeURIComponent(account.userId) + '.json';
    if (!path && head) return privateResponse(null, 200, 'application/json');
    if (!path && request.method === 'GET') {
      const [{ decisions }, { photos }] = await Promise.all([readDecisions(bucket, decisionsKey), readPhotoGallery(bucket, PREFIX)]);
      return json({ version: board.version, pots: overlayPhotoGallery(board.pots, photos), reference: board.reference, decisions });
    }
    const media = /^\/media\/([a-f0-9]{64}\.jpg)$/.exec(path);
    if (media && (request.method === 'GET' || head)) {
      const key = PREFIX + 'media/' + media[1];
      const object = head ? await bucket.head(key) : await bucket.get(key);
      if (!object) return error('Photo not found', 404);
      return privateResponse('body' in object ? (object as R2ObjectBody).body : null, 200, 'image/jpeg');
    }
    const pot = /^\/pots\/(pots-[0-9]{2})(\/shape-verdict)?$/.exec(path);
    if (pot && request.method === 'PUT') {
      const [, potId, verdict] = pot;
      if (!board.pots.some(pot => pot.id === potId)) return error('Pot not found', 404);
      return verdict
        ? await saveShapeVerdict(request, potId, bucket, decisionsKey)
        : await saveDecision(request, board, potId, bucket, decisionsKey);
    }
    return error('Review route not found', 404);
  } catch {
    return error('Private review unavailable', 503);
  }
}

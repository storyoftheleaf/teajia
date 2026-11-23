/** Owner-only reading packets live in the private Atlas bucket, separate from Stock. */
type ReadingIndex = {
  ownerUserId: string;
  items: { id: string; title: string; status: string; digest: string }[];
};
type Scope = { accountId: string; userId: string };
const PATH = '/api/admin/catalog-review/teas';

export async function serveCatalogTeaReading(
  request: Request, env: { DB: D1Database; ATLAS_BUCKET?: R2Bucket },
  activeAccount: () => Promise<Scope | { error: Response }>,
) {
  const head = request.method === 'HEAD';
  const reply = (status: number, body?: BodyInit | null) => new Response(head ? null : body, {
    status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' },
  });
  if (!head && request.method !== 'GET') return reply(405);
  const scope = await activeAccount();
  if ('error' in scope) return reply(scope.error.status);
  const member = await env.DB.prepare(
    `SELECT 1 FROM account_members m JOIN accounts a ON a.id=m.account_id JOIN users u ON u.id=m.user_id
      WHERE m.user_id=? AND m.account_id=? AND m.status='active' AND a.status='active'
      AND (m.role='owner' OR u.platform_role='platform_owner')`,
  ).bind(scope.userId, scope.accountId).first();
  if (!member) return reply(403);
  const bucket = env.ATLAS_BUCKET;
  if (!bucket) return reply(503);
  const root = 'owner-review/' + scope.accountId + '/catalog-reading/';
  const object = await bucket.get(root + 'index.json');
  if (!object) return reply(404);
  const index = await object.json<ReadingIndex>();
  if (index.ownerUserId !== scope.userId) return reply(403);
  const suffix = new URL(request.url).pathname.slice(PATH.length);
  if (!suffix) return reply(200, JSON.stringify(index.items.map(({ id, title, status }) => ({ id, title, status }))));
  const item = index.items.find(row => suffix === '/' + row.id);
  if (!item || !/^[a-f0-9]{64}$/.test(item.digest)) return reply(404);
  const key = root + 'pages/' + item.digest + '.json';
  if (head) return reply(await bucket.head(key) ? 200 : 404);
  const page = await bucket.get(key);
  return page ? reply(200, page.body) : reply(404);
}

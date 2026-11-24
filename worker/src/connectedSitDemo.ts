const FEATURE = 'connected_sit_demo';
const PUBLIC_PATH = '/api/public/connected-sit-demo';
const OWNER_PATH = '/api/admin/events/connected-sit-demo';

type DemoEnv = { DB: D1Database };
type OwnerScope = { accountId: string; userId: string };
type Handler<E> = (request: Request, env: E) => Promise<Response>;

function availability(available: boolean, status = 200): Response {
  return Response.json({ available }, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });
}

function withoutCaching(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set('Cache-Control', 'no-store');
  return new Response(response.body, { status: response.status, headers });
}

async function demoAvailable(DB: D1Database, accountId: string): Promise<boolean> {
  const row = await DB.prepare(
    `SELECT COALESCE(f.enabled, 1) AS enabled
     FROM accounts a
     LEFT JOIN account_features f ON f.account_id = a.id AND f.feature = ?
     WHERE a.id = ? AND a.status = 'active' AND a.public_enabled = 1`,
  ).bind(FEATURE, accountId).first<{ enabled: number }>();
  return row?.enabled === 1;
}

export function connectedSitDemoRoutes<E extends DemoEnv>(options: {
  accountId: string;
  requireOwner: (request: Request, env: E) => Promise<OwnerScope | { error: Response }>;
}): [string, string, Handler<E>][] {
  const publicStatus: Handler<E> = async (_request, { DB }) => {
    const available = await demoAvailable(DB, options.accountId);
    return availability(available, available ? 200 : 404);
  };

  const ownerControl: Handler<E> = async (request, env) => {
    const scope = await options.requireOwner(request, env);
    if ('error' in scope) return withoutCaching(scope.error);
    if (scope.accountId !== options.accountId) return availability(false, 404);

    if (request.method === 'DELETE') {
      await env.DB.prepare(
        `INSERT INTO account_features (account_id, feature, enabled, enabled_by, enabled_at)
         VALUES (?, ?, 0, ?, datetime('now'))
         ON CONFLICT(account_id, feature) DO UPDATE SET
           enabled = 0, enabled_by = excluded.enabled_by, enabled_at = excluded.enabled_at
         WHERE account_features.enabled <> 0`,
      ).bind(scope.accountId, FEATURE, scope.userId).run();
      return availability(false);
    }
    return availability(await demoAvailable(env.DB, scope.accountId));
  };

  return [
    ['GET', PUBLIC_PATH, publicStatus],
    // A read-only POST excludes stale responses cached by older service workers.
    ['POST', PUBLIC_PATH, publicStatus],
    ['GET', OWNER_PATH, ownerControl],
    ['DELETE', OWNER_PATH, ownerControl],
  ];
}

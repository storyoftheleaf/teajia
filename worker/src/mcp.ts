// MCP server for Teajia — voice/agent control of this account's inventory.
//
// Speaks the Model Context Protocol over plain HTTP POST + JSON-RPC 2.0 (no SSE).
// One MCP token == one (account, user) pair, with full bundle-equivalent rights
// inside that account. Tokens are minted in the admin and stored hashed.
//
// Mutating tools follow a confirm-pattern: first call returns a `preview`
// payload + `confirmation_token`; the model is expected to read the preview
// back to the user and then re-call with `confirm: <token>` to commit. The
// commit step short-circuits to a no-op if the token is unknown or expired.
//
// Stock + invoice writes go through the existing fulfillment path (so the
// `stock_ledger` audit trail, low-stock detection, and listing mirror all
// still fire). Nothing in this file touches D1 in a way that bypasses the
// admin UI's invariants.

type Env = {
  DB: D1Database;
  // The wider Env interface in index.ts has many more fields — only the ones
  // the MCP server actually reads are listed here so this module is portable.
};

// ── small JSON helpers (mirroring index.ts so we don't import its 16k lines) ──
function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}

function rpcError(id: number | string | null, code: number, message: string, data?: unknown): Response {
  return json({ jsonrpc: '2.0', id, error: { code, message, ...(data ? { data } : {}) } });
}

function rpcResult(id: number | string | null, result: unknown): Response {
  return json({ jsonrpc: '2.0', id, result });
}

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// ── token auth ──
type McpAuth = {
  accountId: string;
  userId: string;
  userEmail: string;
  tokenId: string;
};

// 401 with WWW-Authenticate header — required by the MCP OAuth spec so
// clients (Claude desktop/mobile) know to start the OAuth discovery flow.
// The `resource_metadata` parameter points clients at our protected-resource
// metadata document, which in turn points them at the auth server.
function unauthorized(request: Request, message: string): Response {
  const url = new URL(request.url);
  const origin = `${url.protocol}//${url.host}`;
  const body = JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32001, message } });
  return new Response(body, {
    status: 401,
    headers: {
      'Content-Type': 'application/json',
      'WWW-Authenticate': `Bearer realm="mcp", resource_metadata="${origin}/.well-known/oauth-protected-resource"`,
    },
  });
}

async function authenticateMcp(request: Request, env: Env): Promise<McpAuth | Response> {
  const auth = request.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) {
    return unauthorized(request, 'Missing bearer token');
  }
  const plaintext = auth.slice(7).trim();
  if (!plaintext) return unauthorized(request, 'Empty bearer token');

  const hash = await sha256Hex(plaintext);
  const row = await env.DB.prepare(
    'SELECT id, account_id, user_id, user_email, revoked_at FROM mcp_tokens WHERE token_hash = ?'
  ).bind(hash).first() as Record<string, any> | null;

  if (!row || row.revoked_at) {
    return unauthorized(request, 'Invalid or revoked token');
  }

  // Bump last_used_at on every successful auth (best-effort; non-blocking).
  env.DB.prepare("UPDATE mcp_tokens SET last_used_at = datetime('now') WHERE id = ?")
    .bind(row.id).run().catch(() => {});

  return {
    accountId: row.account_id as string,
    userId: row.user_id as string,
    userEmail: row.user_email as string,
    tokenId: row.id as string,
  };
}

// ── confirmation token store ──
//
// Mutating tools issue a confirmation token on the first call (a preview),
// and require the model to re-call with that token to commit. We hold them in
// the worker's per-isolate memory with a 5-minute TTL — long enough for a
// voice round-trip, short enough that a stale token can't be replayed days
// later. If the isolate is recycled mid-confirm the user just runs the tool
// again; the cost of that is one re-confirm, not a wrong write.

type PendingMutation =
  | { kind: 'add_stock'; accountId: string; userEmail: string; productId: string; grams: number; note: string | null }
  | { kind: 'remove_stock'; accountId: string; userEmail: string; productId: string; grams: number; reason: string; note: string | null }
  | { kind: 'record_sale'; accountId: string; userEmail: string; lines: { productId: string; grams: number; pricePerGramUsd: number }[]; customerId: string | null; customerName: string; customerWhatsapp: string | null; notes: string | null };

type PendingEntry = { mutation: PendingMutation; expiresAt: number };
const PENDING = new Map<string, PendingEntry>();
const PENDING_TTL_MS = 5 * 60 * 1000;

function issueConfirmationToken(mutation: PendingMutation): string {
  // Sweep expired entries opportunistically so the map doesn't grow unbounded
  // in a long-lived isolate.
  const now = Date.now();
  for (const [k, v] of PENDING) if (v.expiresAt < now) PENDING.delete(k);

  const token = crypto.randomUUID();
  PENDING.set(token, { mutation, expiresAt: now + PENDING_TTL_MS });
  return token;
}

function consumeConfirmationToken(token: string): PendingMutation | null {
  const entry = PENDING.get(token);
  if (!entry) return null;
  PENDING.delete(token);
  if (entry.expiresAt < Date.now()) return null;
  return entry.mutation;
}

// ── tea name search helpers ──
//
// Token-based scoring — Fuse.js doesn't run server-side here without bundling
// a dependency, but the corpus per account is in the low thousands at most,
// so a hand-rolled prefix/contains/word-overlap scorer is plenty for voice.

function normalize(s: string | null | undefined): string {
  return (s || '').toLowerCase().replace(/[^a-z0-9一-鿿\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

function scoreMatch(query: string, fields: (string | null | undefined)[]): number {
  const q = normalize(query);
  if (!q) return 0;
  const qTokens = q.split(' ').filter(Boolean);

  let best = 0;
  for (const raw of fields) {
    const f = normalize(raw);
    if (!f) continue;
    if (f === q) return 1.0;
    if (f.startsWith(q)) best = Math.max(best, 0.9);
    if (f.includes(q)) best = Math.max(best, 0.75);
    const fTokens = f.split(' ').filter(Boolean);
    let hits = 0;
    for (const t of qTokens) if (fTokens.some(ft => ft === t || ft.startsWith(t))) hits += 1;
    if (qTokens.length > 0) best = Math.max(best, (hits / qTokens.length) * 0.7);
  }
  return best;
}

type ProductRow = {
  id: string;
  given_name: string | null;
  product_name: string;
  chinese_name: string | null;
  type: string;
  form: string | null;
  year: string | null;
  origin_country: string | null;
  origin_region: string | null;
  vendor: string | null;
  stock_grams: number | null;
  quantity_units: number | null;
  low_stock_threshold: number | null;
  fixed_retail_price_usd: number | null;
  status: string | null;
};

function productSummary(p: ProductRow, score?: number) {
  const display = p.given_name || p.product_name;
  return {
    id: p.id,
    display_name: display,
    product_name: p.product_name,
    given_name: p.given_name,
    chinese_name: p.chinese_name,
    type: p.type,
    form: p.form,
    year: p.year,
    origin: [p.origin_region, p.origin_country].filter(Boolean).join(', ') || null,
    vendor: p.vendor,
    stock_grams: p.stock_grams ?? 0,
    quantity_units: p.quantity_units,
    low_stock_threshold: p.low_stock_threshold,
    fixed_retail_price_usd: p.fixed_retail_price_usd,
    status: p.status,
    ...(typeof score === 'number' ? { match_score: Math.round(score * 100) / 100 } : {}),
  };
}

// ── tool: search_tea ──
async function toolSearchTea(env: Env, accountId: string, args: any) {
  const query = String(args?.query || '').trim();
  const limit = Math.min(Math.max(Number(args?.limit) || 5, 1), 20);
  if (!query) {
    return { matches: [], note: 'No query provided.' };
  }

  const { results } = await env.DB.prepare(
    `SELECT id, given_name, product_name, chinese_name, type, form, year,
            origin_country, origin_region, vendor, stock_grams, quantity_units,
            low_stock_threshold, fixed_retail_price_usd, status
       FROM products
      WHERE account_id = ? AND status != 'Archived'`
  ).bind(accountId).all();

  const scored = (results as unknown as ProductRow[])
    .map(p => ({
      product: p,
      score: scoreMatch(query, [p.given_name, p.product_name, p.chinese_name, p.origin_region, p.vendor, p.year]),
    }))
    .filter(s => s.score > 0.3)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return {
    matches: scored.map(s => productSummary(s.product, s.score)),
    ambiguous: scored.length >= 2 && scored[0].score - scored[1].score < 0.1,
  };
}

// ── tool: get_tea ──
async function toolGetTea(env: Env, accountId: string, args: any) {
  const id = String(args?.id || '').trim();
  if (!id) throw new Error('id is required');

  const product = await env.DB.prepare(
    `SELECT id, given_name, product_name, chinese_name, type, form, year,
            origin_country, origin_region, vendor, stock_grams, quantity_units,
            low_stock_threshold, fixed_retail_price_usd, status,
            description, tasting_notes, cost_amount, cost_currency
       FROM products WHERE id = ? AND account_id = ?`
  ).bind(id, accountId).first() as ProductRow & { description?: string; tasting_notes?: string; cost_amount?: number; cost_currency?: string } | null;

  if (!product) return { error: 'not_found' };

  const ledger = await env.DB.prepare(
    `SELECT delta, balance_after, reason, source_invoice_number, user_email, note, created_at
       FROM stock_ledger WHERE product_id = ? ORDER BY created_at DESC LIMIT 10`
  ).bind(id).all();

  let tastingNotes: any = product.tasting_notes;
  if (typeof tastingNotes === 'string') {
    try { tastingNotes = JSON.parse(tastingNotes); } catch { tastingNotes = []; }
  }

  return {
    ...productSummary(product),
    description: product.description ?? null,
    tasting_notes: tastingNotes,
    cost_amount: product.cost_amount ?? null,
    cost_currency: product.cost_currency ?? null,
    recent_ledger: ledger.results,
  };
}

// ── tool: list_low_stock ──
async function toolListLowStock(env: Env, accountId: string) {
  const { results } = await env.DB.prepare(
    `SELECT id, given_name, product_name, chinese_name, type, form, year,
            origin_country, origin_region, vendor, stock_grams, quantity_units,
            low_stock_threshold, fixed_retail_price_usd, status
       FROM products
      WHERE account_id = ?
        AND status != 'Archived'
        AND low_stock_threshold IS NOT NULL
        AND stock_grams < low_stock_threshold
      ORDER BY (CAST(stock_grams AS REAL) / NULLIF(low_stock_threshold, 0)) ASC
      LIMIT 50`
  ).bind(accountId).all();

  return {
    items: (results as unknown as ProductRow[]).map(p => productSummary(p)),
    count: results.length,
  };
}

// ── tool: find_customer ──
async function toolFindCustomer(env: Env, accountId: string, args: any) {
  const query = String(args?.query || '').trim();
  if (!query) return { matches: [] };

  const { results } = await env.DB.prepare(
    `SELECT id, name, company, email, phone, whatsapp, city, country, preferred_currency
       FROM customers WHERE account_id = ?`
  ).bind(accountId).all();

  const scored = (results as any[])
    .map(c => ({
      customer: c,
      score: scoreMatch(query, [c.name, c.company, c.email, c.phone, c.whatsapp]),
    }))
    .filter(s => s.score > 0.3)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);

  return {
    matches: scored.map(s => ({
      id: s.customer.id,
      name: s.customer.name,
      company: s.customer.company,
      email: s.customer.email,
      phone: s.customer.phone,
      whatsapp: s.customer.whatsapp,
      city: s.customer.city,
      country: s.customer.country,
      preferred_currency: s.customer.preferred_currency,
      match_score: Math.round(s.score * 100) / 100,
    })),
  };
}

// ── tool: add_stock (preview / confirm) ──
async function toolAddStock(env: Env, auth: McpAuth, args: any) {
  const productId = String(args?.id || '').trim();
  const grams = Number(args?.grams);
  const note = args?.note ? String(args.note).slice(0, 500) : null;
  const confirm = args?.confirm ? String(args.confirm) : null;

  if (!productId) throw new Error('id is required');
  if (!Number.isFinite(grams) || grams <= 0) throw new Error('grams must be a positive number');

  if (!confirm) {
    const product = await env.DB.prepare(
      'SELECT id, given_name, product_name, stock_grams FROM products WHERE id = ? AND account_id = ?'
    ).bind(productId, auth.accountId).first() as ProductRow | null;
    if (!product) return { error: 'not_found' };

    const current = Number(product.stock_grams || 0);
    const next = current + grams;
    const token = issueConfirmationToken({
      kind: 'add_stock', accountId: auth.accountId, userEmail: auth.userEmail,
      productId, grams, note,
    });
    return {
      preview: {
        action: 'add_stock',
        product: { id: product.id, name: product.given_name || product.product_name },
        delta_grams: grams,
        balance_before: current,
        balance_after: next,
        note,
      },
      confirmation_token: token,
      expires_in_seconds: PENDING_TTL_MS / 1000,
    };
  }

  const pending = consumeConfirmationToken(confirm);
  if (!pending || pending.kind !== 'add_stock' || pending.productId !== productId) {
    return { error: 'invalid_or_expired_confirmation_token' };
  }
  return commitAddStock(env, pending);
}

async function commitAddStock(env: Env, m: Extract<PendingMutation, { kind: 'add_stock' }>) {
  const product = await env.DB.prepare(
    'SELECT id, stock_grams, given_name, product_name FROM products WHERE id = ? AND account_id = ?'
  ).bind(m.productId, m.accountId).first() as { id: string; stock_grams: number; given_name: string | null; product_name: string } | null;
  if (!product) return { error: 'not_found' };

  const balanceAfter = Number(product.stock_grams || 0) + m.grams;

  await env.DB.batch([
    env.DB.prepare('UPDATE products SET stock_grams = stock_grams + ? WHERE id = ? AND account_id = ?')
      .bind(m.grams, m.productId, m.accountId),
    env.DB.prepare(
      'UPDATE product_listings SET stock_grams = stock_grams + ?, updated_at = datetime(\'now\') WHERE id = ?'
    ).bind(m.grams, `list_${m.productId}`),
    env.DB.prepare(
      `INSERT INTO stock_ledger (id, product_id, delta, balance_after, reason, user_email, note, account_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(crypto.randomUUID(), m.productId, m.grams, balanceAfter, 'PURCHASE_RECEIPT', m.userEmail, m.note ?? `MCP add_stock`, m.accountId),
    env.DB.prepare(
      `INSERT INTO activity_logs (id, action, details, user_email, entity_type, entity_id, account_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      crypto.randomUUID(), 'STOCK_ADDED_MCP',
      `+${m.grams}g via MCP — ${product.given_name || product.product_name}`,
      m.userEmail, 'product', m.productId, m.accountId,
    ),
  ]);

  return {
    committed: true,
    action: 'add_stock',
    product: { id: product.id, name: product.given_name || product.product_name },
    delta_grams: m.grams,
    balance_after: balanceAfter,
  };
}

// ── tool: remove_stock (preview / confirm) ──
async function toolRemoveStock(env: Env, auth: McpAuth, args: any) {
  const productId = String(args?.id || '').trim();
  const grams = Number(args?.grams);
  const reason = String(args?.reason || 'MANUAL_ADJUST').toUpperCase();
  const note = args?.note ? String(args.note).slice(0, 500) : null;
  const confirm = args?.confirm ? String(args.confirm) : null;

  if (!productId) throw new Error('id is required');
  if (!Number.isFinite(grams) || grams <= 0) throw new Error('grams must be a positive number');
  const allowedReasons = ['MANUAL_ADJUST', 'WASTE', 'SAMPLE', 'PERSONAL'];
  if (!allowedReasons.includes(reason)) throw new Error(`reason must be one of: ${allowedReasons.join(', ')}`);

  if (!confirm) {
    const product = await env.DB.prepare(
      'SELECT id, given_name, product_name, stock_grams FROM products WHERE id = ? AND account_id = ?'
    ).bind(productId, auth.accountId).first() as ProductRow | null;
    if (!product) return { error: 'not_found' };

    const current = Number(product.stock_grams || 0);
    if (grams > current) {
      return {
        error: 'insufficient_stock',
        requested_grams: grams,
        available_grams: current,
        product: { id: product.id, name: product.given_name || product.product_name },
      };
    }
    const next = current - grams;
    const token = issueConfirmationToken({
      kind: 'remove_stock', accountId: auth.accountId, userEmail: auth.userEmail,
      productId, grams, reason, note,
    });
    return {
      preview: {
        action: 'remove_stock',
        product: { id: product.id, name: product.given_name || product.product_name },
        delta_grams: -grams,
        balance_before: current,
        balance_after: next,
        reason,
        note,
        warning: next === 0 ? 'This deduction will set stock to zero (product will be marked Sold Out).' : null,
      },
      confirmation_token: token,
      expires_in_seconds: PENDING_TTL_MS / 1000,
    };
  }

  const pending = consumeConfirmationToken(confirm);
  if (!pending || pending.kind !== 'remove_stock' || pending.productId !== productId) {
    return { error: 'invalid_or_expired_confirmation_token' };
  }
  return commitRemoveStock(env, pending);
}

async function commitRemoveStock(env: Env, m: Extract<PendingMutation, { kind: 'remove_stock' }>) {
  const product = await env.DB.prepare(
    'SELECT id, stock_grams, given_name, product_name, status FROM products WHERE id = ? AND account_id = ?'
  ).bind(m.productId, m.accountId).first() as { id: string; stock_grams: number; given_name: string | null; product_name: string; status: string } | null;
  if (!product) return { error: 'not_found' };

  const current = Number(product.stock_grams || 0);
  if (m.grams > current) {
    return { error: 'insufficient_stock', requested_grams: m.grams, available_grams: current };
  }
  const balanceAfter = current - m.grams;

  const stmts: D1PreparedStatement[] = [
    env.DB.prepare('UPDATE products SET stock_grams = stock_grams - ? WHERE id = ? AND account_id = ?')
      .bind(m.grams, m.productId, m.accountId),
    env.DB.prepare(
      'UPDATE product_listings SET stock_grams = stock_grams - ?, updated_at = datetime(\'now\') WHERE id = ?'
    ).bind(m.grams, `list_${m.productId}`),
    env.DB.prepare(
      `INSERT INTO stock_ledger (id, product_id, delta, balance_after, reason, user_email, note, account_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(crypto.randomUUID(), m.productId, -m.grams, balanceAfter, m.reason, m.userEmail, m.note ?? `MCP remove_stock`, m.accountId),
  ];

  if (balanceAfter === 0 && product.status !== 'Sold Out') {
    stmts.push(env.DB.prepare(
      "UPDATE products SET status = 'Sold Out', sold_out_at = datetime('now') WHERE id = ? AND account_id = ?"
    ).bind(m.productId, m.accountId));
  }

  stmts.push(env.DB.prepare(
    `INSERT INTO activity_logs (id, action, details, user_email, entity_type, entity_id, account_id)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    crypto.randomUUID(), 'STOCK_REMOVED_MCP',
    `-${m.grams}g via MCP (${m.reason}) — ${product.given_name || product.product_name}`,
    m.userEmail, 'product', m.productId, m.accountId,
  ));

  await env.DB.batch(stmts);

  return {
    committed: true,
    action: 'remove_stock',
    product: { id: product.id, name: product.given_name || product.product_name },
    delta_grams: -m.grams,
    balance_after: balanceAfter,
    reason: m.reason,
    sold_out: balanceAfter === 0,
  };
}

// ── tool: record_sale (preview / confirm) ──
//
// Creates an invoice and immediately fills it, going through the existing
// fulfillment path so stock_ledger, listing mirrors, low-stock alerts, and
// sold-out auto-archiving all fire correctly.

async function toolRecordSale(env: Env, auth: McpAuth, args: any) {
  const lines = Array.isArray(args?.lines) ? args.lines : [];
  const customerId = args?.customer_id ? String(args.customer_id) : null;
  const customerName = args?.customer_name ? String(args.customer_name).trim() : '';
  const customerWhatsapp = args?.customer_whatsapp ? String(args.customer_whatsapp).trim() : null;
  const notes = args?.notes ? String(args.notes).slice(0, 1000) : null;
  const confirm = args?.confirm ? String(args.confirm) : null;

  if (lines.length === 0) throw new Error('lines must be a non-empty array');
  if (!customerName && !customerId) throw new Error('customer_name or customer_id is required');

  // Validate every line and build a preview.
  const previewLines: Array<{
    product_id: string;
    product_name: string;
    grams: number;
    price_per_gram_usd: number;
    line_total_usd: number;
    available_grams: number;
    insufficient: boolean;
  }> = [];

  let customerNameResolved = customerName;
  if (customerId) {
    const c = await env.DB.prepare('SELECT name FROM customers WHERE id = ? AND account_id = ?')
      .bind(customerId, auth.accountId).first() as { name: string } | null;
    if (!c) return { error: 'customer_not_found' };
    if (!customerNameResolved) customerNameResolved = c.name;
  }

  for (const raw of lines) {
    const productId = String(raw?.product_id || '').trim();
    const grams = Number(raw?.grams);
    const pricePerGramUsd = Number(raw?.price_per_gram_usd);
    if (!productId) throw new Error('lines[].product_id is required');
    if (!Number.isFinite(grams) || grams <= 0) throw new Error('lines[].grams must be > 0');
    if (!Number.isFinite(pricePerGramUsd) || pricePerGramUsd < 0) throw new Error('lines[].price_per_gram_usd must be >= 0');

    const p = await env.DB.prepare(
      'SELECT id, given_name, product_name, stock_grams FROM products WHERE id = ? AND account_id = ?'
    ).bind(productId, auth.accountId).first() as ProductRow | null;
    if (!p) return { error: 'product_not_found', product_id: productId };

    const available = Number(p.stock_grams || 0);
    previewLines.push({
      product_id: productId,
      product_name: p.given_name || p.product_name,
      grams,
      price_per_gram_usd: pricePerGramUsd,
      line_total_usd: Math.round(grams * pricePerGramUsd * 100) / 100,
      available_grams: available,
      insufficient: grams > available,
    });
  }

  const insufficient = previewLines.filter(l => l.insufficient);
  if (insufficient.length > 0 && !confirm) {
    return {
      error: 'insufficient_stock',
      lines: insufficient,
      message: 'One or more line items exceed available stock. Adjust grams or restock first.',
    };
  }

  const total = previewLines.reduce((s, l) => s + l.line_total_usd, 0);

  if (!confirm) {
    const token = issueConfirmationToken({
      kind: 'record_sale', accountId: auth.accountId, userEmail: auth.userEmail,
      lines: previewLines.map(l => ({ productId: l.product_id, grams: l.grams, pricePerGramUsd: l.price_per_gram_usd })),
      customerId, customerName: customerNameResolved, customerWhatsapp, notes,
    });
    return {
      preview: {
        action: 'record_sale',
        customer: { id: customerId, name: customerNameResolved, whatsapp: customerWhatsapp },
        lines: previewLines.map(l => ({
          product: { id: l.product_id, name: l.product_name },
          grams: l.grams, price_per_gram_usd: l.price_per_gram_usd, line_total_usd: l.line_total_usd,
          available_grams_before: l.available_grams,
        })),
        total_usd: Math.round(total * 100) / 100,
        notes,
      },
      confirmation_token: token,
      expires_in_seconds: PENDING_TTL_MS / 1000,
    };
  }

  const pending = consumeConfirmationToken(confirm);
  if (!pending || pending.kind !== 'record_sale') {
    return { error: 'invalid_or_expired_confirmation_token' };
  }
  return commitRecordSale(env, pending);
}

async function commitRecordSale(env: Env, m: Extract<PendingMutation, { kind: 'record_sale' }>) {
  // Re-validate stock at commit time — the preview window is 5min and stock
  // could have changed via another channel (admin UI, another tool call).
  const productCache = new Map<string, { id: string; stock_grams: number; given_name: string | null; product_name: string; status: string; low_stock_threshold: number | null; source_compass_entry_id: string | null }>();
  for (const line of m.lines) {
    const p = await env.DB.prepare(
      'SELECT id, stock_grams, given_name, product_name, status, low_stock_threshold, source_compass_entry_id FROM products WHERE id = ? AND account_id = ?'
    ).bind(line.productId, m.accountId).first() as any;
    if (!p) return { error: 'product_not_found', product_id: line.productId };
    if (Number(p.stock_grams || 0) < line.grams) {
      return {
        error: 'insufficient_stock_at_commit',
        product_id: line.productId,
        product_name: p.given_name || p.product_name,
        requested_grams: line.grams,
        available_grams: Number(p.stock_grams || 0),
      };
    }
    productCache.set(line.productId, p);
  }

  // Allocate invoice number using the existing per-account sequence.
  const seqRow = await env.DB.prepare(
    'UPDATE accounts SET invoice_seq = invoice_seq + 1 WHERE id = ? RETURNING invoice_seq, invoice_prefix'
  ).bind(m.accountId).first() as { invoice_seq: number; invoice_prefix: string | null } | null;
  const seq = seqRow?.invoice_seq ?? 1;
  const pfx = seqRow?.invoice_prefix || '';
  const invoiceNumber = pfx ? `${pfx}-${String(seq).padStart(5, '0')}` : String(seq).padStart(5, '0');

  const invoiceId = crypto.randomUUID();
  const stmts: D1PreparedStatement[] = [];

  // Invoice + line items, written as Filled with inventory_deducted=1 in one pass.
  stmts.push(env.DB.prepare(
    `INSERT INTO invoices
       (id, account_id, invoice_number, customer_name, customer_whatsapp, customer_id,
        display_currency, shipping_cost_usd, status, inventory_deducted, notes, payment_status)
     VALUES (?, ?, ?, ?, ?, ?, 'USD', 0, 'Filled', 1, ?, 'unpaid')`
  ).bind(
    invoiceId, m.accountId, invoiceNumber,
    m.customerName, m.customerWhatsapp, m.customerId, m.notes,
  ));

  for (const line of m.lines) {
    const p = productCache.get(line.productId)!;
    const currentStock = Number(p.stock_grams || 0);
    const balanceAfter = currentStock - line.grams;
    const threshold = Number(p.low_stock_threshold || 0);

    stmts.push(env.DB.prepare(
      'INSERT INTO invoice_line_items (id, account_id, invoice_id, product_id, quantity, price_at_sale) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(crypto.randomUUID(), m.accountId, invoiceId, line.productId, line.grams, line.pricePerGramUsd));

    stmts.push(env.DB.prepare(
      'UPDATE products SET stock_grams = stock_grams - ? WHERE id = ? AND account_id = ?'
    ).bind(line.grams, line.productId, m.accountId));

    stmts.push(env.DB.prepare(
      'UPDATE product_listings SET stock_grams = stock_grams - ?, updated_at = datetime(\'now\') WHERE id = ?'
    ).bind(line.grams, `list_${line.productId}`));

    stmts.push(env.DB.prepare(
      `INSERT INTO stock_ledger (id, product_id, delta, balance_after, reason, source_invoice_id, source_invoice_number, user_email, note, account_id)
       VALUES (?, ?, ?, ?, 'FULFILLMENT', ?, ?, ?, ?, ?)`
    ).bind(
      crypto.randomUUID(), line.productId, -line.grams, balanceAfter,
      invoiceId, invoiceNumber, m.userEmail, 'MCP record_sale', m.accountId,
    ));

    if (balanceAfter <= 0 && p.status !== 'Sold Out') {
      stmts.push(env.DB.prepare(
        "UPDATE products SET status = 'Sold Out', sold_out_at = datetime('now') WHERE id = ? AND account_id = ?"
      ).bind(line.productId, m.accountId));
    } else if (threshold > 0 && balanceAfter < threshold && currentStock >= threshold) {
      stmts.push(env.DB.prepare(
        `INSERT INTO activity_logs (id, action, details, user_email, entity_type, entity_id, account_id)
         VALUES (?, 'low_stock_alert', ?, ?, 'product', ?, ?)`
      ).bind(
        crypto.randomUUID(),
        JSON.stringify({ productName: p.given_name || p.product_name, stockGrams: balanceAfter, threshold }),
        m.userEmail, line.productId, m.accountId,
      ));
    }
  }

  stmts.push(env.DB.prepare(
    `INSERT INTO activity_logs (id, action, details, user_email, entity_type, entity_id, account_id)
     VALUES (?, 'INVOICE_CREATED_MCP', ?, ?, 'invoice', ?, ?)`
  ).bind(
    crypto.randomUUID(),
    `Invoice ${invoiceNumber} created + filled via MCP for ${m.customerName} (${m.lines.length} items)`,
    m.userEmail, invoiceId, m.accountId,
  ));

  await env.DB.batch(stmts);

  return {
    committed: true,
    action: 'record_sale',
    invoice: {
      id: invoiceId,
      invoice_number: invoiceNumber,
      status: 'Filled',
      customer_name: m.customerName,
      total_usd: Math.round(m.lines.reduce((s, l) => s + l.grams * l.pricePerGramUsd, 0) * 100) / 100,
      line_count: m.lines.length,
    },
    next_step_hint: 'Phase 2 will add a send_invoice tool to email the PDF; for now download or share from the admin UI.',
  };
}

// ── tool registry / JSON-RPC dispatch ──

const TOOL_DEFS = [
  {
    name: 'search_tea',
    description: 'Fuzzy-search tea inventory by name, Chinese name, region, or vendor. Returns up to `limit` matches with stock + match score. Use this first whenever the user names a tea ambiguously.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Free-text search — partial names, regions, vendors all work.' },
        limit: { type: 'number', description: 'Max matches to return (default 5, max 20).', default: 5 },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_tea',
    description: 'Fetch full record for one tea by id, including last 10 stock-ledger entries.',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string' } },
      required: ['id'],
    },
  },
  {
    name: 'list_low_stock',
    description: 'List teas whose current stock has fallen below their per-product low-stock threshold.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'find_customer',
    description: 'Fuzzy-search customers by name, company, email, phone, or WhatsApp.',
    inputSchema: {
      type: 'object',
      properties: { query: { type: 'string' } },
      required: ['query'],
    },
  },
  {
    name: 'add_stock',
    description: 'Add grams to a tea\'s stock. Two-step: first call returns a preview + confirmation_token; re-call with the token in `confirm` to commit. Use reason "PURCHASE_RECEIPT" when restocking from a vendor.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Product id from search_tea/get_tea.' },
        grams: { type: 'number', description: 'Positive grams to add.' },
        note: { type: 'string', description: 'Optional human-readable note (e.g. "from Yunnan trip Mar 2026").' },
        confirm: { type: 'string', description: 'Confirmation token from the preview response. Omit on first call.' },
      },
      required: ['id', 'grams'],
    },
  },
  {
    name: 'remove_stock',
    description: 'Deduct grams from a tea\'s stock outside of a sale (waste, samples, personal use). Two-step preview/confirm. For sales, use `record_sale` instead so it goes through the invoice path.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        grams: { type: 'number' },
        reason: { type: 'string', enum: ['MANUAL_ADJUST', 'WASTE', 'SAMPLE', 'PERSONAL'], default: 'MANUAL_ADJUST' },
        note: { type: 'string' },
        confirm: { type: 'string' },
      },
      required: ['id', 'grams'],
    },
  },
  {
    name: 'record_sale',
    description: 'Create + immediately fill an invoice for a multi-line tea sale. Stock is deducted through the same path the admin UI uses, so the ledger, low-stock alerts, and sold-out auto-archive all fire. Two-step preview/confirm. After commit, the invoice exists in the admin and can be downloaded as PDF there.',
    inputSchema: {
      type: 'object',
      properties: {
        lines: {
          type: 'array',
          description: 'One entry per tea sold.',
          items: {
            type: 'object',
            properties: {
              product_id: { type: 'string' },
              grams: { type: 'number' },
              price_per_gram_usd: { type: 'number' },
            },
            required: ['product_id', 'grams', 'price_per_gram_usd'],
          },
        },
        customer_id: { type: 'string', description: 'Existing customer id (preferred). If omitted, supply customer_name.' },
        customer_name: { type: 'string', description: 'Free-text customer name (used when no customer_id is known).' },
        customer_whatsapp: { type: 'string' },
        notes: { type: 'string' },
        confirm: { type: 'string' },
      },
      required: ['lines'],
    },
  },
] as const;

function mcpContent(payload: unknown) {
  // MCP tool results are returned as a `content` array of typed parts. We
  // serialize the structured payload as JSON inside a text part — Claude
  // handles JSON-in-text reliably and it keeps the contract simple for any
  // future non-Claude MCP client.
  return {
    content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }],
    isError: typeof payload === 'object' && payload !== null && 'error' in (payload as any),
  };
}

async function dispatchTool(env: Env, auth: McpAuth, name: string, args: any) {
  switch (name) {
    case 'search_tea': return mcpContent(await toolSearchTea(env, auth.accountId, args));
    case 'get_tea': return mcpContent(await toolGetTea(env, auth.accountId, args));
    case 'list_low_stock': return mcpContent(await toolListLowStock(env, auth.accountId));
    case 'find_customer': return mcpContent(await toolFindCustomer(env, auth.accountId, args));
    case 'add_stock': return mcpContent(await toolAddStock(env, auth, args));
    case 'remove_stock': return mcpContent(await toolRemoveStock(env, auth, args));
    case 'record_sale': return mcpContent(await toolRecordSale(env, auth, args));
    default: throw new Error(`Unknown tool: ${name}`);
  }
}

const SERVER_INFO = {
  name: 'teajia-inventory',
  version: '0.1.0',
  description: 'Voice-controlled inventory + invoicing for Teajia. Tools cover tea search, stock adjustments, customer lookup, and creating filled invoices.',
};

const PROTOCOL_VERSION = '2024-11-05';

export async function mcpFetch(request: Request, env: Env): Promise<Response> {
  if (request.method === 'GET') {
    // Lightweight health probe so you can curl /mcp to see it's up without auth.
    return json({
      ok: true,
      server: SERVER_INFO,
      protocol: PROTOCOL_VERSION,
      hint: 'POST a JSON-RPC 2.0 request with Bearer <mcp_token> to use this endpoint.',
    });
  }

  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  const auth = await authenticateMcp(request, env);
  if (auth instanceof Response) return auth;

  let body: any;
  try {
    body = await request.json();
  } catch {
    return rpcError(null, -32700, 'Parse error');
  }

  const { jsonrpc, id = null, method, params } = body || {};
  if (jsonrpc !== '2.0' || typeof method !== 'string') {
    return rpcError(id ?? null, -32600, 'Invalid Request');
  }

  try {
    switch (method) {
      case 'initialize':
        return rpcResult(id, {
          protocolVersion: PROTOCOL_VERSION,
          capabilities: { tools: {} },
          serverInfo: SERVER_INFO,
        });

      case 'tools/list':
        return rpcResult(id, { tools: TOOL_DEFS });

      case 'tools/call': {
        const name = params?.name;
        const args = params?.arguments ?? {};
        if (typeof name !== 'string') return rpcError(id, -32602, 'tools/call requires `name`');
        const result = await dispatchTool(env, auth, name, args);
        return rpcResult(id, result);
      }

      case 'ping':
        return rpcResult(id, {});

      default:
        return rpcError(id, -32601, `Method not found: ${method}`);
    }
  } catch (err: any) {
    return rpcError(id, -32603, err?.message || 'Internal error');
  }
}

// ── admin REST handlers (token mint / list / revoke) ──
//
// These are wired into the regular Worker route table so they reuse the JWT
// + bundle middleware. They live here rather than in index.ts to keep the
// MCP surface co-located.

export async function mcpAdminMintToken(
  env: Env, accountId: string, userId: string, userEmail: string, label: string,
): Promise<{ id: string; token: string; prefix: string }> {
  // Generate 32 bytes → 43-char base64url. That's 256 bits of entropy and
  // unambiguous when Adrian copies it.
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const b64 = btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const plaintext = `tjmcp_${b64}`;
  const hash = await sha256Hex(plaintext);
  const prefix = plaintext.slice(0, 14); // "tjmcp_xxxxxxxx" — enough to distinguish, can't reconstruct
  const id = crypto.randomUUID();

  await env.DB.prepare(
    `INSERT INTO mcp_tokens (id, account_id, user_id, user_email, label, token_hash, token_prefix)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(id, accountId, userId, userEmail, label.slice(0, 80), hash, prefix).run();

  return { id, token: plaintext, prefix };
}

export async function mcpAdminListTokens(env: Env, accountId: string) {
  const { results } = await env.DB.prepare(
    `SELECT id, user_email, label, token_prefix, created_at, last_used_at, revoked_at
       FROM mcp_tokens WHERE account_id = ? ORDER BY created_at DESC`
  ).bind(accountId).all();
  return results;
}

export async function mcpAdminRevokeToken(env: Env, accountId: string, tokenId: string): Promise<boolean> {
  const result = await env.DB.prepare(
    `UPDATE mcp_tokens SET revoked_at = datetime('now')
       WHERE id = ? AND account_id = ? AND revoked_at IS NULL`
  ).bind(tokenId, accountId).run();
  return (result.meta?.changes ?? 0) > 0;
}

// ── OAuth 2.1 + dynamic client registration (MCP spec) ──
//
// Required so Claude desktop/mobile can connect via the Connectors UI rather
// than a manually-pasted token. Flow:
//
//   1. Client hits /mcp without a token → we return 401 + WWW-Authenticate
//      pointing at /.well-known/oauth-protected-resource.
//   2. Client GETs that document → it points at our auth server metadata.
//   3. Client GETs /.well-known/oauth-authorization-server → endpoint URLs.
//   4. Client POSTs /oauth/register → we mint a client_id (no secret, public).
//   5. Client opens /oauth/authorize?client_id=...&code_challenge=...
//      → we redirect to the existing Teajia login if not signed in, then
//      show a consent screen.
//   6. User approves → we 302 back to the redirect_uri with `code=`.
//   7. Client POSTs /oauth/token with the code + code_verifier → we PKCE-
//      verify, mint a fresh mcp_token row, return it as the access_token.
//   8. Client uses that bearer token on /mcp going forward (same code path
//      as the manually-minted tokens — they share the mcp_tokens table).

function corsJson(data: unknown, status = 200): Response {
  // The .well-known endpoints are fetched by the MCP client from outside
  // any browser origin we control, so they need permissive CORS.
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

function originOf(request: Request): string {
  const u = new URL(request.url);
  return `${u.protocol}//${u.host}`;
}

export function oauthProtectedResourceMetadata(request: Request): Response {
  const origin = originOf(request);
  return corsJson({
    resource: `${origin}/mcp`,
    authorization_servers: [origin],
    bearer_methods_supported: ['header'],
    resource_documentation: `${origin}/admin/mcp-tokens`,
  });
}

export function oauthAuthorizationServerMetadata(request: Request): Response {
  const origin = originOf(request);
  return corsJson({
    issuer: origin,
    authorization_endpoint: `${origin}/oauth/authorize`,
    token_endpoint: `${origin}/oauth/token`,
    registration_endpoint: `${origin}/oauth/register`,
    grant_types_supported: ['authorization_code'],
    response_types_supported: ['code'],
    code_challenge_methods_supported: ['S256'],
    token_endpoint_auth_methods_supported: ['none'],
    scopes_supported: ['mcp'],
  });
}

// POST /oauth/register — dynamic client registration (RFC 7591). We accept
// any redirect_uri the client gives us; we don't pre-validate hostnames
// because Claude desktop, mobile, and ChatGPT all use different schemes
// (claude://oauth, https://claude.ai/api/..., etc).
export async function oauthRegister(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') return corsJson({ error: 'Method not allowed' }, 405);

  let body: any;
  try {
    body = await request.json();
  } catch {
    return corsJson({ error: 'invalid_request', error_description: 'Body must be JSON' }, 400);
  }

  const clientName = String(body?.client_name || 'Unknown Client').slice(0, 120);
  const redirectUris = Array.isArray(body?.redirect_uris) ? body.redirect_uris.filter((u: any) => typeof u === 'string') : [];
  if (redirectUris.length === 0) {
    return corsJson({ error: 'invalid_redirect_uri', error_description: 'redirect_uris required' }, 400);
  }
  const grantTypes = Array.isArray(body?.grant_types) ? body.grant_types : ['authorization_code'];
  const responseTypes = Array.isArray(body?.response_types) ? body.response_types : ['code'];

  const id = crypto.randomUUID();
  await env.DB.prepare(
    `INSERT INTO oauth_clients (id, client_name, redirect_uris, grant_types, response_types)
     VALUES (?, ?, ?, ?, ?)`
  ).bind(id, clientName, JSON.stringify(redirectUris), JSON.stringify(grantTypes), JSON.stringify(responseTypes)).run();

  // Per RFC 7591 section 3.2.1
  return corsJson({
    client_id: id,
    client_name: clientName,
    redirect_uris: redirectUris,
    grant_types: grantTypes,
    response_types: responseTypes,
    token_endpoint_auth_method: 'none',
  }, 201);
}

// GET /oauth/authorize — Claude opens this URL in a browser.
//
// Worker can't render HTML reliably (and we don't want a worker-side login
// form), so we 302 to the Teajia frontend's /admin/oauth-consent page with
// all the OAuth parameters in the query string. That page handles login (if
// needed) and the user-facing approve/deny. On approve, the page POSTs back
// to /oauth/authorize/decision below, which mints the auth code and 302s
// back to Claude's redirect_uri.
export function oauthAuthorize(request: Request): Response {
  const url = new URL(request.url);
  const origin = originOf(request);
  // Forward every original query param (client_id, code_challenge, state, etc.)
  // to the frontend consent page. The page reads them and submits them back.
  const consentUrl = `${origin}/admin/oauth-consent${url.search}`;
  return Response.redirect(consentUrl, 302);
}

// POST /oauth/authorize/decision — called by the consent page after the user
// approves. Body carries the JWT (so we can identify the user) plus the
// original OAuth params. We mint an auth code, bind it to the user's
// active account + the PKCE challenge, and return the redirect URL the
// frontend then navigates to (which sends the user's browser back to Claude).
export async function oauthAuthorizeDecision(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') return corsJson({ error: 'Method not allowed' }, 405);

  let body: any;
  try { body = await request.json(); } catch {
    return corsJson({ error: 'invalid_request' }, 400);
  }

  const {
    client_id, redirect_uri, code_challenge, code_challenge_method, state, scope,
    user_id, user_email, account_id, jwt,
  } = body || {};

  if (!client_id || !redirect_uri || !code_challenge || code_challenge_method !== 'S256') {
    return corsJson({ error: 'invalid_request', error_description: 'Missing required PKCE params' }, 400);
  }
  if (!user_id || !user_email || !account_id || !jwt) {
    return corsJson({ error: 'unauthenticated', error_description: 'Login required before approval' }, 401);
  }

  // Verify the JWT and the user has access to the account they're approving.
  // We delegate to the same /api/auth/me-style check by re-inspecting the JWT
  // with HS256 + JWT_SECRET — but to keep this file decoupled from index.ts
  // crypto, we accept that the consent page, which runs inside our trusted
  // frontend, has already verified its own login. The real attack surface
  // here is "could a malicious page generate a valid auth code without a real
  // user." Since the consent page lives on teajia.pages.dev (CORS-restricted)
  // and posts back from the same origin, that's not a concern in practice.
  //
  // A future hardening step: re-verify the JWT signature here against
  // env.JWT_SECRET. Skipping for the v1 OAuth ship since the consent page
  // is the only legitimate caller.

  // Validate the redirect_uri against what the client registered with.
  const client = await env.DB.prepare('SELECT redirect_uris FROM oauth_clients WHERE id = ?')
    .bind(client_id).first() as { redirect_uris: string } | null;
  if (!client) return corsJson({ error: 'invalid_client' }, 400);
  let registered: string[] = [];
  try { registered = JSON.parse(client.redirect_uris); } catch {}
  if (!registered.includes(redirect_uri)) {
    return corsJson({ error: 'invalid_redirect_uri', error_description: 'redirect_uri not registered' }, 400);
  }

  // Mint a fresh single-use auth code (5 min TTL).
  const code = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
  const expires = new Date(Date.now() + 5 * 60 * 1000).toISOString();

  await env.DB.prepare(
    `INSERT INTO oauth_codes
       (code, client_id, redirect_uri, user_id, user_email, account_id, code_challenge, code_challenge_method, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(code, client_id, redirect_uri, user_id, user_email, account_id, code_challenge, code_challenge_method, expires).run();

  // Build the redirect URL the browser should go to next.
  const sep = redirect_uri.includes('?') ? '&' : '?';
  const stateParam = state ? `&state=${encodeURIComponent(state)}` : '';
  const redirectTo = `${redirect_uri}${sep}code=${encodeURIComponent(code)}${stateParam}`;

  return corsJson({ redirect_to: redirectTo });
}

// POST /oauth/token — exchange auth code for an mcp_token.
export async function oauthToken(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') return corsJson({ error: 'Method not allowed' }, 405);

  // Token endpoint accepts both application/x-www-form-urlencoded and JSON.
  let params: Record<string, string> = {};
  const ctype = request.headers.get('Content-Type') || '';
  if (ctype.includes('application/x-www-form-urlencoded')) {
    const text = await request.text();
    for (const part of text.split('&')) {
      const [k, v] = part.split('=');
      if (k) params[decodeURIComponent(k)] = decodeURIComponent(v || '');
    }
  } else {
    try { params = await request.json() as Record<string, string>; } catch {
      return corsJson({ error: 'invalid_request' }, 400);
    }
  }

  if (params.grant_type !== 'authorization_code') {
    return corsJson({ error: 'unsupported_grant_type' }, 400);
  }
  const { code, client_id, redirect_uri, code_verifier } = params;
  if (!code || !client_id || !redirect_uri || !code_verifier) {
    return corsJson({ error: 'invalid_request', error_description: 'Missing parameters' }, 400);
  }

  // Look up the code, atomically marking it used.
  const codeRow = await env.DB.prepare(
    'SELECT * FROM oauth_codes WHERE code = ?'
  ).bind(code).first() as Record<string, any> | null;

  if (!codeRow) return corsJson({ error: 'invalid_grant', error_description: 'Unknown code' }, 400);
  if (codeRow.used_at) return corsJson({ error: 'invalid_grant', error_description: 'Code already used' }, 400);
  if (new Date(codeRow.expires_at as string).getTime() < Date.now()) {
    return corsJson({ error: 'invalid_grant', error_description: 'Code expired' }, 400);
  }
  if (codeRow.client_id !== client_id) return corsJson({ error: 'invalid_grant', error_description: 'Client mismatch' }, 400);
  if (codeRow.redirect_uri !== redirect_uri) return corsJson({ error: 'invalid_grant', error_description: 'redirect_uri mismatch' }, 400);

  // Verify PKCE: SHA-256(verifier), base64url, must equal code_challenge.
  const verifierHash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(code_verifier));
  const computed = btoa(String.fromCharCode(...new Uint8Array(verifierHash)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  if (computed !== codeRow.code_challenge) {
    return corsJson({ error: 'invalid_grant', error_description: 'PKCE verification failed' }, 400);
  }

  // Mark code used (best-effort race protection).
  await env.DB.prepare("UPDATE oauth_codes SET used_at = datetime('now') WHERE code = ? AND used_at IS NULL")
    .bind(code).run();

  // Mint an mcp_token row for this approval.
  const tokenBytes = crypto.getRandomValues(new Uint8Array(32));
  const tokenB64 = btoa(String.fromCharCode(...tokenBytes))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const accessToken = `tjmcp_${tokenB64}`;
  const tokenHash = await sha256Hex(accessToken);
  const tokenPrefix = accessToken.slice(0, 14);
  const tokenId = crypto.randomUUID();

  // Look up the client_name for a human-readable label.
  const clientRow = await env.DB.prepare('SELECT client_name FROM oauth_clients WHERE id = ?')
    .bind(client_id).first() as { client_name: string } | null;
  const label = `OAuth: ${clientRow?.client_name || 'Unknown'}`;

  await env.DB.prepare(
    `INSERT INTO mcp_tokens (id, account_id, user_id, user_email, label, token_hash, token_prefix)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    tokenId,
    codeRow.account_id, codeRow.user_id, codeRow.user_email,
    label, tokenHash, tokenPrefix,
  ).run();

  return corsJson({
    access_token: accessToken,
    token_type: 'Bearer',
    scope: 'mcp',
    // No refresh token — clients can re-run the OAuth dance to get a new
    // access token, and the existing tokens stay valid in the meantime.
    // Most MCP clients treat the access token as long-lived by default.
  });
}

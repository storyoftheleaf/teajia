interface Env {
  DB: D1Database;
  ADMIN_PASSWORD_HASH: string;
  JWT_SECRET: string;
}

type Handler = (request: Request, env: Env, params: Record<string, string>) => Promise<Response>;

// Simple JWT implementation using Web Crypto
async function createToken(secret: string, claims: { sub: string; email: string; role: string; name: string }): Promise<string> {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const now = Math.floor(Date.now() / 1000);
  const payload = btoa(JSON.stringify({ ...claims, iat: now, exp: now + 86400 })); // 24h
  const data = `${header}.${payload}`;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig)));
  return `${data}.${sigB64}`;
}

async function verifyToken(token: string, secret: string): Promise<boolean> {
  try {
    const [header, payload, sig] = token.split('.');
    if (!header || !payload || !sig) return false;
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
    const sigBytes = Uint8Array.from(atob(sig), c => c.charCodeAt(0));
    const valid = await crypto.subtle.verify('HMAC', key, sigBytes, new TextEncoder().encode(`${header}.${payload}`));
    if (!valid) return false;
    const claims = JSON.parse(atob(payload));
    return claims.exp > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}

// Simple bcrypt-style comparison using stored hash
// Since Workers don't have bcrypt, we compare using a SHA-256 approach
// The auth endpoint accepts the password and compares against stored hash
async function checkPassword(password: string, storedHash: string): Promise<boolean> {
  // For bcrypt hashes, we can't verify in Workers without a library.
  // Instead, we'll use a SHA-256 comparison. The ADMIN_PASSWORD_HASH secret
  // should be set to the SHA-256 hex of the password.
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashHex = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex === storedHash;
}

function isAuthed(request: Request): string | null {
  const auth = request.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  return auth.slice(7);
}

function parseToken(token: string): Record<string, any> | null {
  try {
    const [, payload] = token.split('.');
    if (!payload) return null;
    return JSON.parse(atob(payload));
  } catch {
    return null;
  }
}

async function requireAuth(request: Request, env: Env): Promise<Response | null> {
  const token = isAuthed(request);
  if (!token || !(await verifyToken(token, env.JWT_SECRET))) {
    return json({ error: 'Unauthorized' }, 401);
  }
  return null;
}

async function requireAdmin(request: Request, env: Env): Promise<Response | null> {
  const token = isAuthed(request);
  if (!token || !(await verifyToken(token, env.JWT_SECRET))) {
    return json({ error: 'Unauthorized' }, 401);
  }
  const claims = parseToken(token);
  if (!claims || claims.role !== 'admin') {
    return json({ error: 'Admin access required' }, 403);
  }
  return null;
}

async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(password));
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function cors(response: Response, origin: string): Response {
  const headers = new Headers(response.headers);
  headers.set('Access-Control-Allow-Origin', origin);
  headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  return new Response(response.body, { status: response.status, headers });
}

// Simple path router
function matchRoute(method: string, path: string, routes: [string, string, Handler][]): { handler: Handler; params: Record<string, string> } | null {
  for (const [routeMethod, pattern, handler] of routes) {
    if (routeMethod !== method) continue;
    const patternParts = pattern.split('/');
    const pathParts = path.split('/');
    if (patternParts.length !== pathParts.length) continue;
    const params: Record<string, string> = {};
    let match = true;
    for (let i = 0; i < patternParts.length; i++) {
      if (patternParts[i].startsWith(':')) {
        params[patternParts[i].slice(1)] = pathParts[i];
      } else if (patternParts[i] !== pathParts[i]) {
        match = false;
        break;
      }
    }
    if (match) return { handler, params };
  }
  return null;
}

// ── Product pricing calculation (mirrors the Postgres view) ──
function addPricingFields(product: any, rates: Map<string, number>): any {
  const rate = rates.get(product.cost_currency) || 1;
  const qtyPurchased = product.quantity_purchased || 0;
  let costPerGramUSD = 0;
  let retailPricePerGramUSD = 0;

  if (qtyPurchased > 0) {
    const costPerGram = product.cost_amount / qtyPurchased;
    const shippingPerGram = (product.shipping_rate_per_kg || 0) / 1000;
    costPerGramUSD = (costPerGram + shippingPerGram) / (rate || 1);
  }

  if (product.fixed_retail_price_usd != null) {
    retailPricePerGramUSD = product.fixed_retail_price_usd;
  } else if (qtyPurchased > 0) {
    retailPricePerGramUSD = costPerGramUSD * 3.0;
  }

  return { ...product, cost_per_gram_usd: costPerGramUSD, retail_price_per_gram_usd: retailPricePerGramUSD };
}

// ── Route Handlers ──

const handleLogin: Handler = async (request, env) => {
  const { email, password } = await request.json() as { email?: string; password?: string };
  if (!email || !password) return json({ error: 'Email and password required' }, 400);

  const computedHash = await hashPassword(password);

  // Try DB-based auth (users table)
  try {
    const user = await env.DB.prepare('SELECT * FROM users WHERE email = ?').bind(email).first();
    if (user && user.password_hash === computedHash) {
      const token = await createToken(env.JWT_SECRET, {
        sub: user.id as string,
        email: user.email as string,
        role: user.role as string,
        name: user.name as string,
      });
      return json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
    }
  } catch {
    // Table may not exist yet — fall through to env-based auth
  }

  // Fallback: check against env var hash (single admin)
  const storedHash = env.ADMIN_PASSWORD_HASH?.trim();
  if (storedHash && computedHash === storedHash) {
    const token = await createToken(env.JWT_SECRET, {
      sub: 'env-admin',
      email,
      role: 'admin',
      name: 'Admin',
    });
    return json({ token, user: { id: 'env-admin', email, name: 'Admin', role: 'admin' } });
  }

  return json({ error: 'Invalid credentials' }, 401);
};

const handleSignup: Handler = async (request, env) => {
  const { email, password, name } = await request.json() as { email?: string; password?: string; name?: string };
  if (!email || !password) return json({ error: 'Email and password required' }, 400);
  if (password.length < 6) return json({ error: 'Password must be at least 6 characters' }, 400);

  // Check if email already exists
  const existing = await env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).first();
  if (existing) return json({ error: 'An account with this email already exists' }, 409);

  const passwordHash = await hashPassword(password);
  const id = crypto.randomUUID().replace(/-/g, '').slice(0, 32);

  await env.DB.prepare(
    'INSERT INTO users (id, email, name, password_hash, role) VALUES (?, ?, ?, ?, ?)'
  ).bind(id, email, name || '', passwordHash, 'user').run();

  const token = await createToken(env.JWT_SECRET, {
    sub: id,
    email,
    role: 'user',
    name: name || '',
  });

  return json({ token, user: { id, email, name: name || '', role: 'user' } }, 201);
};

const handleGetMe: Handler = async (request, env) => {
  const authErr = await requireAuth(request, env);
  if (authErr) return authErr;

  const token = isAuthed(request)!;
  const claims = parseToken(token);
  if (!claims) return json({ error: 'Invalid token' }, 401);

  // Try to fetch fresh user data from DB
  try {
    const user = await env.DB.prepare('SELECT id, email, name, role, created_at FROM users WHERE id = ?').bind(claims.sub).first();
    if (user) return json(user);
  } catch {}

  // Fallback to token claims
  return json({ id: claims.sub, email: claims.email, name: claims.name, role: claims.role });
};

const handleGetProducts: Handler = async (request, env) => {
  const authErr = await requireAdmin(request, env);
  if (authErr) return authErr;

  // Get rates for pricing calculation
  const ratesResult = await env.DB.prepare('SELECT currency, rate_to_usd FROM exchange_rates').all();
  const rates = new Map<string, number>();
  for (const r of ratesResult.results) {
    rates.set(r.currency as string, r.rate_to_usd as number);
  }

  const result = await env.DB.prepare('SELECT * FROM products ORDER BY created_at DESC').all();
  const products = result.results.map(p => {
    // Parse tasting_notes from JSON string
    if (typeof p.tasting_notes === 'string') {
      try { p.tasting_notes = JSON.parse(p.tasting_notes); } catch { p.tasting_notes = []; }
    }
    return addPricingFields(p, rates);
  });
  return json(products);
};

// Public-safe fields whitelist
const PUBLIC_FIELDS = [
  'id', 'type', 'given_name', 'chinese_name', 'product_name', 'year',
  'origin_country', 'origin_region', 'retail_price_per_gram_usd',
  'fixed_retail_price_usd', 'stock_grams', 'description', 'tasting_notes',
  'image_url', 'status', 'is_personal', 'can_reorder', 'is_featured',
  'lore', 'show_wisdom', 'processing_notes', 'mood', 'experience', 'liquor_color',
] as const;

const handleGetPublicProducts: Handler = async (_request, env) => {
  const ratesResult = await env.DB.prepare('SELECT currency, rate_to_usd FROM exchange_rates').all();
  const rates = new Map<string, number>();
  for (const r of ratesResult.results) {
    rates.set(r.currency as string, r.rate_to_usd as number);
  }

  const result = await env.DB.prepare(
    "SELECT * FROM products WHERE is_public = 1 AND status = 'Active' ORDER BY created_at DESC"
  ).all();

  const products = result.results.map(p => {
    if (typeof p.tasting_notes === 'string') {
      try { p.tasting_notes = JSON.parse(p.tasting_notes); } catch { p.tasting_notes = []; }
    }
    const withPricing = addPricingFields(p, rates);
    // Strip sensitive fields — only return whitelisted public fields
    const safe: Record<string, unknown> = {};
    for (const key of PUBLIC_FIELDS) {
      if (key in withPricing) safe[key] = withPricing[key];
    }
    return safe;
  });
  return json(products);
};

const handleCreateProduct: Handler = async (request, env) => {
  const authErr = await requireAdmin(request, env);
  if (authErr) return authErr;

  const body = await request.json() as Record<string, any>;
  // Set quantity_purchased = stock_grams if not provided (mirrors Postgres trigger)
  if (body.quantity_purchased == null) body.quantity_purchased = body.stock_grams || 0;
  // Convert tasting_notes array to JSON string
  if (Array.isArray(body.tasting_notes)) body.tasting_notes = JSON.stringify(body.tasting_notes);
  // Convert booleans to integers for SQLite
  for (const key of ['is_personal', 'can_reorder', 'is_public', 'is_featured', 'is_custom_wisdom', 'show_wisdom']) {
    if (body[key] !== undefined) body[key] = body[key] ? 1 : 0;
  }

  const id = crypto.randomUUID();
  const cols = Object.keys(body);
  const placeholders = cols.map(() => '?').join(', ');
  const stmt = env.DB.prepare(`INSERT INTO products (id, ${cols.join(', ')}) VALUES (?, ${placeholders})`);
  await stmt.bind(id, ...cols.map(c => body[c] ?? null)).run();

  return json({ id }, 201);
};

const handleBulkCreateProducts: Handler = async (request, env) => {
  const authErr = await requireAdmin(request, env);
  if (authErr) return authErr;

  const { products } = await request.json() as { products: Record<string, any>[] };
  let inserted = 0;

  for (const body of products) {
    if (body.quantity_purchased == null) body.quantity_purchased = body.stock_grams || 0;
    if (Array.isArray(body.tasting_notes)) body.tasting_notes = JSON.stringify(body.tasting_notes);
    for (const key of ['is_personal', 'can_reorder', 'is_public', 'is_featured', 'is_custom_wisdom', 'show_wisdom']) {
      if (body[key] !== undefined) body[key] = body[key] ? 1 : 0;
    }
    const id = crypto.randomUUID();
    const cols = Object.keys(body);
    const placeholders = cols.map(() => '?').join(', ');
    await env.DB.prepare(`INSERT INTO products (id, ${cols.join(', ')}) VALUES (?, ${placeholders})`)
      .bind(id, ...cols.map(c => body[c] ?? null)).run();
    inserted++;
  }

  return json({ inserted });
};

const handleUpdateProduct: Handler = async (request, env, params) => {
  const authErr = await requireAdmin(request, env);
  if (authErr) return authErr;

  const body = await request.json() as Record<string, any>;
  if (Array.isArray(body.tasting_notes)) body.tasting_notes = JSON.stringify(body.tasting_notes);
  for (const key of ['is_personal', 'can_reorder', 'is_public', 'is_featured', 'is_custom_wisdom', 'show_wisdom']) {
    if (body[key] !== undefined) body[key] = body[key] ? 1 : 0;
  }

  const cols = Object.keys(body);
  const sets = cols.map(c => `${c} = ?`).join(', ');
  await env.DB.prepare(`UPDATE products SET ${sets} WHERE id = ?`)
    .bind(...cols.map(c => body[c] ?? null), params.id).run();

  return json({ success: true });
};

const handleDeleteProduct: Handler = async (request, env, params) => {
  const authErr = await requireAdmin(request, env);
  if (authErr) return authErr;

  await env.DB.prepare('DELETE FROM products WHERE id = ?').bind(params.id).run();
  return json({ success: true });
};

// ── Exchange Rates ──
const handleGetRates: Handler = async (_request, env) => {
  const result = await env.DB.prepare('SELECT * FROM exchange_rates').all();
  return json(result.results);
};

// ── Invoices ──
const handleGetInvoices: Handler = async (request, env) => {
  const authErr = await requireAuth(request, env);
  if (authErr) return authErr;

  const url = new URL(request.url);
  const limit = parseInt(url.searchParams.get('limit') || '50');
  const result = await env.DB.prepare('SELECT * FROM invoices ORDER BY created_at DESC LIMIT ?').bind(limit).all();
  return json(result.results);
};

const handleCreateInvoice: Handler = async (request, env) => {
  const authErr = await requireAuth(request, env);
  if (authErr) return authErr;

  const body = await request.json() as { invoice: Record<string, any>; lineItems: Record<string, any>[] };
  const id = crypto.randomUUID();

  await env.DB.prepare(
    `INSERT INTO invoices (id, invoice_number, customer_name, customer_whatsapp, display_currency, shipping_cost_usd, status, inventory_deducted) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id,
    body.invoice.invoice_number,
    body.invoice.customer_name,
    body.invoice.customer_whatsapp || null,
    body.invoice.display_currency,
    body.invoice.shipping_cost_usd || 0,
    body.invoice.status || 'Pending',
    0
  ).run();

  for (const item of body.lineItems) {
    const itemId = crypto.randomUUID();
    await env.DB.prepare(
      'INSERT INTO invoice_line_items (id, invoice_id, product_id, quantity, price_at_sale) VALUES (?, ?, ?, ?, ?)'
    ).bind(itemId, id, item.product_id, item.quantity, item.price_at_sale).run();
  }

  return json({ id, invoice_number: body.invoice.invoice_number }, 201);
};

const handleGetInvoiceItems: Handler = async (request, env, params) => {
  const authErr = await requireAuth(request, env);
  if (authErr) return authErr;

  const result = await env.DB.prepare(
    `SELECT ili.*, p.given_name, p.product_name
     FROM invoice_line_items ili
     LEFT JOIN products p ON ili.product_id = p.id
     WHERE ili.invoice_id = ?`
  ).bind(params.id).all();
  return json(result.results);
};

const handleUpdateInvoice: Handler = async (request, env, params) => {
  const authErr = await requireAuth(request, env);
  if (authErr) return authErr;

  const body = await request.json() as Record<string, any>;
  const cols = Object.keys(body);
  const sets = cols.map(c => `${c} = ?`).join(', ');
  await env.DB.prepare(`UPDATE invoices SET ${sets} WHERE id = ?`)
    .bind(...cols.map(c => body[c] ?? null), params.id).run();
  return json({ success: true });
};

const handleDeleteInvoice: Handler = async (request, env, params) => {
  const authErr = await requireAuth(request, env);
  if (authErr) return authErr;

  await env.DB.prepare('DELETE FROM invoice_line_items WHERE invoice_id = ?').bind(params.id).run();
  await env.DB.prepare('DELETE FROM invoices WHERE id = ?').bind(params.id).run();
  return json({ success: true });
};

// ── RPC: Fulfill Invoice ──
const handleFulfillInvoice: Handler = async (request, env) => {
  const authErr = await requireAdmin(request, env);
  if (authErr) return authErr;

  const { invoice_id } = await request.json() as { invoice_id: string };

  const invoice = await env.DB.prepare('SELECT * FROM invoices WHERE id = ?').bind(invoice_id).first();
  if (!invoice) return json({ error: 'Invoice not found' }, 404);
  if (invoice.inventory_deducted) return json({ error: 'Inventory already deducted' }, 400);

  const items = await env.DB.prepare('SELECT * FROM invoice_line_items WHERE invoice_id = ?').bind(invoice_id).all();

  for (const item of items.results) {
    await env.DB.prepare('UPDATE products SET stock_grams = stock_grams - ? WHERE id = ?')
      .bind(item.quantity, item.product_id).run();
  }

  await env.DB.prepare("UPDATE invoices SET status = 'Filled', inventory_deducted = 1 WHERE id = ?")
    .bind(invoice_id).run();

  await env.DB.prepare("INSERT INTO activity_logs (id, action, details) VALUES (?, 'FULFILLMENT', ?)")
    .bind(crypto.randomUUID(), `Order ${invoice.invoice_number} marked as filled. Inventory deducted.`).run();

  return json({ success: true });
};

// ── RPC: Increment Stock (for void restore) ──
const handleIncrementStock: Handler = async (request, env) => {
  const authErr = await requireAdmin(request, env);
  if (authErr) return authErr;

  const { product_id, amount } = await request.json() as { product_id: string; amount: number };
  await env.DB.prepare('UPDATE products SET stock_grams = stock_grams + ? WHERE id = ?')
    .bind(amount, product_id).run();
  return json({ success: true });
};

// ── RPC: Truncate All Data ──
const handleTruncateAll: Handler = async (request, env) => {
  const authErr = await requireAdmin(request, env);
  if (authErr) return authErr;

  await env.DB.prepare('DELETE FROM invoice_line_items').run();
  await env.DB.prepare('DELETE FROM invoices').run();
  await env.DB.prepare('DELETE FROM products').run();
  await env.DB.prepare('DELETE FROM activity_logs').run();
  return json({ success: true });
};

// ── Activity Logs ──
const handleGetActivityLogs: Handler = async (request, env) => {
  const authErr = await requireAuth(request, env);
  if (authErr) return authErr;

  const result = await env.DB.prepare('SELECT * FROM activity_logs ORDER BY created_at DESC LIMIT 50').all();
  return json(result.results);
};

// ── Image Upload (presigned URL for R2) ──
const handleUploadImage: Handler = async (request, env) => {
  const authErr = await requireAuth(request, env);
  if (authErr) return authErr;

  // This endpoint generates presigned URLs for Cloudflare R2
  // For now, return the expected shape. The actual R2 signing
  // requires R2 secrets which should be added to wrangler.toml
  const { filename, filetype } = await request.json() as { filename: string; filetype: string };

  // TODO: Add R2 bucket binding and presigned URL generation
  // For now, pass through to indicate the endpoint exists
  return json({ error: 'R2 upload not yet configured. Add R2 binding to wrangler.toml' }, 501);
};

// ── Routes ──
const routes: [string, string, Handler][] = [
  // Auth
  ['POST', '/api/auth/login', handleLogin],
  ['POST', '/api/auth/signup', handleSignup],
  ['GET', '/api/auth/me', handleGetMe],

  // Products
  ['GET', '/api/products/public', handleGetPublicProducts],
  ['GET', '/api/products', handleGetProducts],
  ['POST', '/api/products', handleCreateProduct],
  ['POST', '/api/products/bulk', handleBulkCreateProducts],
  ['PUT', '/api/products/:id', handleUpdateProduct],
  ['DELETE', '/api/products/:id', handleDeleteProduct],

  // Exchange Rates
  ['GET', '/api/rates', handleGetRates],

  // Invoices
  ['GET', '/api/invoices', handleGetInvoices],
  ['POST', '/api/invoices', handleCreateInvoice],
  ['GET', '/api/invoices/:id/items', handleGetInvoiceItems],
  ['PUT', '/api/invoices/:id', handleUpdateInvoice],
  ['DELETE', '/api/invoices/:id', handleDeleteInvoice],

  // RPC
  ['POST', '/api/rpc/fulfill-invoice', handleFulfillInvoice],
  ['POST', '/api/rpc/increment-stock', handleIncrementStock],
  ['POST', '/api/rpc/truncate-all', handleTruncateAll],

  // Activity Logs
  ['GET', '/api/activity-logs', handleGetActivityLogs],

  // Image Upload
  ['POST', '/api/upload-image', handleUploadImage],
];

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin') || '*';

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return cors(new Response(null, { status: 204 }), origin);
    }

    const match = matchRoute(request.method, url.pathname, routes);
    if (!match) {
      return cors(json({ error: 'Not found' }, 404), origin);
    }

    try {
      const response = await match.handler(request, env, match.params);
      return cors(response, origin);
    } catch (err: any) {
      console.error('Worker error:', err);
      return cors(json({ error: err.message || 'Internal server error' }, 500), origin);
    }
  },
};

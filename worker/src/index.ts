interface Env {
  DB: D1Database;
  MEDIA_BUCKET: R2Bucket;
  ADMIN_PASSWORD_HASH: string;
  JWT_SECRET: string;
  ANTHROPIC_API_KEY: string;
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
  'lore', 'show_wisdom', 'processing_notes', 'terroir', 'mood', 'experience',
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
    `INSERT INTO invoices (id, invoice_number, customer_name, customer_whatsapp, customer_id, display_currency, shipping_cost_usd, status, inventory_deducted) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id,
    body.invoice.invoice_number,
    body.invoice.customer_name,
    body.invoice.customer_whatsapp || null,
    body.invoice.customer_id || null,
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

// ── Customers ──
const handleGetCustomers: Handler = async (request, env) => {
  const authErr = await requireAdmin(request, env);
  if (authErr) return authErr;

  // Join with invoices to get order stats
  const result = await env.DB.prepare(`
    SELECT c.*,
      COUNT(i.id) as order_count,
      COALESCE(SUM(
        (SELECT SUM(ili.quantity * ili.price_at_sale) FROM invoice_line_items ili WHERE ili.invoice_id = i.id)
      ), 0) as total_spent_usd,
      MAX(i.created_at) as last_order_date
    FROM customers c
    LEFT JOIN invoices i ON i.customer_id = c.id AND i.status != 'Void'
    GROUP BY c.id
    ORDER BY c.created_at DESC
  `).all();

  return json(result.results);
};

const handleGetCustomer: Handler = async (request, env, params) => {
  const authErr = await requireAdmin(request, env);
  if (authErr) return authErr;

  const customer = await env.DB.prepare('SELECT * FROM customers WHERE id = ?').bind(params.id).first();
  if (!customer) return json({ error: 'Customer not found' }, 404);

  // Get their orders
  const orders = await env.DB.prepare(
    'SELECT * FROM invoices WHERE customer_id = ? ORDER BY created_at DESC'
  ).bind(params.id).all();

  return json({ ...customer, orders: orders.results });
};

const handleCreateCustomer: Handler = async (request, env) => {
  const authErr = await requireAdmin(request, env);
  if (authErr) return authErr;

  const body = await request.json() as Record<string, any>;
  const id = crypto.randomUUID();

  if (Array.isArray(body.tags)) body.tags = JSON.stringify(body.tags);

  await env.DB.prepare(
    `INSERT INTO customers (id, name, company, email, phone, whatsapp, address, city, country, preferred_currency, tags, notes, source)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id,
    body.name,
    body.company || null,
    body.email || null,
    body.phone || null,
    body.whatsapp || null,
    body.address || null,
    body.city || null,
    body.country || null,
    body.preferred_currency || 'USD',
    body.tags || '[]',
    body.notes || null,
    body.source || null
  ).run();

  return json({ id }, 201);
};

const handleUpdateCustomer: Handler = async (request, env, params) => {
  const authErr = await requireAdmin(request, env);
  if (authErr) return authErr;

  const body = await request.json() as Record<string, any>;
  if (Array.isArray(body.tags)) body.tags = JSON.stringify(body.tags);

  const cols = Object.keys(body);
  const sets = cols.map(c => `${c} = ?`).join(', ');
  await env.DB.prepare(`UPDATE customers SET ${sets}, updated_at = datetime('now') WHERE id = ?`)
    .bind(...cols.map(c => body[c] ?? null), params.id).run();

  return json({ success: true });
};

const handleDeleteCustomer: Handler = async (request, env, params) => {
  const authErr = await requireAdmin(request, env);
  if (authErr) return authErr;

  // Unlink invoices (set customer_id to null) rather than cascade delete
  await env.DB.prepare('UPDATE invoices SET customer_id = NULL WHERE customer_id = ?').bind(params.id).run();
  await env.DB.prepare('DELETE FROM customers WHERE id = ?').bind(params.id).run();
  return json({ success: true });
};

const handleGetCustomerOrders: Handler = async (request, env, params) => {
  const authErr = await requireAdmin(request, env);
  if (authErr) return authErr;

  const orders = await env.DB.prepare(
    'SELECT * FROM invoices WHERE customer_id = ? ORDER BY created_at DESC'
  ).bind(params.id).all();

  return json(orders.results);
};

const handleGetCustomerTeas: Handler = async (request, env, params) => {
  const authErr = await requireAdmin(request, env);
  if (authErr) return authErr;

  // Get all teas this customer has purchased, with quantities and dates
  const result = await env.DB.prepare(`
    SELECT
      p.id, p.product_name, p.given_name, p.chinese_name, p.type, p.image_url,
      p.origin_country, p.origin_region,
      SUM(ili.quantity) as total_quantity,
      COUNT(DISTINCT i.id) as order_count,
      MIN(i.created_at) as first_purchased,
      MAX(i.created_at) as last_purchased
    FROM invoice_line_items ili
    JOIN invoices i ON i.id = ili.invoice_id
    JOIN products p ON p.id = ili.product_id
    WHERE i.customer_id = ? AND i.status != 'Void'
    GROUP BY p.id
    ORDER BY last_purchased DESC
  `).bind(params.id).all();

  return json(result.results);
};

const handleGetVendorProducts: Handler = async (request, env, params) => {
  const authErr = await requireAdmin(request, env);
  if (authErr) return authErr;

  const result = await env.DB.prepare(`
    SELECT id, product_name, given_name, chinese_name, type, image_url,
      origin_country, origin_region, stock_grams, status, cost_amount, cost_currency
    FROM products
    WHERE vendor_id = ?
    ORDER BY product_name ASC
  `).bind(params.id).all();

  return json(result.results);
};

const handleLinkVendorProduct: Handler = async (request, env, params) => {
  const authErr = await requireAdmin(request, env);
  if (authErr) return authErr;

  const body = await request.json() as Record<string, any>;
  const productId = body.product_id;
  if (!productId) return json({ error: 'product_id required' }, 400);

  await env.DB.prepare('UPDATE products SET vendor_id = ? WHERE id = ?')
    .bind(params.id, productId).run();

  return json({ success: true });
};

const handleUnlinkVendorProduct: Handler = async (request, env, params) => {
  const authErr = await requireAdmin(request, env);
  if (authErr) return authErr;

  await env.DB.prepare('UPDATE products SET vendor_id = NULL WHERE id = ?')
    .bind(params.productId).run();

  return json({ success: true });
};

// ── Backfill: match existing invoices to customers ──
const handleBackfillCustomerLinks: Handler = async (request, env) => {
  const authErr = await requireAdmin(request, env);
  if (authErr) return authErr;

  // Find invoices with no customer_id and try to match by name
  const unlinked = await env.DB.prepare(
    `SELECT id, customer_name, customer_whatsapp FROM invoices WHERE customer_id IS NULL AND customer_name IS NOT NULL`
  ).all();

  const customers = await env.DB.prepare('SELECT id, name, whatsapp FROM customers').all();

  let linked = 0;
  for (const inv of unlinked.results) {
    const name = (inv.customer_name as string || '').toLowerCase().trim();
    if (!name) continue;

    // Try exact name match first, then WhatsApp match
    let match = customers.results.find(
      (c: any) => (c.name as string).toLowerCase().trim() === name
    );
    if (!match && inv.customer_whatsapp) {
      match = customers.results.find(
        (c: any) => c.whatsapp && c.whatsapp === inv.customer_whatsapp
      );
    }

    if (match) {
      await env.DB.prepare('UPDATE invoices SET customer_id = ? WHERE id = ?')
        .bind(match.id, inv.id).run();
      linked++;
    }
  }

  return json({ linked, total_unlinked: unlinked.results.length });
};

// ── AI Wisdom Generation ──
const handleGenerateWisdom: Handler = async (request, env) => {
  const authErr = await requireAdmin(request, env);
  if (authErr) return authErr;

  if (!env.ANTHROPIC_API_KEY) {
    return json({ error: 'ANTHROPIC_API_KEY not configured' }, 503);
  }

  const { prompt } = await request.json() as { prompt: string };
  if (!prompt) return json({ error: 'prompt required' }, 400);

  const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-opus-4-6',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
      tools: [{
        name: 'generate_tea_wisdom',
        description: 'Output structured wisdom fields for a tea product.',
        input_schema: {
          type: 'object',
          properties: {
            lore: { type: 'string', description: '2-3 sentences of historical or geographical lore about the tea.' },
            tastingNotes: { type: 'array', items: { type: 'string' }, description: '3-4 distinct sensory tasting notes.' },
            chineseName: { type: 'string', description: 'Traditional Chinese name of the tea, if known.' },
            originRegion: { type: 'string', description: 'Specific origin region, e.g., "Nantou, Taiwan".' },
            processingNotes: { type: 'string', description: 'Processing notes, e.g., "Heavy charcoal roast over pine wood."' },
            terroir: { type: 'string', description: '1-2 sentences describing the growing environment: soil type, altitude, climate, geography.' },
            mood: { type: 'string', description: 'A short mood or feeling, e.g., "Grounding & Meditative".' },
            experience: { type: 'string', description: '1-2 sentences describing the feeling of drinking this tea.' },
          },
          required: ['lore', 'tastingNotes'],
          additionalProperties: false,
        },
      }],
      tool_choice: { type: 'tool', name: 'generate_tea_wisdom' },
    }),
  });

  if (!claudeRes.ok) {
    return json({ error: `Claude API error: ${claudeRes.status}` }, 502);
  }

  const claudeData = await claudeRes.json() as any;
  const toolUse = claudeData.content?.find((b: any) => b.type === 'tool_use');
  if (!toolUse) return json({ error: 'No structured output from Claude' }, 500);

  return json(toolUse.input);
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

// ── Waitlist Cascade Helper ──
async function cascadeWaitlist(env: Env, eventId: string, claimWindowMinutes: number): Promise<void> {
  const next = await env.DB.prepare(
    `SELECT id FROM event_attendees
     WHERE event_id = ? AND status = 'waitlist'
     ORDER BY waitlist_position ASC, created_at ASC LIMIT 1`
  ).bind(eventId).first();

  if (next) {
    const expiresAt = new Date(Date.now() + claimWindowMinutes * 60 * 1000).toISOString();
    await env.DB.prepare(
      `UPDATE event_attendees SET claim_expires_at = ? WHERE id = ?`
    ).bind(expiresAt, next.id).run();

    // Create a waitlist_promotion notification
    await env.DB.prepare(
      `INSERT INTO event_notifications (id, event_id, attendee_id, type, message_template, status)
       VALUES (?, ?, ?, 'waitlist_promotion', 'A spot has opened up! Claim it before it expires.', 'pending')`
    ).bind(crypto.randomUUID(), eventId, next.id).run();
  }
}

// ── Event Public Routes ──

const handleGetEventBySlug: Handler = async (_request, env, params) => {
  const event = await env.DB.prepare(
    `SELECT id, slug, title, subtitle, description, flyer_image_url, event_date, event_end_date,
            location_name, address_text, map_link, guidelines_text, total_capacity, timezone, status,
            session_flow, playlist_url, created_at
     FROM events WHERE slug = ? AND status = 'active'`
  ).bind(params.slug).first();

  if (!event) return json({ error: 'Event not found' }, 404);

  const count = await env.DB.prepare(
    `SELECT COALESCE(SUM(1 + plus_one), 0) as total
     FROM event_attendees WHERE event_id = ? AND status = 'confirmed'`
  ).bind(event.id).first();

  const confirmedCount = (count?.total as number) || 0;

  return json({
    ...event,
    confirmed_count: confirmedCount,
    seats_remaining: (event.total_capacity as number) - confirmedCount,
  });
};

const handleRSVP: Handler = async (request, env, params) => {
  const event = await env.DB.prepare(
    `SELECT id, total_capacity, claim_window_minutes FROM events WHERE slug = ? AND status = 'active'`
  ).bind(params.slug).first();

  if (!event) return json({ error: 'Event not found' }, 404);

  const body = await request.json() as Record<string, any>;
  const { full_name, phone_number, email, plus_one, plus_one_name, photo_consent, notes, tea_preference, bringing_tea } = body;

  if (!full_name || !phone_number) return json({ error: 'full_name and phone_number are required' }, 400);

  // Check for duplicate
  const existing = await env.DB.prepare(
    `SELECT magic_token, status FROM event_attendees WHERE event_id = ? AND phone_number = ?`
  ).bind(event.id, phone_number).first();

  if (existing) {
    return json({
      magic_token: existing.magic_token,
      status: existing.status,
      redirect_url: `/m/${existing.magic_token}`,
      existing: true,
    });
  }

  // Golden tier detection
  let accessTier = 'standard';
  let customerId: string | null = null;

  const customer = await env.DB.prepare(
    `SELECT id, tags FROM customers WHERE phone = ? OR whatsapp = ?`
  ).bind(phone_number, phone_number).first();

  if (customer) {
    customerId = customer.id as string;
    try {
      const tags = typeof customer.tags === 'string' ? JSON.parse(customer.tags) : customer.tags;
      if (Array.isArray(tags) && tags.some((t: string) => t.toLowerCase() === 'golden')) {
        accessTier = 'golden';
      }
    } catch {}
  }

  // Capacity check
  const count = await env.DB.prepare(
    `SELECT COALESCE(SUM(1 + plus_one), 0) as total
     FROM event_attendees WHERE event_id = ? AND status = 'confirmed'`
  ).bind(event.id).first();

  const confirmedTotal = (count?.total as number) || 0;
  const seatsNeeded = 1 + (plus_one ? 1 : 0);
  const totalCapacity = event.total_capacity as number;

  let status: string;
  let waitlistPosition: number | null = null;

  if (accessTier === 'golden' && confirmedTotal + seatsNeeded <= totalCapacity) {
    status = 'confirmed';
  } else if (accessTier === 'standard' && confirmedTotal + seatsNeeded <= Math.floor(totalCapacity * 0.8)) {
    status = 'confirmed';
  } else {
    status = 'waitlist';
    const maxPos = await env.DB.prepare(
      `SELECT COALESCE(MAX(waitlist_position), 0) as max_pos
       FROM event_attendees WHERE event_id = ? AND status = 'waitlist'`
    ).bind(event.id).first();
    waitlistPosition = ((maxPos?.max_pos as number) || 0) + 1;
  }

  const magicToken = crypto.randomUUID();

  await env.DB.prepare(
    `INSERT INTO event_attendees
       (id, event_id, customer_id, full_name, phone_number, email, plus_one, plus_one_name,
        access_tier, status, magic_token, photo_consent, notes, tea_preference, bringing_tea, waitlist_position)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    crypto.randomUUID(),
    event.id,
    customerId,
    full_name,
    phone_number,
    email || null,
    plus_one ? 1 : 0,
    plus_one_name || null,
    accessTier,
    status,
    magicToken,
    photo_consent ? 1 : 0,
    notes || null,
    tea_preference || null,
    bringing_tea || null,
    waitlistPosition
  ).run();

  return json({
    magic_token: magicToken,
    status,
    redirect_url: `/m/${magicToken}`,
  }, 201);
};

const handleGetEventAvailability: Handler = async (_request, env, params) => {
  const event = await env.DB.prepare(
    `SELECT id, total_capacity FROM events WHERE slug = ? AND status = 'active'`
  ).bind(params.slug).first();

  if (!event) return json({ error: 'Event not found' }, 404);

  const count = await env.DB.prepare(
    `SELECT COALESCE(SUM(1 + plus_one), 0) as total
     FROM event_attendees WHERE event_id = ? AND status = 'confirmed'`
  ).bind(event.id).first();

  const confirmedCount = (count?.total as number) || 0;
  const totalCapacity = event.total_capacity as number;

  return json({
    total_capacity: totalCapacity,
    confirmed_count: confirmedCount,
    seats_remaining: totalCapacity - confirmedCount,
    is_full: confirmedCount >= totalCapacity,
  });
};

const handleGetRSVP: Handler = async (_request, env, params) => {
  const attendee = await env.DB.prepare(
    `SELECT ea.*, e.title, e.subtitle, e.description, e.flyer_image_url, e.event_date, e.event_end_date,
            e.location_name, e.address_text, e.map_link, e.guidelines_text, e.venue_guide,
            e.timezone, e.status as event_status, e.session_flow, e.playlist_url, e.slug
     FROM event_attendees ea
     JOIN events e ON e.id = ea.event_id
     WHERE ea.magic_token = ?`
  ).bind(params.token).first();

  if (!attendee) return json({ error: 'RSVP not found' }, 404);

  // Parse session_flow from JSON if present
  let sessionFlow = null;
  if (attendee.session_flow) {
    try { sessionFlow = JSON.parse(attendee.session_flow as string); } catch { sessionFlow = attendee.session_flow; }
  }

  // Get revealed tea menu items
  const menu = await env.DB.prepare(
    `SELECT etm.*, p.given_name, p.product_name, p.chinese_name, p.type, p.image_url, p.description as product_description
     FROM event_tea_menu etm
     LEFT JOIN products p ON p.id = etm.product_id
     WHERE etm.event_id = ? AND (etm.reveal_date IS NULL OR etm.reveal_date <= datetime('now'))
     ORDER BY etm.brew_order ASC`
  ).bind(attendee.event_id).all();

  return json({
    attendee: {
      id: attendee.id,
      full_name: attendee.full_name,
      phone_number: attendee.phone_number,
      email: attendee.email,
      plus_one: attendee.plus_one,
      plus_one_name: attendee.plus_one_name,
      access_tier: attendee.access_tier,
      status: attendee.status,
      magic_token: attendee.magic_token,
      photo_consent: attendee.photo_consent,
      notes: attendee.notes,
      tea_preference: attendee.tea_preference,
      bringing_tea: attendee.bringing_tea,
      waitlist_position: attendee.waitlist_position,
      claimed_at: attendee.claimed_at,
      claim_expires_at: attendee.claim_expires_at,
      attended: attendee.attended,
      created_at: attendee.created_at,
    },
    event: {
      slug: attendee.slug,
      title: attendee.title,
      subtitle: attendee.subtitle,
      description: attendee.description,
      flyer_image_url: attendee.flyer_image_url,
      event_date: attendee.event_date,
      event_end_date: attendee.event_end_date,
      location_name: attendee.location_name,
      address_text: attendee.address_text,
      map_link: attendee.map_link,
      guidelines_text: attendee.guidelines_text,
      venue_guide: attendee.venue_guide,
      timezone: attendee.timezone,
      status: attendee.event_status,
      session_flow: sessionFlow,
      playlist_url: attendee.playlist_url,
    },
    tea_menu: menu.results,
  });
};

const handleUpdateRSVP: Handler = async (request, env, params) => {
  const attendee = await env.DB.prepare(
    `SELECT ea.*, e.total_capacity, e.claim_window_minutes, e.id as eid
     FROM event_attendees ea
     JOIN events e ON e.id = ea.event_id
     WHERE ea.magic_token = ?`
  ).bind(params.token).first();

  if (!attendee) return json({ error: 'RSVP not found' }, 404);

  const body = await request.json() as Record<string, any>;

  // Handle cancellation
  if (body.cancel) {
    await env.DB.prepare(
      `UPDATE event_attendees SET status = 'cancelled' WHERE id = ?`
    ).bind(attendee.id).run();

    // Cascade waitlist
    await cascadeWaitlist(env, attendee.eid as string, (attendee.claim_window_minutes as number) || 60);

    return json({ success: true, status: 'cancelled' });
  }

  // Handle plus_one change
  if (body.plus_one !== undefined) {
    const newPlusOne = body.plus_one ? 1 : 0;
    const oldPlusOne = (attendee.plus_one as number) || 0;

    if (newPlusOne > oldPlusOne && attendee.status === 'confirmed') {
      // Adding a plus one — check capacity
      const count = await env.DB.prepare(
        `SELECT COALESCE(SUM(1 + plus_one), 0) as total
         FROM event_attendees WHERE event_id = ? AND status = 'confirmed'`
      ).bind(attendee.eid).first();

      const confirmedTotal = (count?.total as number) || 0;
      const totalCapacity = attendee.total_capacity as number;

      if (confirmedTotal + 1 > totalCapacity) {
        return json({ error: 'No capacity for plus one' }, 409);
      }
    }

    await env.DB.prepare(
      `UPDATE event_attendees SET plus_one = ?, plus_one_name = ? WHERE id = ?`
    ).bind(newPlusOne, body.plus_one_name || null, attendee.id).run();

    // If removing plus one and there are waitlisted people, cascade
    if (newPlusOne < oldPlusOne) {
      await cascadeWaitlist(env, attendee.eid as string, (attendee.claim_window_minutes as number) || 60);
    }
  }

  return json({ success: true });
};

const handleClaimSpot: Handler = async (_request, env, params) => {
  const attendee = await env.DB.prepare(
    `SELECT ea.*, e.claim_window_minutes, e.id as eid
     FROM event_attendees ea
     JOIN events e ON e.id = ea.event_id
     WHERE ea.magic_token = ? AND ea.status = 'waitlist'`
  ).bind(params.token).first();

  if (!attendee) return json({ error: 'RSVP not found or not on waitlist' }, 404);

  if (!attendee.claim_expires_at) {
    return json({ error: 'No claim offer pending' }, 400);
  }

  const expiresAt = new Date(attendee.claim_expires_at as string);
  if (expiresAt <= new Date()) {
    // Expired — cascade to next
    await env.DB.prepare(
      `UPDATE event_attendees SET claim_expires_at = NULL WHERE id = ?`
    ).bind(attendee.id).run();

    await cascadeWaitlist(env, attendee.eid as string, (attendee.claim_window_minutes as number) || 60);

    return json({ error: 'Claim window has expired' }, 410);
  }

  // Claim the spot
  await env.DB.prepare(
    `UPDATE event_attendees SET status = 'confirmed', claimed_at = datetime('now'), claim_expires_at = NULL WHERE id = ?`
  ).bind(attendee.id).run();

  // Create spot_claimed notification
  await env.DB.prepare(
    `INSERT INTO event_notifications (id, event_id, attendee_id, type, message_template, status)
     VALUES (?, ?, ?, 'spot_claimed', 'You have claimed your spot!', 'sent')`
  ).bind(crypto.randomUUID(), attendee.eid, attendee.id).run();

  return json({ success: true, status: 'confirmed' });
};

const handleGetPostSession: Handler = async (_request, env, params) => {
  const attendee = await env.DB.prepare(
    `SELECT ea.event_id FROM event_attendees ea WHERE ea.magic_token = ?`
  ).bind(params.token).first();

  if (!attendee) return json({ error: 'RSVP not found' }, 404);

  const postSession = await env.DB.prepare(
    `SELECT * FROM event_post_session WHERE event_id = ?`
  ).bind(attendee.event_id).first();

  if (!postSession) return json({ error: 'Post-session data not yet available' }, 404);

  // Parse JSON fields
  let galleryImages = null;
  if (postSession.gallery_images) {
    try { galleryImages = JSON.parse(postSession.gallery_images as string); } catch { galleryImages = postSession.gallery_images; }
  }
  let teaLedger = null;
  if (postSession.tea_ledger) {
    try { teaLedger = JSON.parse(postSession.tea_ledger as string); } catch { teaLedger = postSession.tea_ledger; }
  }

  // Get aggregated tasting notes (anonymous)
  const notes = await env.DB.prepare(
    `SELECT etn.tea_menu_id, etn.rating, etn.impression, etn.is_favorite,
            etm.custom_name, p.given_name, p.product_name
     FROM event_tasting_notes etn
     LEFT JOIN event_tea_menu etm ON etm.id = etn.tea_menu_id
     LEFT JOIN products p ON p.id = etm.product_id
     WHERE etn.event_id = ?
     ORDER BY etm.brew_order ASC`
  ).bind(attendee.event_id).all();

  return json({
    ...postSession,
    gallery_images: galleryImages,
    tea_ledger: teaLedger,
    tasting_notes: notes.results,
  });
};

const handleSubmitTastingNotes: Handler = async (request, env, params) => {
  const attendee = await env.DB.prepare(
    `SELECT ea.id, ea.event_id, e.event_date
     FROM event_attendees ea
     JOIN events e ON e.id = ea.event_id
     WHERE ea.magic_token = ?`
  ).bind(params.token).first();

  if (!attendee) return json({ error: 'RSVP not found' }, 404);

  // Verify event date has passed
  const eventDate = new Date(attendee.event_date as string);
  if (eventDate > new Date()) {
    return json({ error: 'Tasting notes can only be submitted after the event' }, 400);
  }

  const notes = await request.json() as Array<{ tea_menu_id?: string; rating?: number; impression?: string; is_favorite?: boolean }>;
  if (!Array.isArray(notes)) return json({ error: 'Expected an array of tasting notes' }, 400);

  const stmts = notes.map(note =>
    env.DB.prepare(
      `INSERT INTO event_tasting_notes (id, event_id, attendee_id, tea_menu_id, rating, impression, is_favorite)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      crypto.randomUUID(),
      attendee.event_id,
      attendee.id,
      note.tea_menu_id || null,
      note.rating || null,
      note.impression || null,
      note.is_favorite ? 1 : 0
    )
  );

  await env.DB.batch(stmts);

  return json({ success: true, count: notes.length }, 201);
};

const handleFindRSVP: Handler = async (request, env, params) => {
  const event = await env.DB.prepare(
    `SELECT id FROM events WHERE slug = ?`
  ).bind(params.slug).first();

  if (!event) return json({ error: 'Event not found' }, 404);

  const body = await request.json() as { phone_number: string };
  if (!body.phone_number) return json({ error: 'phone_number is required' }, 400);

  const attendee = await env.DB.prepare(
    `SELECT magic_token, status FROM event_attendees WHERE event_id = ? AND phone_number = ?`
  ).bind(event.id, body.phone_number).first();

  if (!attendee) return json({ error: 'RSVP not found for this phone number' }, 404);

  return json({
    magic_token: attendee.magic_token,
    status: attendee.status,
    redirect_url: `/m/${attendee.magic_token}`,
  });
};

// ── Event Admin Routes ──

const handleGetEvents: Handler = async (request, env) => {
  const authErr = await requireAdmin(request, env);
  if (authErr) return authErr;

  const result = await env.DB.prepare(`
    SELECT e.*,
      COALESCE(SUM(CASE WHEN ea.status = 'confirmed' THEN 1 + ea.plus_one ELSE 0 END), 0) as confirmed_count,
      COALESCE(SUM(CASE WHEN ea.status = 'waitlist' THEN 1 ELSE 0 END), 0) as waitlist_count,
      COUNT(ea.id) as total_attendees
    FROM events e
    LEFT JOIN event_attendees ea ON ea.event_id = e.id AND ea.status != 'cancelled'
    GROUP BY e.id
    ORDER BY e.event_date DESC
  `).all();

  return json(result.results);
};

const handleCreateEvent: Handler = async (request, env) => {
  const authErr = await requireAdmin(request, env);
  if (authErr) return authErr;

  const body = await request.json() as Record<string, any>;
  if (!body.slug || !body.title || !body.event_date || !body.total_capacity) {
    return json({ error: 'slug, title, event_date, and total_capacity are required' }, 400);
  }

  // Check slug uniqueness
  const existingSlug = await env.DB.prepare('SELECT id FROM events WHERE slug = ?').bind(body.slug).first();
  if (existingSlug) return json({ error: 'An event with this slug already exists' }, 409);

  const id = crypto.randomUUID();

  await env.DB.prepare(
    `INSERT INTO events (id, slug, title, subtitle, description, flyer_image_url, event_date, event_end_date,
       location_name, address_text, map_link, guidelines_text, venue_guide, total_capacity, claim_window_minutes,
       timezone, status, session_flow, playlist_url)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id,
    body.slug,
    body.title,
    body.subtitle || null,
    body.description || null,
    body.flyer_image_url || null,
    body.event_date,
    body.event_end_date || null,
    body.location_name || null,
    body.address_text || null,
    body.map_link || null,
    body.guidelines_text || null,
    body.venue_guide || null,
    body.total_capacity,
    body.claim_window_minutes || 60,
    body.timezone || 'Asia/Taipei',
    body.status || 'draft',
    body.session_flow ? (typeof body.session_flow === 'string' ? body.session_flow : JSON.stringify(body.session_flow)) : null,
    body.playlist_url || null
  ).run();

  return json({ id, slug: body.slug }, 201);
};

const handleUpdateEvent: Handler = async (request, env, params) => {
  const authErr = await requireAdmin(request, env);
  if (authErr) return authErr;

  const body = await request.json() as Record<string, any>;

  // Stringify JSON fields if needed
  if (body.session_flow && typeof body.session_flow !== 'string') {
    body.session_flow = JSON.stringify(body.session_flow);
  }

  const cols = Object.keys(body);
  if (cols.length === 0) return json({ error: 'No fields to update' }, 400);

  const sets = cols.map(c => `${c} = ?`).join(', ');
  await env.DB.prepare(`UPDATE events SET ${sets}, updated_at = datetime('now') WHERE id = ?`)
    .bind(...cols.map(c => body[c] ?? null), params.id).run();

  return json({ success: true });
};

const handleDeleteEvent: Handler = async (request, env, params) => {
  const authErr = await requireAdmin(request, env);
  if (authErr) return authErr;

  await env.DB.prepare(`UPDATE events SET status = 'archived', updated_at = datetime('now') WHERE id = ?`)
    .bind(params.id).run();

  return json({ success: true });
};

const handleGetAttendees: Handler = async (request, env, params) => {
  const authErr = await requireAdmin(request, env);
  if (authErr) return authErr;

  const result = await env.DB.prepare(
    `SELECT ea.*, c.name as customer_name_linked, c.tags as customer_tags
     FROM event_attendees ea
     LEFT JOIN customers c ON c.id = ea.customer_id
     WHERE ea.event_id = ?
     ORDER BY ea.status ASC, ea.created_at ASC`
  ).bind(params.id).all();

  return json(result.results);
};

const handleUpdateAttendee: Handler = async (request, env, params) => {
  const authErr = await requireAdmin(request, env);
  if (authErr) return authErr;

  const body = await request.json() as Record<string, any>;

  const attendee = await env.DB.prepare(
    `SELECT ea.*, e.claim_window_minutes, e.id as eid
     FROM event_attendees ea
     JOIN events e ON e.id = ea.event_id
     WHERE ea.id = ?`
  ).bind(params.id).first();

  if (!attendee) return json({ error: 'Attendee not found' }, 404);

  const cols = Object.keys(body);
  const sets = cols.map(c => `${c} = ?`).join(', ');
  await env.DB.prepare(`UPDATE event_attendees SET ${sets} WHERE id = ?`)
    .bind(...cols.map(c => body[c] ?? null), params.id).run();

  // If status changed to cancelled, cascade waitlist
  if (body.status === 'cancelled' && attendee.status !== 'cancelled') {
    await cascadeWaitlist(env, attendee.eid as string, (attendee.claim_window_minutes as number) || 60);
  }

  return json({ success: true });
};

const handleGetNotifications: Handler = async (request, env, params) => {
  const authErr = await requireAdmin(request, env);
  if (authErr) return authErr;

  const result = await env.DB.prepare(
    `SELECT en.*, ea.full_name, ea.phone_number
     FROM event_notifications en
     LEFT JOIN event_attendees ea ON ea.id = en.attendee_id
     WHERE en.event_id = ?
     ORDER BY en.created_at DESC`
  ).bind(params.id).all();

  return json(result.results);
};

const handleCreateNotifications: Handler = async (request, env, params) => {
  const authErr = await requireAdmin(request, env);
  if (authErr) return authErr;

  // Generate checkin reminders for all confirmed attendees
  const attendees = await env.DB.prepare(
    `SELECT id FROM event_attendees WHERE event_id = ? AND status = 'confirmed'`
  ).bind(params.id).all();

  const stmts = attendees.results.map(a =>
    env.DB.prepare(
      `INSERT INTO event_notifications (id, event_id, attendee_id, type, message_template, status)
       VALUES (?, ?, ?, 'checkin_reminder', 'Reminder: Your tea session is coming up soon!', 'pending')`
    ).bind(crypto.randomUUID(), params.id, a.id)
  );

  if (stmts.length > 0) {
    await env.DB.batch(stmts);
  }

  return json({ success: true, count: stmts.length }, 201);
};

const handleUpsertPostSession: Handler = async (request, env, params) => {
  const authErr = await requireAdmin(request, env);
  if (authErr) return authErr;

  const body = await request.json() as Record<string, any>;

  // Stringify JSON fields
  const teaLedger = body.tea_ledger ? (typeof body.tea_ledger === 'string' ? body.tea_ledger : JSON.stringify(body.tea_ledger)) : null;
  const galleryImages = body.gallery_images ? (typeof body.gallery_images === 'string' ? body.gallery_images : JSON.stringify(body.gallery_images)) : null;

  const existing = await env.DB.prepare(
    `SELECT id FROM event_post_session WHERE event_id = ?`
  ).bind(params.id).first();

  if (existing) {
    await env.DB.prepare(
      `UPDATE event_post_session SET tea_ledger = ?, playlist_url = ?, gallery_images = ?, session_notes = ? WHERE event_id = ?`
    ).bind(teaLedger, body.playlist_url || null, galleryImages, body.session_notes || null, params.id).run();
  } else {
    await env.DB.prepare(
      `INSERT INTO event_post_session (id, event_id, tea_ledger, playlist_url, gallery_images, session_notes)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).bind(crypto.randomUUID(), params.id, teaLedger, body.playlist_url || null, galleryImages, body.session_notes || null).run();
  }

  return json({ success: true });
};

const handleDuplicateEvent: Handler = async (request, env, params) => {
  const authErr = await requireAdmin(request, env);
  if (authErr) return authErr;

  const body = await request.json() as { slug: string; event_date: string };
  if (!body.slug || !body.event_date) return json({ error: 'slug and event_date are required' }, 400);

  const existingSlug = await env.DB.prepare('SELECT id FROM events WHERE slug = ?').bind(body.slug).first();
  if (existingSlug) return json({ error: 'An event with this slug already exists' }, 409);

  const source = await env.DB.prepare('SELECT * FROM events WHERE id = ?').bind(params.id).first();
  if (!source) return json({ error: 'Source event not found' }, 404);

  const newId = crypto.randomUUID();

  await env.DB.prepare(
    `INSERT INTO events (id, slug, title, subtitle, description, flyer_image_url, event_date, event_end_date,
       location_name, address_text, map_link, guidelines_text, venue_guide, total_capacity, claim_window_minutes,
       timezone, status, session_flow, playlist_url)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?)`
  ).bind(
    newId,
    body.slug,
    source.title,
    source.subtitle,
    source.description,
    source.flyer_image_url,
    body.event_date,
    source.event_end_date,
    source.location_name,
    source.address_text,
    source.map_link,
    source.guidelines_text,
    source.venue_guide,
    source.total_capacity,
    source.claim_window_minutes,
    source.timezone,
    source.session_flow,
    source.playlist_url
  ).run();

  // Copy tea menu
  const menu = await env.DB.prepare('SELECT * FROM event_tea_menu WHERE event_id = ?').bind(params.id).all();
  if (menu.results.length > 0) {
    const menuStmts = menu.results.map(m =>
      env.DB.prepare(
        `INSERT INTO event_tea_menu (id, event_id, product_id, custom_name, custom_description, reveal_date, brew_order)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).bind(crypto.randomUUID(), newId, m.product_id, m.custom_name, m.custom_description, m.reveal_date, m.brew_order)
    );
    await env.DB.batch(menuStmts);
  }

  return json({ id: newId, slug: body.slug }, 201);
};

const handleBatchAttendance: Handler = async (request, env, params) => {
  const authErr = await requireAdmin(request, env);
  if (authErr) return authErr;

  const body = await request.json() as { attendee_ids: string[]; attended: boolean };
  if (!Array.isArray(body.attendee_ids)) return json({ error: 'attendee_ids must be an array' }, 400);

  const attendedVal = body.attended ? 1 : 0;
  const stmts = body.attendee_ids.map(id =>
    env.DB.prepare('UPDATE event_attendees SET attended = ? WHERE id = ? AND event_id = ?')
      .bind(attendedVal, id, params.id)
  );

  if (stmts.length > 0) {
    await env.DB.batch(stmts);
  }

  return json({ success: true, count: stmts.length });
};

const handleGetTeaMenu: Handler = async (request, env, params) => {
  const authErr = await requireAdmin(request, env);
  if (authErr) return authErr;

  const result = await env.DB.prepare(
    `SELECT etm.*, p.given_name, p.product_name, p.chinese_name, p.type, p.image_url
     FROM event_tea_menu etm
     LEFT JOIN products p ON p.id = etm.product_id
     WHERE etm.event_id = ?
     ORDER BY etm.brew_order ASC`
  ).bind(params.id).all();

  return json(result.results);
};

const handleUpsertTeaMenu: Handler = async (request, env, params) => {
  const authErr = await requireAdmin(request, env);
  if (authErr) return authErr;

  const items = await request.json() as Array<Record<string, any>>;
  if (!Array.isArray(items)) return json({ error: 'Expected an array of menu items' }, 400);

  const stmts: D1PreparedStatement[] = [];

  for (const item of items) {
    if (item.id) {
      // Update existing
      stmts.push(
        env.DB.prepare(
          `UPDATE event_tea_menu SET product_id = ?, custom_name = ?, custom_description = ?, reveal_date = ?, brew_order = ?
           WHERE id = ? AND event_id = ?`
        ).bind(
          item.product_id || null,
          item.custom_name || null,
          item.custom_description || null,
          item.reveal_date || null,
          item.brew_order ?? null,
          item.id,
          params.id
        )
      );
    } else {
      // Insert new
      stmts.push(
        env.DB.prepare(
          `INSERT INTO event_tea_menu (id, event_id, product_id, custom_name, custom_description, reveal_date, brew_order)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          crypto.randomUUID(),
          params.id,
          item.product_id || null,
          item.custom_name || null,
          item.custom_description || null,
          item.reveal_date || null,
          item.brew_order ?? null
        )
      );
    }
  }

  if (stmts.length > 0) {
    await env.DB.batch(stmts);
  }

  return json({ success: true, count: stmts.length });
};

const handleDeleteTeaMenuItem: Handler = async (request, env, params) => {
  const authErr = await requireAdmin(request, env);
  if (authErr) return authErr;

  await env.DB.prepare(
    'DELETE FROM event_tea_menu WHERE id = ? AND event_id = ?'
  ).bind(params.itemId, params.id).run();

  return json({ success: true });
};

const handleGetTastingNotes: Handler = async (request, env, params) => {
  const authErr = await requireAdmin(request, env);
  if (authErr) return authErr;

  const result = await env.DB.prepare(
    `SELECT etn.*, ea.full_name, ea.phone_number, etm.custom_name, p.given_name, p.product_name
     FROM event_tasting_notes etn
     JOIN event_attendees ea ON ea.id = etn.attendee_id
     LEFT JOIN event_tea_menu etm ON etm.id = etn.tea_menu_id
     LEFT JOIN products p ON p.id = etm.product_id
     WHERE etn.event_id = ?
     ORDER BY etm.brew_order ASC, ea.full_name ASC`
  ).bind(params.id).all();

  return json(result.results);
};

// ── Flyer Upload (R2) ──
const handleUploadFlyer: Handler = async (request, env) => {
  const authErr = await requireAdmin(request, env);
  if (authErr) return authErr;

  if (!env.MEDIA_BUCKET) {
    return json({ error: 'R2 media bucket not configured' }, 503);
  }

  const contentType = request.headers.get('Content-Type') || '';
  if (!contentType.includes('multipart/form-data')) {
    return json({ error: 'Expected multipart/form-data' }, 400);
  }

  const formData = await request.formData();
  const file = formData.get('file') as File | null;

  if (!file) return json({ error: 'No file provided' }, 400);

  const ext = file.name.split('.').pop() || 'jpg';
  const key = `flyers/${crypto.randomUUID()}.${ext}`;

  await env.MEDIA_BUCKET.put(key, file.stream(), {
    httpMetadata: { contentType: file.type },
  });

  // Return the public URL (assumes custom domain or R2 public access configured)
  const publicUrl = `https://media.teajia.co/${key}`;

  return json({ url: publicUrl, key }, 201);
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

  // Customers
  ['GET', '/api/customers', handleGetCustomers],
  ['GET', '/api/customers/:id', handleGetCustomer],
  ['POST', '/api/customers', handleCreateCustomer],
  ['PUT', '/api/customers/:id', handleUpdateCustomer],
  ['DELETE', '/api/customers/:id', handleDeleteCustomer],
  ['GET', '/api/customers/:id/orders', handleGetCustomerOrders],
  ['GET', '/api/customers/:id/teas', handleGetCustomerTeas],
  ['GET', '/api/customers/:id/products', handleGetVendorProducts],
  ['POST', '/api/customers/:id/products', handleLinkVendorProduct],
  ['DELETE', '/api/customers/:id/products/:productId', handleUnlinkVendorProduct],

  // RPC
  ['POST', '/api/rpc/fulfill-invoice', handleFulfillInvoice],
  ['POST', '/api/rpc/increment-stock', handleIncrementStock],
  ['POST', '/api/rpc/truncate-all', handleTruncateAll],
  ['POST', '/api/rpc/backfill-customer-links', handleBackfillCustomerLinks],

  // Activity Logs
  ['GET', '/api/activity-logs', handleGetActivityLogs],

  // Image Upload
  ['POST', '/api/upload-image', handleUploadImage],

  // AI
  ['POST', '/api/generate-wisdom', handleGenerateWisdom],

  // Events — Public
  ['GET', '/api/events/:slug/public', handleGetEventBySlug],
  ['POST', '/api/events/:slug/rsvp', handleRSVP],
  ['GET', '/api/events/:slug/availability', handleGetEventAvailability],
  ['POST', '/api/events/:slug/find-rsvp', handleFindRSVP],

  // RSVP — Token-based (public)
  ['GET', '/api/rsvp/:token', handleGetRSVP],
  ['PUT', '/api/rsvp/:token', handleUpdateRSVP],
  ['POST', '/api/rsvp/:token/claim', handleClaimSpot],
  ['GET', '/api/rsvp/:token/post-session', handleGetPostSession],
  ['POST', '/api/rsvp/:token/tasting-notes', handleSubmitTastingNotes],

  // Events — Admin
  ['GET', '/api/admin/events', handleGetEvents],
  ['POST', '/api/admin/events', handleCreateEvent],
  ['PUT', '/api/admin/events/:id', handleUpdateEvent],
  ['DELETE', '/api/admin/events/:id', handleDeleteEvent],
  ['GET', '/api/admin/events/:id/attendees', handleGetAttendees],
  ['GET', '/api/admin/events/:id/notifications', handleGetNotifications],
  ['POST', '/api/admin/events/:id/notifications', handleCreateNotifications],
  ['POST', '/api/admin/events/:id/post-session', handleUpsertPostSession],
  ['POST', '/api/admin/events/:id/duplicate', handleDuplicateEvent],
  ['POST', '/api/admin/events/:id/attendance', handleBatchAttendance],
  ['GET', '/api/admin/events/:id/tea-menu', handleGetTeaMenu],
  ['POST', '/api/admin/events/:id/tea-menu', handleUpsertTeaMenu],
  ['DELETE', '/api/admin/events/:id/tea-menu/:itemId', handleDeleteTeaMenuItem],
  ['GET', '/api/admin/events/:id/tasting-notes', handleGetTastingNotes],

  // Admin — Attendees (direct by ID)
  ['PUT', '/api/admin/attendees/:id', handleUpdateAttendee],

  // Media Upload
  ['POST', '/api/upload-flyer', handleUploadFlyer],
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

  async scheduled(_event: ScheduledEvent, env: Env, _ctx: ExecutionContext): Promise<void> {
    // Generate checkin reminder notifications for events happening tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    const events = await env.DB.prepare(
      `SELECT id FROM events WHERE date(event_date) = ? AND status = 'active'`
    ).bind(tomorrowStr).all();

    for (const event of events.results) {
      const attendees = await env.DB.prepare(
        `SELECT ea.id FROM event_attendees ea
         LEFT JOIN event_notifications en ON en.attendee_id = ea.id AND en.event_id = ea.event_id AND en.type = 'checkin_reminder'
         WHERE ea.event_id = ? AND ea.status = 'confirmed' AND en.id IS NULL`
      ).bind(event.id).all();

      if (attendees.results.length > 0) {
        const stmts = attendees.results.map(a =>
          env.DB.prepare(
            `INSERT INTO event_notifications (id, event_id, attendee_id, type, message_template, status)
             VALUES (?, ?, ?, 'checkin_reminder', 'Reminder: Your tea session is tomorrow!', 'pending')`
          ).bind(crypto.randomUUID(), event.id, a.id)
        );
        await env.DB.batch(stmts);
      }
    }
  },
};

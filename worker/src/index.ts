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

// ── Audit & Ledger Helpers ──
function getUserEmail(request: Request): string | null {
  const token = isAuthed(request);
  if (!token) return null;
  const claims = parseToken(token);
  return claims?.email || null;
}

function buildActivityLog(
  env: Env, action: string, details: string,
  userEmail?: string | null, entityType?: string | null, entityId?: string | null
) {
  return env.DB.prepare(
    'INSERT INTO activity_logs (id, action, details, user_email, entity_type, entity_id) VALUES (?, ?, ?, ?, ?, ?)'
  ).bind(crypto.randomUUID(), action, details, userEmail || null, entityType || null, entityId || null);
}

function buildStockLedgerEntry(
  env: Env, productId: string, delta: number, balanceAfter: number, reason: string,
  userEmail?: string | null, invoiceId?: string | null, invoiceNumber?: string | null, note?: string | null
) {
  return env.DB.prepare(
    'INSERT INTO stock_ledger (id, product_id, delta, balance_after, reason, source_invoice_id, source_invoice_number, user_email, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).bind(crypto.randomUUID(), productId, delta, balanceAfter, reason, invoiceId || null, invoiceNumber || null, userEmail || null, note || null);
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
  if (!claims || (claims.role !== 'admin' && claims.role !== 'owner')) {
    return json({ error: 'Admin access required' }, 403);
  }
  return null;
}

async function requireOwner(request: Request, env: Env): Promise<Response | null> {
  const token = isAuthed(request);
  if (!token || !(await verifyToken(token, env.JWT_SECRET))) {
    return json({ error: 'Unauthorized' }, 401);
  }
  const claims = parseToken(token);
  if (!claims || claims.role !== 'owner') {
    return json({ error: 'Owner access required' }, 403);
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

function cachedJson(data: unknown, maxAge: number, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': `public, max-age=${maxAge}, s-maxage=${maxAge}`,
    },
  });
}

function cors(response: Response, origin: string): Response {
  const headers = new Headers(response.headers);
  headers.set('Access-Control-Allow-Origin', origin);
  headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  headers.set('Vary', 'Origin');
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
  const isTeaware = product.type === 'Teaware';

  // For teaware, use quantity_units as the divisor (per-unit pricing)
  // For tea, use quantity_purchased (per-gram pricing)
  const qty = isTeaware
    ? (product.quantity_units || product.quantity_purchased || 0)
    : (product.quantity_purchased || 0);

  let costPerUnitUSD = 0;
  let retailPricePerUnitUSD = 0;

  if (qty > 0) {
    const costPerUnit = product.cost_amount / qty;
    // Shipping per gram only applies to tea, not teaware
    const shippingPerUnit = isTeaware ? 0 : (product.shipping_rate_per_kg || 0) / 1000;
    costPerUnitUSD = (costPerUnit + shippingPerUnit) / (rate || 1);
  }

  if (qty > 0) {
    retailPricePerUnitUSD = costPerUnitUSD * 3.0;
  }

  return {
    ...product,
    stock_grams: Math.round(product.stock_grams || 0),
    cost_per_gram_usd: Math.round(costPerUnitUSD * 100) / 100,
    retail_price_per_gram_usd: Math.round(retailPricePerUnitUSD * 100) / 100,
  };
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
    const user = await env.DB.prepare('SELECT id, email, name, role, admin_request_status, created_at FROM users WHERE id = ?').bind(claims.sub).first();
    if (user) return json(user);
  } catch {}

  // Fallback to token claims
  return json({ id: claims.sub, email: claims.email, name: claims.name, role: claims.role });
};

// ── Change Password ──
const handleChangePassword: Handler = async (request, env) => {
  const authErr = await requireAuth(request, env);
  if (authErr) return authErr;

  const token = isAuthed(request)!;
  const claims = parseToken(token);
  if (!claims) return json({ error: 'Invalid token' }, 401);

  const { currentPassword, newPassword } = await request.json() as { currentPassword?: string; newPassword?: string };
  if (!currentPassword || !newPassword) return json({ error: 'Current and new password required' }, 400);
  if (newPassword.length < 6) return json({ error: 'New password must be at least 6 characters' }, 400);

  const user = await env.DB.prepare('SELECT id, password_hash FROM users WHERE id = ?').bind(claims.sub).first();
  if (!user) return json({ error: 'User not found' }, 404);

  const currentHash = await hashPassword(currentPassword);
  if (currentHash !== user.password_hash) return json({ error: 'Current password is incorrect' }, 403);

  const newHash = await hashPassword(newPassword);
  await env.DB.prepare('UPDATE users SET password_hash = ? WHERE id = ?').bind(newHash, claims.sub).run();

  return json({ ok: true, message: 'Password changed successfully' });
};

// ── Update Profile (name/email) ──
const handleUpdateProfile: Handler = async (request, env) => {
  const authErr = await requireAuth(request, env);
  if (authErr) return authErr;

  const token = isAuthed(request)!;
  const claims = parseToken(token);
  if (!claims) return json({ error: 'Invalid token' }, 401);

  const { name, email } = await request.json() as { name?: string; email?: string };

  if (email && email !== claims.email) {
    const existing = await env.DB.prepare('SELECT id FROM users WHERE email = ? AND id != ?').bind(email, claims.sub).first();
    if (existing) return json({ error: 'Email already in use' }, 409);
  }

  const updates: string[] = [];
  const binds: any[] = [];
  if (name !== undefined) { updates.push('name = ?'); binds.push(name); }
  if (email !== undefined) { updates.push('email = ?'); binds.push(email); }

  if (updates.length === 0) return json({ error: 'No fields to update' }, 400);

  binds.push(claims.sub);
  await env.DB.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).bind(...binds).run();

  const updatedUser = await env.DB.prepare('SELECT id, email, name, role, admin_request_status, created_at FROM users WHERE id = ?').bind(claims.sub).first();

  // Issue fresh token with updated claims
  const newToken = await createToken(env.JWT_SECRET, {
    sub: updatedUser!.id as string,
    email: updatedUser!.email as string,
    role: updatedUser!.role as string,
    name: updatedUser!.name as string,
  });

  return json({ token: newToken, user: updatedUser });
};

// ── Request Admin Role ──
const handleRequestAdmin: Handler = async (request, env) => {
  const authErr = await requireAuth(request, env);
  if (authErr) return authErr;

  const token = isAuthed(request)!;
  const claims = parseToken(token);
  if (!claims) return json({ error: 'Invalid token' }, 401);

  if (claims.role === 'admin' || claims.role === 'owner') {
    return json({ error: 'You already have admin access' }, 400);
  }

  const user = await env.DB.prepare('SELECT id, admin_request_status FROM users WHERE id = ?').bind(claims.sub).first();
  if (!user) return json({ error: 'User not found' }, 404);
  if (user.admin_request_status === 'pending') return json({ error: 'Admin request already pending' }, 400);

  await env.DB.prepare(
    "UPDATE users SET admin_request_status = 'pending', admin_requested_at = datetime('now') WHERE id = ?"
  ).bind(claims.sub).run();

  return json({ ok: true, message: 'Admin access requested. An administrator will review your request.' });
};

// ── List All Users (admin/owner) ──
const handleListUsers: Handler = async (request, env) => {
  const authErr = await requireAdmin(request, env);
  if (authErr) return authErr;

  const users = await env.DB.prepare(
    'SELECT id, email, name, role, admin_request_status, admin_requested_at, created_at FROM users ORDER BY created_at DESC'
  ).all();

  return json(users.results);
};

// ── Approve/Deny Admin Request (owner only) ──
const handleUpdateUserRole: Handler = async (request, env, params) => {
  const authErr = await requireOwner(request, env);
  if (authErr) return authErr;

  const userId = params.id;
  const { role, admin_request_status } = await request.json() as { role?: string; admin_request_status?: string };

  const user = await env.DB.prepare('SELECT id, role FROM users WHERE id = ?').bind(userId).first();
  if (!user) return json({ error: 'User not found' }, 404);

  // Prevent changing owner role
  if (user.role === 'owner') return json({ error: 'Cannot modify owner account' }, 403);

  const updates: string[] = [];
  const binds: any[] = [];

  if (role && ['user', 'admin'].includes(role)) {
    updates.push('role = ?');
    binds.push(role);
  }
  if (admin_request_status && ['none', 'approved', 'denied'].includes(admin_request_status)) {
    updates.push('admin_request_status = ?');
    binds.push(admin_request_status);
  }

  if (updates.length === 0) return json({ error: 'No valid updates' }, 400);

  binds.push(userId);
  await env.DB.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).bind(...binds).run();

  const updated = await env.DB.prepare(
    'SELECT id, email, name, role, admin_request_status, admin_requested_at, created_at FROM users WHERE id = ?'
  ).bind(userId).first();

  return json(updated);
};

// ── Delete User (owner only) ──
const handleDeleteUser: Handler = async (request, env, params) => {
  const authErr = await requireOwner(request, env);
  if (authErr) return authErr;

  const userId = params.id;
  const user = await env.DB.prepare('SELECT id, role FROM users WHERE id = ?').bind(userId).first();
  if (!user) return json({ error: 'User not found' }, 404);
  if (user.role === 'owner') return json({ error: 'Cannot delete owner account' }, 403);

  await env.DB.prepare('DELETE FROM users WHERE id = ?').bind(userId).run();
  return json({ ok: true });
};

// ── Generate Password Reset Token (admin/owner) ──
const handleCreateResetToken: Handler = async (request, env) => {
  const authErr = await requireAdmin(request, env);
  if (authErr) return authErr;

  const { userId } = await request.json() as { userId?: string };
  if (!userId) return json({ error: 'userId required' }, 400);

  const user = await env.DB.prepare('SELECT id, email, name FROM users WHERE id = ?').bind(userId).first();
  if (!user) return json({ error: 'User not found' }, 404);

  // Generate a random reset token
  const resetToken = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
  const id = crypto.randomUUID().replace(/-/g, '').slice(0, 32);

  // Expires in 24 hours
  await env.DB.prepare(
    "INSERT INTO password_reset_tokens (id, user_id, token, expires_at) VALUES (?, ?, ?, datetime('now', '+24 hours'))"
  ).bind(id, userId, resetToken).run();

  return json({ token: resetToken, user: { id: user.id, email: user.email, name: user.name } });
};

// ── Reset Password with Token (public) ──
const handleResetPassword: Handler = async (request, env) => {
  const { token, newPassword } = await request.json() as { token?: string; newPassword?: string };
  if (!token || !newPassword) return json({ error: 'Token and new password required' }, 400);
  if (newPassword.length < 6) return json({ error: 'Password must be at least 6 characters' }, 400);

  const resetRecord = await env.DB.prepare(
    "SELECT * FROM password_reset_tokens WHERE token = ? AND used = 0 AND expires_at > datetime('now')"
  ).bind(token).first();

  if (!resetRecord) return json({ error: 'Invalid or expired reset token' }, 400);

  const newHash = await hashPassword(newPassword);
  await env.DB.batch([
    env.DB.prepare('UPDATE users SET password_hash = ? WHERE id = ?').bind(newHash, resetRecord.user_id),
    env.DB.prepare('UPDATE password_reset_tokens SET used = 1 WHERE id = ?').bind(resetRecord.id),
  ]);

  return json({ ok: true, message: 'Password has been reset successfully. You can now sign in.' });
};

const handleGetProducts: Handler = async (request, env) => {
  const authErr = await requireAdmin(request, env);
  if (authErr) return authErr;

  // Batch rates + products in a single D1 round-trip
  const [ratesResult, result] = await env.DB.batch([
    env.DB.prepare('SELECT currency, rate_to_usd FROM exchange_rates'),
    env.DB.prepare('SELECT * FROM products ORDER BY created_at DESC'),
  ]);
  const rates = new Map<string, number>();
  for (const r of ratesResult.results) {
    rates.set(r.currency as string, r.rate_to_usd as number);
  }

  const products = result.results.map(p => {
    // Parse JSON array fields
    if (typeof p.tasting_notes === 'string') {
      try { p.tasting_notes = JSON.parse(p.tasting_notes); } catch { p.tasting_notes = []; }
    }
    if (typeof p.additional_images === 'string') {
      try { p.additional_images = JSON.parse(p.additional_images); } catch { p.additional_images = []; }
    }
    if (typeof p.tasting === 'string') {
      try { p.tasting = JSON.parse(p.tasting); } catch { p.tasting = {}; }
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
  'image_url', 'additional_images', 'status', 'is_personal', 'can_reorder', 'is_featured', 'is_curated',
  'lore', 'show_wisdom', 'processing_notes', 'terroir', 'mood', 'experience',
  'material', 'capacity_ml', 'teaware_category', 'quantity_units', 'tasting',
] as const;

const handleGetPublicProducts: Handler = async (_request, env) => {
  // Batch rates + products in a single D1 round-trip; select only needed columns
  const [ratesResult, result] = await env.DB.batch([
    env.DB.prepare('SELECT currency, rate_to_usd FROM exchange_rates'),
    env.DB.prepare(
      `SELECT id, type, given_name, chinese_name, product_name, year,
              origin_country, origin_region, stock_grams, description,
              tasting_notes, image_url, additional_images, status,
              is_personal, can_reorder, is_featured, is_curated, lore, show_wisdom,
              processing_notes, terroir, mood, experience,
              cost_amount, cost_currency, quantity_purchased,
              shipping_rate_per_kg, fixed_retail_price_usd,
              material, capacity_ml, teaware_category, quantity_units, tasting
       FROM products
       WHERE is_public = 1 AND status = 'Active'
       ORDER BY created_at DESC`
    ),
  ]);
  const rates = new Map<string, number>();
  for (const r of ratesResult.results) {
    rates.set(r.currency as string, r.rate_to_usd as number);
  }

  const products = result.results.map(p => {
    if (typeof p.tasting_notes === 'string') {
      try { p.tasting_notes = JSON.parse(p.tasting_notes); } catch { p.tasting_notes = []; }
    }
    if (typeof p.additional_images === 'string') {
      try { p.additional_images = JSON.parse(p.additional_images); } catch { p.additional_images = []; }
    }
    if (typeof p.tasting === 'string') {
      try { p.tasting = JSON.parse(p.tasting); } catch { p.tasting = {}; }
    }
    const withPricing = addPricingFields(p, rates);
    // Strip sensitive fields — only return whitelisted public fields
    const safe: Record<string, unknown> = {};
    for (const key of PUBLIC_FIELDS) {
      if (key in withPricing) safe[key] = withPricing[key];
    }
    return safe;
  });
  return cachedJson(products, 60);
};

// ── Auto-resolve vendor name → vendor_id (find-or-create customer) ──
async function resolveVendorId(env: Env, vendorName: string | null | undefined, originCountry?: string): Promise<string | null> {
  if (!vendorName || !vendorName.trim()) return null;
  const name = vendorName.trim();
  const key = name.toLowerCase();

  // Check if a customer with this name already exists
  const existing = await env.DB.prepare(
    'SELECT id, tags FROM customers WHERE LOWER(name) = ?'
  ).bind(key).first();

  if (existing) {
    // Ensure the vendor tag is present
    let tags: string[] = [];
    try { tags = JSON.parse(existing.tags as string || '[]'); } catch { tags = []; }
    if (!tags.includes('vendor')) {
      tags.push('vendor');
      await env.DB.prepare("UPDATE customers SET tags = ?, updated_at = datetime('now') WHERE id = ?")
        .bind(JSON.stringify(tags), existing.id).run();
    }
    return existing.id as string;
  }

  // Create new customer tagged as vendor
  const id = crypto.randomUUID();
  await env.DB.prepare(
    `INSERT INTO customers (id, name, country, tags, source, created_at, updated_at)
     VALUES (?, ?, ?, '["vendor"]', 'auto-linked from inventory', datetime('now'), datetime('now'))`
  ).bind(id, name, originCountry || null).run();

  return id;
}

const handleCreateProduct: Handler = async (request, env) => {
  const authErr = await requireAdmin(request, env);
  if (authErr) return authErr;

  const body = await request.json() as Record<string, any>;
  // Set quantity_purchased: use quantity_units for teaware, stock_grams for tea
  if (body.quantity_purchased == null) {
    body.quantity_purchased = body.type === 'Teaware'
      ? (body.quantity_units || 1)
      : (body.stock_grams || 0);
  }
  // Convert tasting_notes array to JSON string
  if (Array.isArray(body.tasting_notes)) body.tasting_notes = JSON.stringify(body.tasting_notes);
  if (Array.isArray(body.additional_images)) body.additional_images = JSON.stringify(body.additional_images);
  if (body.tasting && typeof body.tasting === 'object') body.tasting = JSON.stringify(body.tasting);
  // Convert booleans to integers for SQLite
  for (const key of ['is_personal', 'can_reorder', 'is_public', 'is_featured', 'is_curated', 'is_custom_wisdom', 'show_wisdom', 'is_sample']) {
    if (body[key] !== undefined) body[key] = body[key] ? 1 : 0;
  }

  // Auto-resolve vendor → vendor_id
  if (body.vendor && !body.vendor_id) {
    body.vendor_id = await resolveVendorId(env, body.vendor, body.origin_country);
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

  // Pre-resolve all vendor names to vendor_ids (batch for efficiency)
  const vendorCache: Record<string, string> = {};
  for (const raw of products) {
    if (raw.vendor && !raw.vendor_id) {
      const key = (raw.vendor as string).trim().toLowerCase();
      if (!vendorCache[key]) {
        const vid = await resolveVendorId(env, raw.vendor as string, raw.origin_country as string);
        if (vid) vendorCache[key] = vid;
      }
    }
  }

  const stmts = products.map(raw => {
    // Strip null/undefined/empty-string keys so we only INSERT columns with actual values
    const body: Record<string, any> = {};
    for (const [k, v] of Object.entries(raw)) {
      if (v !== null && v !== undefined && v !== '') body[k] = v;
    }

    if (body.quantity_purchased == null) {
      body.quantity_purchased = body.type === 'Teaware'
        ? (body.quantity_units || 1)
        : (body.stock_grams || 0);
    }
    if (Array.isArray(body.tasting_notes)) body.tasting_notes = JSON.stringify(body.tasting_notes);
    if (Array.isArray(body.additional_images)) body.additional_images = JSON.stringify(body.additional_images);
    if (body.tasting && typeof body.tasting === 'object') body.tasting = JSON.stringify(body.tasting);
    for (const key of ['is_personal', 'can_reorder', 'is_public', 'is_featured', 'is_curated', 'is_custom_wisdom', 'show_wisdom', 'is_sample']) {
      if (body[key] !== undefined) body[key] = body[key] ? 1 : 0;
    }
    // Apply cached vendor_id
    if (body.vendor && !body.vendor_id) {
      const key = (body.vendor as string).trim().toLowerCase();
      if (vendorCache[key]) body.vendor_id = vendorCache[key];
    }
    const id = crypto.randomUUID();
    const cols = Object.keys(body);
    const placeholders = cols.map(() => '?').join(', ');
    return env.DB.prepare(`INSERT INTO products (id, ${cols.join(', ')}) VALUES (?, ${placeholders})`)
      .bind(id, ...cols.map(c => body[c] ?? null));
  });

  for (let i = 0; i < stmts.length; i += 100) {
    await env.DB.batch(stmts.slice(i, i + 100));
  }

  return json({ inserted: stmts.length });
};

const handleUpdateProduct: Handler = async (request, env, params) => {
  const authErr = await requireAdmin(request, env);
  if (authErr) return authErr;

  const userEmail = getUserEmail(request);
  const body = await request.json() as Record<string, any>;
  if (Array.isArray(body.tasting_notes)) body.tasting_notes = JSON.stringify(body.tasting_notes);
  if (Array.isArray(body.additional_images)) body.additional_images = JSON.stringify(body.additional_images);
  if (body.tasting && typeof body.tasting === 'object') body.tasting = JSON.stringify(body.tasting);
  for (const key of ['is_personal', 'can_reorder', 'is_public', 'is_featured', 'is_curated', 'is_custom_wisdom', 'show_wisdom', 'is_sample']) {
    if (body[key] !== undefined) body[key] = body[key] ? 1 : 0;
  }

  // Auto-resolve vendor → vendor_id
  if (body.vendor !== undefined && !body.vendor_id) {
    body.vendor_id = await resolveVendorId(env, body.vendor, body.origin_country);
  }

  // Stock change logging
  const extraStmts: D1PreparedStatement[] = [];
  if (body.stock_grams !== undefined) {
    const current = await env.DB.prepare('SELECT stock_grams, given_name, product_name FROM products WHERE id = ?').bind(params.id).first();
    if (current) {
      const oldStock = Number(current.stock_grams) || 0;
      const newStock = Number(body.stock_grams);
      const delta = newStock - oldStock;
      if (delta !== 0) {
        const name = current.given_name || current.product_name || params.id;
        extraStmts.push(buildStockLedgerEntry(env, params.id, delta, newStock, 'MANUAL_ADJUST', userEmail, null, null, `Manual: ${oldStock}→${newStock}`));
        extraStmts.push(buildActivityLog(env, 'STOCK_ADJUSTED', `${name}: ${oldStock}g → ${newStock}g (${delta > 0 ? '+' : ''}${delta}g)`, userEmail, 'product', params.id));
      }
    }
  }

  const cols = Object.keys(body);
  const sets = cols.map(c => `${c} = ?`).join(', ');
  const updateStmt = env.DB.prepare(`UPDATE products SET ${sets} WHERE id = ?`)
    .bind(...cols.map(c => body[c] ?? null), params.id);

  if (extraStmts.length > 0) {
    await env.DB.batch([updateStmt, ...extraStmts]);
  } else {
    await updateStmt.run();
  }

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
  return cachedJson(result.results, 3600);
};

// ── Invoices ──
const handleGetInvoices: Handler = async (request, env) => {
  const authErr = await requireAuth(request, env);
  if (authErr) return authErr;

  const url = new URL(request.url);
  const limit = parseInt(url.searchParams.get('limit') || '50');
  const offset = parseInt(url.searchParams.get('offset') || '0');
  const includeDeleted = url.searchParams.get('include_deleted') === '1';

  const whereClause = includeDeleted ? '' : 'WHERE deleted_at IS NULL';
  const result = await env.DB.prepare(
    `SELECT i.*, COALESCE(t.line_total, 0) as computed_total
     FROM invoices i
     LEFT JOIN (
       SELECT invoice_id, SUM(quantity * price_at_sale) as line_total
       FROM invoice_line_items GROUP BY invoice_id
     ) t ON t.invoice_id = i.id
     ${whereClause}
     ORDER BY i.created_at DESC LIMIT ? OFFSET ?`
  ).bind(limit, offset).all();
  return json(result.results);
};

const handleCreateInvoice: Handler = async (request, env) => {
  const authErr = await requireAuth(request, env);
  if (authErr) return authErr;

  const userEmail = getUserEmail(request);
  const body = await request.json() as { invoice: Record<string, any>; lineItems: Record<string, any>[] };
  const id = crypto.randomUUID();

  const invoiceStmt = env.DB.prepare(
    `INSERT INTO invoices (id, invoice_number, customer_name, customer_whatsapp, customer_id, display_currency, shipping_cost_usd, status, inventory_deducted, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id,
    body.invoice.invoice_number,
    body.invoice.customer_name,
    body.invoice.customer_whatsapp || null,
    body.invoice.customer_id || null,
    body.invoice.display_currency,
    body.invoice.shipping_cost_usd || 0,
    body.invoice.status || 'Pending',
    0,
    body.invoice.notes || null
  );

  const lineItemStmts = body.lineItems.map((item: Record<string, any>) =>
    env.DB.prepare(
      'INSERT INTO invoice_line_items (id, invoice_id, product_id, quantity, price_at_sale) VALUES (?, ?, ?, ?, ?)'
    ).bind(crypto.randomUUID(), id, item.product_id, item.quantity, item.price_at_sale)
  );

  const logStmt = buildActivityLog(
    env, 'INVOICE_CREATED',
    `Invoice ${body.invoice.invoice_number} created for ${body.invoice.customer_name} (${body.lineItems.length} items)`,
    userEmail, 'invoice', id
  );

  await env.DB.batch([invoiceStmt, ...lineItemStmts, logStmt]);

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

  const userEmail = getUserEmail(request);
  const invoice = await env.DB.prepare('SELECT * FROM invoices WHERE id = ?').bind(params.id).first();
  if (!invoice) return json({ error: 'Invoice not found' }, 404);
  if (invoice.status !== 'Void') return json({ error: 'Only Void invoices can be deleted' }, 400);

  await env.DB.batch([
    env.DB.prepare("UPDATE invoices SET deleted_at = datetime('now') WHERE id = ?").bind(params.id),
    buildActivityLog(env, 'INVOICE_DELETED', `Invoice ${invoice.invoice_number} soft-deleted`, userEmail, 'invoice', params.id),
  ]);
  return json({ success: true });
};

// ── RPC: Fulfill Invoice ──
const handleFulfillInvoice: Handler = async (request, env) => {
  const authErr = await requireAdmin(request, env);
  if (authErr) return authErr;

  const userEmail = getUserEmail(request);
  const { invoice_id } = await request.json() as { invoice_id: string };

  const invoice = await env.DB.prepare('SELECT * FROM invoices WHERE id = ?').bind(invoice_id).first();
  if (!invoice) return json({ error: 'Invoice not found' }, 404);
  if (invoice.inventory_deducted) return json({ error: 'Inventory already deducted' }, 400);

  const items = await env.DB.prepare('SELECT * FROM invoice_line_items WHERE invoice_id = ?').bind(invoice_id).all();

  // Fetch current stock for all affected products
  const productIds = items.results.map(i => i.product_id);
  const products = new Map<string, any>();
  for (const pid of productIds) {
    const p = await env.DB.prepare('SELECT id, stock_grams, given_name, product_name, status FROM products WHERE id = ?').bind(pid).first();
    if (p) products.set(pid as string, p);
  }

  const stmts: D1PreparedStatement[] = [];

  // Stock deductions + ledger entries
  for (const item of items.results) {
    const product = products.get(item.product_id as string);
    const currentStock = product ? Number(product.stock_grams) || 0 : 0;
    const qty = Number(item.quantity) || 0;
    const newBalance = currentStock - qty;

    stmts.push(
      env.DB.prepare('UPDATE products SET stock_grams = stock_grams - ? WHERE id = ?').bind(qty, item.product_id)
    );
    stmts.push(buildStockLedgerEntry(
      env, item.product_id as string, -qty, newBalance, 'FULFILLMENT',
      userEmail, invoice_id, invoice.invoice_number as string
    ));

    // Auto-archive if stock hits zero
    if (newBalance <= 0 && product && product.status !== 'Sold Out') {
      stmts.push(
        env.DB.prepare("UPDATE products SET status = 'Sold Out', sold_out_at = datetime('now') WHERE id = ?").bind(item.product_id)
      );
      stmts.push(buildActivityLog(
        env, 'PRODUCT_SOLD_OUT',
        `${product.given_name || product.product_name} auto-archived (stock reached ${newBalance}g after fulfillment of ${invoice.invoice_number})`,
        userEmail, 'product', item.product_id as string
      ));
    }
  }

  // Update invoice status
  stmts.push(
    env.DB.prepare("UPDATE invoices SET status = 'Filled', inventory_deducted = 1 WHERE id = ?").bind(invoice_id)
  );

  // Activity log
  stmts.push(buildActivityLog(
    env, 'FULFILLMENT',
    `Order ${invoice.invoice_number} marked as filled. Inventory deducted for ${items.results.length} item(s).`,
    userEmail, 'invoice', invoice_id
  ));

  await env.DB.batch(stmts);

  return json({ success: true });
};

// ── RPC: Increment Stock (for void restore — legacy, kept for backwards compat) ──
const handleIncrementStock: Handler = async (request, env) => {
  const authErr = await requireAdmin(request, env);
  if (authErr) return authErr;

  const { product_id, amount } = await request.json() as { product_id: string; amount: number };
  await env.DB.prepare('UPDATE products SET stock_grams = stock_grams + ? WHERE id = ?')
    .bind(amount, product_id).run();
  return json({ success: true });
};

// ── RPC: Void Invoice (atomic server-side) ──
const handleVoidInvoice: Handler = async (request, env) => {
  const authErr = await requireAdmin(request, env);
  if (authErr) return authErr;

  const userEmail = getUserEmail(request);
  const { invoice_id } = await request.json() as { invoice_id: string };

  const invoice = await env.DB.prepare('SELECT * FROM invoices WHERE id = ?').bind(invoice_id).first();
  if (!invoice) return json({ error: 'Invoice not found' }, 404);
  if (invoice.status === 'Void') return json({ error: 'Invoice is already voided' }, 400);

  const stmts: D1PreparedStatement[] = [];

  if (invoice.inventory_deducted) {
    const items = await env.DB.prepare('SELECT * FROM invoice_line_items WHERE invoice_id = ?').bind(invoice_id).all();

    for (const item of items.results) {
      const product = await env.DB.prepare('SELECT id, stock_grams, given_name, product_name, status FROM products WHERE id = ?')
        .bind(item.product_id).first();
      const currentStock = product ? Number(product.stock_grams) || 0 : 0;
      const qty = Number(item.quantity) || 0;
      const newBalance = currentStock + qty;

      stmts.push(
        env.DB.prepare('UPDATE products SET stock_grams = stock_grams + ? WHERE id = ?').bind(qty, item.product_id)
      );
      stmts.push(buildStockLedgerEntry(
        env, item.product_id as string, qty, newBalance, 'VOID',
        userEmail, invoice_id, invoice.invoice_number as string
      ));

      // If product was Sold Out and now has stock, reactivate
      if (product && product.status === 'Sold Out' && newBalance > 0) {
        stmts.push(
          env.DB.prepare("UPDATE products SET status = 'Active', sold_out_at = NULL WHERE id = ?").bind(item.product_id)
        );
      }
    }
  }

  stmts.push(
    env.DB.prepare("UPDATE invoices SET status = 'Void', inventory_deducted = 0 WHERE id = ?").bind(invoice_id)
  );
  stmts.push(buildActivityLog(
    env, 'INVOICE_VOIDED',
    `Invoice ${invoice.invoice_number} voided.${invoice.inventory_deducted ? ' Stock restored.' : ''}`,
    userEmail, 'invoice', invoice_id
  ));

  await env.DB.batch(stmts);
  return json({ success: true });
};

// ── RPC: Split Invoice ──
const handleSplitInvoice: Handler = async (request, env) => {
  const authErr = await requireAdmin(request, env);
  if (authErr) return authErr;

  const userEmail = getUserEmail(request);
  const { invoice_id, line_item_ids } = await request.json() as { invoice_id: string; line_item_ids: string[] };

  const invoice = await env.DB.prepare('SELECT * FROM invoices WHERE id = ?').bind(invoice_id).first();
  if (!invoice) return json({ error: 'Invoice not found' }, 404);
  if (invoice.status !== 'Pending') return json({ error: 'Only Pending invoices can be split' }, 400);

  const allItems = await env.DB.prepare('SELECT * FROM invoice_line_items WHERE invoice_id = ?').bind(invoice_id).all();
  if (line_item_ids.length === 0 || line_item_ids.length >= allItems.results.length) {
    return json({ error: 'Must select a proper subset of items to split' }, 400);
  }

  const newId = crypto.randomUUID();
  const year = new Date().getFullYear();
  const newNumber = `INV-${year}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;

  const stmts: D1PreparedStatement[] = [];

  // Create new invoice with same customer info
  stmts.push(env.DB.prepare(
    `INSERT INTO invoices (id, invoice_number, customer_name, customer_whatsapp, customer_id, display_currency, shipping_cost_usd, status, inventory_deducted, notes)
     VALUES (?, ?, ?, ?, ?, ?, 0, 'Pending', 0, ?)`
  ).bind(newId, newNumber, invoice.customer_name, invoice.customer_whatsapp, invoice.customer_id, invoice.display_currency, invoice.notes));

  // Move selected line items to new invoice
  for (const itemId of line_item_ids) {
    stmts.push(env.DB.prepare('UPDATE invoice_line_items SET invoice_id = ? WHERE id = ?').bind(newId, itemId));
  }

  stmts.push(buildActivityLog(env, 'INVOICE_SPLIT',
    `Invoice ${invoice.invoice_number} split. ${line_item_ids.length} item(s) moved to ${newNumber}.`,
    userEmail, 'invoice', invoice_id));
  stmts.push(buildActivityLog(env, 'INVOICE_SPLIT',
    `Invoice ${newNumber} created from split of ${invoice.invoice_number}.`,
    userEmail, 'invoice', newId));

  await env.DB.batch(stmts);
  return json({ original_id: invoice_id, new_id: newId, new_invoice_number: newNumber }, 201);
};

// ── Update Invoice Items (edit pending order) ──
const handleUpdateInvoiceItems: Handler = async (request, env, params) => {
  const authErr = await requireAdmin(request, env);
  if (authErr) return authErr;

  const userEmail = getUserEmail(request);
  const invoice = await env.DB.prepare('SELECT * FROM invoices WHERE id = ?').bind(params.id).first();
  if (!invoice) return json({ error: 'Invoice not found' }, 404);
  if (invoice.status !== 'Pending') return json({ error: 'Only Pending invoices can be edited' }, 400);

  const body = await request.json() as {
    lineItems?: { product_id: string; quantity: number; price_at_sale: number }[];
    shipping_cost_usd?: number;
    customer_name?: string;
    customer_id?: string;
    display_currency?: string;
    notes?: string;
  };

  const stmts: D1PreparedStatement[] = [];

  // Update line items if provided
  if (body.lineItems) {
    stmts.push(env.DB.prepare('DELETE FROM invoice_line_items WHERE invoice_id = ?').bind(params.id));
    for (const item of body.lineItems) {
      stmts.push(env.DB.prepare(
        'INSERT INTO invoice_line_items (id, invoice_id, product_id, quantity, price_at_sale) VALUES (?, ?, ?, ?, ?)'
      ).bind(crypto.randomUUID(), params.id, item.product_id, item.quantity, item.price_at_sale));
    }
  }

  // Update header fields
  const updates: string[] = [];
  const vals: any[] = [];
  for (const [key, val] of Object.entries(body)) {
    if (key === 'lineItems') continue;
    updates.push(`${key} = ?`);
    vals.push(val ?? null);
  }
  if (updates.length > 0) {
    stmts.push(env.DB.prepare(`UPDATE invoices SET ${updates.join(', ')} WHERE id = ?`).bind(...vals, params.id));
  }

  stmts.push(buildActivityLog(env, 'INVOICE_EDITED',
    `Invoice ${invoice.invoice_number} edited.${body.lineItems ? ` ${body.lineItems.length} line items.` : ''}`,
    userEmail, 'invoice', params.id));

  await env.DB.batch(stmts);
  return json({ success: true });
};

// ── Stock Ledger ──
const handleGetStockLedger: Handler = async (request, env) => {
  const authErr = await requireAuth(request, env);
  if (authErr) return authErr;

  const url = new URL(request.url);
  const productId = url.searchParams.get('product_id');
  const limit = parseInt(url.searchParams.get('limit') || '50');
  const offset = parseInt(url.searchParams.get('offset') || '0');

  if (productId) {
    const result = await env.DB.prepare(
      `SELECT sl.*, p.given_name, p.product_name
       FROM stock_ledger sl
       LEFT JOIN products p ON sl.product_id = p.id
       WHERE sl.product_id = ?
       ORDER BY sl.created_at DESC LIMIT ? OFFSET ?`
    ).bind(productId, limit, offset).all();
    return json(result.results);
  }

  // Global stock ledger (all products)
  const result = await env.DB.prepare(
    `SELECT sl.*, p.given_name, p.product_name
     FROM stock_ledger sl
     LEFT JOIN products p ON sl.product_id = p.id
     ORDER BY sl.created_at DESC LIMIT ? OFFSET ?`
  ).bind(limit, offset).all();
  return json(result.results);
};

// ── RPC: Reset Stock Verification ──
const handleResetStockVerification: Handler = async (request, env) => {
  const authErr = await requireAdmin(request, env);
  if (authErr) return authErr;

  await env.DB.prepare('UPDATE products SET stock_verified_at = NULL').run();
  return json({ success: true });
};

// ── RPC: Truncate All Data ──
const handleTruncateAll: Handler = async (request, env) => {
  const authErr = await requireAdmin(request, env);
  if (authErr) return authErr;

  await env.DB.batch([
    env.DB.prepare('DELETE FROM invoice_line_items'),
    env.DB.prepare('DELETE FROM invoices'),
    env.DB.prepare('DELETE FROM products'),
    env.DB.prepare('DELETE FROM activity_logs'),
  ]);
  return json({ success: true });
};

// ── Customers ──
const handleGetCustomers: Handler = async (request, env) => {
  const authErr = await requireAdmin(request, env);
  if (authErr) return authErr;

  // Join with invoices to get order stats (fallback if customer_id column missing)
  let result;
  try {
    result = await env.DB.prepare(`
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
  } catch {
    // Fallback: customer_id column may not exist yet
    result = await env.DB.prepare(`
      SELECT c.*, 0 as order_count, 0 as total_spent_usd, NULL as last_order_date
      FROM customers c
      ORDER BY c.created_at DESC
    `).all();
  }

  return json(result.results);
};

const handleGetCustomer: Handler = async (request, env, params) => {
  const authErr = await requireAdmin(request, env);
  if (authErr) return authErr;

  const customer = await env.DB.prepare('SELECT * FROM customers WHERE id = ?').bind(params.id).first();
  if (!customer) return json({ error: 'Customer not found' }, 404);

  // Get their orders
  let orders: any[] = [];
  try {
    const result = await env.DB.prepare(
      'SELECT * FROM invoices WHERE customer_id = ? ORDER BY created_at DESC'
    ).bind(params.id).all();
    orders = result.results;
  } catch { /* customer_id column may not exist yet */ }

  return json({ ...customer, orders });
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
  try {
    await env.DB.prepare('UPDATE invoices SET customer_id = NULL WHERE customer_id = ?').bind(params.id).run();
  } catch { /* customer_id column may not exist yet */ }
  await env.DB.prepare('DELETE FROM customers WHERE id = ?').bind(params.id).run();
  return json({ success: true });
};

const handleGetCustomerOrders: Handler = async (request, env, params) => {
  const authErr = await requireAdmin(request, env);
  if (authErr) return authErr;

  try {
    const orders = await env.DB.prepare(
      'SELECT * FROM invoices WHERE customer_id = ? ORDER BY created_at DESC'
    ).bind(params.id).all();
    return json(orders.results);
  } catch {
    return json([]);
  }
};

const handleGetCustomerTeas: Handler = async (request, env, params) => {
  const authErr = await requireAdmin(request, env);
  if (authErr) return authErr;

  // Get all teas this customer has purchased, with quantities and dates
  try {
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
  } catch {
    return json([]);
  }
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

  const updates: D1PreparedStatement[] = [];
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
      updates.push(
        env.DB.prepare('UPDATE invoices SET customer_id = ? WHERE id = ?')
          .bind(match.id, inv.id)
      );
    }
  }

  if (updates.length > 0) {
    for (let i = 0; i < updates.length; i += 100) {
      await env.DB.batch(updates.slice(i, i + 100));
    }
  }

  return json({ linked: updates.length, total_unlinked: unlinked.results.length });
};

// ── Auto-link vendors: create customer records from product vendor field ──
const handleAutoLinkVendors: Handler = async (request, env) => {
  const authErr = await requireAdmin(request, env);
  if (authErr) return authErr;

  // Get all distinct vendor names from products that have a vendor but no vendor_id
  const productsWithVendor = await env.DB.prepare(
    `SELECT id, vendor, origin_country FROM products WHERE vendor IS NOT NULL AND vendor != '' AND (vendor_id IS NULL OR vendor_id = '')`
  ).all();

  if (productsWithVendor.results.length === 0) {
    return json({ created: 0, linked: 0, message: 'All products are already linked to vendor records.' });
  }

  // Group products by vendor name (case-insensitive)
  const vendorGroups: Record<string, { normalizedName: string; originalName: string; country: string; productIds: string[] }> = {};
  for (const p of productsWithVendor.results) {
    const vendorName = (p.vendor as string).trim();
    const key = vendorName.toLowerCase();
    if (!vendorGroups[key]) {
      vendorGroups[key] = {
        normalizedName: key,
        originalName: vendorName,
        country: (p.origin_country as string) || '',
        productIds: [],
      };
    }
    vendorGroups[key].productIds.push(p.id as string);
  }

  // Get existing customers to avoid duplicates
  const existingCustomers = await env.DB.prepare('SELECT id, name, tags FROM customers').all();
  const existingByName: Record<string, { id: string; tags: string }> = {};
  for (const c of existingCustomers.results) {
    existingByName[(c.name as string).toLowerCase().trim()] = { id: c.id as string, tags: c.tags as string };
  }

  let created = 0;
  let linked = 0;
  const linkUpdates: D1PreparedStatement[] = [];

  for (const key of Object.keys(vendorGroups)) {
    const group = vendorGroups[key];
    let customerId: string;

    if (existingByName[key]) {
      // Customer already exists — ensure they have the 'vendor' tag
      customerId = existingByName[key].id;
      let tags: string[] = [];
      try { tags = JSON.parse(existingByName[key].tags || '[]'); } catch { tags = []; }
      if (!tags.includes('vendor')) {
        tags.push('vendor');
        await env.DB.prepare('UPDATE customers SET tags = ?, updated_at = datetime(\'now\') WHERE id = ?')
          .bind(JSON.stringify(tags), customerId).run();
      }
    } else {
      // Create new customer record tagged as vendor
      customerId = crypto.randomUUID();
      await env.DB.prepare(
        `INSERT INTO customers (id, name, country, tags, source, created_at, updated_at)
         VALUES (?, ?, ?, '["vendor"]', 'auto-linked from inventory', datetime('now'), datetime('now'))`
      ).bind(customerId, group.originalName, group.country || null).run();
      created++;
    }

    // Link all products from this vendor
    for (const pid of group.productIds) {
      linkUpdates.push(
        env.DB.prepare('UPDATE products SET vendor_id = ? WHERE id = ?')
          .bind(customerId, pid)
      );
      linked++;
    }
  }

  // Batch the product updates
  if (linkUpdates.length > 0) {
    for (let i = 0; i < linkUpdates.length; i += 100) {
      await env.DB.batch(linkUpdates.slice(i, i + 100));
    }
  }

  return json({ created, linked, vendors: Object.keys(vendorGroups).length });
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
            lore: { type: 'string', description: 'Historical and geographical lore about the tea, written as 2-3 short paragraphs separated by newlines (\\n\\n). Each paragraph should be 1-2 sentences. Cover origin story, terroir significance, and cultural context. Write in an evocative but grounded style.' },
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

// ── Migrate Tasting Data (AI-assisted) ──
const TASTING_TAXONOMY_TERMS = `Flavor: floral, orchid, jasmine, osmanthus, rose, honeysuckle, honey, caramel, brown-sugar, vanilla, stone-fruit, peach, apricot, lychee, dried-fruit, citrus, plum, chestnut, almond, toasted-rice, roasted-grain, charcoal, toasted, cocoa, dark-chocolate, baked, camphor, sandalwood, cedar, pine, woody, earthy, mushroom, leather, smoky, mineral, stony, iron, slate, fresh-grass, herbaceous, seaweed, vegetal, bitter, astringent, savory, umami, medicinal, aged, hay
Body: light, medium, full, silky, smooth, crisp, oily, dry
Finish: finish-short, finish-medium, finish-long, lingering, hui-gan, sweet-return, finish-clean, finish-dry, finish-cooling, finish-warming, throat-opening, throat-depth, coating, expanding
Feeling: calming, grounding, settling, contemplative, energizing, uplifting, clearing, focusing, feeling-warming, feeling-cooling, softening, nourishing, expansive, opening
Liquor color: pale-gold, gold, amber, honey-color, copper, orange, reddish-brown, deep-brown, dark-chestnut, ink
Brewing: high-temp, medium-temp, low-temp, short-steeps, patient-steeps, flash-steeps, many-infusions, few-infusions, gaiwan, yixing, porcelain, glass, opens-slowly, peaks-mid-session`;

const handleMigrateTasting: Handler = async (request, env) => {
  const authErr = await requireAdmin(request, env);
  if (authErr) return authErr;

  if (!env.ANTHROPIC_API_KEY) {
    return json({ error: 'ANTHROPIC_API_KEY not configured' }, 503);
  }

  // Fetch all products that have legacy tasting data but no structured tasting
  const result = await env.DB.prepare(
    `SELECT id, given_name, product_name, type, tasting_notes, mood, experience, description, terroir, processing_notes, tasting
     FROM products WHERE tasting IS NULL OR tasting = '{}' OR tasting = ''`
  ).all();

  const products = result.results;
  if (!products.length) {
    return json({ message: 'No products need migration', migrated: 0 });
  }

  const migrated: string[] = [];
  const errors: string[] = [];

  // Process in batches of 5 to avoid rate limits
  for (let i = 0; i < products.length; i += 5) {
    const batch = products.slice(i, i + 5);
    const promises = batch.map(async (p) => {
      const name = `${p.given_name || ''} ${p.product_name || ''}`.trim();
      const tastingNotes = typeof p.tasting_notes === 'string'
        ? (() => { try { return JSON.parse(p.tasting_notes as string); } catch { return []; } })()
        : (p.tasting_notes || []);

      if (!tastingNotes.length && !p.mood && !p.experience) {
        return; // Nothing to migrate
      }

      const prompt = `Map this tea's existing free-text data to structured taxonomy term IDs.

Tea: ${name} (${p.type})
Existing tasting notes: ${(tastingNotes as string[]).join(', ')}
Mood: ${p.mood || 'none'}
Experience: ${p.experience || 'none'}
Description: ${(p.description as string || '').slice(0, 200)}
Terroir: ${p.terroir || 'none'}
Processing: ${p.processing_notes || 'none'}

Available taxonomy term IDs:
${TASTING_TAXONOMY_TERMS}

Return arrays of matching term IDs for each category. Only include terms that are clearly supported by the data. Leave categories empty if no data supports them.`;

      try {
        const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'x-api-key': env.ANTHROPIC_API_KEY!,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            model: 'claude-sonnet-4-6',
            max_tokens: 512,
            messages: [{ role: 'user', content: prompt }],
            tools: [{
              name: 'map_tasting_data',
              description: 'Map free-text tea data to structured taxonomy term IDs.',
              input_schema: {
                type: 'object',
                properties: {
                  flavor: { type: 'array', items: { type: 'string' } },
                  body: { type: 'array', items: { type: 'string' } },
                  finish: { type: 'array', items: { type: 'string' } },
                  feeling: { type: 'array', items: { type: 'string' } },
                  'liquor-color': { type: 'array', items: { type: 'string' } },
                  brewing: { type: 'array', items: { type: 'string' } },
                },
                additionalProperties: false,
              },
            }],
            tool_choice: { type: 'tool', name: 'map_tasting_data' },
          }),
        });

        if (!claudeRes.ok) {
          errors.push(`${p.id}: Claude API ${claudeRes.status}`);
          return;
        }

        const claudeData = await claudeRes.json() as any;
        const toolUse = claudeData.content?.find((b: any) => b.type === 'tool_use');
        if (!toolUse?.input) {
          errors.push(`${p.id}: No structured output`);
          return;
        }

        // Clean: remove empty arrays
        const tasting: Record<string, string[]> = {};
        for (const [key, val] of Object.entries(toolUse.input)) {
          if (Array.isArray(val) && val.length > 0) {
            tasting[key] = val as string[];
          }
        }

        if (Object.keys(tasting).length > 0) {
          await env.DB.prepare('UPDATE products SET tasting = ? WHERE id = ?')
            .bind(JSON.stringify(tasting), p.id)
            .run();
          migrated.push(p.id as string);
        }
      } catch (err: any) {
        errors.push(`${p.id}: ${err.message}`);
      }
    });

    await Promise.all(promises);
  }

  return json({ migrated: migrated.length, errors, total: products.length });
};

// ── Activity Logs ──
const handleGetActivityLogs: Handler = async (request, env) => {
  const authErr = await requireAuth(request, env);
  if (authErr) return authErr;

  const url = new URL(request.url);
  const limit = parseInt(url.searchParams.get('limit') || '50');
  const offset = parseInt(url.searchParams.get('offset') || '0');
  const action = url.searchParams.get('action');
  const search = url.searchParams.get('search');
  const entityId = url.searchParams.get('entity_id');

  const conditions: string[] = [];
  const binds: any[] = [];

  if (action) { conditions.push('action = ?'); binds.push(action); }
  if (search) { conditions.push('details LIKE ?'); binds.push(`%${search}%`); }
  if (entityId) { conditions.push('entity_id = ?'); binds.push(entityId); }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const result = await env.DB.prepare(
    `SELECT * FROM activity_logs ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`
  ).bind(...binds, limit, offset).all();

  // Also return total count for pagination
  const countResult = await env.DB.prepare(
    `SELECT COUNT(*) as total FROM activity_logs ${where}`
  ).bind(...binds).first();

  return json({ logs: result.results, total: countResult?.total || 0 });
};

// ── Image Upload (R2) ──
const handleUploadImage: Handler = async (request, env) => {
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
  const key = `products/${crypto.randomUUID()}.${ext}`;

  await env.MEDIA_BUCKET.put(key, file.stream(), {
    httpMetadata: { contentType: file.type },
  });

  const publicUrl = `https://media.teajia.co/${key}`;

  return json({ url: publicUrl, key }, 201);
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

  return cachedJson({
    ...event,
    confirmed_count: confirmedCount,
    seats_remaining: (event.total_capacity as number) - confirmedCount,
  }, 30);
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

  return cachedJson({
    total_capacity: totalCapacity,
    confirmed_count: confirmedCount,
    seats_remaining: totalCapacity - confirmedCount,
    is_full: confirmedCount >= totalCapacity,
  }, 10);
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
       timezone, status, session_flow, playlist_url, location_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
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
    body.location_id || null
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

// ── Saved Locations ──
const handleGetSavedLocations: Handler = async (request, env) => {
  const authErr = await requireAdmin(request, env);
  if (authErr) return authErr;
  const result = await env.DB.prepare('SELECT * FROM saved_locations ORDER BY name ASC').all();
  return json(result.results);
};

const handleCreateSavedLocation: Handler = async (request, env) => {
  const authErr = await requireAdmin(request, env);
  if (authErr) return authErr;
  const body = await request.json() as Record<string, any>;
  if (!body.name || !body.address) return json({ error: 'name and address are required' }, 400);
  const id = crypto.randomUUID();
  await env.DB.prepare(
    `INSERT INTO saved_locations (id, name, address, map_link, guidelines, venue_guide) VALUES (?, ?, ?, ?, ?, ?)`
  ).bind(id, body.name, body.address, body.map_link || null, body.guidelines || null, body.venue_guide || null).run();
  return json({ id, name: body.name }, 201);
};

const handleUpdateSavedLocation: Handler = async (request, env, params) => {
  const authErr = await requireAdmin(request, env);
  if (authErr) return authErr;
  const body = await request.json() as Record<string, any>;
  const cols = Object.keys(body);
  if (cols.length === 0) return json({ error: 'No fields to update' }, 400);
  const sets = cols.map(c => `${c} = ?`).join(', ');
  await env.DB.prepare(`UPDATE saved_locations SET ${sets}, updated_at = datetime('now') WHERE id = ?`)
    .bind(...cols.map(c => body[c] ?? null), params.id).run();
  return json({ success: true });
};

const handleDeleteSavedLocation: Handler = async (request, env, params) => {
  const authErr = await requireAdmin(request, env);
  if (authErr) return authErr;
  await env.DB.prepare('DELETE FROM saved_locations WHERE id = ?').bind(params.id).run();
  return json({ success: true });
};

// ── Newsletter ──

const handleNewsletterSubscribe: Handler = async (request, env) => {
  const body = await request.json() as Record<string, any>;
  const email = (body.email || '').trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json({ error: 'Invalid email address' }, 400);
  }
  const source = typeof body.source === 'string' ? body.source.slice(0, 50) : 'website';
  await env.DB.prepare(
    'INSERT OR IGNORE INTO newsletter_subscribers (email, source) VALUES (?, ?)'
  ).bind(email, source).run();
  return json({ success: true });
};

const handleGetNewsletterSubscribers: Handler = async (request, env) => {
  const authErr = await requireAdmin(request, env);
  if (authErr) return authErr;
  const { results } = await env.DB.prepare(
    'SELECT id, email, subscribed_at, source FROM newsletter_subscribers ORDER BY subscribed_at DESC'
  ).all();
  return json({ subscribers: results });
};

// ── User Favorites ──
const handleGetUserFavorites: Handler = async (request, env) => {
  const authErr = await requireAuth(request, env);
  if (authErr) return authErr;
  const token = isAuthed(request)!;
  const claims = parseToken(token);
  if (!claims) return json({ error: 'Invalid token' }, 401);
  const userId = claims.sub;
  const { results } = await env.DB.prepare(
    'SELECT item_id FROM user_favorites WHERE user_id = ? ORDER BY created_at ASC'
  ).bind(userId).all();
  return json({ favorites: (results || []).map((r: any) => r.item_id) });
};

const handlePutUserFavorites: Handler = async (request, env) => {
  const authErr = await requireAuth(request, env);
  if (authErr) return authErr;
  const token = isAuthed(request)!;
  const claims = parseToken(token);
  if (!claims) return json({ error: 'Invalid token' }, 401);
  const userId = claims.sub;
  const body = await request.json() as { favorites: string[] };
  if (!Array.isArray(body.favorites)) {
    return json({ error: 'favorites must be an array of item IDs' }, 400);
  }
  // Replace all favorites: delete existing, insert new
  await env.DB.prepare('DELETE FROM user_favorites WHERE user_id = ?').bind(userId).run();
  if (body.favorites.length > 0) {
    const stmt = env.DB.prepare(
      'INSERT OR IGNORE INTO user_favorites (user_id, item_id) VALUES (?, ?)'
    );
    const batch = body.favorites.map((itemId: string) => stmt.bind(userId, itemId));
    await env.DB.batch(batch);
  }
  return json({ ok: true, count: body.favorites.length });
};

// ── Teaware Collection ──

const handleGetTeawareCollection: Handler = async (request, env) => {
  const authErr = await requireAdmin(request, env);
  if (authErr) return authErr;

  const url = new URL(request.url);
  const category = url.searchParams.get('category');

  let query = 'SELECT * FROM teaware_collection';
  const binds: string[] = [];
  if (category) {
    query += ' WHERE category = ?';
    binds.push(category);
  }
  query += ' ORDER BY category, name';

  const stmt = binds.length > 0
    ? env.DB.prepare(query).bind(...binds)
    : env.DB.prepare(query);
  const result = await stmt.all();

  // Attach photos for each item
  const items = result.results;
  if (items.length > 0) {
    const ids = items.map(i => i.id as string);
    const placeholders = ids.map(() => '?').join(',');
    const photos = await env.DB.prepare(
      `SELECT * FROM teaware_photos WHERE teaware_id IN (${placeholders}) ORDER BY sort_order, created_at`
    ).bind(...ids).all();

    const photoMap = new Map<string, any[]>();
    for (const p of photos.results) {
      const tid = p.teaware_id as string;
      if (!photoMap.has(tid)) photoMap.set(tid, []);
      photoMap.get(tid)!.push(p);
    }
    for (const item of items) {
      (item as any).photos = photoMap.get(item.id as string) || [];
    }
  }

  return json(items);
};

const handleGetTeawareItem: Handler = async (request, env, params) => {
  const authErr = await requireAdmin(request, env);
  if (authErr) return authErr;

  const item = await env.DB.prepare('SELECT * FROM teaware_collection WHERE id = ?').bind(params.id).first();
  if (!item) return json({ error: 'Not found' }, 404);

  const photos = await env.DB.prepare(
    'SELECT * FROM teaware_photos WHERE teaware_id = ? ORDER BY sort_order, created_at'
  ).bind(params.id).all();
  (item as any).photos = photos.results;

  return json(item);
};

const handleCreateTeawareItem: Handler = async (request, env) => {
  const authErr = await requireAdmin(request, env);
  if (authErr) return authErr;

  const body = await request.json() as Record<string, any>;
  if (!body.name || !body.category) {
    return json({ error: 'name and category are required' }, 400);
  }

  const id = crypto.randomUUID();
  const cols = ['name', 'chinese_name', 'category', 'material', 'capacity_ml', 'origin',
    'artist', 'year_acquired', 'purchase_price', 'purchase_currency', 'description',
    'condition', 'is_favorite', 'notes'];
  const present = cols.filter(c => body[c] !== undefined);
  const placeholders = present.map(() => '?').join(', ');

  await env.DB.prepare(
    `INSERT INTO teaware_collection (id, ${present.join(', ')}) VALUES (?, ${placeholders})`
  ).bind(id, ...present.map(c => body[c] ?? null)).run();

  return json({ id }, 201);
};

const handleUpdateTeawareItem: Handler = async (request, env, params) => {
  const authErr = await requireAdmin(request, env);
  if (authErr) return authErr;

  const body = await request.json() as Record<string, any>;
  const cols = Object.keys(body);
  if (cols.length === 0) return json({ error: 'No fields to update' }, 400);

  const sets = cols.map(c => `${c} = ?`).join(', ');
  await env.DB.prepare(
    `UPDATE teaware_collection SET ${sets}, updated_at = datetime('now') WHERE id = ?`
  ).bind(...cols.map(c => body[c] ?? null), params.id).run();

  return json({ success: true });
};

const handleDeleteTeawareItem: Handler = async (request, env, params) => {
  const authErr = await requireAdmin(request, env);
  if (authErr) return authErr;

  // CASCADE will delete photos via FK, but D1 may not enforce FK cascades, so do it explicitly
  await env.DB.batch([
    env.DB.prepare('DELETE FROM teaware_photos WHERE teaware_id = ?').bind(params.id),
    env.DB.prepare('DELETE FROM teaware_collection WHERE id = ?').bind(params.id),
  ]);

  return json({ success: true });
};

// ── Teaware Photos ──

const handleAddTeawarePhoto: Handler = async (request, env, params) => {
  const authErr = await requireAdmin(request, env);
  if (authErr) return authErr;

  const body = await request.json() as { url: string; caption?: string; is_primary?: boolean };
  if (!body.url) return json({ error: 'url is required' }, 400);

  // Verify the teaware item exists
  const item = await env.DB.prepare('SELECT id FROM teaware_collection WHERE id = ?').bind(params.id).first();
  if (!item) return json({ error: 'Teaware item not found' }, 404);

  const id = crypto.randomUUID();

  // If marking as primary, unset other primaries first
  if (body.is_primary) {
    await env.DB.prepare('UPDATE teaware_photos SET is_primary = 0 WHERE teaware_id = ?').bind(params.id).run();
  }

  // Get next sort order
  const maxOrder = await env.DB.prepare(
    'SELECT COALESCE(MAX(sort_order), -1) as max_order FROM teaware_photos WHERE teaware_id = ?'
  ).bind(params.id).first();
  const sortOrder = ((maxOrder?.max_order as number) || 0) + 1;

  await env.DB.prepare(
    'INSERT INTO teaware_photos (id, teaware_id, url, caption, is_primary, sort_order) VALUES (?, ?, ?, ?, ?, ?)'
  ).bind(id, params.id, body.url, body.caption || null, body.is_primary ? 1 : 0, sortOrder).run();

  return json({ id }, 201);
};

const handleDeleteTeawarePhoto: Handler = async (request, env, params) => {
  const authErr = await requireAdmin(request, env);
  if (authErr) return authErr;

  await env.DB.prepare('DELETE FROM teaware_photos WHERE id = ? AND teaware_id = ?')
    .bind(params.photoId, params.id).run();

  return json({ success: true });
};

const handleUpdateTeawarePhoto: Handler = async (request, env, params) => {
  const authErr = await requireAdmin(request, env);
  if (authErr) return authErr;

  const body = await request.json() as Record<string, any>;

  // If setting as primary, unset others first
  if (body.is_primary) {
    await env.DB.prepare('UPDATE teaware_photos SET is_primary = 0 WHERE teaware_id = ?').bind(params.id).run();
    body.is_primary = 1;
  } else if (body.is_primary === false) {
    body.is_primary = 0;
  }

  const cols = Object.keys(body);
  if (cols.length === 0) return json({ error: 'No fields to update' }, 400);

  const sets = cols.map(c => `${c} = ?`).join(', ');
  await env.DB.prepare(
    `UPDATE teaware_photos SET ${sets} WHERE id = ? AND teaware_id = ?`
  ).bind(...cols.map(c => body[c] ?? null), params.photoId, params.id).run();

  return json({ success: true });
};

const handleGetTeawareCategories: Handler = async (request, env) => {
  const authErr = await requireAdmin(request, env);
  if (authErr) return authErr;

  const result = await env.DB.prepare(
    'SELECT category, COUNT(*) as count FROM teaware_collection GROUP BY category ORDER BY category'
  ).all();

  return json(result.results);
};

// ── Routes ──
const routes: [string, string, Handler][] = [
  // Auth
  ['POST', '/api/auth/login', handleLogin],
  ['POST', '/api/auth/signup', handleSignup],
  ['GET', '/api/auth/me', handleGetMe],
  ['PUT', '/api/auth/change-password', handleChangePassword],
  ['PUT', '/api/auth/profile', handleUpdateProfile],
  ['POST', '/api/auth/request-admin', handleRequestAdmin],
  ['POST', '/api/auth/reset-password', handleResetPassword],

  // User Management (admin/owner)
  ['GET', '/api/admin/users', handleListUsers],
  ['PUT', '/api/admin/users/:id/role', handleUpdateUserRole],
  ['DELETE', '/api/admin/users/:id', handleDeleteUser],
  ['POST', '/api/admin/reset-token', handleCreateResetToken],

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

  // Invoices — edit items
  ['PUT', '/api/invoices/:id/items', handleUpdateInvoiceItems],

  // RPC
  ['POST', '/api/rpc/fulfill-invoice', handleFulfillInvoice],
  ['POST', '/api/rpc/void-invoice', handleVoidInvoice],
  ['POST', '/api/rpc/split-invoice', handleSplitInvoice],
  ['POST', '/api/rpc/increment-stock', handleIncrementStock],
  ['POST', '/api/rpc/truncate-all', handleTruncateAll],
  ['POST', '/api/rpc/backfill-customer-links', handleBackfillCustomerLinks],
  ['POST', '/api/rpc/auto-link-vendors', handleAutoLinkVendors],
  ['POST', '/api/rpc/reset-stock-verification', handleResetStockVerification],

  // Activity Logs & Stock Ledger
  ['GET', '/api/activity-logs', handleGetActivityLogs],
  ['GET', '/api/stock-ledger', handleGetStockLedger],

  // Image Upload
  ['POST', '/api/upload-image', handleUploadImage],

  // AI
  ['POST', '/api/generate-wisdom', handleGenerateWisdom],
  ['POST', '/api/admin/migrate-tasting', handleMigrateTasting],

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

  // Saved Locations — Admin
  ['GET', '/api/admin/locations', handleGetSavedLocations],
  ['POST', '/api/admin/locations', handleCreateSavedLocation],
  ['PUT', '/api/admin/locations/:id', handleUpdateSavedLocation],
  ['DELETE', '/api/admin/locations/:id', handleDeleteSavedLocation],

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

  // Newsletter
  ['POST', '/api/newsletter/subscribe', handleNewsletterSubscribe],
  ['GET', '/api/newsletter/subscribers', handleGetNewsletterSubscribers],

  // User Favorites
  ['GET', '/api/user/favorites', handleGetUserFavorites],
  ['PUT', '/api/user/favorites', handlePutUserFavorites],

  // Teaware Collection
  ['GET', '/api/admin/teaware', handleGetTeawareCollection],
  ['GET', '/api/admin/teaware/categories', handleGetTeawareCategories],
  ['GET', '/api/admin/teaware/:id', handleGetTeawareItem],
  ['POST', '/api/admin/teaware', handleCreateTeawareItem],
  ['PUT', '/api/admin/teaware/:id', handleUpdateTeawareItem],
  ['DELETE', '/api/admin/teaware/:id', handleDeleteTeawareItem],

  // Teaware Photos
  ['POST', '/api/admin/teaware/:id/photos', handleAddTeawarePhoto],
  ['PUT', '/api/admin/teaware/:id/photos/:photoId', handleUpdateTeawarePhoto],
  ['DELETE', '/api/admin/teaware/:id/photos/:photoId', handleDeleteTeawarePhoto],
];

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin') || '*';

    // CORS preflight — cache for 24h to eliminate redundant OPTIONS round-trips
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': origin,
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          'Access-Control-Max-Age': '86400',
        },
      });
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

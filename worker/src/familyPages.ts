/**
 * Teajia family, stage 3: a page for anyone. Plan: todo/plans/teajia-family.md,
 * decisions 13 and 14.
 *
 * A member's person page is the same contributor row the tea masters use, with
 * one new word on it, `contributors.page_tier` (migration 0074):
 *
 * - 'family'  anyone. Created on the first share. Live without review. No Pay.
 * - 'creator' only the owner grants it. The draft-and-approve gate. No Pay.
 * - 'master'  only the owner grants it. The draft-and-approve gate. Pay.
 * - NULL      a page from before the family. Role text, gate and Pay as they were.
 *
 * Changing the word never touches the page address or the page's content.
 * The word printed on the page comes from the tier (`pageWord`), never from
 * the free-text `role`, so nobody can write "Tea master" on their own page.
 *
 * Registered from worker/src/index.ts: the tier route through
 * `familyPageRoutes(deps)`; the share handlers in familyRoutes.ts call
 * `ensureFamilyPage`; the profile read and write paths call the helpers below.
 */
import {
  FAMILY_PAGE_TIERS, FAMILY_PAGE_WORDS, familyPageAllowsPay, familyPageNeedsReview, familyPageTierOf,
  type FamilyPageTier,
} from '../../src/lib/familyContract';

export { familyPageAllowsPay, familyPageNeedsReview, familyPageTierOf };

type Person = { userId: string; email: string; name: string };
type Handler<E> = (request: Request, env: E, params: Record<string, string>, ctx?: ExecutionContext) => Promise<Response>;

export interface FamilyPageEnv { DB: D1Database }

export interface FamilyPageDeps<E extends FamilyPageEnv> {
  /** The owner's door to one contributor: the same check the Tea Masters screen uses. */
  requireContributorSteward(request: Request, env: E, contributorId: string):
    Promise<{ error: Response } | { ctx: { userId?: string }; contributor: Record<string, any> }>;
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}

/** The word printed on a page, or null for a page from before the family (its own role text stands). */
export function pageWord(tier: unknown): string | null {
  const known = familyPageTierOf(tier);
  return known ? FAMILY_PAGE_WORDS[known] : null;
}

/** A row with the word from its tier laid over its free-text role. */
export function withPageWord<T extends { role?: unknown; page_tier?: unknown }>(row: T): T {
  const word = pageWord(row.page_tier);
  return word ? { ...row, role: word } : row;
}

/** "Mei Lin" becomes "mei-lin". The page address is made once and never changes. */
export function familySlug(name: string): string {
  const slug = name.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40).replace(/-+$/g, '');
  return slug || 'member';
}

/** Words people could not have as an address because the site already uses them under /people. */
const RESERVED_SLUGS = new Set(['new', 'pay', 'favorites', 'index', 'admin', 'api']);

async function freeSlug(db: D1Database, name: string): Promise<string> {
  const base = familySlug(name);
  const candidates = [RESERVED_SLUGS.has(base) ? `${base}-teajia` : base];
  for (let i = 0; i < 6; i += 1) candidates.push(`${candidates[0]}-${crypto.randomUUID().replace(/-/g, '').slice(0, 4)}`);
  for (const candidate of candidates) {
    const taken = await db.prepare('SELECT 1 FROM contributors WHERE id = ?').bind(candidate).first();
    if (!taken) return candidate;
  }
  return `${candidates[0]}-${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;
}

/** The account that holds editorial identities: the active platform owner, as the profile flow already does. */
async function editorialSteward(db: D1Database): Promise<string | null> {
  const row = await db.prepare(
    `SELECT id FROM accounts WHERE is_platform_owner = 1 AND status = 'active' ORDER BY created_at, id LIMIT 1`,
  ).first<{ id: string }>();
  return row?.id ?? null;
}

export type FamilyPage = { id: string; created: boolean; tier: FamilyPageTier | null };

/**
 * The person's page, made on their first share. Nothing changes for someone
 * who already has a page: a tea master's page keeps its gate, and sharing
 * never turns a draft live. A family page is put live (or put back live) by
 * sharing, because sharing is the act of putting something on it; the owner's
 * take-down is a hide, which this never touches.
 * Returns null when no page can be made (no confirmed email, no steward).
 */
export async function ensureFamilyPage(db: D1Database, person: Person): Promise<FamilyPage | null> {
  const existing = await db.prepare('SELECT id, page_tier, is_published FROM contributors WHERE user_id = ?')
    .bind(person.userId).first<{ id: string; page_tier: string | null; is_published: number }>();
  if (existing) {
    const tier = familyPageTierOf(existing.page_tier);
    if (tier === 'family' && existing.is_published !== 1) {
      await db.prepare(`UPDATE contributors SET is_published = 1, unpublished_at = NULL, updated_at = datetime('now') WHERE id = ? AND user_id = ?`)
        .bind(existing.id, person.userId).run();
    }
    return { id: existing.id, created: false, tier };
  }
  const user = await db.prepare('SELECT name, email, email_verified_at FROM users WHERE id = ?')
    .bind(person.userId).first<{ name: string | null; email: string; email_verified_at: string | null }>();
  if (!user || !user.email_verified_at) return null;
  const steward = await editorialSteward(db);
  if (!steward) return null;
  const name = (user.name ?? '').trim() || user.email.split('@')[0].replace(/[._+-]+/g, ' ').trim() || 'Teajia family';
  const id = await freeSlug(db, name);
  try {
    await db.prepare(
      `INSERT INTO contributors (id, account_id, user_id, display_name, page_tier, is_published, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'family', 1, datetime('now'), datetime('now'))`,
    ).bind(id, steward, person.userId, name).run();
  } catch {
    // A second share at the same moment made the page first: take that one.
    const raced = await db.prepare('SELECT id, page_tier FROM contributors WHERE user_id = ?').bind(person.userId).first<{ id: string; page_tier: string | null }>();
    return raced ? { id: raced.id, created: false, tier: familyPageTierOf(raced.page_tier) } : null;
  }
  return { id, created: true, tier: 'family' };
}

/**
 * A family member's save goes live at once. Anything a changed word left
 * waiting in a draft goes live with it, so no words are lost, and the role is
 * never taken from the person: their word comes from the tier.
 */
export async function applyFamilyProfileWrite(
  db: D1Database,
  contributorId: string,
  userId: string,
  values: Record<string, string | null>,
  allowedFields: readonly string[],
): Promise<void> {
  const allowed = new Set(allowedFields);
  const waiting = await db.prepare(`SELECT payload FROM contributor_profile_drafts WHERE contributor_id = ? AND approval_status != 'approved'`)
    .bind(contributorId).first<{ payload: string }>();
  let earlier: Record<string, string | null> = {};
  if (waiting?.payload) {
    try {
      const parsed = JSON.parse(waiting.payload);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        earlier = Object.fromEntries(Object.entries(parsed).filter(([field, value]) =>
          allowed.has(field) && (typeof value === 'string' || value === null))) as Record<string, string | null>;
      }
    } catch { earlier = {}; }
  }
  const merged: Record<string, string | null> = { ...earlier, ...values };
  delete merged.role;
  const fields = Object.keys(merged).filter(field => allowed.has(field));
  const statements: D1PreparedStatement[] = [
    db.prepare(
      `UPDATE contributors SET ${fields.map(field => `${field} = ?`).concat(['is_published = 1', 'unpublished_at = NULL']).join(', ')}, updated_at = datetime('now')
        WHERE id = ? AND user_id = ?`,
    ).bind(...fields.map(field => merged[field]), contributorId, userId),
  ];
  if (waiting) {
    statements.push(db.prepare(
      `UPDATE contributor_profile_drafts SET approval_status = 'approved', reviewed_by = ?, reviewed_at = datetime('now'),
              reviewer_note = NULL, updated_at = datetime('now') WHERE contributor_id = ?`,
    ).bind(userId, contributorId));
  }
  await db.batch(statements);
}

export function familyPageRoutes<E extends FamilyPageEnv>(deps: FamilyPageDeps<E>): [string, string, Handler<E>][] {
  // PUT /api/admin/family/pages/:id/tier { tier }: the owner's choice of word.
  // Only this column changes; the address and the content stay as they are.
  const setTier: Handler<E> = async (request, env, params) => {
    const owned = await deps.requireContributorSteward(request, env, params.id);
    if ('error' in owned) return owned.error;
    let body: Record<string, unknown> | null = null;
    try { body = await request.json() as Record<string, unknown>; } catch { body = null; }
    const tier = familyPageTierOf(body?.tier);
    if (!tier) return json({ error: `Choose one of: ${FAMILY_PAGE_TIERS.map(item => FAMILY_PAGE_WORDS[item]).join(', ')}.`, code: 'validation_failed' }, 400);
    await env.DB.prepare(`UPDATE contributors SET page_tier = ?, updated_at = datetime('now') WHERE id = ?`).bind(tier, params.id).run();
    return json({ id: params.id, page_tier: tier, word: FAMILY_PAGE_WORDS[tier], pay: familyPageAllowsPay(tier) });
  };
  return [['PUT', '/api/admin/family/pages/:id/tier', setTier]];
}

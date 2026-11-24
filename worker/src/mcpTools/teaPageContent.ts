/**
 * Tea page content for agents: the curator's notes, the customer tasting
 * excerpts, and the photographs customers offered to the shop.
 *
 * Shop photos already have their tools in curation.ts and are not touched
 * here. Everything below does what the admin screens do, through the same
 * statements:
 *
 *   - curator's notes are the starred notes in `products.tasting` that carry
 *     no community attribution. The page shows them only while
 *     `tasting_source` is 'owner', because starred notes under any other
 *     source can be imported supplier words. So this tool writes them only
 *     when the shop already owns the tasting, or when there is no tasting
 *     claim at all (it then stamps 'owner'); a supplier or potential profile
 *     with terms is refused until set_tasting confirms it.
 *   - excerpts go through tastingExcerptReview.ts, shared with the
 *     /api/admin/tasting-note-candidates routes.
 *   - photographs go through the exported functions in familyRoutes.ts,
 *     shared with /api/admin/family/photographs.
 *
 * Authority. The admin routes need the 'publish' bundle. MCP has no scope for
 * a bundle, and a non-owner MCP token can never hold catalog:write, so every
 * write here is catalog:write, which mcp.ts limits to current owner-tier
 * authority before a handler runs. The two lists are inventory:read (which
 * catalog:write implies, so a token that can act can also see what it acts
 * on) and check owner tier themselves, because a staff or viewer token also
 * holds inventory:read and customer words and photographs waiting for review
 * are not theirs to read through this door.
 */
import type { ToolDefinition, ToolEnv, ToolHandler, ToolModule } from './registry';
import { INVALID_TICKET, consumeTicket, issueTicket, previewEnvelope } from './tickets';
import { tastingHasTerms } from '../curateImportTasting';
import {
  approveTastingExcerptOffer, dismissTastingExcerptOffer, listTastingExcerptCandidates, loadApprovedExcerpt,
  loadTastingExcerptOffer, matchesTastingOffer, readExcerptPlacements, setTastingExcerptPlacements,
  type ExcerptStatus, type ReviewOutcome,
} from '../tastingExcerptReview';
import {
  FAMILY_OWNER_ACTIONS, applyPhotographUse, listOfferedPhotographs, readShopPhotograph, type FamilyOwnerAction,
} from '../familyRoutes';

// Mirrors OWNER_TIERS in mcp.ts, which cannot be imported (mcp.ts imports this folder).
const OWNER_TIERS: ReadonlySet<string> = new Set(['platform_owner', 'account_owner']);
const OWNER_REQUIRED = {
  error: 'owner_tier_required',
  message: 'Customer words and photographs waiting for review are read by the shop owner only.',
} as const;

const MAX_NOTES = 40;
const MAX_NOTE_LENGTH = 2000;

type Ticket =
  | { kind: 'teaPage:set_curator_notes'; accountId: string; userEmail: string; productId: string; texts: string[]; expectedRaw: string | null; expectedSource: string | null }
  | { kind: 'teaPage:approve_excerpt'; accountId: string; excerptId: string; offeredAt: string; sourceText: string; byline: string | null; body: Record<string, unknown> }
  | { kind: 'teaPage:dismiss_excerpt'; accountId: string; excerptId: string; offeredAt: string }
  | { kind: 'teaPage:excerpt_placement'; accountId: string; impressionId: string; listing: boolean | undefined; mainPage: boolean | undefined }
  | { kind: 'teaPage:photograph_use'; accountId: string; photographId: string; action: FamilyOwnerAction; expectedUse: string };

function optionalText(value: unknown): string | null {
  if (value == null) return null;
  const text = String(value).trim();
  return text === '' ? null : text;
}

/* ── products ────────────────────────────────────────────────────────────── */

type ProductRow = { id: string; given_name: string | null; product_name: string; tasting: string | null; tasting_source: string | null };

/**
 * Resolve a product within the caller's account, accepting the id prefixes
 * search_tea hands back and refusing one that matches more than one tea, the
 * same way curation.ts does: a note on the wrong tea is a silent mistake.
 */
async function resolveProduct(env: ToolEnv, accountId: string, productId: string): Promise<ProductRow | { error: string; candidates?: string[] }> {
  const columns = 'id, given_name, product_name, tasting, tasting_source';
  const exact = await env.DB.prepare(`SELECT ${columns} FROM products WHERE id = ? AND account_id = ?`)
    .bind(productId, accountId).first<ProductRow>();
  if (exact) return exact;
  const { results } = await env.DB.prepare(`SELECT ${columns} FROM products WHERE account_id = ? AND id LIKE ? LIMIT 5`)
    .bind(accountId, `${productId}-%`).all<ProductRow>();
  if (!results || results.length === 0) return { error: 'product_not_found' };
  if (results.length > 1) return { error: 'product_id_ambiguous', candidates: results.map(r => r.id) };
  return results[0];
}

const productLabel = (row: { given_name: string | null; product_name: string }) => row.given_name || row.product_name;

/* ── curator's notes ─────────────────────────────────────────────────────── */

type NoteObject = { id?: string; text?: string; starred?: boolean; sourceAuthor?: unknown; sourceJournalEntryId?: unknown; [key: string]: unknown };

function isCuratorNote(note: unknown): note is NoteObject {
  if (!note || typeof note !== 'object' || Array.isArray(note)) return false;
  const n = note as NoteObject;
  return n.starred === true && !n.sourceAuthor && !n.sourceJournalEntryId;
}

const noteText = (note: NoteObject) => (typeof note.text === 'string' ? note.text.trim() : '');

/**
 * The stored tasting as an object. Unreadable is an error, never `{}`: merging
 * onto nothing would save over every other note, the teaser and the terms.
 */
function readTastingStrict(raw: unknown): { tasting: Record<string, unknown>; notes: unknown[] } | { error: string } {
  let parsed: unknown = null;
  if (typeof raw === 'string' && raw.trim() !== '') {
    try { parsed = JSON.parse(raw); } catch { return { error: 'stored_tasting_unreadable' }; }
  } else if (raw != null && typeof raw !== 'string') {
    return { error: 'stored_tasting_unreadable' };
  }
  if (parsed === null) return { tasting: {}, notes: [] };
  if (typeof parsed !== 'object' || Array.isArray(parsed)) return { error: 'stored_tasting_unreadable' };
  const tasting = { ...(parsed as Record<string, unknown>) };
  if (tasting.notes === undefined) return { tasting, notes: [] };
  if (!Array.isArray(tasting.notes)) return { error: 'stored_tasting_notes_unreadable' };
  return { tasting, notes: tasting.notes };
}

/**
 * Replace the curator's notes and nothing else. A note whose text is unchanged
 * keeps its id and capture time; the new set sits where the first curator note
 * was, so the other notes keep their order.
 */
function replaceCuratorNotes(notes: unknown[], texts: string[], now: string): unknown[] {
  const pool = notes.filter(isCuratorNote);
  const fresh = texts.map(text => {
    const at = pool.findIndex(n => noteText(n) === text);
    if (at >= 0) return pool.splice(at, 1)[0];
    return { id: crypto.randomUUID(), text, starred: true, section: 'general', capturedAt: now };
  });
  const out: unknown[] = [];
  let placed = false;
  for (const note of notes) {
    if (isCuratorNote(note)) {
      if (!placed) { out.push(...fresh); placed = true; }
      continue;
    }
    out.push(note);
  }
  if (!placed) out.push(...fresh);
  return out;
}

function readNoteTexts(value: unknown): { texts: string[] } | { error: string } {
  if (!Array.isArray(value)) return { error: 'notes_must_be_an_array_of_strings' };
  if (value.length > MAX_NOTES) return { error: `at_most_${MAX_NOTES}_notes` };
  const texts: string[] = [];
  for (const entry of value) {
    if (typeof entry !== 'string') return { error: 'notes_must_be_an_array_of_strings' };
    const text = entry.trim();
    if (!text) return { error: 'empty_note_refused' };
    if (text.length > MAX_NOTE_LENGTH) return { error: `note_too_long: ${text.slice(0, 40)}` };
    if (texts.includes(text)) return { error: `duplicate_note: ${text.slice(0, 40)}` };
    texts.push(text);
  }
  return { texts };
}

/**
 * Whether the shop may write curator's notes on this tea, and what
 * `tasting_source` becomes. Null source with no terms is the one case that is
 * promoted, and only when there are notes to show.
 */
function curatorNoteSource(tasting: Record<string, unknown>, source: string | null, texts: string[]): { next: string | null } | { refused: string } {
  const current = source && source.trim() ? source.trim() : null;
  if (current === 'owner') return { next: 'owner' };
  if (current === null && !tastingHasTerms(tasting)) return { next: texts.length ? 'owner' : null };
  return {
    refused: 'The taste words on this tea came from a supplier or are a potential profile. '
      + 'Confirm them as the shop\'s own with set_tasting first, then add curator\'s notes.',
  };
}

const setCuratorNotes: ToolHandler = async (env, auth, args) => {
  const productId = optionalText(args?.product_id);
  if (!productId) return { error: 'product_id_required' };
  const read = readNoteTexts(args?.notes);
  if ('error' in read) return { error: read.error };
  const texts = read.texts;
  const confirm = optionalText(args?.confirm);

  const product = await resolveProduct(env, auth.accountId, productId);
  if ('error' in product) return { error: product.error, ...(product.candidates ? { candidates: product.candidates } : {}) };
  const stored = readTastingStrict(product.tasting);
  if ('error' in stored) return { error: stored.error, message: 'Fix the stored tasting in the admin before setting notes here.' };
  const source = curatorNoteSource(stored.tasting, product.tasting_source, texts);
  if ('refused' in source) return { error: 'tasting_not_owned_by_shop', message: source.refused, tasting_source: product.tasting_source };

  const before = stored.notes.filter(isCuratorNote).map(noteText);

  if (!confirm) {
    if (before.length === texts.length && before.every((t, i) => t === texts[i]) && source.next === (product.tasting_source || null)) {
      return { unchanged: true, product: { id: product.id, name: productLabel(product) }, curator_notes: before };
    }
    const token = await issueTicket<Ticket>(env, {
      kind: 'teaPage:set_curator_notes', accountId: auth.accountId, userEmail: auth.userEmail,
      productId: product.id, texts, expectedRaw: product.tasting ?? null, expectedSource: product.tasting_source ?? null,
    }, auth.tokenId);
    const otherNotes = stored.notes.length - stored.notes.filter(isCuratorNote).length;
    return previewEnvelope({
      action: 'set_curator_notes',
      product: { id: product.id, name: productLabel(product) },
      curator_notes: { before, after: texts },
      other_notes_kept: otherNotes,
      tasting_source: { before: product.tasting_source ?? null, after: source.next },
      note: 'Only the curator\'s notes change. Customer and community notes, the taste terms and the teaser are kept as they are.',
    }, token);
  }

  const ticket = await consumeTicket<Ticket, 'teaPage:set_curator_notes'>(env, confirm, 'teaPage:set_curator_notes', auth);
  if (!ticket || ticket.productId !== product.id || JSON.stringify(ticket.texts) !== JSON.stringify(texts)) return INVALID_TICKET;
  if ((product.tasting ?? null) !== ticket.expectedRaw || (product.tasting_source ?? null) !== ticket.expectedSource) {
    return { error: 'tasting_changed_since_preview', message: 'The tasting on this tea changed after the preview. Preview again.' };
  }

  const next = { ...stored.tasting, notes: replaceCuratorNotes(stored.notes, ticket.texts, new Date().toISOString()) };
  const result = await env.DB.prepare(
    `UPDATE products SET tasting = ?, tasting_source = ?, updated_at = datetime('now')
      WHERE id = ? AND account_id = ? AND tasting IS ? AND tasting_source IS ?`
  ).bind(JSON.stringify(next), source.next, ticket.productId, ticket.accountId, ticket.expectedRaw, ticket.expectedSource).run();
  if (!result.meta?.changes) {
    return { error: 'tasting_changed_since_preview', message: 'The tasting on this tea changed after the preview. Preview again.' };
  }
  await env.DB.prepare(
    `INSERT INTO activity_logs (id, action, details, user_email, entity_type, entity_id, account_id)
     VALUES (?, 'CURATOR_NOTES_SET_MCP', ?, ?, 'product', ?, ?)`
  ).bind(crypto.randomUUID(), JSON.stringify({ before, after: ticket.texts }), ticket.userEmail, ticket.productId, ticket.accountId).run();

  return {
    committed: true, action: 'set_curator_notes',
    product_id: ticket.productId, product: productLabel(product),
    curator_notes: ticket.texts, tasting_source: source.next,
  };
};

/* ── customer tasting excerpts ───────────────────────────────────────────── */

const EXCERPT_STATUS: Record<string, ExcerptStatus> = { waiting: 'starred', approved: 'promoted', passed: 'dismissed' };

/** A shared function's answer, as a tool result. */
function outcomeResult(action: string, outcome: ReviewOutcome) {
  if (outcome.status >= 400) return { error: outcome.body?.error ?? 'refused', status: outcome.status };
  return { committed: true, action, ...outcome.body };
}

const listTastingExcerpts: ToolHandler = async (env, auth, args) => {
  if (!OWNER_TIERS.has(auth.creatorTier)) return OWNER_REQUIRED;
  const wanted = optionalText(args?.status) ?? 'open';
  const names = wanted === 'open' ? ['waiting', 'approved'] : wanted === 'all' ? ['waiting', 'approved', 'passed'] : [wanted];
  if (!names.every(name => name in EXCERPT_STATUS)) return { error: 'status_must_be_open_waiting_approved_passed_or_all' };
  const productId = optionalText(args?.product_id);

  const products = new Map<string, { product_id: string; product_name: string; waiting: unknown[]; approved: unknown[]; passed: unknown[] }>();
  for (const name of names) {
    for (const row of await listTastingExcerptCandidates(env.DB, auth.accountId, EXCERPT_STATUS[name])) {
      if (productId && row.productId !== productId) continue;
      let group = products.get(row.productId);
      if (!group) {
        group = { product_id: row.productId, product_name: row.productName, waiting: [], approved: [], passed: [] };
        products.set(row.productId, group);
      }
      (group as any)[name].push({
        excerpt_id: row.id,
        text: row.finalText,
        byline: row.attributionName,
        offered_at: row.offeredAt,
        ...(name === 'approved' ? {
          impression_id: row.impressionId, show_on_listing: row.showOnListing, show_on_homepage: row.showOnMainPage,
        } : {}),
      });
    }
  }
  return { products: [...products.values()] };
};

async function productName(env: ToolEnv, accountId: string, productId: string): Promise<string | null> {
  const row = await env.DB.prepare('SELECT given_name, product_name FROM products WHERE id = ? AND account_id = ?')
    .bind(productId, accountId).first<{ given_name: string | null; product_name: string }>();
  return row ? productLabel(row) : null;
}

const approveTastingExcerpt: ToolHandler = async (env, auth, args) => {
  const excerptId = optionalText(args?.excerpt_id);
  if (!excerptId) return { error: 'excerpt_id_required' };
  const confirm = optionalText(args?.confirm);
  // The route's own rule: the shop approves the words as offered. Text or a
  // byline that differ are refused, exactly as the admin route refuses them.
  const body: Record<string, unknown> = {};
  if (args?.text !== undefined) body.edited_text = typeof args.text === 'string' ? args.text.trim() : args.text;
  if (args?.byline !== undefined) body.attribution_name = typeof args.byline === 'string' ? args.byline.trim() : args.byline;

  const offer = await loadTastingExcerptOffer(env.DB, auth.accountId, excerptId);
  if (!offer) return { error: 'excerpt_not_found' };
  if (offer.status !== 'starred') return { error: 'excerpt_already_resolved', status: offer.status };
  if (!matchesTastingOffer(body, offer)) {
    return { error: 'only_the_customer_can_change_the_words', message: 'The excerpt and byline are published as the customer offered them. Approve without text or byline, or pass on it.' };
  }

  if (!confirm) {
    const token = await issueTicket<Ticket>(env, {
      kind: 'teaPage:approve_excerpt', accountId: auth.accountId, excerptId: offer.id,
      offeredAt: offer.offered_at, sourceText: offer.source_text, byline: offer.attribution_name ?? null, body,
    }, auth.tokenId);
    return previewEnvelope({
      action: 'approve_tasting_excerpt',
      product: { id: offer.product_id, name: await productName(env, auth.accountId, offer.product_id) },
      text: offer.source_text,
      byline: offer.attribution_name ?? null,
      note: 'An approved excerpt starts hidden. Show it with set_tasting_excerpt_placement.',
    }, token);
  }

  const ticket = await consumeTicket<Ticket, 'teaPage:approve_excerpt'>(env, confirm, 'teaPage:approve_excerpt', auth);
  if (!ticket || ticket.excerptId !== offer.id) return INVALID_TICKET;
  if (ticket.offeredAt !== offer.offered_at || ticket.sourceText !== offer.source_text || ticket.byline !== (offer.attribution_name ?? null)) {
    return { error: 'excerpt_changed_since_preview' };
  }
  return outcomeResult('approve_tasting_excerpt',
    await approveTastingExcerptOffer(env.DB, { accountId: auth.accountId, userId: auth.userId }, offer.id, ticket.body));
};

const dismissTastingExcerpt: ToolHandler = async (env, auth, args) => {
  const excerptId = optionalText(args?.excerpt_id);
  if (!excerptId) return { error: 'excerpt_id_required' };
  const confirm = optionalText(args?.confirm);
  const offer = await loadTastingExcerptOffer(env.DB, auth.accountId, excerptId);
  if (!offer) return { error: 'excerpt_not_found' };
  if (offer.status !== 'starred') return { error: 'excerpt_already_resolved', status: offer.status };

  if (!confirm) {
    const token = await issueTicket<Ticket>(env, {
      kind: 'teaPage:dismiss_excerpt', accountId: auth.accountId, excerptId: offer.id, offeredAt: offer.offered_at,
    }, auth.tokenId);
    return previewEnvelope({
      action: 'dismiss_tasting_excerpt',
      product: { id: offer.product_id, name: await productName(env, auth.accountId, offer.product_id) },
      text: offer.source_text,
      byline: offer.attribution_name ?? null,
      note: 'Passing keeps the excerpt off the page. The customer\'s own journal is not touched.',
    }, token);
  }

  const ticket = await consumeTicket<Ticket, 'teaPage:dismiss_excerpt'>(env, confirm, 'teaPage:dismiss_excerpt', auth);
  if (!ticket || ticket.excerptId !== offer.id) return INVALID_TICKET;
  if (ticket.offeredAt !== offer.offered_at) return { error: 'excerpt_changed_since_preview' };
  return outcomeResult('dismiss_tasting_excerpt',
    await dismissTastingExcerptOffer(env.DB, { accountId: auth.accountId, userId: auth.userId }, offer.id));
};

const setTastingExcerptPlacement: ToolHandler = async (env, auth, args) => {
  const impressionId = optionalText(args?.impression_id);
  if (!impressionId) return { error: 'impression_id_required' };
  const confirm = optionalText(args?.confirm);
  const placements = readExcerptPlacements({ show_on_listing: args?.show_on_listing, show_on_main_page: args?.show_on_homepage });
  if (!placements) return { error: 'give_show_on_listing_or_show_on_homepage_as_true_or_false' };

  const excerpt = await loadApprovedExcerpt(env.DB, auth.accountId, impressionId);
  if (!excerpt) return { error: 'approved_excerpt_not_found' };
  const now = { listing: excerpt.show_on_listing === 1, homepage: excerpt.show_on_main_page === 1 };

  if (!confirm) {
    const token = await issueTicket<Ticket>(env, {
      kind: 'teaPage:excerpt_placement', accountId: auth.accountId, impressionId: excerpt.id,
      listing: placements.listing, mainPage: placements.mainPage,
    }, auth.tokenId);
    return previewEnvelope({
      action: 'set_tasting_excerpt_placement',
      product: { id: excerpt.product_id, name: await productName(env, auth.accountId, excerpt.product_id) },
      text: excerpt.text,
      byline: excerpt.attribution_name ?? null,
      show_on_listing: { before: now.listing, after: placements.listing ?? now.listing },
      show_on_homepage: { before: now.homepage, after: placements.mainPage ?? now.homepage },
    }, token);
  }

  const ticket = await consumeTicket<Ticket, 'teaPage:excerpt_placement'>(env, confirm, 'teaPage:excerpt_placement', auth);
  if (!ticket || ticket.impressionId !== excerpt.id
      || ticket.listing !== placements.listing || ticket.mainPage !== placements.mainPage) return INVALID_TICKET;
  const outcome = await setTastingExcerptPlacements(env.DB, auth.accountId, excerpt.id,
    { listing: ticket.listing, mainPage: ticket.mainPage });
  if (outcome.status >= 400) return outcomeResult('set_tasting_excerpt_placement', outcome);
  return {
    committed: true, action: 'set_tasting_excerpt_placement', impression_id: excerpt.id,
    show_on_listing: outcome.body.showOnListing, show_on_homepage: outcome.body.showOnMainPage,
  };
};

/* ── customer photographs ────────────────────────────────────────────────── */

const listOfferedPhotographsTool: ToolHandler = async (env, auth, args) => {
  if (!OWNER_TIERS.has(auth.creatorTier)) return OWNER_REQUIRED;
  const productId = optionalText(args?.product_id);
  // No secret: the addresses are the canonical ones, which load only while the
  // picture is on show. The signed addresses stay with the admin screen.
  const photographs = (await listOfferedPhotographs(env.DB, auth.accountId, undefined))
    .filter(photo => !productId || photo.product_id === productId);
  return {
    photographs,
    note: 'Addresses are unsigned, so a picture that is not on show will not load from them. Hidden pictures are listed with hidden: true.',
  };
};

const ACTION_WORDS: Record<FamilyOwnerAction, string> = {
  place: 'Place it on the tea page.',
  lead: 'Make it the tea\'s lead picture. The current lead steps back to what it was before.',
  pass: 'Pass on it. It stays off the tea page.',
  restore: 'Undo the shop\'s decision and put it back in the pile.',
};

const setPhotographUse: ToolHandler = async (env, auth, args) => {
  const photographId = optionalText(args?.photograph_id);
  if (!photographId) return { error: 'photograph_id_required' };
  const action = optionalText(args?.action) as FamilyOwnerAction | null;
  if (!action || !FAMILY_OWNER_ACTIONS.includes(action)) return { error: 'action_must_be_place_lead_pass_or_restore' };
  const confirm = optionalText(args?.confirm);

  const photo = await readShopPhotograph(env.DB, auth.accountId, photographId);
  if (!photo) return { error: 'photograph_not_found' };
  if (!photo.offered_at) return { error: 'not_offered', message: 'Only a photograph offered to Teajia can be used.' };

  if (!confirm) {
    let currentLead: string | null = null;
    if (action === 'lead') {
      const lead = await env.DB.prepare(
        `SELECT id FROM member_photographs WHERE account_id = ? AND product_id = ? AND shop_use = 'lead' AND id <> ? LIMIT 1`
      ).bind(auth.accountId, photo.product_id, photo.id).first<{ id: string }>();
      currentLead = lead?.id ?? null;
    }
    const token = await issueTicket<Ticket>(env, {
      kind: 'teaPage:photograph_use', accountId: auth.accountId, photographId: photo.id, action, expectedUse: photo.shop_use,
    }, auth.tokenId);
    return previewEnvelope({
      action: 'set_photograph_use',
      photograph_id: photo.id,
      product: { id: photo.product_id, name: await productName(env, auth.accountId, photo.product_id) },
      shop_use_now: photo.shop_use,
      doing: ACTION_WORDS[action],
      ...(action === 'lead' ? { current_lead_steps_back: currentLead } : {}),
    }, token);
  }

  const ticket = await consumeTicket<Ticket, 'teaPage:photograph_use'>(env, confirm, 'teaPage:photograph_use', auth);
  if (!ticket || ticket.photographId !== photo.id || ticket.action !== action) return INVALID_TICKET;
  if (ticket.expectedUse !== photo.shop_use) return { error: 'photograph_changed_since_preview' };
  const outcome = await applyPhotographUse(env.DB, { accountId: auth.accountId, userId: auth.userId }, photo.id, ticket.action);
  if ('refused' in outcome) return { error: outcome.refused.code, message: outcome.refused.error };
  return { committed: true, action: 'set_photograph_use', use: ticket.action, photograph: outcome.row };
};

/* ── definitions ─────────────────────────────────────────────────────────── */

const CONFIRM_ARG = { type: 'string', description: 'confirmation_token from the preview call. Omit to preview.' };

const defs: ToolDefinition[] = [
  {
    name: 'set_curator_notes',
    scope: 'catalog:write',
    description: 'Set the curator\'s notes on a tea page: the shop\'s own quoted lines shown under "Curator\'s notes". Replaces exactly that set with the texts given, in order; an empty array clears it. Customer and community notes, taste terms and the teaser are kept. The page shows these notes only when the tasting is the shop\'s own: if the taste words came from a supplier or are a potential profile, this is refused, so confirm them with set_tasting first, then add curator\'s notes. Two-step preview/confirm.',
    inputSchema: {
      type: 'object',
      properties: {
        product_id: { type: 'string', description: 'Product id from search_tea/get_tea. An id prefix that matches more than one tea is refused.' },
        notes: { type: 'array', items: { type: 'string' }, description: 'The curator\'s notes, in display order. Empty strings and duplicates are refused.' },
        confirm: CONFIRM_ARG,
      },
      required: ['product_id', 'notes'],
    },
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
  },
  {
    name: 'list_tasting_excerpts',
    scope: 'inventory:read',
    description: 'List the tasting excerpts customers offered from their journals, grouped by tea: those waiting for the shop, those approved (with whether each shows on the tea listing and on the homepage), and optionally those passed on. Shop owner only.',
    inputSchema: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['open', 'waiting', 'approved', 'passed', 'all'], description: 'open (default) is waiting plus approved.' },
        product_id: { type: 'string', description: 'Only this tea.' },
      },
    },
  },
  {
    name: 'approve_tasting_excerpt',
    scope: 'catalog:write',
    description: 'Approve a customer\'s offered tasting excerpt, as the admin\'s "Approve excerpt" does. The words and byline are published exactly as the customer offered them: only the customer can change them, so text or byline that differ are refused. An approved excerpt starts hidden; show it with set_tasting_excerpt_placement. Two-step preview/confirm.',
    inputSchema: {
      type: 'object',
      properties: {
        excerpt_id: { type: 'string', description: 'excerpt_id from list_tasting_excerpts (a waiting one).' },
        text: { type: 'string', description: 'Optional. Must equal the offered excerpt.' },
        byline: { type: 'string', description: 'Optional. Must equal the offered byline.' },
        confirm: CONFIRM_ARG,
      },
      required: ['excerpt_id'],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },
  {
    name: 'dismiss_tasting_excerpt',
    scope: 'catalog:write',
    description: 'Pass on a customer\'s offered tasting excerpt, as the admin\'s Pass does. It stays off the page; the customer\'s journal is untouched. Two-step preview/confirm.',
    inputSchema: {
      type: 'object',
      properties: {
        excerpt_id: { type: 'string', description: 'excerpt_id from list_tasting_excerpts (a waiting one).' },
        confirm: CONFIRM_ARG,
      },
      required: ['excerpt_id'],
    },
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
  },
  {
    name: 'set_tasting_excerpt_placement',
    scope: 'catalog:write',
    description: 'Show or hide an approved customer excerpt on the tea listing and on the homepage. Give one or both; the other stays as it is. Two-step preview/confirm.',
    inputSchema: {
      type: 'object',
      properties: {
        impression_id: { type: 'string', description: 'impression_id of an approved excerpt from list_tasting_excerpts.' },
        show_on_listing: { type: 'boolean', description: 'Show on the tea\'s own page.' },
        show_on_homepage: { type: 'boolean', description: 'Show on the shop\'s homepage.' },
        confirm: CONFIRM_ARG,
      },
      required: ['impression_id'],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: 'list_offered_photographs',
    scope: 'inventory:read',
    description: 'List the photographs customers offered to the shop (newest 200), with each one\'s tea, the shop\'s current use (none, placed, lead, passed), whether its author removed it from their page, and whether the shop hid it. Addresses are unsigned. Shop owner only.',
    inputSchema: {
      type: 'object',
      properties: { product_id: { type: 'string', description: 'Only this tea.' } },
    },
  },
  {
    name: 'set_photograph_use',
    scope: 'catalog:write',
    description: 'Decide what the shop does with an offered customer photograph, as the admin screen does: place it on the tea page, make it the lead picture (the current lead steps back), pass on it, or restore it to the pile. Two-step preview/confirm.',
    inputSchema: {
      type: 'object',
      properties: {
        photograph_id: { type: 'string', description: 'id from list_offered_photographs.' },
        action: { type: 'string', enum: [...FAMILY_OWNER_ACTIONS] },
        confirm: CONFIRM_ARG,
      },
      required: ['photograph_id', 'action'],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
];

const handlers: Record<string, ToolHandler> = {
  set_curator_notes: setCuratorNotes,
  list_tasting_excerpts: listTastingExcerpts,
  approve_tasting_excerpt: approveTastingExcerpt,
  dismiss_tasting_excerpt: dismissTastingExcerpt,
  set_tasting_excerpt_placement: setTastingExcerptPlacement,
  list_offered_photographs: listOfferedPhotographsTool,
  set_photograph_use: setPhotographUse,
};

export const teaPageContentTools: ToolModule = {
  area: 'tea page content (curator notes, customer excerpts, customer photographs)',
  defs,
  handlers,
};

export const __testables = { readTastingStrict, replaceCuratorNotes, isCuratorNote, curatorNoteSource, readNoteTexts };

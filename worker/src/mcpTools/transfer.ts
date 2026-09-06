/**
 * Moving stock between the shops.
 *
 * Teajia is several accounts — Bali, the Hong Kong holding, whatever comes next
 * — and a tea physically carried from one to another has, until now, been two
 * separate acts of typing: a removal in one shop and an addition in the other,
 * with nothing in either ledger saying they were the same event. That is how a
 * hundred grams goes missing and both shelves look correct.
 *
 * There is already a transfer inside one account: `applyStockMovement` in
 * index.ts, `movement_type = 'transfer'`, source and destination both in
 * `ctx.accountId`, used for splitting one holding into another of the same
 * Curate identity. This module is the other half — the same movement across the
 * account boundary — and it deliberately reuses that path's vocabulary
 * (`movement_type = 'transfer'`, `reason = 'TRANSFER'`, the
 * `stock_movement_guard` sentinel) so a transfer reads the same in the ledger
 * whichever door it came through. `TRANSFER` is also already a label
 * StockLedgerPanel knows how to print; a new reason string would render as raw
 * caps to Adrian and to nobody's benefit.
 *
 * ── What this module needs from files it may not edit ──
 *
 * Written here rather than done, because this branch is one of several editing
 * this repo at once and a shared-file edit here is a merge conflict for someone
 * else. Three things are outstanding:
 *
 *   1. REGISTRATION. `worker/src/mcp.ts` line ~6465 holds `const TOOL_MODULES:
 *      ToolModule[] = [];`. It must become:
 *
 *          import { transferToolModule } from './mcpTools/transfer';
 *          const TOOL_MODULES: ToolModule[] = [transferToolModule];
 *
 *      Until that line changes these tools do not exist at runtime: nothing
 *      imports this file, so it is dead weight that typechecks.
 *
 *   2. AUDIT. `AUDITED_TOOLS` in mcp.ts (~line 6488) is a hardcoded name set,
 *      so `logMcpToolCall` will not write an activity_logs row for a confirmed
 *      `transfer_stock` the way it does for `remove_stock`. This module writes
 *      its own activity_logs rows on BOTH accounts, which is the part that
 *      actually matters (the movement is legible in each shop's history), but
 *      the `MCP_TOOL_CALL` audit trail still wants `'transfer_stock'` added to
 *      that set. A cross-tenant write is the last one you want missing from it.
 *
 *   3. ANNOTATIONS. `visibleToolDefs` rebuilds every listed tool's annotations
 *      from `annotationsFor(name)`, which reads name sets local to mcp.ts, so
 *      the `annotations` declared on a module's definitions are discarded.
 *      `list_transferable_accounts` therefore advertises `readOnlyHint: false`
 *      despite reading nothing but rows. They are declared below anyway so the
 *      truth is recorded where the tool is; either `READ_ONLY_TOOLS` gains the
 *      name or `visibleToolDefs` learns to prefer a definition's own
 *      annotations.
 */

import { sha256Hex } from '../inquiryDomain';
import type { ReceiptUnit } from '../inventoryDomain';
import type { ToolAuth, ToolDefinition, ToolEnv, ToolModule } from './registry';
import { INVALID_TICKET, PENDING_TTL_MS, consumeTicket, issueTicket } from './tickets';

/* Same five minutes mcp.ts gives every other preview: long enough for a voice
   round-trip, short enough that a ticket cannot be replayed tomorrow. */
const TICKET_KIND = 'transfer_stock';

/* Stock lives in one of two columns and the choice is the product's, never the
   caller's. Interpolating a column name into SQL is only safe because the value
   can only ever be one of these two literals — read `columnFor` before adding a
   third. */
const GRAM_COLUMN = 'stock_grams';
const UNIT_COLUMN = 'quantity_units';

type StockRow = {
  id: string;
  account_id: string;
  type: string | null;
  given_name: string | null;
  product_name: string;
  status: string | null;
  stock_grams: number | null;
  quantity_units: number | null;
  cost_amount: number | null;
  cost_currency: string | null;
  tea_key: string | null;
  profile_id: string | null;
};

type TransferTicket = {
  kind: typeof TICKET_KIND;
  transferId: string;
  /* The source shop, and also the tenant the ticket belongs to: a transfer is
     authorised by the account the stock leaves, which is why this is the plain
     `accountId` the shared ticket helper keys and re-checks the row on. It was
     `fromAccountId` beside `toAccountId`, which read better but meant carrying
     `auth.accountId` under a second name — one value, two homes, free to drift
     the way four freight rates once did. */
  accountId: string;
  toAccountId: string;
  fromProductId: string;
  toProductId: string;
  quantity: number;
  unit: ReceiptUnit;
  userEmail: string;
  note: string | null;
};

// ── reading the request ──

/**
 * A quantity that was never given is not a quantity of zero.
 *
 * `Number('')` is 0 and so is `Number(null)`, which is the same trap
 * `enteredNumber()` exists for on the admin side: the natural conversion turns
 * "the model omitted this" into "move nothing", and a transfer of nothing is a
 * confirmation prompt Adrian says yes to for a movement that never happens.
 * Absent is refused out loud; zero is refused too, because moving no tea is not
 * a movement anyone means.
 */
function requiredQuantity(raw: unknown, field: string): number {
  if (raw === undefined || raw === null) throw new Error(`${field} is required`);
  if (typeof raw === 'string' && raw.trim() === '') throw new Error(`${field} is required`);
  const value = Number(raw);
  if (!Number.isFinite(value)) throw new Error(`${field} must be a number`);
  if (value <= 0) throw new Error(`${field} must be greater than zero`);
  /* Both stock columns are INTEGER. A half-gram silently truncating in SQLite
     is a rounding error nobody can see afterwards. */
  if (!Number.isInteger(value)) throw new Error(`${field} must be a whole number`);
  return value;
}

function trimmedString(raw: unknown): string {
  return raw == null ? '' : String(raw).trim();
}

/**
 * Which column this product's stock lives in.
 *
 * The same rule `decodeInventoryImportRow` uses, deliberately: teaware counts
 * pieces, tea weighs grams, and a row already carrying `quantity_units` is
 * counted whatever its type says. Two definitions of "is this counted or
 * weighed" would eventually disagree, and the one that disagreed would move
 * stock into a column nobody reads.
 */
function unitFor(row: StockRow): ReceiptUnit {
  const isUnit = String(row.type || '').toLowerCase() === 'teaware' || row.quantity_units != null;
  return isUnit ? 'unit' : 'g';
}

function columnFor(unit: ReceiptUnit): typeof GRAM_COLUMN | typeof UNIT_COLUMN {
  return unit === 'unit' ? UNIT_COLUMN : GRAM_COLUMN;
}

function balanceOf(row: StockRow, unit: ReceiptUnit): number {
  return Number((unit === 'unit' ? row.quantity_units : row.stock_grams) ?? 0);
}

function displayName(row: StockRow): string {
  return row.given_name || row.product_name;
}

// ── who may receive ──

type ReachableAccount = {
  id: string;
  slug: string;
  name: string;
  role: string | null;
  canReceive: boolean;
  blockedReason: string | null;
};

/**
 * The destination is authorised against the USER, not against the token.
 *
 * A token is minted for one account and its scopes were checked against what
 * its holder could do *there*. Letting that token write into a second account
 * merely because the same person owns both would make a stock:write token in
 * the quietest shop a stock:write token everywhere, which is a widening nobody
 * consented to at mint time. So the destination is re-derived from
 * `account_members` exactly the way `allowedMcpScopesForCurrentAuthority` does
 * it in mcp.ts: an owner may write, a staff member may write only with the
 * `stock` bundle, a viewer never may.
 *
 * `platform_owner` is the one tier that reaches an account without a membership
 * row, because that is already true of authentication itself — mcp.ts hands a
 * platform owner every scope in every account it authenticates. Note that
 * `platform_admin` arrives here indistinguishable from an ordinary account
 * owner (mcp.ts maps it to `account_owner`), so it needs a real membership.
 * That is the conservative direction to be wrong in.
 */
function membershipCanWriteStock(role: string | null, permissionsJson: string | null): boolean {
  if (role === 'owner') return true;
  if (role !== 'staff') return false;
  if (!permissionsJson) return false;
  try {
    const parsed = JSON.parse(permissionsJson) as { bundles?: unknown };
    return Array.isArray(parsed.bundles) && parsed.bundles.includes('stock');
  } catch {
    /* Permissions we cannot read grant nothing. */
    return false;
  }
}

const REACHABLE_LIMIT = 100;

async function reachableAccounts(env: ToolEnv, auth: ToolAuth): Promise<ReachableAccount[]> {
  if (auth.creatorTier === 'platform_owner') {
    const { results } = await env.DB.prepare(
      `SELECT a.id, a.slug, a.name
         FROM accounts a
        WHERE a.status = 'active' AND a.id != ?
        ORDER BY a.name
        LIMIT ?`
    ).bind(auth.accountId, REACHABLE_LIMIT).all<{ id: string; slug: string; name: string }>();
    return (results || []).map(row => ({
      id: row.id, slug: row.slug, name: row.name,
      role: 'platform_owner', canReceive: true, blockedReason: null,
    }));
  }

  const { results } = await env.DB.prepare(
    `SELECT a.id, a.slug, a.name, am.role, am.permissions
       FROM account_members am
       JOIN accounts a ON a.id = am.account_id
      WHERE am.user_id = ? AND am.status = 'active'
        AND a.status = 'active' AND a.id != ?
      ORDER BY a.name
      LIMIT ?`
  ).bind(auth.userId, auth.accountId, REACHABLE_LIMIT)
    .all<{ id: string; slug: string; name: string; role: string | null; permissions: string | null }>();

  return (results || []).map(row => {
    const canReceive = membershipCanWriteStock(row.role, row.permissions);
    return {
      id: row.id,
      slug: row.slug,
      name: row.name,
      role: row.role,
      canReceive,
      /* Listed even when it cannot receive, with the reason attached. An
         account that silently vanishes from the list looks like an account that
         does not exist, and the model then tells Adrian the shop is gone
         instead of that his role there does not cover stock. */
      blockedReason: canReceive ? null : `your role in this shop (${row.role ?? 'none'}) does not carry stock write access`,
    };
  });
}

async function resolveDestinationAccount(env: ToolEnv, auth: ToolAuth, requested: string): Promise<
  { ok: true; account: ReachableAccount } | { ok: false; error: Record<string, unknown> }
> {
  const wanted = requested.toLowerCase();
  const accounts = await reachableAccounts(env, auth);
  /* Named by id or by slug: a voice caller says "the Hong Kong shop", and the
     model has the slug far more often than the opaque id. */
  const match = accounts.find(a => a.id.toLowerCase() === wanted || a.slug.toLowerCase() === wanted);
  if (!match) {
    return {
      ok: false,
      error: {
        error: 'destination_account_not_reachable',
        requested,
        reachable_accounts: accounts.map(a => ({ id: a.id, slug: a.slug, name: a.name, can_receive_stock: a.canReceive })),
      },
    };
  }
  if (!match.canReceive) {
    return { ok: false, error: { error: 'destination_account_forbidden', account: { id: match.id, slug: match.slug, name: match.name }, reason: match.blockedReason } };
  }
  return { ok: true, account: match };
}

// ── finding the two ends of the move ──

const STOCK_SELECT = `
  SELECT p.id, p.account_id, p.type, p.given_name, p.product_name, p.status,
         p.stock_grams, p.quantity_units, p.cost_amount, p.cost_currency, p.tea_key,
         pl.profile_id
    FROM products p
    LEFT JOIN product_listings pl
      ON pl.legacy_product_id = p.id AND pl.account_id = p.account_id`;

async function loadStockRow(env: ToolEnv, productId: string, accountId: string): Promise<StockRow | null> {
  return await env.DB.prepare(`${STOCK_SELECT} WHERE p.id = ? AND p.account_id = ?`)
    .bind(productId, accountId).first<StockRow>();
}

/**
 * The receiving shop's own row for the same tea.
 *
 * `products` is per-account, so the destination is a different row with its own
 * cost, its own currency and its own freight. Three ways to find it, in
 * descending confidence: the caller names it, the two shops list the same
 * `tea_profiles` row (`product_listings` is UNIQUE on account+profile, so that
 * answer is single by construction), or the rows share a `tea_key`.
 *
 * What this deliberately will NOT do is create the row. A product carries a
 * cost, a currency and a freight rate, and there is no honest value for any of
 * them here: the source shop's cost is what IT paid, and copying it across
 * would make one purchase price two stored facts that drift — the exact shape
 * that gave this shop four freight rates. A destination that does not exist is
 * an answer ("create the tea in that shop first"), not a gap to fill in.
 */
async function resolveDestinationProduct(
  env: ToolEnv,
  source: StockRow,
  toAccountId: string,
  explicitId: string,
): Promise<{ ok: true; row: StockRow; matchedBy: string } | { ok: false; error: Record<string, unknown> }> {
  if (explicitId) {
    const row = await loadStockRow(env, explicitId, toAccountId);
    if (!row) return { ok: false, error: { error: 'destination_product_not_found', to_product_id: explicitId, to_account_id: toAccountId } };
    return { ok: true, row, matchedBy: 'to_product_id' };
  }

  if (source.profile_id) {
    const row = await env.DB.prepare(`${STOCK_SELECT} WHERE pl.profile_id = ? AND p.account_id = ?`)
      .bind(source.profile_id, toAccountId).first<StockRow>();
    if (row) return { ok: true, row, matchedBy: 'shared_tea_profile' };
  }

  if (source.tea_key) {
    const { results } = await env.DB.prepare(`${STOCK_SELECT} WHERE p.tea_key = ? AND p.account_id = ?`)
      .bind(source.tea_key, toAccountId).all<StockRow>();
    const candidates = results || [];
    if (candidates.length === 1) return { ok: true, row: candidates[0], matchedBy: 'shared_tea_key' };
    if (candidates.length > 1) {
      /* Guessing between two holdings of the same tea puts the grams on the
         wrong shelf and the ledger says it went to the right one. */
      return {
        ok: false,
        error: {
          error: 'destination_product_ambiguous',
          to_account_id: toAccountId,
          candidates: candidates.map(row => ({ id: row.id, name: displayName(row), stock: balanceOf(row, unitFor(row)) })),
          hint: 'Pass to_product_id to say which holding receives the stock.',
        },
      };
    }
  }

  return {
    ok: false,
    error: {
      error: 'destination_product_not_found',
      to_account_id: toAccountId,
      source_product: { id: source.id, name: displayName(source) },
      hint: 'That shop has no row for this tea. Create it there first (create_tea), then transfer — this tool will not invent a product, because a new row needs a cost and a currency that only the receiving shop can state.',
    },
  };
}

// ── the tools ──

async function toolTransferStock(env: ToolEnv, auth: ToolAuth, args: any) {
  const confirm = args?.confirm ? String(args.confirm) : null;
  if (confirm) {
    const ticket = await consumeTicket<TransferTicket, typeof TICKET_KIND>(env, confirm, TICKET_KIND, auth);
    if (!ticket) return { error: 'invalid_or_expired_confirmation_token' };
    return commitTransfer(env, auth, ticket);
  }

  const fromProductId = trimmedString(args?.id ?? args?.product_id ?? args?.from_product_id);
  if (!fromProductId) throw new Error('id is required (the product to move stock out of)');
  const toAccountRef = trimmedString(args?.to_account ?? args?.to_account_id ?? args?.to_account_slug);
  if (!toAccountRef) throw new Error('to_account is required (the id or slug of the shop receiving the stock)');
  const explicitToProductId = trimmedString(args?.to_product_id);
  const note = args?.note ? String(args.note).slice(0, 500) : null;

  const source = await loadStockRow(env, fromProductId, auth.accountId);
  if (!source) return { error: 'not_found' };

  const unit = unitFor(source);
  /* `grams` and `units` are accepted because the built-in stock tools speak
     `grams` and a model reaches for the word it already knows. A `grams` on
     teaware is refused rather than read as a count: the two are not the same
     number and treating them as one would move 12 grams of a teapot. */
  if (unit === 'unit' && args?.grams != null) {
    throw new Error(`${displayName(source)} is counted in units, not grams — pass quantity or units`);
  }
  if (unit === 'g' && args?.units != null) {
    throw new Error(`${displayName(source)} is weighed in grams, not units — pass quantity or grams`);
  }
  const quantity = requiredQuantity(
    args?.quantity ?? (unit === 'unit' ? args?.units : args?.grams),
    unit === 'unit' ? 'quantity (units)' : 'quantity (grams)',
  );

  const destinationAccount = await resolveDestinationAccount(env, auth, toAccountRef);
  if (!destinationAccount.ok) return destinationAccount.error;

  const destination = await resolveDestinationProduct(env, source, destinationAccount.account.id, explicitToProductId);
  if (!destination.ok) return destination.error;

  const mismatch = unitMismatch(source, destination.row);
  if (mismatch) return mismatch;

  const available = balanceOf(source, unit);
  if (quantity > available) {
    return {
      error: 'insufficient_stock',
      requested: quantity,
      available,
      unit,
      product: { id: source.id, name: displayName(source) },
    };
  }

  const destinationBefore = balanceOf(destination.row, unit);
  const token = await issueTicket(env, {
    kind: TICKET_KIND,
    transferId: crypto.randomUUID(),
    accountId: auth.accountId,
    toAccountId: destinationAccount.account.id,
    fromProductId: source.id,
    toProductId: destination.row.id,
    quantity,
    unit,
    userEmail: auth.userEmail,
    note,
  }, auth.tokenId);

  return {
    preview: {
      action: 'transfer_stock',
      quantity,
      unit,
      from: {
        account_id: auth.accountId,
        product: { id: source.id, name: displayName(source) },
        balance_before: available,
        balance_after: available - quantity,
      },
      to: {
        account_id: destinationAccount.account.id,
        account_name: destinationAccount.account.name,
        product: { id: destination.row.id, name: displayName(destination.row) },
        matched_by: destination.matchedBy,
        balance_before: destinationBefore,
        balance_after: destinationBefore + quantity,
      },
      note,
      warnings: transferWarnings(source, destination.row, available - quantity),
    },
    confirmation_token: token,
    expires_in_seconds: PENDING_TTL_MS / 1000,
  };
}

function unitMismatch(source: StockRow, destination: StockRow): Record<string, unknown> | null {
  if (source.id === destination.id) {
    return { error: 'transfer_destination_must_differ', hint: 'Source and destination are the same product row.' };
  }
  const sourceUnit = unitFor(source);
  const destinationUnit = unitFor(destination);
  if (sourceUnit !== destinationUnit) {
    /* Grams into a units column reads as a count of teapots. The REST transfer
       refuses the same pairing for the same reason. */
    return {
      error: 'transfer_unit_mismatch',
      source: { id: source.id, name: displayName(source), unit: sourceUnit },
      destination: { id: destination.id, name: displayName(destination), unit: destinationUnit },
    };
  }
  return null;
}

/**
 * Things the operator should see BEFORE saying yes, never fixed silently.
 *
 * Neither of these blocks the move — both are true facts about the receiving
 * shelf that only become expensive after the tea is on it.
 */
function transferWarnings(source: StockRow, destination: StockRow, sourceBalanceAfter: number): string[] {
  const warnings: string[] = [];
  if (sourceBalanceAfter === 0) {
    warnings.push(`This empties ${displayName(source)} in the sending shop; it will be marked Sold Out.`);
  }
  /* A destination with no cost recorded prices at nothing times three. The
     transfer does not carry the source's cost across — that cost is what the
     sending shop paid, and copying it would make one purchase into two stored
     facts that drift apart. Said out loud instead. */
  if (destination.cost_amount == null || Number(destination.cost_amount) === 0 || !destination.cost_currency) {
    warnings.push(`${displayName(destination)} in the receiving shop has no cost recorded, so it cannot be priced there until one is entered. The transfer does not carry the sending shop's cost across.`);
  }
  if (destination.status === 'Sold Out') {
    warnings.push(`${displayName(destination)} is marked Sold Out in the receiving shop; the stock arrives but the status is not changed for you.`);
  }
  return warnings;
}

/**
 * Commit.
 *
 * Everything is re-read here rather than trusted from the ticket, exactly as
 * `commitAddStock` re-reads its product: five minutes is long enough for the
 * destination to be archived, for the membership to be revoked, or for the
 * stock to be sold.
 *
 * The write is one `env.DB.batch`, which is one transaction, because a transfer
 * that half-lands is worse than one that fails: a removal without its addition
 * is stock destroyed, and an addition without its removal is stock invented.
 * But a transaction alone is not enough — a statement that matches no rows is a
 * no-op, not an error, so a batch can commit with only half its statements
 * having done anything. That is what the guard is for:
 *
 *   - the source decrement runs only if the source still holds the stock AND
 *     the destination row still exists, and stamps a fresh
 *     `stock_movement_guard` when it does;
 *   - every other statement is conditional on that stamp.
 *
 * So either the whole movement happens or none of it does, and
 * `meta.changes === 0` on the first statement is how we know which. The
 * sentinel is `applyStockMovement`'s own; this is the same trick applied across
 * an account boundary.
 */
async function commitTransfer(env: ToolEnv, auth: ToolAuth, ticket: TransferTicket) {
  if (ticket.accountId !== auth.accountId) {
    /* Cannot normally happen — consumeTicket already scopes to the caller's
       account — but a ticket is the one input here that arrives as stored data,
       and stock landing in the wrong tenant is not a failure you can undo by
       reading a log. */
    return { error: 'invalid_or_expired_confirmation_token' };
  }

  const source = await loadStockRow(env, ticket.fromProductId, ticket.accountId);
  if (!source) return { error: 'not_found' };

  const destinationAccount = await resolveDestinationAccount(env, auth, ticket.toAccountId);
  if (!destinationAccount.ok) return destinationAccount.error;

  const destination = await loadStockRow(env, ticket.toProductId, ticket.toAccountId);
  if (!destination) return { error: 'destination_product_not_found', to_product_id: ticket.toProductId, to_account_id: ticket.toAccountId };

  const mismatch = unitMismatch(source, destination);
  if (mismatch) return mismatch;
  if (unitFor(source) !== ticket.unit) {
    /* The product changed shape between preview and confirm (a tea retyped as
       teaware). The preview Adrian approved described a different movement. */
    return { error: 'transfer_unit_changed', previewed_unit: ticket.unit, current_unit: unitFor(source) };
  }

  const column = columnFor(ticket.unit);
  const guard = crypto.randomUUID();
  const knownAt = new Date().toISOString();
  const movementUnit = ticket.unit === 'unit' ? 'unit' : 'gram';
  const idempotencyKey = `mcp-transfer:${ticket.transferId}`;
  const sourceName = displayName(source);
  const destinationName = displayName(destination);
  const sourceNote = ticket.note
    ? `${ticket.note} (transfer ${ticket.transferId} → ${destinationAccount.account.name})`
    : `Transfer ${ticket.transferId} → ${destinationAccount.account.name}`;
  const destinationNote = ticket.note
    ? `${ticket.note} (transfer ${ticket.transferId} ← ${ticket.accountId})`
    : `Transfer ${ticket.transferId} ← ${ticket.accountId}`;

  /* `EXISTS (… stock_movement_guard = ?)` on the SOURCE row is the whole
     interlock: only statement 1 writes that value, so a statement that finds it
     knows statement 1 landed. Note the guard is stamped on the source only —
     the destination row is in another tenant and its guard column belongs to
     that shop's own movements. */
  const landed = `EXISTS (SELECT 1 FROM products WHERE id = ? AND account_id = ? AND stock_movement_guard = ?)`;

  const statements = [
    env.DB.prepare(
      `UPDATE products
          SET ${column} = COALESCE(${column}, 0) - ?,
              stock_movement_guard = ?,
              stock_known_at = ?,
              updated_at = datetime('now')
        WHERE id = ? AND account_id = ?
          AND COALESCE(${column}, 0) >= ?
          AND EXISTS (SELECT 1 FROM products WHERE id = ? AND account_id = ?)`
    ).bind(
      ticket.quantity, guard, knownAt,
      ticket.fromProductId, ticket.accountId,
      ticket.quantity,
      ticket.toProductId, ticket.toAccountId,
    ),

    env.DB.prepare(
      `UPDATE products
          SET ${column} = COALESCE(${column}, 0) + ?,
              stock_known_at = ?,
              updated_at = datetime('now')
        WHERE id = ? AND account_id = ? AND ${landed}`
    ).bind(
      ticket.quantity, knownAt,
      ticket.toProductId, ticket.toAccountId,
      ticket.fromProductId, ticket.accountId, guard,
    ),
  ];

  /* `product_listings` mirrors grams only — it has no units column — so a
     teaware move touches `products` alone. Matched on
     `legacy_product_id + account_id` rather than the `list_<id>` id convention
     the built-in add_stock uses: that convention only holds for rows the mirror
     itself created, and a listing this tool cannot find is a shop shelf that
     silently keeps the old number. */
  if (ticket.unit === 'g') {
    statements.push(
      env.DB.prepare(
        `UPDATE product_listings
            SET stock_grams = MAX(0, COALESCE(stock_grams, 0) - ?),
                stock_known_at = ?,
                updated_at = datetime('now')
          WHERE legacy_product_id = ? AND account_id = ? AND ${landed}`
      ).bind(ticket.quantity, knownAt, ticket.fromProductId, ticket.accountId, ticket.fromProductId, ticket.accountId, guard),
      env.DB.prepare(
        `UPDATE product_listings
            SET stock_grams = COALESCE(stock_grams, 0) + ?,
                stock_known_at = ?,
                updated_at = datetime('now')
          WHERE legacy_product_id = ? AND account_id = ? AND ${landed}`
      ).bind(ticket.quantity, knownAt, ticket.toProductId, ticket.toAccountId, ticket.fromProductId, ticket.accountId, guard),
    );
  }

  /* Two ledger rows, one per shop, sharing a transfer id in the note and an
     idempotency key that differs only by account — so each shelf's history
     shows the movement, and the two halves can be matched back into one event.
     `balance_after` is read back out of `products` in the statement itself
     rather than computed here: the row was updated earlier in this same
     transaction, so the subquery sees the true post-move balance even if
     something else moved the stock between preview and confirm. A balance
     computed in JavaScript from a five-minute-old read is a number that looks
     authoritative and is not. */
  const ledgerInsert = (
    ledgerId: string, productId: string, accountId: string, delta: number, note: string,
  ) => env.DB.prepare(
    `INSERT INTO stock_ledger
       (id, product_id, delta, balance_after, movement_unit, movement_type, reason,
        user_email, note, account_id, idempotency_key)
     SELECT ?, ?, ?, (SELECT COALESCE(${column}, 0) FROM products WHERE id = ? AND account_id = ?),
            ?, 'transfer', 'TRANSFER', ?, ?, ?, ?
      WHERE ${landed}`
  ).bind(
    ledgerId, productId, delta, productId, accountId,
    movementUnit, ticket.userEmail, note, accountId, idempotencyKey,
    ticket.fromProductId, ticket.accountId, guard,
  );

  statements.push(
    ledgerInsert(crypto.randomUUID(), ticket.fromProductId, ticket.accountId, -ticket.quantity, sourceNote),
    ledgerInsert(crypto.randomUUID(), ticket.toProductId, ticket.toAccountId, ticket.quantity, destinationNote),
  );

  /* An emptied shelf goes Sold Out, the same as remove_stock does at zero: the
     tea is gone from THIS shop even though it still exists in the business, and
     a shop showing a tea in stock that it cannot pour is the worse lie. The
     condition reads the post-decrement value because this statement runs after
     the decrement inside the same transaction. The receiving row is
     deliberately NOT revived from Sold Out — add_stock does not do that either,
     and quietly republishing a tea is a decision, not a side effect. It is said
     out loud in the preview warnings instead. */
  statements.push(
    env.DB.prepare(
      `UPDATE products
          SET status = 'Sold Out', sold_out_at = datetime('now')
        WHERE id = ? AND account_id = ?
          AND COALESCE(${column}, 0) = 0
          AND (status IS NULL OR status != 'Sold Out')
          AND ${landed}`
    ).bind(ticket.fromProductId, ticket.accountId, ticket.fromProductId, ticket.accountId, guard),
  );

  /* One activity row in each shop. A transfer is the one movement that is only
     half-legible from inside either account, so each side's log has to name the
     other. */
  const activityInsert = (accountId: string, action: string, details: string, entityId: string) => env.DB.prepare(
    `INSERT INTO activity_logs (id, action, details, user_email, entity_type, entity_id, account_id)
     SELECT ?, ?, ?, ?, 'product', ?, ? WHERE ${landed}`
  ).bind(
    crypto.randomUUID(), action, details, ticket.userEmail, entityId, accountId,
    ticket.fromProductId, ticket.accountId, guard,
  );

  const amount = `${ticket.quantity}${ticket.unit === 'unit' ? ' units' : 'g'}`;
  statements.push(
    activityInsert(ticket.accountId, 'STOCK_TRANSFERRED_OUT_MCP', `-${amount} via MCP — ${sourceName} → ${destinationAccount.account.name} (transfer ${ticket.transferId})`, ticket.fromProductId),
    activityInsert(ticket.toAccountId, 'STOCK_TRANSFERRED_IN_MCP', `+${amount} via MCP — ${destinationName} ← ${ticket.accountId} (transfer ${ticket.transferId})`, ticket.toProductId),
  );

  const results = await env.DB.batch(statements);
  const moved = Number((results[0] as any)?.meta?.changes || 0);
  if (moved !== 1) {
    /* The decrement matched nothing, so every guarded statement after it also
       matched nothing: the shelves are exactly as they were. Re-read to say
       which of the two conditions failed rather than guessing. */
    const live = await loadStockRow(env, ticket.fromProductId, ticket.accountId);
    return {
      error: 'insufficient_stock',
      requested: ticket.quantity,
      available: live ? balanceOf(live, ticket.unit) : 0,
      unit: ticket.unit,
      product: { id: ticket.fromProductId, name: sourceName },
    };
  }

  /* Read the balances back rather than reporting the arithmetic. The ledger's
     own balance_after was computed inside the transaction; a number returned to
     Adrian that was derived from a read taken before the write is the same
     number one step less true, and this surface is where he decides whether the
     shelf is right. */
  const sourceAfterRow = await loadStockRow(env, ticket.fromProductId, ticket.accountId);
  const destinationAfterRow = await loadStockRow(env, ticket.toProductId, ticket.toAccountId);
  const sourceAfter = sourceAfterRow ? balanceOf(sourceAfterRow, ticket.unit) : balanceOf(source, ticket.unit) - ticket.quantity;
  const destinationAfter = destinationAfterRow ? balanceOf(destinationAfterRow, ticket.unit) : balanceOf(destination, ticket.unit) + ticket.quantity;
  return {
    committed: true,
    action: 'transfer_stock',
    transfer_id: ticket.transferId,
    quantity: ticket.quantity,
    unit: ticket.unit,
    from: {
      account_id: ticket.accountId,
      product: { id: ticket.fromProductId, name: sourceName },
      balance_after: sourceAfter,
      sold_out: sourceAfter === 0,
    },
    to: {
      account_id: ticket.toAccountId,
      account_name: destinationAccount.account.name,
      product: { id: ticket.toProductId, name: destinationName },
      balance_after: destinationAfter,
      status: destinationAfterRow?.status ?? destination.status,
    },
  };
}

async function toolListTransferableAccounts(env: ToolEnv, auth: ToolAuth, _args: any) {
  const accounts = await reachableAccounts(env, auth);
  const from = await env.DB.prepare('SELECT id, slug, name FROM accounts WHERE id = ?')
    .bind(auth.accountId).first<{ id: string; slug: string; name: string }>();
  return {
    from_account: from ? { id: from.id, slug: from.slug, name: from.name } : { id: auth.accountId, slug: null, name: null },
    accounts: accounts.map(a => ({
      id: a.id,
      slug: a.slug,
      name: a.name,
      your_role: a.role,
      can_receive_stock: a.canReceive,
      blocked_reason: a.blockedReason,
    })),
    /* Said rather than left to be inferred from a short list: a hundred shops
       is not a plausible Teajia, so a truncated list means something is wrong
       with the question, not with the answer. */
    truncated: accounts.length >= REACHABLE_LIMIT,
  };
}

// ── definitions ──

const defs: ToolDefinition[] = [
  {
    name: 'transfer_stock',
    scope: 'stock:write',
    description: 'Move stock of one tea (grams) or one teaware (units) from this shop to another shop you hold stock-write access in. Writes a removal in the sending shop and an addition in the receiving shop as one movement, so the two halves can never disagree. The receiving shop must already carry the tea — this will not create a product there, because a new product needs a cost and a currency only that shop can state. Two-step: call once to preview, then again with confirm.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Product id in THIS shop, the one stock leaves.' },
        to_account: { type: 'string', description: 'Id or slug of the shop receiving the stock. Use list_transferable_accounts to see the choices.' },
        to_product_id: { type: 'string', description: 'Optional. The receiving shop\'s product id. Omit and it is matched by shared tea profile, then by tea key; a tie is refused rather than guessed.' },
        quantity: { type: 'number', description: 'How much to move: grams for tea, whole units for teaware. Required — omitting it is not a request to move nothing.' },
        grams: { type: 'number', description: 'Alias for quantity on a tea. Refused on teaware.' },
        units: { type: 'number', description: 'Alias for quantity on teaware. Refused on tea.' },
        note: { type: 'string', description: 'Optional note written into both ledger entries.' },
        confirm: { type: 'string', description: 'The confirmation_token from the preview call. Single use.' },
      },
      required: ['id', 'to_account'],
    },
    /* Discarded today by visibleToolDefs — see the header note. Declared so the
       tool's own file states what it is. */
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
  },
  {
    name: 'list_transferable_accounts',
    scope: 'inventory:read',
    description: 'The other shops this token\'s holder can move stock to, with the role held in each and, where stock cannot be moved there, why not. Read-only.',
    inputSchema: { type: 'object', properties: {} },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
];

export const transferToolModule: ToolModule = {
  area: 'transfer',
  defs,
  handlers: {
    transfer_stock: toolTransferStock,
    list_transferable_accounts: toolListTransferableAccounts,
  },
};

/* Exported for the tests, which drive the handlers directly: this module is not
   in TOOL_MODULES yet (see the header), so there is no mcpFetch route to reach
   it through. */
export const __testables = { membershipCanWriteStock, requiredQuantity, unitFor, columnFor, transferWarnings };

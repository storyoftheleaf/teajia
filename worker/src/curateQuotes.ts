import { prepareCurateRecordedWrite, requireCurateManager, type CurateRecordedChange } from './curateMutations';
import { QUOTE_HEADER_COLUMNS, readQuoteFields } from '../../src/lib/curateStructuredFields';
import { refreshedCurrencyName } from './exchangeRateFeed';
type Scope = { accountId: string; userId?: string; agent?: string };
type Row = Record<string, any>;
const LINE_COLUMNS = ['compass_entry_id','vendor_item_number','price_amount','price_currency','price_per_unit_grams','discount_percent','route_quotes'];
const decodeLine = (line: Row) => ({ ...line, route_quotes: line.route_quotes ? JSON.parse(line.route_quotes) : [] });
export async function listCurateQuotes(db: D1Database, scope: Scope, vendorId?: string): Promise<Row[]> {
  const rows = await db.prepare(`SELECT * FROM curate_quotes WHERE account_id = ? AND archived_at IS NULL ${vendorId ? 'AND vendor_id = ?' : ''} ORDER BY updated_at DESC, id LIMIT 100`)
    .bind(scope.accountId, ...(vendorId ? [vendorId] : [])).all<Row>();
  return rows.results;
}
export async function getCurateQuote(db: D1Database, scope: Scope, quoteId: string): Promise<Row | null> {
  const header = await db.prepare('SELECT * FROM curate_quotes WHERE id = ? AND account_id = ? AND archived_at IS NULL').bind(quoteId, scope.accountId).first<Row>();
  if (!header) return null;
  const lines = await db.prepare('SELECT * FROM curate_quote_lines WHERE quote_id = ? AND account_id = ? AND archived_at IS NULL ORDER BY id').bind(quoteId, scope.accountId).all<Row>();
  return { ...header, lines: lines.results.map(decodeLine) };
}
export async function prepareCurateQuoteWrite(db: D1Database, scope: Scope, raw: Record<string, unknown>, quoteId?: string): Promise<{ id: string; statements: D1PreparedStatement[] }> {
  const id = quoteId ?? crypto.randomUUID();
  const collision = await db.prepare('SELECT * FROM curate_quotes WHERE id = ?').bind(id).first<Row>();
  if (collision && (collision.account_id !== scope.accountId || collision.archived_at)) throw new Error('Quote not found in this account');
  const current = await getCurateQuote(db, scope, id);
  const patch = readQuoteFields(raw, current ?? {}, refreshedCurrencyName);
  const merged: Row = { ...(current ?? {}), ...patch };
  if (!merged.vendor_id || !await db.prepare('SELECT id FROM customers WHERE id = ? AND account_id = ?').bind(merged.vendor_id, scope.accountId).first()) throw new Error('Quote vendor not found in this account');
  if (!current && !scope.userId) throw new Error('Quote creator is required');
  const lines = patch.lines?.map(line => ({ ...(current?.lines.find((old: Row) => old.id === line.id) ?? {}), ...line }));
  if (lines) for (const line of lines) {
    const old = await db.prepare('SELECT quote_id, account_id FROM curate_quote_lines WHERE id = ?').bind(line.id).first<Row>();
    if (old && (old.account_id !== scope.accountId || old.quote_id !== id)) throw new Error('Quote line identity belongs to another quote/account');
    const tea = await db.prepare('SELECT vendor_id FROM tea_compass_entries WHERE id = ? AND account_id = ?').bind(line.compass_entry_id, scope.accountId).first<Row>();
    if (!tea || tea.vendor_id !== merged.vendor_id) throw new Error('Quote tea must belong to this account and vendor');
    if ((line.price_amount == null) !== (line.price_currency == null)) throw new Error('Quote line amount and currency must be supplied or cleared together');
    if (line.price_amount != null && !Object.prototype.hasOwnProperty.call(line, 'price_per_unit_grams')) throw new Error('Quote line needs price_per_unit_grams; null explicitly means per piece');
  }
  if (!scope.userId) throw new Error('Quote editor identity is required');
  await requireCurateManager(db, { accountId: scope.accountId, userId: scope.userId });
  if (!lines && raw.vendor_id !== undefined && current?.lines.length && current.vendor_id !== merged.vendor_id) {
    throw new Error('A quote with linked teas cannot change vendor without reviewed replacement lines');
  }
  if (lines && new Set(lines.map(line => line.compass_entry_id)).size !== lines.length) throw new Error('Quote has duplicate tea links');
  const now = new Date().toISOString();
  const headerBefore = collision;
  const headerAfter: Row = { ...(headerBefore ?? {}), id, account_id: scope.accountId,
    ...(headerBefore ? {} : { created_by_user_id: scope.userId, created_by_agent: scope.agent ?? null, created_at: now, archived_at: null }), updated_at: now };
  for (const key of QUOTE_HEADER_COLUMNS) headerAfter[key] = merged[key] ?? null;
  const changes: CurateRecordedChange[] = [{ entityType: 'quote', entityId: id, before: headerBefore, after: headerAfter }];
  if (lines) {
    const oldLines = await db.prepare('SELECT * FROM curate_quote_lines WHERE quote_id = ? AND account_id = ? AND archived_at IS NULL').bind(id, scope.accountId).all<Row>();
    const existing = new Map(oldLines.results.map(line => [line.id, line]));
    const desired = new Set(lines.map(line => line.id));
    const teaChanges = new Map<string, { before: Row; after: Row }>();
    for (const old of oldLines.results) {
      const replacement = lines.find(line => line.id === old.id);
      if (desired.has(old.id) && replacement?.compass_entry_id === old.compass_entry_id) continue;
      if (!desired.has(old.id)) changes.push({ entityType: 'quote_line', entityId: old.id, before: old, after: { ...old, archived_at: now } });
      const tea = await db.prepare('SELECT * FROM tea_compass_entries WHERE id = ? AND account_id = ?').bind(old.compass_entry_id, scope.accountId).first<Row>();
      if (tea?.quote_id === id) teaChanges.set(tea.id, { before: tea, after: { ...tea, quote_id: null, updated_at: now } });
    }
    for (const line of lines) {
      const old = existing.get(line.id) ?? await db.prepare('SELECT * FROM curate_quote_lines WHERE id = ? AND quote_id = ? AND account_id = ?').bind(line.id, id, scope.accountId).first<Row>();
      const after: Row = { id: line.id, account_id: scope.accountId, quote_id: id, archived_at: null };
      for (const key of LINE_COLUMNS) after[key] = key === 'route_quotes' ? JSON.stringify(line[key] ?? []) : line[key] ?? null;
      changes.push({ entityType: 'quote_line', entityId: line.id, before: old ?? null, after });
      const tea = await db.prepare('SELECT * FROM tea_compass_entries WHERE id = ? AND account_id = ?').bind(line.compass_entry_id, scope.accountId).first<Row>();
      const previous = teaChanges.get(tea!.id);
      teaChanges.set(tea!.id, { before: previous?.before ?? tea!, after: { ...(previous?.after ?? tea), quote_id: id, updated_at: now } });
    }
    for (const [teaId, change] of teaChanges) changes.push({ entityType: 'tea', entityId: teaId, ...change });
  }
  const write = prepareCurateRecordedWrite(db, { accountId: scope.accountId, userId: scope.userId }, { commandType: 'quote:save', agent: scope.agent, changes });
  return { id, statements: [...write.statements, write.assertion] };
}

export async function validateCompassQuoteLink(db: D1Database, accountId: string, entry: Row): Promise<void> {
  if (entry.quote_id == null) return;
  const quote = await db.prepare('SELECT vendor_id FROM curate_quotes WHERE id = ? AND account_id = ? AND archived_at IS NULL').bind(entry.quote_id, accountId).first<Row>();
  if (!quote || quote.vendor_id !== entry.vendor_id) throw new Error('Quote link must belong to this account and tea vendor');
}

/**
 * WeChat and Instagram live in a customer's `contacts` list, not in columns.
 *
 * `customers` has no `wechat` or `instagram` column in the migration ledger or
 * in schema.sql, but the customer update route allowed both names, so any
 * update carrying one ("UPDATE customers SET wechat = ?") failed outright.
 * Curate's vendor card sends WeChat in the same payload as the phone, the
 * WhatsApp, the business-card photo and the location, so adding a vendor's
 * WeChat silently lost every one of those with it.
 *
 * The site already keeps these handles as `{channel, handle}` entries in
 * `contacts` (src/admin/types.ts ContactEntry). So a write folds them in there,
 * and a read lifts them back out under their old names for any screen that
 * still reads `customer.wechat`.
 */

export const HANDLE_CHANNELS = ['wechat', 'instagram'] as const;
type HandleChannel = (typeof HANDLE_CHANNELS)[number];

interface ContactEntry { channel: string; handle: string }

function parseContacts(raw: unknown): ContactEntry[] {
  if (Array.isArray(raw)) return raw as ContactEntry[];
  if (typeof raw !== 'string' || !raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Moves `wechat` / `instagram` out of an update body and into its `contacts`.
 *
 * `existingContacts` is what the row holds now; the body's own `contacts`, when
 * it sends one, wins over it. A handle sent as an empty string or null removes
 * that channel. The body is changed in place; returns whether it touched
 * contacts, so the caller knows `contacts` must be written.
 */
export function foldHandlesIntoContacts(body: Record<string, unknown>, existingContacts: unknown): boolean {
  const present = HANDLE_CHANNELS.filter((c) => Object.prototype.hasOwnProperty.call(body, c));
  if (present.length === 0) return false;
  let contacts = parseContacts(body.contacts ?? existingContacts);
  for (const channel of present) {
    const value = body[channel];
    delete body[channel];
    const handle = typeof value === 'string' ? value.trim() : value == null ? '' : String(value).trim();
    contacts = contacts.filter((c) => c.channel !== channel);
    if (handle) contacts.push({ channel, handle });
  }
  body.contacts = JSON.stringify(contacts);
  return true;
}

/** A customer row with `wechat` / `instagram` lifted back out of `contacts`. */
export function withContactHandles<T extends Record<string, unknown>>(row: T): T & Partial<Record<HandleChannel, string>> {
  const contacts = parseContacts(row.contacts);
  const out: Record<string, unknown> = { ...row };
  for (const channel of HANDLE_CHANNELS) {
    if (out[channel]) continue;
    const found = contacts.find((c) => c.channel === channel && c.handle);
    if (found) out[channel] = found.handle;
  }
  return out as T & Partial<Record<HandleChannel, string>>;
}

/**
 * A customer's tags as a list, whatever shape the row holds.
 *
 * `tags` is meant to be a JSON array, but Curate's vendor picker created
 * vendors with `tags: 'vendor'`, a bare word, and the create route stored it as
 * sent. Every read then ran JSON.parse over it and threw, so one vendor added
 * from Curate took down the whole customer list. Reads now accept a bare word
 * or a comma list as well as JSON; writes store JSON.
 */
export function customerTagList(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map(String).filter(Boolean);
  if (typeof raw !== 'string' || !raw.trim()) return [];
  const text = raw.trim();
  if (text.startsWith('[')) {
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean);
    } catch { /* fall through to the plain-text reading */ }
  }
  return text.split(',').map((t) => t.trim()).filter(Boolean);
}

/** Tags as the column stores them: a JSON array. */
export function customerTagsForStore(raw: unknown): string {
  return JSON.stringify(customerTagList(raw));
}

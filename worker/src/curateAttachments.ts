/** Private, role-labelled source evidence, shared by the app and agent tools. */
import type { ToolAuth, ToolEnv } from './mcpTools/registry';
import { issueTicket, consumeTicket, INVALID_TICKET, previewEnvelope } from './mcpTools/tickets';
import { requireCurateManager, prepareCurateRecordedWrite } from './curateMutations';

const TARGETS = { tea: 'tea_compass_entries', vendor: 'customers', arrival: 'curate_receipt_proposals', quote: 'curate_quotes' } as const;
const ROLES = ['leaf','liquor','wrapper','label','pricelist','businesscard','source_document'] as const;
export type AttachmentTarget = keyof typeof TARGETS;
export const MAX_ATTACHMENT_BYTES = 6 * 1024 * 1024;
type Input = { entity_type: AttachmentTarget; entity_id: string; role: typeof ROLES[number]; filename: string; mime_type: string; data_base64: string; agent?: string; confirm?: string };
type Ticket = { kind: 'curate:attach'; accountId: string; userId: string; entityType: AttachmentTarget; entityId: string; role: Input['role']; filename: string; mime: string; digest: string; size: number; assetId: string; attachmentId: string; agent: string };

export async function attachmentTarget(db: D1Database, accountId: string, type: unknown, id: unknown) {
  if (typeof type !== 'string' || !Object.hasOwn(TARGETS,type) || typeof id !== 'string' || !id || id.length > 100) throw new Error('A valid attachment target is required');
  const table = TARGETS[type as AttachmentTarget];
  const row = await db.prepare(`SELECT * FROM ${table} WHERE id = ? AND account_id = ?`).bind(id, accountId).first<Record<string, any>>();
  if (!row || row.deleted_at || row.archived_at || row.merged_into_id) throw new Error('Attachment target not found');
  return row;
}
export function decodeAttachment(input: Pick<Input, 'data_base64'|'mime_type'|'filename'|'role'>) {
  if (!ROLES.includes(input.role)) throw new Error('Choose a supported photo or document role');
  if (typeof input.filename !== 'string' || !input.filename.trim() || input.filename.length > 200 || /[\x00-\x1f/\\]/.test(input.filename)) throw new Error('A plain filename is required');
  const encoded = input.data_base64;
  if (typeof encoded !== 'string' || !encoded || encoded.length > Math.ceil(MAX_ATTACHMENT_BYTES / 3) * 4 || encoded.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(encoded)) throw new Error('File must be valid base64, at most 6 MiB decoded');
  let decoded: string;
  try { decoded = atob(encoded); } catch { throw new Error('File must be valid base64'); }
  const bytes = Uint8Array.from(decoded, c => c.charCodeAt(0));
  if (!bytes.length || bytes.length > MAX_ATTACHMENT_BYTES) throw new Error('File must contain 1 byte to 6 MiB');
  const starts = (...signature: number[]) => signature.every((b, i) => bytes[i] === b);
  const ascii = (offset: number, length: number) => String.fromCharCode(...bytes.slice(offset, offset + length));
  const mime = input.mime_type?.toLowerCase();
  const valid = mime === 'image/jpeg' ? starts(255,216,255)
    : mime === 'image/png' ? starts(137,80,78,71,13,10,26,10)
    : mime === 'image/webp' ? ascii(0,4) === 'RIFF' && ascii(8,4) === 'WEBP'
    : mime === 'application/pdf' ? ascii(0,5) === '%PDF-' : false;
  if (!valid) throw new Error('Use a JPEG, PNG, WebP or PDF whose bytes match its file type');
  if (['leaf','liquor','wrapper','label'].includes(input.role) && !mime.startsWith('image/')) throw new Error('Tea photo roles require an image');
  return { bytes, mime, filename: input.filename.trim() };
}
const digestOf = async (bytes: Uint8Array) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(b => b.toString(16).padStart(2,'0')).join('');

export async function uploadCurateAttachment(env: ToolEnv & { ATLAS_BUCKET?: R2Bucket }, auth: ToolAuth, input: Input) {
  await requireCurateManager(env.DB, auth);
  await attachmentTarget(env.DB, auth.accountId, input.entity_type, input.entity_id);
  if (input.role === 'businesscard' && input.entity_type !== 'vendor') throw new Error('Attach a business card to its vendor');
  const file = decodeAttachment(input);
  const digest = await digestOf(file.bytes);
  if (!input.confirm) {
    const ticket: Ticket = { kind: 'curate:attach', accountId: auth.accountId, userId: auth.userId, entityType: input.entity_type, entityId: input.entity_id, role: input.role, filename: file.filename, mime: file.mime, digest, size: file.bytes.length, assetId: crypto.randomUUID(), attachmentId: crypto.randomUUID(), agent: String(input.agent || 'the app').slice(0,60) };
    const token = await issueTicket(env, ticket, auth.tokenId);
    return previewEnvelope({ action: 'curate_upload_attachment', entity_type: ticket.entityType, entity_id: ticket.entityId, filename: ticket.filename, role: ticket.role, size_bytes: ticket.size, sha256: digest, visibility: 'Private shop evidence. Not published to the storefront.' }, token);
  }
  const ticket = await consumeTicket<Ticket, 'curate:attach'>(env, input.confirm, 'curate:attach', auth);
  if (!ticket || ticket.userId !== auth.userId) return INVALID_TICKET;
  if (ticket.digest !== digest || ticket.entityType !== input.entity_type || ticket.entityId !== input.entity_id || ticket.role !== input.role || ticket.filename !== file.filename || ticket.mime !== file.mime) throw new Error('File or target changed since preview; preview again');
  if (!env.ATLAS_BUCKET) throw new Error('Private file storage is unavailable');
  const now = new Date().toISOString();
  const key = `curate/attachments/${auth.accountId}/${ticket.assetId}`;
  const asset = { id: ticket.assetId, account_id: auth.accountId, object_key: key, filename: file.filename, mime_type: file.mime, size_bytes: file.bytes.length, sha256: digest, state: 'attached', created_by_user_id: auth.userId, created_at: now, deleted_at: null };
  const attachment = { id: ticket.attachmentId, account_id: auth.accountId, asset_id: asset.id, entity_type: ticket.entityType, entity_id: ticket.entityId, role: ticket.role, position: 0, created_by_user_id: auth.userId, created_at: now, deleted_at: null };
  const write = await prepareCurateRecordedWrite(env.DB, auth, { commandType: 'attachment.attach', agent: ticket.agent,
    guards: [{sql: `EXISTS(SELECT 1 FROM ${TARGETS[ticket.entityType]} WHERE id=? AND account_id=?${ticket.entityType === 'tea' || ticket.entityType === 'vendor' ? ' AND deleted_at IS NULL AND archived_at IS NULL AND merged_into_id IS NULL' : ticket.entityType === 'quote' ? ' AND archived_at IS NULL' : ''})`, values:[ticket.entityId,auth.accountId]}], changes: [
    { entityType: 'asset', entityId: asset.id, before: null, after: asset },
    { entityType: 'attachment', entityId: attachment.id, before: null, after: attachment },
  ] });
  await env.ATLAS_BUCKET.put(key, file.bytes, { httpMetadata: { contentType: file.mime }, customMetadata: { account: auth.accountId, sha256: digest } });
  try {
    await env.DB.batch([...write.statements, write.assertion]);
    const saved = await env.DB.prepare('SELECT id FROM curate_attachments WHERE id = ? AND account_id = ?').bind(attachment.id, auth.accountId).first();
    if (!saved) throw new Error('Attachment changed while confirming; preview again');
  } catch (error) {
    // Keep immutable private bytes on an ambiguous failure; deleting could
    // break a DB write that committed before the response was interrupted.
    throw error;
  }
  return { confirmed: true, mutation_id: write.mutationId, attachment: { ...attachment, filename: asset.filename, mime_type: asset.mime_type, size_bytes: asset.size_bytes, content_url: `/api/curate/attachments/${attachment.id}/content` } };
}

export async function listCurateAttachments(db: D1Database, scope: { accountId: string }, type: AttachmentTarget, id: string) {
  await attachmentTarget(db, scope.accountId, type, id);
  const rows = await db.prepare(`SELECT a.id,a.entity_type,a.entity_id,a.role,a.created_at,m.filename,m.mime_type,m.size_bytes
    FROM curate_attachments a JOIN curate_media_assets m ON m.id=a.asset_id AND m.account_id=a.account_id
    WHERE a.account_id=? AND a.entity_type=? AND a.entity_id=? AND a.deleted_at IS NULL AND m.deleted_at IS NULL ORDER BY a.position,a.created_at`).bind(scope.accountId,type,id).all();
  return rows.results.map((r: any) => ({ ...r, content_url: `/api/curate/attachments/${r.id}/content` }));
}
export async function readCurateAttachment(env: {DB: D1Database; ATLAS_BUCKET?: R2Bucket}, scope: {accountId: string}, id: string) {
  const row = await env.DB.prepare(`SELECT a.entity_type,a.entity_id,m.object_key,m.filename,m.mime_type
    FROM curate_attachments a JOIN curate_media_assets m ON m.id=a.asset_id AND m.account_id=a.account_id
    WHERE a.id=? AND a.account_id=? AND a.deleted_at IS NULL AND m.deleted_at IS NULL`).bind(id,scope.accountId).first<Record<string,any>>();
  if (!row) return new Response('Not found',{status:404});
  await attachmentTarget(env.DB,scope.accountId,row.entity_type,row.entity_id);
  const object = await env.ATLAS_BUCKET?.get(row.object_key);
  if (!object) return new Response('Not found',{status:404});
  return new Response(object.body,{headers:{'Content-Type':row.mime_type,'Content-Disposition':`attachment; filename*=UTF-8''${encodeURIComponent(row.filename)}`,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
}

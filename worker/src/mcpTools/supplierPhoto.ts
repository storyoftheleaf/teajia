/**
 * `set_supplier_photo`: put a picture on a supplier's card from an agent.
 *
 * Adrian, 2026-11-25: "I want to change who the supplier is as well as his
 * picture, so that I can just send you his supply info and you can put all
 * the pertinent information in there." The words already have doors
 * (`curate_save_vendor`, `rename_supplier`, `curate_set_product_vendor`); the
 * picture did not. The app keeps three on the vendor's customers row
 * (migration 0082): the face Adrian recognises them by, the storefront and the
 * business card. `vendorFaces.ts` shows the face first, then the shop, then
 * the card.
 *
 * What it does, and why:
 *   - The picture arrives as an https link or as base64, read by the same
 *     `readAgentPhoto` that `curate_add_photo` uses, and its first bytes are
 *     checked against its type, as the app's upload route does, because this
 *     lands on the public media path.
 *   - Two steps, like `curate_add_photo`: the preview pins the picture's
 *     SHA-256 and the photo it replaces, and confirm must send the same
 *     picture again. A link whose picture changed in between, or a card whose
 *     photo someone else changed, writes nothing.
 *   - The app squares a face on the face at 800 px before it saves it,
 *     because faces are shown small and vendor photos are often fetched on a
 *     slow connection. The worker cannot run the app's face finder, so it asks
 *     Cloudflare Images for the same frame (cover, gravity face); storefronts
 *     and cards are only scaled down. If Images is unavailable the picture is
 *     kept as sent, and the answer says so. Adrian can reframe any face in the
 *     vendor Faces view, which opens the shared photo editor.
 *   - The write is a recorded Curate write on the vendor, so it shows in
 *     curate_history with its before and after and curate_undo can put the
 *     old photo back. The old file is not deleted.
 */
import { prepareCurateRecordedWrite, requireCurateManager } from '../curateMutations';
import { readAgentPhoto } from './curatePhotos';
import { isVendorRow, vendorById } from './curateIntake';
import type { ToolAuth, ToolDefinition, ToolEnv, ToolModule } from './registry';
import { consumeTicket, INVALID_TICKET, issueTicket, previewEnvelope, type TicketPayload } from './tickets';

const SLOTS = {
  face: 'face_photo',
  storefront: 'storefront_photo',
  business_card: 'business_card_photo',
} as const;
type Slot = keyof typeof SLOTS;
type PhotoColumn = (typeof SLOTS)[Slot];

const SLOT_WORDS: Record<Slot, string> = { face: 'face photo', storefront: 'storefront photo', business_card: 'business card photo' };
const EXTENSIONS: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

interface ImagesLike {
  input(stream: ReadableStream<Uint8Array>): {
    transform(options: Record<string, unknown>): {
      output(options: { format: string; quality?: number }): Promise<{ response(): Response }>;
    };
  };
}
type PhotoEnv = ToolEnv & { IMAGES?: ImagesLike };

interface SupplierPhotoTicket extends TicketPayload {
  kind: 'set_supplier_photo';
  userId: string;
  vendorId: string;
  slot: Slot;
  digest: string;
  previous: string | null;
  agent: string;
}

const text = (v: unknown, max: number): string | null => {
  const s = typeof v === 'string' ? v.trim().slice(0, max) : '';
  return s || null;
};

function readSlot(value: unknown): Slot {
  if (value === undefined || value === null || value === '') return 'face';
  const slot = String(value).trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (slot === 'card') return 'business_card';
  if (slot === 'shop' || slot === 'storefront_photo') return 'storefront';
  if (!Object.hasOwn(SLOTS, slot)) throw new Error('photo must be face, storefront or business_card');
  return slot as Slot;
}

/** The first bytes say what the file is; a jpeg label on anything else is refused. */
export function looksLikeImage(bytes: Uint8Array, type: string): boolean {
  if (type === 'image/jpeg') return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (type === 'image/png') return [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((v, i) => bytes[i] === v);
  if (type === 'image/webp') {
    const ascii = String.fromCharCode(...bytes.slice(0, 12));
    return ascii.startsWith('RIFF') && ascii.slice(8, 12) === 'WEBP';
  }
  return false;
}

async function digestOf(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
}

async function readPicture(args: any): Promise<{ bytes: Uint8Array; type: string }> {
  const photo = await readAgentPhoto(args ?? {});
  if (!looksLikeImage(photo.bytes, photo.type)) throw new Error('That file is not the picture it says it is. Send a jpeg, png or webp.');
  return photo;
}

/**
 * A face squared on the face at 800 px, a shop or card scaled to fit 1600 px,
 * both as jpeg. Falls back to a centred square for a face, then to the picture
 * as sent, so a missing or failing Images binding never loses the photo.
 */
export async function shrinkForCard(env: PhotoEnv, photo: { bytes: Uint8Array; type: string }, slot: Slot):
  Promise<{ bytes: Uint8Array; type: string; framed: 'face' | 'centre' | 'scaled' | 'as_sent' }> {
  const images = env.IMAGES;
  if (!images) return { ...photo, framed: 'as_sent' };
  const attempts: Array<{ framed: 'face' | 'centre' | 'scaled'; transform: Record<string, unknown> }> = slot === 'face'
    ? [
        { framed: 'face', transform: { width: 800, height: 800, fit: 'cover', gravity: 'face' } },
        { framed: 'centre', transform: { width: 800, height: 800, fit: 'cover', gravity: 'center' } },
      ]
    : [{ framed: 'scaled', transform: { width: 1600, height: 1600, fit: 'scale-down' } }];
  for (const attempt of attempts) {
    try {
      const result = await images
        .input(new Blob([photo.bytes], { type: photo.type }).stream())
        .transform(attempt.transform)
        .output({ format: 'image/jpeg', quality: 80 });
      const response = result.response();
      if (!response.ok) continue;
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (bytes.length && looksLikeImage(bytes, 'image/jpeg')) return { bytes, type: 'image/jpeg', framed: attempt.framed };
    } catch {
      /* try the next frame, then keep the picture as sent */
    }
  }
  return { ...photo, framed: 'as_sent' };
}

async function currentPhotos(env: ToolEnv, auth: ToolAuth, vendorId: string) {
  return env.DB.prepare('SELECT face_photo, storefront_photo, business_card_photo FROM customers WHERE id = ? AND account_id = ?')
    .bind(vendorId, auth.accountId).first<Record<PhotoColumn, string | null>>();
}

async function toolSetSupplierPhoto(rawEnv: ToolEnv, auth: ToolAuth, args: any): Promise<unknown> {
  const env = rawEnv as PhotoEnv;
  await requireCurateManager(env.DB, auth);
  const confirm = text(args?.confirm, 100);

  if (confirm) {
    const t = await consumeTicket<SupplierPhotoTicket, 'set_supplier_photo'>(env, confirm, 'set_supplier_photo', auth);
    if (!t || t.userId !== auth.userId) return INVALID_TICKET;
    const vendorId = text(args?.vendor_id, 80);
    if (vendorId && vendorId !== t.vendorId) return INVALID_TICKET;
    const photo = await readPicture(args);
    if (await digestOf(photo.bytes) !== t.digest) {
      return { error: 'picture_changed', message: 'That is not the picture the preview showed. Nothing was changed; preview again with the picture you mean.' };
    }
    if (!env.MEDIA_BUCKET) return { error: 'media_storage_unavailable', message: 'The shop could not reach its photo storage. Nothing was changed.' };
    const column = SLOTS[t.slot];
    const before = await env.DB.prepare(
      'SELECT * FROM customers WHERE id = ? AND account_id = ? AND deleted_at IS NULL AND archived_at IS NULL AND merged_into_id IS NULL'
    ).bind(t.vendorId, auth.accountId).first<Record<string, any>>();
    if (!before) return { error: 'not_found', message: 'That supplier was removed or merged after the preview. Nothing was changed.' };
    if ((before[column] ?? null) !== t.previous) {
      return { error: 'photo_changed_since_preview', message: `The ${SLOT_WORDS[t.slot]} on the card changed after the preview. Nothing was changed; preview again.` };
    }

    const stored = await shrinkForCard(env, photo, t.slot);
    const key = `accounts/${auth.accountId}/products/${crypto.randomUUID()}.${EXTENSIONS[stored.type] ?? 'jpg'}`;
    await env.MEDIA_BUCKET.put(key, stored.bytes, { httpMetadata: { contentType: stored.type } });
    // The address the app's own upload route returns, so every view that
    // already rewrites media addresses shows this one the same way.
    const url = `https://media.teajia.co/${key}?v=${Date.now()}`;
    const after: Record<string, any> = { ...before, [column]: url, updated_at: new Date().toISOString() };
    // A new face replaces the whole photo the old one was cut from
    // (migration 0153), so reframing opens on this picture, not the old one.
    if (t.slot === 'face' && 'face_photo_original' in before) after.face_photo_original = null;
    const write = prepareCurateRecordedWrite(env.DB, auth, {
      commandType: 'vendor:update', agent: t.agent,
      changes: [{ entityType: 'vendor', entityId: t.vendorId, before, after }],
    });
    // The file is written before the row, as curate_add_photo does: an
    // unreferenced file is harmless, a row pointing at no file is a broken face.
    await env.DB.batch([...write.statements, write.assertion]);
    return {
      committed: true,
      action: 'set_supplier_photo',
      mutation_id: write.mutationId,
      vendor: { id: t.vendorId, name: before.name },
      photo: t.slot,
      url,
      replaced: t.previous,
      framed: stored.framed,
      ...(t.slot === 'face' ? { reframe: 'If the face sits off-centre, Adrian can reframe it in the vendor Faces view.' } : {}),
      undo: 'curate_undo with this mutation_id puts the previous photo back.',
    };
  }

  const vendorId = text(args?.vendor_id, 80);
  if (!vendorId) throw new Error('vendor_id is required. Find the supplier with curate_find or curate_get_vendor.');
  const slot = readSlot(args?.photo);
  const vendor = await vendorById(env, auth, vendorId);
  if (!vendor) return { error: 'not_found', message: 'No active supplier with that id in this shop.' };
  if (!isVendorRow(vendor)) {
    return { error: 'not_a_supplier', message: `${vendor.name} is in the shop as a contact, not a supplier. Save them as a vendor with curate_save_vendor first.` };
  }
  const photo = await readPicture(args);
  const photos = await currentPhotos(env, auth, vendorId);
  const previous = photos?.[SLOTS[slot]] ?? null;
  const digest = await digestOf(photo.bytes);
  const token = await issueTicket<SupplierPhotoTicket>(env, {
    kind: 'set_supplier_photo', accountId: auth.accountId, userId: auth.userId, vendorId, slot, digest, previous,
    agent: text(args?.agent, 60) ?? 'an agent',
  }, auth.tokenId);
  const words = SLOT_WORDS[slot];
  return previewEnvelope({
    action: 'set_supplier_photo',
    read_back: previous
      ? `Replace ${vendor.name}'s ${words} with this picture.`
      : `Add this picture as ${vendor.name}'s ${words}.`,
    vendor: { id: vendor.id, name: vendor.name, chinese_name: vendor.chinese_name ?? null, company: vendor.company ?? null },
    photo: slot,
    current_photo: previous,
    new_picture: { type: photo.type, size_bytes: photo.bytes.length, sha256: digest },
    will_store: slot === 'face' ? 'Squared on the face at 800 px.' : 'Scaled to fit 1600 px.',
    how_to_confirm: 'Send confirm with the same image_url or image_base64 after Adrian says yes.',
  }, token);
}

const defs: ToolDefinition[] = [
  {
    name: 'set_supplier_photo',
    scope: 'stock:write',
    description: 'Add or replace a supplier\'s picture on their card: their face (what Adrian recognises them by, shown in the vendor pickers), their storefront, or their business card. Send the picture as an https link the shop can open (a Drive link must be shared as "anyone with the link") or as image_base64; jpeg, png or webp under 6 MiB. Find the supplier with curate_find first; to change their name or contact details use curate_save_vendor, and to change which supplier a tea is from use curate_set_product_vendor. Two steps: read the preview back, then send confirm with the same picture only after Adrian said yes. Recorded in curate_history and reversible with curate_undo.',
    inputSchema: {
      type: 'object',
      properties: {
        vendor_id: { type: 'string', description: 'The supplier\'s id from curate_find or curate_get_vendor.' },
        photo: { type: 'string', enum: ['face', 'storefront', 'business_card'], description: 'Which picture on the card. Default face.' },
        image_url: { type: 'string', description: 'An https link to the picture.' },
        image_base64: { type: 'string', description: 'The picture itself, base64, when there is no link.' },
        mime_type: { type: 'string', enum: ['image/jpeg', 'image/png', 'image/webp'], description: 'With image_base64. Default image/jpeg.' },
        agent: { type: 'string', description: 'Who is adding it, e.g. Claude, so the history says where it came from.' },
        confirm: { type: 'string', description: 'The confirmation_token from the preview, sent with the same picture after Adrian said yes.' },
      },
      additionalProperties: false,
    },
    annotations: { destructiveHint: false },
  },
];

export const supplierPhotoTools: ToolModule = {
  area: 'supplier-photo',
  defs,
  handlers: { set_supplier_photo: toolSetSupplierPhoto },
};

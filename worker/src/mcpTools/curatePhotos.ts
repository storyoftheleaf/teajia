import { requireCurateManager } from '../curateMutations';
/** Private role-labelled photos for agents. A preview/confirm wrapper over the
 * same attachment service the app uses. No automatic Drive or public copying. */

import { teaDriveFiles, type DriveEnv } from '../curateDrive';
import { uploadCurateAttachment, listCurateAttachments, MAX_ATTACHMENT_BYTES } from '../curateAttachments';
import { entryById, str } from './curateIntake';
import type { ToolDefinition, ToolEnv, ToolHandler, ToolModule } from './registry';

const MAX_PHOTO_BYTES = MAX_ATTACHMENT_BYTES;
const TYPES: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

type PhotoEnv = ToolEnv & DriveEnv & { KEY_ENCRYPTION_SECRET?: string; ATLAS_BUCKET?: R2Bucket };

/** The picture the agent sent, read and checked: an image, under 6 MiB. */
export async function readAgentPhoto(args: { image_url?: unknown; image_base64?: unknown; mime_type?: unknown }): Promise<{ bytes: Uint8Array; type: string }> {
  const url = str(args.image_url, 2000);
  const b64 = typeof args.image_base64 === 'string' ? args.image_base64.replace(/^data:[^,]*,/, '').replace(/\s+/g, '') : '';
  if (!url && !b64) throw new Error('image_url or image_base64 is required');
  if (b64.length > Math.ceil(MAX_PHOTO_BYTES / 3) * 4) throw new Error('That photo is over 6 MiB.');
  if (url) {
    if (!/^https:\/\//i.test(url)) throw new Error('image_url must be an https link the shop can open');
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) throw new Error(`Could not open the image (${res.status}). A Drive link must be shared as "anyone with the link", or send image_base64.`);
    const type = (res.headers.get('Content-Type') || '').split(';')[0].trim().toLowerCase();
    if (!TYPES[type]) throw new Error(`That link is not a photo (${type || 'unknown type'}). Send a jpeg, png, webp or heic.`);
    if (Number(res.headers.get('content-length')) > MAX_PHOTO_BYTES) throw new Error('That photo is over 6 MiB.');
    const reader = res.body?.getReader();
    if (!reader) throw new Error('Image response has no bytes');
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.length;
      if (size > MAX_PHOTO_BYTES) { await reader.cancel(); throw new Error('That photo is over 6 MiB.'); }
      chunks.push(chunk.value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    if (bytes.length > MAX_PHOTO_BYTES) throw new Error('That photo is over 6 MiB.');
    return { bytes, type };
  }
  const type = String(args.mime_type || 'image/jpeg').toLowerCase();
  if (!TYPES[type]) throw new Error('mime_type must be image/jpeg, image/png, image/webp or image/heic');
  let bin: string;
  try { bin = atob(b64); } catch { throw new Error('image_base64 is not valid base64'); }
  if (bin.length > MAX_PHOTO_BYTES) throw new Error('That photo is over 6 MiB.');
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return { bytes, type };
}

const toolAddPhoto: ToolHandler = async (rawEnv, auth, args) => {
  const env = rawEnv as PhotoEnv;
  const teaId = str(args?.tea_id, 80);
  if (!teaId) throw new Error('tea_id is required');
  await requireCurateManager(env.DB, auth);
  const entry = await entryById(env, auth, teaId);
  if (!entry) throw new Error('No active tea in this shop (tea_id)');
  const photo = await readAgentPhoto(args ?? {});
  let encoded = '';
  for (let offset = 0; offset < photo.bytes.length; offset += 8192) encoded += String.fromCharCode(...photo.bytes.slice(offset, offset + 8192));
  return uploadCurateAttachment(env, auth, {
    entity_type: 'tea', entity_id: teaId, role: args?.role ?? 'label',
    filename: args?.filename ?? `capture.${TYPES[photo.type]}`,
    mime_type: photo.type, data_base64: btoa(encoded),
    agent: str(args?.agent, 60) ?? 'an agent', confirm: str(args?.confirm, 100) ?? undefined,
  });
};

const toolTeaPhotos: ToolHandler = async (rawEnv, auth, args) => {
  const env = rawEnv as PhotoEnv;
  const teaId = str(args?.tea_id, 80);
  if (!teaId) throw new Error('tea_id is required');
  const entry = await entryById(env, auth, teaId);
  if (!entry) throw new Error('No such tea in Curate (tea_id)');
  let photos: string[] = [];
  try { photos = JSON.parse(String(entry.photos || '[]')); } catch { photos = []; }
  return { tea: entry.name, photos, attachments: await listCurateAttachments(env.DB, auth, 'tea', teaId), drive: await teaDriveFiles(env, auth.accountId, teaId) };
};

const defs: ToolDefinition[] = [
  {
    name: 'curate_add_photo',
    scope: 'stock:write',
    description: 'Attach a private photo to a shop Curate tea, including a tea written by another authorized shop author. Read the preview and confirm only after Adrian agrees, resending the same file and role. Supports label, leaf, liquor, wrapper, pricelist and source_document roles. No file is published, put onto the shelf or copied to Drive automatically.',
    inputSchema: {
      type: 'object',
      properties: {
        tea_id: { type: 'string', description: 'The Curate tea, from curate_find or curate_add_tea.' },
        image_url: { type: 'string', description: 'An https link to the photo.' },
        image_base64: { type: 'string', description: 'The photo itself, base64, when there is no link.' },
        mime_type: { type: 'string', enum: Object.keys(TYPES), description: 'For image_base64. Default image/jpeg.' },
        filename: { type: 'string', description: 'Plain filename; defaults to capture plus the image extension.' },
        role: { type: 'string', enum: ['label','leaf','liquor','wrapper','pricelist','source_document'], description: 'Private photo purpose; default label is shown in the preview.' },
        confirm: { type: 'string', description: 'Confirmation token from the exact file preview.' },
        agent: { type: 'string', description: 'Who is calling, in one word.' },
      },
      required: ['tea_id'],
      additionalProperties: false,
    },
  },
  {
    name: 'curate_tea_photos',
    scope: 'inventory:read',
    description: 'The photos on a Curate tea, and its Google Drive folder and files when Drive is connected.',
    inputSchema: {
      type: 'object',
      properties: { tea_id: { type: 'string' } },
      required: ['tea_id'],
      additionalProperties: false,
    },
  },
];

export const curatePhotoTools: ToolModule = {
  area: 'curate-photos',
  defs,
  handlers: { curate_add_photo: toolAddPhoto, curate_tea_photos: toolTeaPhotos },
};

/**
 * Photos on a Curate tea, for agents.
 *
 * An agent hands over a picture (a link it can reach, or the image itself) and
 * the shop keeps it exactly as the app keeps one Adrian takes: a copy in the
 * shop's media store on the tea's card, and a copy in the tea's folder in the
 * shop's Google Drive when Drive is connected. One step: a photo on a Curate
 * tea changes nothing on the shop's shelf.
 */

import { driveSeal, driveStatus, savePhotosToDrive, teaDriveFiles, type DriveEnv } from '../curateDrive';
import { entryById, str } from './curateIntake';
import type { ToolDefinition, ToolEnv, ToolHandler, ToolModule } from './registry';

const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
const TYPES: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/heic': 'heic' };

type PhotoEnv = ToolEnv & DriveEnv & { KEY_ENCRYPTION_SECRET?: string };

/** The picture the agent sent, read and checked: an image, under 10 MB. */
export async function readAgentPhoto(args: { image_url?: unknown; image_base64?: unknown; mime_type?: unknown }): Promise<{ bytes: Uint8Array; type: string }> {
  const url = str(args.image_url, 2000);
  const b64 = typeof args.image_base64 === 'string' ? args.image_base64.replace(/^data:[^,]*,/, '').replace(/\s+/g, '') : '';
  if (!url && !b64) throw new Error('image_url or image_base64 is required');
  if (url) {
    if (!/^https:\/\//i.test(url)) throw new Error('image_url must be an https link the shop can open');
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Could not open the image (${res.status}). A Drive link must be shared as "anyone with the link", or send image_base64.`);
    const type = (res.headers.get('Content-Type') || '').split(';')[0].trim().toLowerCase();
    if (!TYPES[type]) throw new Error(`That link is not a photo (${type || 'unknown type'}). Send a jpeg, png, webp or heic.`);
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (bytes.length > MAX_PHOTO_BYTES) throw new Error('That photo is over 10 MB.');
    return { bytes, type };
  }
  const type = String(args.mime_type || 'image/jpeg').toLowerCase();
  if (!TYPES[type]) throw new Error('mime_type must be image/jpeg, image/png, image/webp or image/heic');
  let bin: string;
  try { bin = atob(b64); } catch { throw new Error('image_base64 is not valid base64'); }
  if (bin.length > MAX_PHOTO_BYTES) throw new Error('That photo is over 10 MB.');
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return { bytes, type };
}

const toolAddPhoto: ToolHandler = async (rawEnv, auth, args) => {
  const env = rawEnv as PhotoEnv;
  const teaId = str(args?.tea_id, 80);
  if (!teaId) throw new Error('tea_id is required');
  const entry = await entryById(env, auth, teaId);
  if (!entry) throw new Error('No such tea in Curate (tea_id)');
  if (!env.MEDIA_BUCKET) throw new Error('The shop has nowhere to keep photos right now');
  const photo = await readAgentPhoto(args ?? {});
  const key = `accounts/${auth.accountId}/curate/${teaId}/${crypto.randomUUID()}.${TYPES[photo.type]}`;
  await env.MEDIA_BUCKET.put(key, photo.bytes, { httpMetadata: { contentType: photo.type } });
  const url = `https://media.teajia.co/${key}`;
  let photos: string[] = [];
  try { photos = JSON.parse(String(entry.photos || '[]')); } catch { photos = []; }
  photos = [...(Array.isArray(photos) ? photos : []), url];
  await env.DB.prepare(`UPDATE tea_compass_entries SET photos = ?, updated_at = datetime('now') WHERE id = ? AND account_id = ? AND user_id = ?`)
    .bind(JSON.stringify(photos), teaId, auth.accountId, auth.userId).run();

  const status = await driveStatus(env, auth.accountId);
  let drive: Record<string, unknown> = { saved: false, why: 'Google Drive is not connected. Adrian connects it on Curate Today.' };
  if (status.connected && status.needs_reconnect) drive = { saved: false, why: 'Google Drive needs connecting again on Curate Today.' };
  else if (status.connected) {
    try {
      await savePhotosToDrive(env, driveSeal(env), auth.accountId, teaId);
      drive = { saved: true, ...(await teaDriveFiles(env, auth.accountId, teaId)) };
    } catch (e) {
      drive = { saved: false, why: `Kept on the tea; Drive did not take it: ${(e as Error).message}` };
    }
  }
  return { added: true, tea: entry.name, photo_url: url, photos_on_tea: photos.length, drive };
};

const toolTeaPhotos: ToolHandler = async (rawEnv, auth, args) => {
  const env = rawEnv as PhotoEnv;
  const teaId = str(args?.tea_id, 80);
  if (!teaId) throw new Error('tea_id is required');
  const entry = await entryById(env, auth, teaId);
  if (!entry) throw new Error('No such tea in Curate (tea_id)');
  let photos: string[] = [];
  try { photos = JSON.parse(String(entry.photos || '[]')); } catch { photos = []; }
  return { tea: entry.name, photos, drive: await teaDriveFiles(env, auth.accountId, teaId) };
};

const defs: ToolDefinition[] = [
  {
    name: 'curate_add_photo',
    scope: 'stock:write',
    description: 'Put a photo on a Curate tea: a label, a cake wrapper, the leaf, the liquor, a price list. Send image_url (an https link the shop can open; a Drive file must be shared as anyone-with-the-link) or image_base64 with mime_type. The photo shows on the tea in the app and is copied into that tea\'s folder in the shop\'s Google Drive (Teajia Curate / vendor / tea) when Drive is connected. One step.',
    inputSchema: {
      type: 'object',
      properties: {
        tea_id: { type: 'string', description: 'The Curate tea, from curate_find or curate_add_tea.' },
        image_url: { type: 'string', description: 'An https link to the photo.' },
        image_base64: { type: 'string', description: 'The photo itself, base64, when there is no link.' },
        mime_type: { type: 'string', enum: Object.keys(TYPES), description: 'For image_base64. Default image/jpeg.' },
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

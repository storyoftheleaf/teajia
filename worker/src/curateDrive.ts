/**
 * Curate photos, saved to the shop's Google Drive.
 *
 * Every photo on a Curate tea is kept twice: the shop's own copy in the media
 * bucket, which the app shows, and a copy in Drive, which Adrian can open and
 * edit on his computer and which an agent can find without the app. Drive is
 * laid out for people: "Teajia Curate" → one folder per vendor → one per tea,
 * named in words.
 *
 * The scope is `drive.file`: the shop sees only the files and folders it made,
 * never the rest of Adrian's Drive. The refresh token is encrypted at rest with
 * the same key as the other per-account secrets.
 */

import { decryptSecret, encryptSecret, type SealEnv } from './secretSeal';

export interface DriveEnv {
  DB: D1Database;
  MEDIA_BUCKET?: R2Bucket;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
}

export type DriveCrypto = {
  encrypt: (plain: string) => Promise<string>;
  decrypt: (sealed: string) => Promise<string>;
};

/** Seal the Drive refresh token with the same key as the other per-account secrets. */
export const driveSeal = (env: SealEnv): DriveCrypto => ({ encrypt: (p) => encryptSecret(p, env), decrypt: (c) => decryptSecret(c, env) });

export const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
export const DRIVE_ROOT_NAME = 'Teajia Curate';
const MEDIA_ORIGIN = 'https://media.teajia.co/';
const FOLDER_MIME = 'application/vnd.google-apps.folder';

export type DriveLink = {
  account_id: string;
  google_email: string | null;
  refresh_token_encrypted: string;
  root_folder_id: string | null;
  last_error: string | null;
};

export async function driveLink(env: DriveEnv, accountId: string): Promise<DriveLink | null> {
  return env.DB.prepare('SELECT account_id, google_email, refresh_token_encrypted, root_folder_id, last_error FROM curate_drive_links WHERE account_id = ?')
    .bind(accountId).first<DriveLink>();
}

/** Google's consent page for the shop's Drive. Offline, so the shop can keep saving. */
export function driveConsentUrl(clientId: string, redirectUri: string, state: string, loginHint?: string): string {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: `${DRIVE_SCOPE} email`,
    state,
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
  });
  if (loginHint) params.set('login_hint', loginHint);
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

/** Finish the consent: keep the refresh token (sealed) and who it belongs to. */
export async function saveDriveConsent(
  env: DriveEnv, sealed: DriveCrypto, input: { accountId: string; userId: string; code: string; redirectUri: string },
): Promise<{ ok: true; email: string | null } | { ok: false; reason: string }> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code: input.code, client_id: env.GOOGLE_CLIENT_ID!, client_secret: env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: input.redirectUri, grant_type: 'authorization_code',
    }),
  });
  if (!res.ok) return { ok: false, reason: 'token_exchange_failed' };
  const token = await res.json() as { access_token?: string; refresh_token?: string; scope?: string };
  if (!token.refresh_token) return { ok: false, reason: 'no_refresh_token' };
  if (!String(token.scope ?? '').includes(DRIVE_SCOPE)) return { ok: false, reason: 'drive_not_granted' };
  let email: string | null = null;
  try {
    const who = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', { headers: { Authorization: `Bearer ${token.access_token}` } });
    if (who.ok) email = ((await who.json()) as { email?: string }).email ?? null;
  } catch { /* the email is a label only */ }
  await env.DB.prepare(
    `INSERT INTO curate_drive_links (account_id, connected_by_user_id, google_email, refresh_token_encrypted, root_folder_id, last_error, connected_at)
     VALUES (?, ?, ?, ?, NULL, NULL, datetime('now'))
     ON CONFLICT(account_id) DO UPDATE SET connected_by_user_id = excluded.connected_by_user_id, google_email = excluded.google_email,
       refresh_token_encrypted = excluded.refresh_token_encrypted, last_error = NULL, connected_at = excluded.connected_at`
  ).bind(input.accountId, input.userId, email, await sealed.encrypt(token.refresh_token)).run();
  accessCache.delete(input.accountId);
  return { ok: true, email };
}

export async function forgetDrive(env: DriveEnv, accountId: string): Promise<void> {
  await env.DB.batch([
    env.DB.prepare('DELETE FROM curate_drive_links WHERE account_id = ?').bind(accountId),
    env.DB.prepare('DELETE FROM curate_drive_folders WHERE account_id = ?').bind(accountId),
  ]);
  accessCache.delete(accountId);
}

const accessCache = new Map<string, { token: string; until: number; credential: string }>();

class DriveNeedsReconnect extends Error {}

async function accessToken(env: DriveEnv, sealed: DriveCrypto, link: DriveLink): Promise<string> {
  const hit = accessCache.get(link.account_id);
  if (hit && hit.until > Date.now() && hit.credential === link.refresh_token_encrypted) return hit.token;
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID!, client_secret: env.GOOGLE_CLIENT_SECRET!,
      refresh_token: await sealed.decrypt(link.refresh_token_encrypted), grant_type: 'refresh_token',
    }), signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string };
    if (body.error === 'invalid_grant') {
      await env.DB.prepare(`UPDATE curate_drive_links SET last_error = 'reconnect' WHERE account_id = ?`).bind(link.account_id).run();
      throw new DriveNeedsReconnect('Google Drive needs connecting again');
    }
    throw new Error(`Drive token refresh failed (${res.status})`);
  }
  const t = await res.json() as { access_token: string; expires_in?: number };
  accessCache.set(link.account_id, { token: t.access_token, credential: link.refresh_token_encrypted, until: Date.now() + ((t.expires_in ?? 3600) - 120) * 1000 });
  return t.access_token;
}

async function createFolder(token: string, name: string, parent: string | null): Promise<string> {
  const res = await fetch('https://www.googleapis.com/drive/v3/files?fields=id', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, mimeType: FOLDER_MIME, ...(parent ? { parents: [parent] } : {}) }),
  });
  if (!res.ok) throw new Error(`Drive folder create failed (${res.status})`);
  return ((await res.json()) as { id: string }).id;
}

/** A folder the shop made, remembered by what it is for, so a rename never makes a second one. */
async function folderFor(env: DriveEnv, token: string, accountId: string, key: string, name: string, parent: string | null): Promise<string> {
  const known = await env.DB.prepare('SELECT folder_id FROM curate_drive_folders WHERE account_id = ? AND folder_key = ?')
    .bind(accountId, key).first<{ folder_id: string }>();
  if (known) return known.folder_id;
  const id = await createFolder(token, name, parent);
  await env.DB.prepare('INSERT OR IGNORE INTO curate_drive_folders (account_id, folder_key, folder_id, name) VALUES (?, ?, ?, ?)')
    .bind(accountId, key, id, name).run();
  return id;
}

const folderName = (s: string | null | undefined, fallback: string) =>
  (String(s ?? '').replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120)) || fallback;

/** "Teajia Curate / Wang Laoshi / Yiwu Gushu 2019" for one tea. */
async function teaFolder(env: DriveEnv, token: string, accountId: string, entry: Record<string, any>): Promise<string> {
  const root = await folderFor(env, token, accountId, 'root', DRIVE_ROOT_NAME, null);
  const vendorKey = entry.vendor_id ? `vendor:${entry.vendor_id}` : `vendor-name:${folderName(entry.vendor_name, 'No vendor').toLowerCase()}`;
  const vendor = await folderFor(env, token, accountId, vendorKey, folderName(entry.vendor_name, 'No vendor'), root);
  const teaName = [folderName(entry.name, 'Untitled tea'), entry.year && !String(entry.name ?? '').includes(String(entry.year)) ? entry.year : null].filter(Boolean).join(' ');
  return folderFor(env, token, accountId, `tea:${entry.id}`, teaName, vendor);
}

/** The bucket key behind a shop photo URL, or null for a photo hosted elsewhere. */
export function mediaKeyOf(url: string): string | null {
  if (!url.startsWith(MEDIA_ORIGIN)) return null;
  const key = decodeURIComponent(url.slice(MEDIA_ORIGIN.length).split('?')[0]);
  return key && !key.includes('..') ? key : null;
}

async function photoBytes(env: DriveEnv, url: string): Promise<{ bytes: Uint8Array; type: string } | null> {
  const key = mediaKeyOf(url);
  if (key && env.MEDIA_BUCKET) {
    const obj = await env.MEDIA_BUCKET.get(key);
    if (!obj) return null;
    return { bytes: new Uint8Array(await obj.arrayBuffer()), type: obj.httpMetadata?.contentType || 'image/jpeg' };
  }
  if (!/^https:\/\//.test(url)) return null;
  const res = await fetch(url);
  if (!res.ok) return null;
  return { bytes: new Uint8Array(await res.arrayBuffer()), type: res.headers.get('Content-Type') || 'image/jpeg' };
}

async function uploadFile(token: string, folderId: string, name: string, file: { bytes: Uint8Array; type: string }): Promise<{ id: string; webViewLink?: string }> {
  const boundary = `teajia${crypto.randomUUID().replace(/-/g, '')}`;
  const enc = new TextEncoder();
  const head = enc.encode(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify({ name, parents: [folderId] })}\r\n--${boundary}\r\nContent-Type: ${file.type}\r\n\r\n`);
  const tail = enc.encode(`\r\n--${boundary}--`);
  const body = new Uint8Array(head.length + file.bytes.length + tail.length);
  body.set(head, 0); body.set(file.bytes, head.length); body.set(tail, head.length + file.bytes.length);
  const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': `multipart/related; boundary=${boundary}` },
    body,
  });
  if (!res.ok) throw new Error(`Drive upload failed (${res.status})`);
  return res.json() as Promise<{ id: string; webViewLink?: string }>;
}

const extFor = (type: string) => (type.includes('png') ? 'png' : type.includes('webp') ? 'webp' : type.includes('heic') ? 'heic' : 'jpg');

/**
 * Copy any of a tea's photos that are not in Drive yet. Safe to call as often
 * as wanted: a photo already copied is skipped, and nothing happens for a shop
 * with no Drive connected. Returns how many were copied.
 */
export async function savePhotosToDrive(env: DriveEnv, sealed: DriveCrypto, accountId: string, entryId: string): Promise<number> {
  const link = await driveLink(env, accountId);
  if (!link || link.last_error === 'reconnect') return 0;
  const entry = await env.DB.prepare('SELECT id, name, year, vendor_id, vendor_name, photos FROM tea_compass_entries WHERE id = ? AND account_id = ?')
    .bind(entryId, accountId).first<Record<string, any>>();
  if (!entry) return 0;
  let photos: string[] = [];
  try { photos = (JSON.parse(String(entry.photos || '[]')) as unknown[]).filter((p): p is string => typeof p === 'string'); } catch { return 0; }
  if (!photos.length) return 0;
  const done = await env.DB.prepare('SELECT photo_url FROM curate_drive_files WHERE account_id = ? AND compass_entry_id = ?')
    .bind(accountId, entryId).all<{ photo_url: string }>();
  const have = new Set((done.results ?? []).map(r => r.photo_url));
  // Only a photo the shop actually holds can be copied. A `blob:` address is a
  // picture that never left the phone it was taken on.
  const todo = photos.filter(p => !have.has(p) && /^https:\/\//.test(p));
  if (!todo.length) return 0;
  let token: string | null = null;
  let folder: string | null = null;
  let copied = 0;
  for (const url of todo) {
    const file = await photoBytes(env, url);
    if (!file) continue;
    // Folders are made only once there is a photo to put in them.
    token ??= await accessToken(env, sealed, link);
    folder ??= await teaFolder(env, token, accountId, entry);
    const stamp = new Date().toISOString().slice(0, 10);
    const name = `${folderName(entry.name, 'Tea')} ${stamp} ${photos.indexOf(url) + 1}.${extFor(file.type)}`;
    const up = await uploadFile(token, folder, name, file);
    await env.DB.prepare(
      'INSERT OR IGNORE INTO curate_drive_files (id, account_id, compass_entry_id, photo_url, drive_file_id, web_view_link) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(crypto.randomUUID(), accountId, entryId, url, up.id, up.webViewLink ?? null).run();
    copied++;
  }
  return copied;
}

/** For a background save: never throws, so a Drive hiccup cannot fail a sync. */
export async function savePhotosToDriveQuietly(env: DriveEnv, sealed: DriveCrypto, accountId: string, entryIds: string[]): Promise<void> {
  for (const id of entryIds) {
    try { await savePhotosToDrive(env, sealed, accountId, id); }
    catch (e) { if (e instanceof DriveNeedsReconnect) return; console.warn('[curate-drive] save failed', id, (e as Error).message); }
  }
}

/** What the app shows: connected or not, to whom, and the folder to open. */
export async function driveStatus(env: DriveEnv, accountId: string) {
  const link = await driveLink(env, accountId);
  if (!link) return { connected: false as const };
  const root = await env.DB.prepare(`SELECT folder_id FROM curate_drive_folders WHERE account_id = ? AND folder_key = 'root'`)
    .bind(accountId).first<{ folder_id: string }>();
  return {
    connected: true as const,
    email: link.google_email,
    needs_reconnect: link.last_error === 'reconnect',
    folder_url: root ? `https://drive.google.com/drive/folders/${root.folder_id}` : null,
  };
}

/** A tea's Drive folder and its saved photos, for an agent that wants to find them. */
export async function teaDriveFiles(env: DriveEnv, accountId: string, entryId: string) {
  const [folder, files, operations] = await Promise.all([
    env.DB.prepare('SELECT folder_id FROM curate_drive_folders WHERE account_id = ? AND folder_key = ?').bind(accountId, `tea:${entryId}`).first<{ folder_id: string }>(),
    env.DB.prepare('SELECT f.photo_url, f.drive_file_id, f.web_view_link, (SELECT id FROM curate_drive_photo_operations o WHERE o.account_id=f.account_id AND o.mapping_id=f.id ORDER BY o.created_at DESC, o.rowid DESC LIMIT 1) AS operation_id, (SELECT status FROM curate_drive_photo_operations o WHERE o.account_id=f.account_id AND o.mapping_id=f.id ORDER BY o.created_at DESC, o.rowid DESC LIMIT 1) AS operation_status FROM curate_drive_files f WHERE f.account_id = ? AND f.compass_entry_id = ? ORDER BY f.created_at').bind(accountId, entryId).all(),
    env.DB.prepare('SELECT id, photo_url, drive_file_id, action, status, actor_user_id, actor_token_id, agent_name, created_at, updated_at, attempts_json FROM curate_drive_photo_operations WHERE account_id=? AND compass_entry_id=? ORDER BY created_at DESC, rowid DESC').bind(accountId,entryId).all(),
  ]);
  return { folder_url: folder ? `https://drive.google.com/drive/folders/${folder.folder_id}` : null, photos: files.results ?? [], operations: operations.results ?? [] };
}

/** Only metadata operations on an exact remembered backup; callers scope the mapping. */
export type DrivePhotoState = { id: string; name: string; mimeType: string; trashed: boolean; explicitlyTrashed?: boolean; version?: string; capabilities?: { canTrash?: boolean; canUntrash?: boolean } };
export class DrivePhotoHttpError extends Error {
  constructor(public status: number) { super(`Drive photo metadata request failed (${status})`); }
}
export async function readDrivePhoto(env: DriveEnv, sealed: DriveCrypto, link: DriveLink, fileId: string): Promise<DrivePhotoState> {
  const token = await accessToken(env, sealed, link);
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?fields=id,name,mimeType,trashed,explicitlyTrashed,version,capabilities(canTrash,canUntrash)`, {
    headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new DrivePhotoHttpError(res.status);
  const file = await res.json() as DrivePhotoState;
  if (file.id !== fileId || typeof file.trashed !== 'boolean' || !file.mimeType?.startsWith('image/')) throw new Error('Drive backup is not the exact image file');
  return file;
}
/** Google Drive files.update: trashed=true/false; never files.delete. */
export async function setDrivePhotoTrashed(env: DriveEnv, sealed: DriveCrypto, link: DriveLink, fileId: string, trashed: boolean): Promise<void> {
  const token = await accessToken(env, sealed, link);
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?fields=id,trashed`, {
    method: 'PATCH', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ trashed }), signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new DrivePhotoHttpError(res.status);
}

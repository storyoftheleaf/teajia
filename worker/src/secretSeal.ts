/** Per-account secrets sealed at rest; shared by the entry and the agent tools. */
export interface SealEnv { KEY_ENCRYPTION_SECRET?: string }

// ── BYOK secret encryption (AES-GCM via HKDF-derived key) ──
// Used for per-account third-party API keys stored in D1. The wrapping key
// is derived from KEY_ENCRYPTION_SECRET so the same plaintext encrypts to
// different ciphertexts each call (12-byte random IV, prepended to output).
async function deriveAesKey(secret: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const baseKey = await crypto.subtle.importKey(
    'raw', enc.encode(secret), 'HKDF', false, ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt: enc.encode('teajia/byok/v1'), info: enc.encode('account-secret') },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

function bytesToB64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

function b64ToBytes(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export async function encryptSecret(plaintext: string, env: SealEnv): Promise<string> {
  if (!env.KEY_ENCRYPTION_SECRET) {
    throw new Error('KEY_ENCRYPTION_SECRET not configured');
  }
  const key = await deriveAesKey(env.KEY_ENCRYPTION_SECRET);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(plaintext)),
  );
  // Prefix the IV so we don't need a second column.
  const combined = new Uint8Array(iv.length + ct.length);
  combined.set(iv, 0);
  combined.set(ct, iv.length);
  return bytesToB64(combined);
}

export async function decryptSecret(b64: string, env: SealEnv): Promise<string> {
  if (!env.KEY_ENCRYPTION_SECRET) {
    throw new Error('KEY_ENCRYPTION_SECRET not configured');
  }
  const key = await deriveAesKey(env.KEY_ENCRYPTION_SECRET);
  const buf = b64ToBytes(b64);
  if (buf.length < 13) throw new Error('Encrypted payload too short');
  const iv = buf.slice(0, 12);
  const ct = buf.slice(12);
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct);
  return new TextDecoder().decode(pt);
}

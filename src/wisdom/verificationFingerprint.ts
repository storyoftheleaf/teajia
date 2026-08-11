const PRIVATE_KEY_NAMES = new Set([
  'contenthash',
  'privateevidenceref',
  'sourcetrust',
  'trust',
  'verification',
  'verificationreceipt',
  'verificationstate',
  'verifiedat',
  'verifiedbyuserid',
]);

function normalizedKey(key: string): string {
  return key.replace(/[^a-z0-9]/gi, '').toLowerCase();
}

function assertPublicKey(key: string): void {
  const normalized = normalizedKey(key);
  if (PRIVATE_KEY_NAMES.has(normalized) || normalized.startsWith('verification')) {
    throw new TypeError(`Private verification input is not permitted: ${key}`);
  }
}

function serialize(value: unknown, ancestors: Set<object>): string {
  if (value === null) return 'null';
  if (typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError('Wisdom verification input must be valid JSON');
    return JSON.stringify(value);
  }
  if (typeof value !== 'object') throw new TypeError('Wisdom verification input must be valid JSON');
  if (ancestors.has(value)) throw new TypeError('Wisdom verification input must not contain cycles');

  ancestors.add(value);
  try {
    if (Array.isArray(value)) return `[${value.map(item => serialize(item, ancestors)).join(',')}]`;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new TypeError('Wisdom verification input must contain plain JSON objects');
    }
    const entries = Object.keys(value as Record<string, unknown>)
      .sort()
      .map(key => {
        assertPublicKey(key);
        return `${JSON.stringify(key)}:${serialize((value as Record<string, unknown>)[key], ancestors)}`;
      });
    return `{${entries.join(',')}}`;
  } finally {
    ancestors.delete(value);
  }
}

export function canonicalizeWisdomVerification(input: unknown): string {
  return serialize(input, new Set());
}

export async function fingerprintWisdomEntry(input: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(canonicalizeWisdomVerification(input));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

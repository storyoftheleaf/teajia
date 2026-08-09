import crypto from 'node:crypto';

function canonicalValue(value) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('Canonical JSON does not permit non-finite numbers');
    return value;
  }
  if (Array.isArray(value)) return value.map((item) => canonicalValue(item));
  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .filter((key) => value[key] !== undefined)
        .sort()
        .map((key) => [key, canonicalValue(value[key])]),
    );
  }
  throw new Error(`Unsupported canonical JSON value: ${typeof value}`);
}

export function canonicalJson(value) {
  return JSON.stringify(canonicalValue(value));
}

export function sha256(value) {
  const input = Buffer.isBuffer(value) || value instanceof Uint8Array ? value : Buffer.from(String(value), 'utf8');
  return crypto.createHash('sha256').update(input).digest('hex');
}

export function stableId(namespace, semanticParts) {
  const prefix = String(namespace).trim().toUpperCase().replace(/[^A-Z0-9]+/g, '-');
  return `${prefix}-${sha256(canonicalJson(semanticParts)).slice(0, 24).toUpperCase()}`;
}


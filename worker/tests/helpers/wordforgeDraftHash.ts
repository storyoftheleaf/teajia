import { createHash } from 'node:crypto';
import type { TeajiaWordforgeDraftV1 } from '../../src/wordforgeArticleDraft';

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.entries(value).sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0);
    return `{${entries.map(([key, child]) => `${JSON.stringify(key)}:${canonicalJson(child)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

export function hashWordforgeDraft(payload: TeajiaWordforgeDraftV1) {
  const { system, id } = payload.source;
  return createHash('sha256').update(canonicalJson({
    schema_version: payload.schema_version,
    source: { system, id },
    article: payload.article,
  })).digest('hex');
}

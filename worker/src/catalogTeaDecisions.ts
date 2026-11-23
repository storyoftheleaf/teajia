import type { TeaEditorialPacket, PassageVerdict } from '../../shared/catalog/teaEditorial';

export async function serveTeaDecisions(
  request: Request, bucket: R2Bucket, root: string, owner: string, suffix: string,
  reply: (status: number, body?: BodyInit | null) => Response,
) {
  const packetObject = await bucket.get(root + 'editorial.json');
  if (!packetObject) return reply(404);
  const packet = await packetObject.json<TeaEditorialPacket>();
  const key = root + 'editorial-decisions/' + encodeURIComponent(owner) + '.json';
  const stored = await bucket.get(key);
  const verdicts = stored ? await stored.json<Record<string, PassageVerdict>>() : {};
  if (suffix === '/decisions') {
    if (request.method !== 'GET' && request.method !== 'HEAD') return reply(405);
    const current = Object.fromEntries(packet.passages.flatMap(p => {
      const decision = verdicts[p.id + '/' + p.revision];
      return decision ? [[p.id, decision]] : [];
    }));
    return reply(200, JSON.stringify({ ...packet, verdicts: current }));
  }
  if (request.method !== 'PUT') return reply(405);
  const passage = packet.passages.find(p => suffix === '/decisions/' + p.id);
  if (!passage) return reply(404);
  if (!request.headers.get('Content-Type')?.includes('application/json')) return reply(415);
  if (Number(request.headers.get('content-length')) > 1024) return reply(413);
  const raw = await request.text();
  if (raw.length > 1024) return reply(413);
  let input;
  try { input = JSON.parse(raw); } catch { return reply(400); }
  if (!input || !['approved','declined','withdrawn'].includes(input.decision)
    || !Number.isSafeInteger(input.version) || input.version < 0) return reply(400);
  if (input.revision !== passage.revision) return reply(409);
  const recordKey = passage.id + '/' + passage.revision;
  const previous = verdicts[recordKey];
  if (previous?.decision === input.decision) return reply(200, JSON.stringify(previous));
  if (input.version !== (previous?.version ?? 0)) return reply(409);
  const updated: PassageVerdict = { decision: input.decision, version: input.version + 1 };
  const result = await bucket.put(key, JSON.stringify({...verdicts, [recordKey]: updated}), {
    onlyIf: stored ? {etagMatches:stored.etag} : {etagDoesNotMatch:'*'},
    httpMetadata:{contentType:'application/json',cacheControl:'private, no-store'},
  });
  return result ? reply(200, JSON.stringify(updated)) : reply(409);
}

import { BridgeError, listTeaArLinks, readTeaArExcerpt } from './curateArBridge';
import { proposeTeaDescription, TeaDescriptionError, type TeaDescriptionEnvironment, type TeaDescriptionSource } from './curateTeaDescription';

function jsonArray(value: unknown): any[] {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') { try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? parsed : []; } catch { return []; } }
  return [];
}
/** Browsers choose excerpts, never the canonical tea facts or another shop's
 * sources. An excerpt must still occur verbatim in the scoped saved material. */
export async function descriptionForTeaRecord(env: TeaDescriptionEnvironment & { DB: D1Database }, scope: { accountId: string; userId?: string }, body: unknown) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new TeaDescriptionError('Choose a tea and its source material.', 'description_invalid_input', 400);
  const input = body as Record<string, unknown>;
  if (typeof input.entryId !== 'string' || input.entryId.length > 160 || !Array.isArray(input.sources) || input.sources.length > 12) throw new TeaDescriptionError('Choose a saved tea and up to 12 sources.', 'description_invalid_input', 400);
  if (input.stagedArSources != null && !Array.isArray(input.stagedArSources)) throw new TeaDescriptionError('Choose valid AR Create excerpts.', 'description_invalid_source', 400);
  const staged = (input.stagedArSources ?? []) as unknown[];
  if (input.sources.length + staged.length > 12) throw new TeaDescriptionError('Choose up to 12 source excerpts.', 'description_invalid_input', 400);
  const entry = await env.DB.prepare('SELECT * FROM tea_compass_entries WHERE id=? AND account_id=?').bind(input.entryId, scope.accountId).first<Record<string, any>>();
  if (!entry) throw new TeaDescriptionError('The tea record was not found in this store.', 'description_tea_not_found', 404);
  const available = new Map<string, TeaDescriptionSource>();
  const add = (id: string, title: string, text: unknown) => { if (typeof text === 'string' && text.trim()) available.set(id, { id, title: title.slice(0, 256), text }); };
  add(`entry:${entry.id}`, 'Tea notes', entry.notes);
  jsonArray(entry.audio_clips).forEach((clip, index) => add(`clip:${index}:${clip.timestamp}`, 'Voice transcript', clip.transcript));
  const notes = await env.DB.prepare(`SELECT id,text,source_type,author_name FROM notes WHERE account_id=? AND (deleted IS NULL OR deleted=0) AND (compass_entry_id=? OR (? IS NOT NULL AND tea_key=?))`).bind(scope.accountId, entry.id, entry.tea_key ?? null, entry.tea_key ?? null).all<Record<string, any>>();
  for (const note of notes.results) add(`note:${note.id}`, `${note.source_type === 'voice' ? 'Voice note' : 'Written note'}${note.author_name ? ` · ${note.author_name}` : ''}`, note.text);
  for (const link of await listTeaArLinks(env.DB, scope.accountId, entry.id)) add(`ar:${link.id}`, `AR Create · ${link.title}`, link.text);
  const selected: TeaDescriptionSource[] = [];
  const seen = new Set<string>();
  for (const item of input.sources) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) throw new TeaDescriptionError('Choose saved source excerpts.', 'description_invalid_source', 400);
    const candidate = item as Record<string, unknown>;
    const original = typeof candidate.id === 'string' ? available.get(candidate.id) : undefined;
    if (!original || typeof candidate.text !== 'string' || !candidate.text.trim() || !original.text.includes(candidate.text)) throw new TeaDescriptionError('A source changed or the excerpt is not in its original. Refresh the material and review it again.', 'description_source_changed', 409);
    if (seen.has(original.id)) throw new TeaDescriptionError('Select each source once.', 'description_duplicate_source', 400);
    seen.add(original.id);
    selected.push({ ...original, text: candidate.text });
  }
  for (const candidate of staged) {
    try {
      const excerpt = await readTeaArExcerpt(env.DB, { accountId: scope.accountId, userId: scope.userId ?? '' }, candidate);
      const id = `staged-ar:${excerpt.requestId}:${excerpt.sourceId}`;
      if (seen.has(id)) throw new TeaDescriptionError('Select each source once.', 'description_duplicate_source', 400);
      seen.add(id);
      selected.push({ id, title: `AR Create · ${excerpt.title}`.slice(0, 256), text: excerpt.text });
    } catch (error) {
      if (error instanceof BridgeError) throw new TeaDescriptionError(error.message, error.code, error.status);
      throw error;
    }
  }
  const facts = { ...entry };
  if (typeof facts.tasting === 'string') { try { facts.tasting = JSON.parse(facts.tasting); } catch { delete facts.tasting; } }
  const draft = await proposeTeaDescription(env, { facts, sources: selected });
  return { ...draft, baseDescription: entry.description ?? null };
}

export type CandidateInput = {
  sourceText: string;
  sourceTasting: string | null;
};

export function parseCandidateInput(value: unknown): CandidateInput {
  const body = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const sourceText = typeof body.source_text === 'string' ? body.source_text.trim() : '';
  if (!sourceText) throw new Error('source_text required');
  const tasting = body.source_tasting;
  return {
    sourceText,
    sourceTasting: tasting == null ? null : (typeof tasting === 'string' ? tasting : JSON.stringify(tasting)),
  };
}

export function candidateToApi(row: Record<string, any>) {
  return {
    id: row.id,
    journalEntryId: row.journal_entry_id,
    noteKey: row.note_key,
    productId: row.product_id,
    status: row.status,
    sourceText: row.source_text,
    finalText: row.edited_text || row.source_text,
    attributionName: row.attribution_name ?? null,
    attributionDetail: row.attribution_detail ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function impressionToApi(row: Record<string, any>) {
  return {
    id: row.id,
    productId: row.product_id,
    text: row.text,
    attributionName: row.attribution_name,
    attributionDetail: row.attribution_detail ?? null,
    publishedAt: row.published_at,
  };
}

/**
 * Every note anyone has written about this shop's teas, flattened out of the
 * journals they live in.
 *
 * A journal row holds two kinds of writing: the paragraph someone wrote about
 * the tea, and any separate notes they took during the sitting. Both are
 * things a person said about a tea, so both come through here as one list and
 * the shop decides between them by reading, not by which field they landed in.
 *
 * `noteKey` is what makes a note addressable later: 'personal' for the
 * paragraph, the note's own id for the rest. It is what a promotion is recorded
 * against, so the same note cannot be published twice.
 */
export interface JournalNote {
  journalEntryId: string;
  noteKey: string;
  productId: string;
  productName: string;
  authorUserId: string | null;
  authorName: string;
  text: string;
  writtenAt: string;
  /** 'open' until the shop promotes or dismisses it. */
  status: 'open' | 'promoted' | 'dismissed';
}

function parseJson(value: unknown): Record<string, any> | null {
  if (value == null) return null;
  if (typeof value === 'object') return value as Record<string, any>;
  if (typeof value !== 'string') return null;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Turns one journal row into its notes. Empty writing yields nothing: a
 * journal entry that only records terms is not a note anyone wrote.
 */
export function journalRowToNotes(
  row: Record<string, any>,
  resolved: Map<string, 'promoted' | 'dismissed'>,
): JournalNote[] {
  const note = parseJson(row.note);
  const tasting = parseJson(note?.tasting) ?? parseJson(row.tasting);
  const writtenAt = String(note?.updatedAt || row.created_at || '');
  const base = {
    journalEntryId: String(row.id),
    productId: String(row.product_id || ''),
    productName: String(row.product_name || 'Unknown tea'),
    authorUserId: row.author_user_id ? String(row.author_user_id) : null,
    authorName: String(row.author_name || row.user_id || 'A customer'),
    writtenAt,
  };
  const out: JournalNote[] = [];

  const personal = typeof note?.personalNote === 'string'
    ? note.personalNote.trim()
    : typeof row.personal_note === 'string' ? row.personal_note.trim() : '';
  if (personal) {
    out.push({ ...base, noteKey: 'personal', text: personal, status: resolved.get(`${row.id}::personal`) ?? 'open' });
  }

  const entries = Array.isArray(tasting?.notes) ? tasting.notes : [];
  entries.forEach((raw: unknown, index: number) => {
    const text = typeof raw === 'string' ? raw.trim() : String((raw as any)?.text ?? '').trim();
    if (!text) return;
    // A legacy note is a bare string with no id. Its position is the only
    // stable handle it has, which is why the index is the fallback key.
    const key = typeof raw === 'string' ? `index-${index}` : String((raw as any)?.id || `index-${index}`);
    out.push({ ...base, noteKey: key, text, status: resolved.get(`${row.id}::${key}`) ?? 'open' });
  });

  return out;
}

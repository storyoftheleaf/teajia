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

export function slugifyArticle(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function parseArticleArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  try { return value ? JSON.parse(String(value)) : []; } catch { return []; }
}

export function articleToApi(row: Record<string, any>) {
  return {
    ...row,
    tags: parseArticleArray(row.tags),
    blocks: parseArticleArray(row.blocks),
    subject_ids: parseArticleArray(row.subject_ids),
  };
}

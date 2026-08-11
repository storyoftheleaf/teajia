import { GENERATED_TEA_REFERENCE_REGISTRY } from '../../src/wisdom/reference/generatedPages';

export const TEA_REFERENCE_ISSUE_CATEGORIES = [
  'incorrect_information',
  'translation',
  'unclear_writing',
  'wrong_source',
  'geography_or_hierarchy',
  'missing_information',
] as const;

export type TeaReferenceIssueCategory = typeof TEA_REFERENCE_ISSUE_CATEGORIES[number];

interface CanonicalSection {
  key: string;
  label: string;
  text: string;
  sourceIds: readonly string[];
}

interface CanonicalPage {
  id: string;
  slug: string;
  kind: string;
  label: string;
  sections: readonly CanonicalSection[];
}

interface CanonicalSource {
  sourceId: string;
  publisher: string;
  title: string;
  publishedDate: string;
  url: string;
}

interface TeaReferenceIssueRow {
  id: string;
  account_id: string;
  page_id: string;
  page_slug: string;
  route: string;
  section_key: string;
  category: TeaReferenceIssueCategory;
  note: string;
  normalized_note: string;
  public_text_snapshot: string;
  source_ids_json: string;
  status: 'open' | 'resolved';
  created_by_user_id: string;
  created_at: string;
  resolved_by_user_id: string | null;
  resolved_at: string | null;
}

export interface TeaReferenceIssue {
  id: string;
  account_id: string;
  page_id: string;
  page_slug: string;
  route: string;
  section_key: string;
  section_label: string;
  category: TeaReferenceIssueCategory;
  note: string;
  public_text_snapshot: string;
  source_ids: string[];
  status: 'open' | 'resolved';
  created_by_user_id: string;
  created_at: string;
  resolved_by_user_id: string | null;
  resolved_at: string | null;
}

export class TeaReferenceIssueError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 404 | 409,
    readonly code: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'TeaReferenceIssueError';
  }
}

const categorySet: ReadonlySet<string> = new Set(TEA_REFERENCE_ISSUE_CATEGORIES);
const pagesById = new Map<string, CanonicalPage>(
  (GENERATED_TEA_REFERENCE_REGISTRY.pages as readonly CanonicalPage[]).map(page => [page.id, page]),
);
const sourcesById = new Map<string, CanonicalSource>(
  (GENERATED_TEA_REFERENCE_REGISTRY.sources as readonly CanonicalSource[]).map(source => [source.sourceId, source]),
);

function codePointCompare(left: string, right: string): number {
  const leftCharacters = left[Symbol.iterator]();
  const rightCharacters = right[Symbol.iterator]();
  while (true) {
    const leftCharacter = leftCharacters.next();
    const rightCharacter = rightCharacters.next();
    if (leftCharacter.done || rightCharacter.done) {
      return leftCharacter.done === rightCharacter.done ? 0 : leftCharacter.done ? -1 : 1;
    }
    const leftPoint = leftCharacter.value.codePointAt(0)!;
    const rightPoint = rightCharacter.value.codePointAt(0)!;
    if (leftPoint !== rightPoint) return leftPoint < rightPoint ? -1 : 1;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function assertOnlyFields(body: Record<string, unknown>, allowed: ReadonlySet<string>): void {
  const unsupported = Object.keys(body).filter(key => !allowed.has(key)).sort(codePointCompare);
  if (unsupported.length > 0) {
    throw new TeaReferenceIssueError(
      'Unsupported fields in Tea Reference issue request',
      400,
      'validation_failed',
      { fields: unsupported },
    );
  }
}

function canonicalRoute(page: CanonicalPage): string | null {
  if (page.kind === 'tea_family') return `/wisdom/family/${page.id}`;
  if (page.kind === 'tea_type') return `/wisdom/type/${page.id}`;
  if (page.kind === 'major_region' || page.kind === 'tea_area') return `/wisdom/region/${page.id}`;
  return null;
}

function canonicalTarget(pageId: string, sectionKey: string): {
  page: CanonicalPage;
  section: CanonicalSection;
  route: string;
} {
  const page = pagesById.get(pageId);
  const route = page ? canonicalRoute(page) : null;
  if (!page || !route) {
    throw new TeaReferenceIssueError('Unknown or non-public Tea Reference page', 400, 'unknown_page');
  }
  const section = page.sections.find(candidate => candidate.key === sectionKey);
  if (!section) {
    throw new TeaReferenceIssueError('Unknown Tea Reference page section', 400, 'unknown_section');
  }
  return { page, section, route };
}

function normalizeNote(note: string): string {
  return note.normalize('NFKC').trim().replace(/\s+/gu, ' ').toLowerCase();
}

function parseSourceIds(value: string): string[] {
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) && parsed.every(item => typeof item === 'string') ? parsed : [];
  } catch {
    return [];
  }
}

function rowToIssue(row: TeaReferenceIssueRow): TeaReferenceIssue {
  const sectionLabel = pagesById.get(row.page_id)?.sections.find(section => section.key === row.section_key)?.label
    ?? row.section_key;
  return {
    id: row.id,
    account_id: row.account_id,
    page_id: row.page_id,
    page_slug: row.page_slug,
    route: row.route,
    section_key: row.section_key,
    section_label: sectionLabel,
    category: row.category,
    note: row.note,
    public_text_snapshot: row.public_text_snapshot,
    source_ids: parseSourceIds(row.source_ids_json),
    status: row.status,
    created_by_user_id: row.created_by_user_id,
    created_at: row.created_at,
    resolved_by_user_id: row.resolved_by_user_id,
    resolved_at: row.resolved_at,
  };
}

const issueProjection = `
  id, account_id, page_id, page_slug, route, section_key, category, note,
  normalized_note, public_text_snapshot, source_ids_json, status,
  created_by_user_id, created_at, resolved_by_user_id, resolved_at
`;

export async function createTeaReferenceIssue(
  db: D1Database,
  context: { accountId: string; userId: string },
  input: unknown,
): Promise<{ issue: TeaReferenceIssue; duplicate: boolean }> {
  if (!isRecord(input)) {
    throw new TeaReferenceIssueError('Invalid Tea Reference issue request', 400, 'validation_failed');
  }
  assertOnlyFields(input, new Set(['page_id', 'section_key', 'category', 'note']));
  const { page_id: pageId, section_key: sectionKey, category, note } = input;
  if (typeof pageId !== 'string' || !pageId || typeof sectionKey !== 'string' || !sectionKey) {
    throw new TeaReferenceIssueError('Page and section are required', 400, 'validation_failed');
  }
  if (typeof category !== 'string' || !categorySet.has(category)) {
    throw new TeaReferenceIssueError('Invalid Tea Reference issue category', 400, 'invalid_category');
  }
  if (typeof note !== 'string' || !note.trim()) {
    throw new TeaReferenceIssueError('A plain-language note is required', 400, 'note_required');
  }
  if (note.length > 4000) {
    throw new TeaReferenceIssueError('The note must be 4,000 characters or fewer', 400, 'note_too_long');
  }

  const { page, section, route } = canonicalTarget(pageId, sectionKey);
  const normalizedNote = normalizeNote(note);
  const sourceIdsJson = JSON.stringify([...section.sourceIds].sort(codePointCompare));
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const id = crypto.randomUUID();
    const insert = await db.prepare(`
      INSERT INTO tea_reference_issues (
        id, account_id, page_id, page_slug, route, section_key, category, note,
        normalized_note, public_text_snapshot, source_ids_json, created_by_user_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT DO NOTHING
    `).bind(
      id,
      context.accountId,
      page.id,
      page.slug,
      route,
      section.key,
      category,
      note,
      normalizedNote,
      section.text,
      sourceIdsJson,
      context.userId,
    ).run();

    const row = await db.prepare(`
      SELECT ${issueProjection}
      FROM tea_reference_issues
      WHERE account_id = ? AND page_id = ? AND section_key = ?
        AND category = ? AND normalized_note = ? AND status = 'open'
    `).bind(context.accountId, page.id, section.key, category, normalizedNote).first<TeaReferenceIssueRow>();
    if (row) return { issue: rowToIssue(row), duplicate: Number(insert.meta.changes ?? 0) === 0 };
  }
  throw new TeaReferenceIssueError(
    'Tea Reference issue changed while it was being created; retry the request',
    409,
    'create_conflict',
  );
}

export async function listTeaReferenceIssues(db: D1Database, accountId: string): Promise<TeaReferenceIssue[]> {
  const result = await db.prepare(`
    SELECT ${issueProjection}
    FROM tea_reference_issues
    WHERE account_id = ? AND status = 'open'
  `).bind(accountId).all<TeaReferenceIssueRow>();
  return result.results
    .map(rowToIssue)
    .sort((left, right) => (
      codePointCompare(left.page_id, right.page_id)
      || codePointCompare(left.section_key, right.section_key)
      || codePointCompare(left.created_at, right.created_at)
      || codePointCompare(left.id, right.id)
    ));
}

const categoryLabels: Record<TeaReferenceIssueCategory, string> = {
  incorrect_information: 'Incorrect information',
  translation: 'Translation',
  unclear_writing: 'Unclear writing',
  wrong_source: 'Wrong source',
  geography_or_hierarchy: 'Geography or hierarchy',
  missing_information: 'Missing information',
};

function escapeMarkdown(value: string): string {
  return value.replace(/[\\`*_{}\[\]<>()#+!|]/g, '\\$&').replace(/^([>-])/gm, '\\$1');
}

function quotedMarkdown(value: string): string {
  return value.replace(/\r\n?/g, '\n').split('\n').map(line => `> ${escapeMarkdown(line)}`).join('\n');
}

function publicSourceMarkdown(sourceId: string): string[] {
  const source = sourcesById.get(sourceId);
  if (!source) return [`- Source ID: \`${sourceId}\``, '  - Public metadata: Unavailable in current registry'];
  const safeUrl = source.url.replace(/</g, '%3C').replace(/>/g, '%3E');
  return [
    `- Source ID: \`${source.sourceId}\``,
    `  - Publisher: ${escapeMarkdown(source.publisher)}`,
    `  - Title: ${escapeMarkdown(source.title)}`,
    `  - Published: ${escapeMarkdown(source.publishedDate)}`,
    `  - URL: <${safeUrl}>`,
  ];
}

export async function exportTeaReferenceIssues(db: D1Database, accountId: string): Promise<string> {
  const issues = await listTeaReferenceIssues(db, accountId);
  const lines = [
    '# Tea Reference regeneration brief',
    '',
    'Open revision issues grouped by canonical public page and section.',
  ];
  let priorPageId: string | null = null;
  let priorSectionKey: string | null = null;
  for (const issue of issues) {
    if (issue.page_id !== priorPageId) {
      const page = pagesById.get(issue.page_id);
      lines.push(
        '',
        `## ${escapeMarkdown(page?.label ?? issue.page_id)}`,
        '',
        `- Page ID: \`${issue.page_id}\``,
        `- Markdown: \`data/tea-reference/pages/${issue.page_slug}.md\``,
        `- Route: \`${issue.route}\``,
      );
      priorPageId = issue.page_id;
      priorSectionKey = null;
    }
    if (issue.section_key !== priorSectionKey) {
      lines.push('', `### ${escapeMarkdown(issue.section_label)}`, '', `Section key: \`${issue.section_key}\``);
      priorSectionKey = issue.section_key;
    }
    lines.push(
      '',
      `<!-- tea-reference-issue:${issue.id} -->`,
      `- Category: ${categoryLabels[issue.category]}`,
      `- Issue ID: \`${issue.id}\``,
      '',
      '**Sources**',
      '',
      ...(issue.source_ids.length ? issue.source_ids.flatMap(publicSourceMarkdown) : ['None']),
      '',
      '**Note**',
      '',
      quotedMarkdown(issue.note),
      '',
      '**Current public text**',
      '',
      quotedMarkdown(issue.public_text_snapshot),
    );
  }
  return `${lines.join('\n')}\n`;
}

export async function resolveTeaReferenceIssues(
  db: D1Database,
  context: { accountId: string; userId: string },
  input: unknown,
): Promise<string[]> {
  if (!isRecord(input)) {
    throw new TeaReferenceIssueError('Invalid Tea Reference issue resolution request', 400, 'validation_failed');
  }
  assertOnlyFields(input, new Set(['ids']));
  if (!Array.isArray(input.ids) || input.ids.length === 0 || input.ids.length > 100
    || input.ids.some(id => typeof id !== 'string' || !id.trim() || id.length > 128)
    || new Set(input.ids).size !== input.ids.length) {
    throw new TeaReferenceIssueError('One to 100 unique issue IDs are required', 400, 'invalid_issue_ids');
  }
  const ids = [...input.ids] as string[];
  const placeholders = ids.map(() => '?').join(', ');
  const existing = await db.prepare(`
    SELECT id FROM tea_reference_issues
    WHERE account_id = ? AND status = 'open' AND id IN (${placeholders})
  `).bind(context.accountId, ...ids).all<{ id: string }>();
  if (existing.results.length !== ids.length) {
    throw new TeaReferenceIssueError('One or more open issues were not found', 404, 'issues_not_found');
  }

  const update = await db.prepare(`
    UPDATE tea_reference_issues
    SET status = 'resolved', resolved_by_user_id = ?, resolved_at = datetime('now')
    WHERE account_id = ? AND status = 'open' AND id IN (${placeholders})
      AND (
        SELECT COUNT(*) FROM tea_reference_issues
        WHERE account_id = ? AND status = 'open' AND id IN (${placeholders})
      ) = ?
  `).bind(
    context.userId,
    context.accountId,
    ...ids,
    context.accountId,
    ...ids,
    ids.length,
  ).run();
  if (Number(update.meta.changes ?? 0) !== ids.length) {
    throw new TeaReferenceIssueError('Issue resolution conflicted with another update', 409, 'resolution_conflict');
  }
  return ids.sort(codePointCompare);
}

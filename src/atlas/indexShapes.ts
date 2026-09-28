// The pieces of the Tea Atlas index, shared by the two things that write it:
// scripts/atlas-build.mjs rebuilds it whole from the package, and the admin's
// "Add a source" merges one new source into what is already published
// (src/atlas/add/mergeIndex.ts). Both must produce the same files, so the
// shapes live here once. Contract: docs/TEA_ATLAS.md.
//
// No imports and only erasable TypeScript, so Node can load this file straight
// from the build script.

export interface PackageSource {
  id: string;
  name: string;
  kind: string;
  subtitle?: string;
  credit?: string;
  issues: Array<{ id: string; label: string; articles: string[] }>;
}

export interface PackageTopic {
  id: string;
  name: string;
  category: string;
  aliases?: string[];
}

export interface PackageArticleMeta {
  id: string;
  source: string;
  issue: string;
  title: string;
  author?: string;
  pages?: string;
  order: number;
  topics?: string[];
  words?: number;
  cover?: string | null;
}

export interface PackageManifest {
  format: 1;
  sources: PackageSource[];
  topics: PackageTopic[];
  articles: PackageArticleMeta[];
}

export interface PackageBlock {
  t: string;
  v?: string;
  src?: string;
  n?: number;
}

export const yearOf = (issueId: string) => /^(\d{4})/.exec(issueId)?.[1] ?? 'Other';

/** What a list of articles shows, without the blocks. */
export function articleCard(a: PackageArticleMeta) {
  return {
    id: a.id, title: a.title, author: a.author || '', pages: a.pages || '',
    order: a.order, topics: a.topics || [], words: a.words || 0, cover: a.cover || null,
  };
}

export const issueCover = (articles: PackageArticleMeta[]) => articles.find(a => a.cover)?.cover ?? null;

export function issueSummary(issue: { id: string; label: string }, articles: PackageArticleMeta[]) {
  return { id: issue.id, label: issue.label, count: articles.length, cover: issueCover(articles) };
}

export function sourceHead(s: PackageSource) {
  return { id: s.id, name: s.name, kind: s.kind, subtitle: s.subtitle || '', credit: s.credit || s.name };
}

export const CATALOG_FIELDS = ['id', 'title', 'author', 'issue', 'issueLabel', 'topics', 'pages'];

export function catalogRow(a: PackageArticleMeta, issue: { id: string; label: string }) {
  return [a.id, a.title, a.author || '', issue.id, issue.label, a.topics || [], a.pages || ''];
}

/** The text full-text search indexes for one article. */
export function searchableText(a: PackageArticleMeta, blocks: PackageBlock[] | undefined): string {
  return [a.title, a.author, ...(blocks || []).filter(b => b.t === 'p' || b.t === 'h' || b.t === 'aside').map(b => b.v)].join('\n');
}

/** A source's line on the home page. */
export function homeSource(s: PackageSource, own: Array<{ issue: { id: string; label: string }; articles: PackageArticleMeta[] }>) {
  return {
    ...sourceHead(s),
    issueCount: own.length,
    articleCount: own.reduce((n, i) => n + i.articles.length, 0),
    first: own[0]?.issue.label ?? '',
    last: own[own.length - 1]?.issue.label ?? '',
    cover: own.length ? issueCover(own[own.length - 1].articles) : null,
  };
}

/** A source's own page: its issues, grouped by year. */
export function sourcePage(s: PackageSource, own: Array<{ issue: { id: string; label: string }; articles: PackageArticleMeta[] }>) {
  const years: Array<{ year: string; issues: ReturnType<typeof issueSummary>[] }> = [];
  for (const i of own) {
    const year = yearOf(i.issue.id);
    let bucket = years[years.length - 1];
    if (!bucket || bucket.year !== year) years.push(bucket = { year, issues: [] });
    bucket.issues.push(issueSummary(i.issue, i.articles));
  }
  return { source: sourceHead(s), years };
}

// Shapes of the Tea Atlas files (built by scripts/atlas-build.mjs, contract in
// docs/TEA_ATLAS.md). Kept here, not in src/types.ts, so the library stays one
// folder the design session can work in.

export interface AtlasSourceHead {
  id: string;
  name: string;
  kind: string;
  subtitle: string;
  credit: string;
}

export interface AtlasTopic {
  id: string;
  name: string;
  category: string;
  aliases: string[];
  count: number;
}

export interface AtlasHome {
  format: 1;
  sources: Array<AtlasSourceHead & {
    issueCount: number;
    articleCount: number;
    first: string;
    last: string;
    cover: string | null;
  }>;
  topics: AtlasTopic[];
  totals: { sources: number; issues: number; articles: number };
}

export interface AtlasIssueSummary {
  id: string;
  label: string;
  count: number;
  cover: string | null;
}

export interface AtlasSource {
  source: AtlasSourceHead;
  years: Array<{ year: string; issues: AtlasIssueSummary[] }>;
}

export interface AtlasArticleCard {
  id: string;
  title: string;
  author: string;
  pages: string;
  order: number;
  topics: string[];
  words: number;
  cover: string | null;
}

export interface AtlasIssue {
  source: AtlasSourceHead;
  issue: AtlasIssueSummary;
  prev: { id: string; label: string } | null;
  next: { id: string; label: string } | null;
  articles: AtlasArticleCard[];
}

export interface AtlasTopicPage {
  topic: Omit<AtlasTopic, 'count'>;
  articles: Array<AtlasArticleCard & { issue: string; issueLabel: string }>;
}

export type AtlasBlock =
  | { t: 'p'; v: string }
  | { t: 'h'; v: string }
  | { t: 'aside'; v: string }
  | { t: 'img'; src: string }
  | { t: 'page'; n: number };

export interface AtlasArticle {
  id: string;
  source: string;
  issue: string;
  title: string;
  author: string;
  pages: string;
  order: number;
  topics: string[];
  words: number;
  cover: string | null;
  blocks: AtlasBlock[];
}

/** One row of search/catalog.json: [id, title, author, issue, issueLabel, topics, pages]. */
export type AtlasCatalogRow = [string, string, string, string, string, string[], string];

export interface AtlasCatalog {
  fields: string[];
  rows: AtlasCatalogRow[];
}

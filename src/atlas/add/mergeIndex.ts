// Merge one new source into the published index, without rebuilding it.
//
// scripts/atlas-build.mjs builds the whole index from every article's text,
// which the browser cannot do (it would mean downloading the whole library).
// A new source is always added at the END of the reading order, so nothing
// already published moves: its articles take the next catalogue numbers, its
// topics' lists grow at the end, and each search word's list of article
// numbers simply gains larger numbers. That is why merging touches only the
// files the new source changes, and why the result is exactly what a full
// rebuild with the source added last produces (worker/tests/tea-atlas-add-source.test.ts
// holds the two side by side).

import type { AtlasCatalog, AtlasCatalogRow, AtlasHome, AtlasTopicPage } from '../types';
import { decodePostings, encodePostings, shardFor, tokenize } from '../searchText.ts';
import {
  articleCard, catalogRow, homeSource, issueSummary, searchableText, sourceHead, sourcePage,
  type PackageArticleMeta, type PackageBlock,
} from '../indexShapes.ts';
import type { SourcePackage } from './buildPackage.ts';

export type Shard = Record<string, number[]>;

/** Topic files and search shards the merge will read and rewrite. */
export function touchedBy(pkg: SourcePackage): { topics: string[]; shards: string[] } {
  const topics = new Set<string>();
  const shards = new Set<string>();
  for (const a of pkg.articles) {
    for (const t of a.topics ?? []) topics.add(t);
    for (const term of tokenize(searchableText(a, a.blocks as PackageBlock[]))) shards.add(shardFor(term));
  }
  return { topics: [...topics].sort(), shards: [...shards].sort() };
}

export interface PublishedIndex {
  home: AtlasHome;
  catalog: AtlasCatalog;
  /** Only the topics in touchedBy(); every topic the home page lists has a file. */
  topics: Map<string, AtlasTopicPage>;
  /** Only the shards in touchedBy(); a shard nobody has written yet is absent. */
  shards: Map<string, Shard>;
}

/** Every index file the new source changes, keyed by its path under index/v1/, home.json last. */
export function mergeIntoIndex(index: PublishedIndex, pkg: SourcePackage): Array<[string, unknown]> {
  const { home, catalog } = index;
  const source = pkg.manifest.sources[0];
  if (home.sources.some(s => s.id === source.id)) throw new Error(`A source called ${source.id} is already in the Tea Atlas.`);
  const known = new Set(home.topics.map(t => t.id));
  const byId = new Map(pkg.articles.map(a => [a.id, a]));
  const own = source.issues.map(issue => ({
    issue,
    articles: issue.articles.map(id => {
      const a = byId.get(id);
      if (!a) throw new Error(`Issue ${issue.id} lists ${id}, which is not in the package.`);
      // Same rule as the rebuild: a topic the library does not have is dropped.
      return { ...a, topics: (a.topics ?? []).filter(t => known.has(t)) } as PackageArticleMeta & { blocks: PackageBlock[] };
    }),
  }));

  const out: Array<[string, unknown]> = [];
  out.push([`sources/${source.id}.json`, sourcePage(source, own)]);
  own.forEach((entry, i) => {
    const prev = own[i - 1];
    const next = own[i + 1];
    out.push([`issues/${entry.issue.id}.json`, {
      source: sourceHead(source),
      issue: issueSummary(entry.issue, entry.articles),
      prev: prev ? { id: prev.issue.id, label: prev.issue.label } : null,
      next: next ? { id: next.issue.id, label: next.issue.label } : null,
      articles: entry.articles.map(articleCard),
    }]);
  });

  // Topics: the new articles join the end of each list, oldest first as ever.
  const added = new Map<string, number>();
  const topicFiles = new Map<string, AtlasTopicPage>();
  for (const { issue, articles } of own) {
    for (const a of articles) {
      for (const t of a.topics ?? []) {
        const page = topicFiles.get(t) ?? structuredClone(index.topics.get(t));
        if (!page) throw new Error(`The topic file for ${t} could not be read.`);
        page.articles.push({ ...articleCard(a), issue: issue.id, issueLabel: issue.label });
        topicFiles.set(t, page);
        added.set(t, (added.get(t) ?? 0) + 1);
      }
    }
  }
  for (const [id, page] of topicFiles) out.push([`topics/${id}.json`, page]);

  // Catalogue and full text: the new articles take the next numbers.
  const rows: AtlasCatalogRow[] = [...catalog.rows];
  const shards = new Map<string, Shard>();
  const shard = (name: string) => {
    let s = shards.get(name);
    if (!s) shards.set(name, s = { ...(index.shards.get(name) ?? {}) });
    return s;
  };
  for (const { issue, articles } of own) {
    for (const a of articles) {
      const n = rows.length;
      rows.push(catalogRow(a, issue) as AtlasCatalogRow);
      for (const term of new Set(tokenize(searchableText(a, a.blocks)))) {
        const s = shard(shardFor(term));
        const numbers = s[term] ? decodePostings(s[term]) : [];
        numbers.push(n);
        s[term] = encodePostings(numbers);
      }
    }
  }
  for (const [name, terms] of [...shards].sort()) out.push([`search/text/${name}.json`, terms]);
  out.push(['search/catalog.json', { fields: catalog.fields, rows }]);

  const nextHome: AtlasHome = {
    ...home,
    sources: [...home.sources, homeSource(source, own) as AtlasHome['sources'][number]],
    topics: home.topics.map(t => ({ ...t, count: t.count + (added.get(t.id) ?? 0) })),
    totals: {
      sources: home.totals.sources + 1,
      issues: home.totals.issues + own.length,
      articles: rows.length,
    },
  };
  // Last, so a reader never meets a home page that points at files not yet written.
  out.push(['home.json', nextHome]);
  return out;
}

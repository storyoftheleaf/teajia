// Tea Atlas: turn the web package (format 1) into the files the Worker serves.
//
// Pure: reads the package, returns every object the bucket should hold as
// { key, file } (copied as-is from the package) or { key, body } (built here).
// scripts/atlas-upload.mjs decides what actually needs uploading.
// The layout is the contract in docs/TEA_ATLAS.md.

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tokenize, shardFor, encodePostings } from '../src/atlas/searchText.ts';

export const INDEX_PREFIX = 'index/v1/';

function fail(message) {
  throw new Error(`Tea Atlas package: ${message}`);
}

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (err) {
    fail(`could not read ${path}: ${err.message}`);
  }
}

function walk(dir, prefix = '') {
  const out = [];
  for (const name of readdirSync(dir).sort()) {
    if (name.startsWith('.')) continue;
    const full = join(dir, name);
    const rel = prefix ? `${prefix}/${name}` : name;
    if (statSync(full).isDirectory()) out.push(...walk(full, rel));
    else out.push(rel);
  }
  return out;
}

const yearOf = issueId => (/^(\d{4})/.exec(issueId)?.[1] ?? 'Other');

/** What a list of articles shows, without the blocks. */
function articleCard(a) {
  return {
    id: a.id, title: a.title, author: a.author || '', pages: a.pages || '',
    order: a.order, topics: a.topics || [], words: a.words || 0, cover: a.cover || null,
  };
}

export function buildAtlas(exportDir) {
  if (!existsSync(join(exportDir, 'manifest.json'))) fail(`no manifest.json in ${exportDir}`);
  const manifest = readJson(join(exportDir, 'manifest.json'));
  if (manifest.format !== 1) fail(`format ${manifest.format} is not format 1`);

  const topicsById = new Map();
  for (const t of manifest.topics) {
    if (topicsById.has(t.id)) fail(`topic id ${t.id} appears twice`);
    topicsById.set(t.id, t);
  }
  const articlesById = new Map();
  for (const a of manifest.articles) {
    if (articlesById.has(a.id)) fail(`article id ${a.id} appears twice`);
    articlesById.set(a.id, a);
  }

  // Reading order: sources as listed, issues as listed, articles as listed.
  const issues = [];        // { source, issue, articles: [meta] }
  const issueIds = new Set();
  for (const source of manifest.sources) {
    for (const issue of source.issues) {
      if (issueIds.has(issue.id)) fail(`issue id ${issue.id} appears twice`);
      issueIds.add(issue.id);
      const articles = issue.articles.map(id => {
        const a = articlesById.get(id);
        if (!a) fail(`issue ${issue.id} lists article ${id}, which is not in articles[]`);
        return a;
      });
      issues.push({ source, issue, articles });
    }
  }

  const objects = [];
  const put = (key, value) => objects.push({ key: INDEX_PREFIX + key, body: JSON.stringify(value), type: 'application/json' });

  const issueCover = articles => articles.find(a => a.cover)?.cover ?? null;
  const issueSummary = ({ issue, articles }) => ({
    id: issue.id, label: issue.label, count: articles.length, cover: issueCover(articles),
  });
  const sourceHead = s => ({ id: s.id, name: s.name, kind: s.kind, subtitle: s.subtitle || '', credit: s.credit || s.name });

  // Catalogue: the numbered list full-text postings point into.
  const catalog = [];
  const numberOf = new Map();
  for (const { issue, articles } of issues) {
    for (const a of articles) {
      numberOf.set(a.id, catalog.length);
      catalog.push([a.id, a.title, a.author || '', issue.id, issue.label, a.topics || [], a.pages || '']);
    }
  }

  // Topic counts and lists, chronological.
  const topicArticles = new Map([...topicsById.keys()].map(id => [id, []]));
  for (const { issue, articles } of issues) {
    for (const a of articles) {
      for (const t of a.topics || []) {
        if (!topicArticles.has(t)) fail(`article ${a.id} carries unknown topic ${t}`);
        topicArticles.get(t).push({ ...articleCard(a), issue: issue.id, issueLabel: issue.label });
      }
    }
  }

  // home.json
  put('home.json', {
    format: 1,
    sources: manifest.sources.map(s => {
      const own = issues.filter(i => i.source.id === s.id);
      return {
        ...sourceHead(s),
        issueCount: own.length,
        articleCount: own.reduce((n, i) => n + i.articles.length, 0),
        first: own[0]?.issue.label ?? '',
        last: own[own.length - 1]?.issue.label ?? '',
        cover: own.length ? issueCover(own[own.length - 1].articles) : null,
      };
    }),
    topics: manifest.topics.map(t => ({
      id: t.id, name: t.name, category: t.category, aliases: t.aliases || [], count: topicArticles.get(t.id).length,
    })),
    totals: { sources: manifest.sources.length, issues: issues.length, articles: catalog.length },
  });

  // sources/<id>.json
  for (const s of manifest.sources) {
    const own = issues.filter(i => i.source.id === s.id);
    const years = [];
    for (const i of own) {
      const year = yearOf(i.issue.id);
      let bucket = years[years.length - 1];
      if (!bucket || bucket.year !== year) years.push(bucket = { year, issues: [] });
      bucket.issues.push(issueSummary(i));
    }
    put(`sources/${s.id}.json`, { source: sourceHead(s), years });
  }

  // issues/<id>.json, with neighbours inside the same source.
  issues.forEach((entry, idx) => {
    const prev = issues[idx - 1]?.source.id === entry.source.id ? issues[idx - 1] : null;
    const next = issues[idx + 1]?.source.id === entry.source.id ? issues[idx + 1] : null;
    put(`issues/${entry.issue.id}.json`, {
      source: sourceHead(entry.source),
      issue: issueSummary(entry),
      prev: prev ? { id: prev.issue.id, label: prev.issue.label } : null,
      next: next ? { id: next.issue.id, label: next.issue.label } : null,
      articles: entry.articles.map(articleCard),
    });
  });

  // topics/<id>.json
  for (const [id, list] of topicArticles) {
    const t = topicsById.get(id);
    put(`topics/${id}.json`, { topic: { id, name: t.name, category: t.category, aliases: t.aliases || [] }, articles: list });
  }

  // Search: catalogue + inverted index shards.
  put('search/catalog.json', { fields: ['id', 'title', 'author', 'issue', 'issueLabel', 'topics', 'pages'], rows: catalog });

  const postings = new Map(); // term -> Set(article number)
  const articleFiles = [];
  for (const { articles } of issues) {
    for (const a of articles) {
      const path = join(exportDir, 'articles', `${a.id}.json`);
      if (!existsSync(path)) fail(`articles/${a.id}.json is missing`);
      articleFiles.push({ key: `articles/${a.id}.json`, file: path, type: 'application/json' });
      const full = readJson(path);
      const n = numberOf.get(a.id);
      const text = [a.title, a.author, ...(full.blocks || []).filter(b => b.t === 'p' || b.t === 'h' || b.t === 'aside').map(b => b.v)].join('\n');
      for (const term of tokenize(text)) {
        let set = postings.get(term);
        if (!set) postings.set(term, set = new Set());
        set.add(n);
      }
    }
  }
  const shards = new Map();
  for (const [term, set] of postings) {
    const shard = shardFor(term);
    if (!shards.has(shard)) shards.set(shard, {});
    shards.get(shard)[term] = encodePostings([...set].sort((x, y) => x - y));
  }
  for (const [shard, terms] of [...shards].sort()) put(`search/text/${shard}.json`, terms);

  // The package's own files, copied as they are.
  const media = existsSync(join(exportDir, 'media'))
    ? walk(join(exportDir, 'media')).map(rel => ({ key: `media/${rel}`, file: join(exportDir, 'media', rel), type: 'image/jpeg' }))
    : [];
  for (const m of media) if (!/\.jpe?g$/i.test(m.key)) fail(`media file ${m.key} is not a JPEG`);

  return {
    objects: [...objects, ...articleFiles, ...media],
    stats: {
      sources: manifest.sources.length, issues: issues.length, articles: catalog.length,
      topics: topicsById.size, terms: postings.size, shards: shards.size, pictures: media.length,
    },
  };
}

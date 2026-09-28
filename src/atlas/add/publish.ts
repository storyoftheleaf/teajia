// Send a built source to the private bucket and merge it into the index.
// Order matters, so a reader never meets a link to something not there yet:
//
//   1. pictures, then articles        (write-once; a retry skips what landed)
//   2. added/<id>/manifest.json and added/sources.json, so the next
//      `npm run atlas:upload` rebuild keeps this source
//   3. the index files the merge changed, home.json last
//
// docs/TEA_ATLAS.md, "Adding a source in the admin".

import { atlasAdminResponse } from '../../lib/api';
import type { AtlasCatalog, AtlasHome, AtlasTopicPage } from '../types';
import type { SourcePackage } from './buildPackage.ts';
import { mergeIntoIndex, touchedBy, type Shard } from './mergeIndex.ts';

export interface AddedRegistry {
  format: 1;
  /** In the order they were added; the rebuild puts them after the package's sources in this order. */
  sources: Array<{ id: string; name: string; addedAt: string }>;
}

export type PublishStep = { label: string; done: number; total: number };

async function readJson<T>(key: string): Promise<T | null> {
  const res = await atlasAdminResponse(`object/${key}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Could not read ${key} (${res.status}).`);
  return res.json() as Promise<T>;
}

async function write(key: string, body: Blob | string, type: string): Promise<'written' | 'already-there'> {
  const res = await atlasAdminResponse(`object/${key}`, {
    method: 'PUT',
    body,
    headers: { 'Content-Type': type },
    retryTimeouts: true,
  });
  if (res.status === 409) return 'already-there';
  if (!res.ok) throw new Error(`Could not save ${key} (${res.status}).`);
  return 'written';
}

/** Run `fn` over `items`, a few at a time. */
async function pool<T>(items: T[], size: number, fn: (item: T) => Promise<void>) {
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, async () => {
    while (next < items.length) await fn(items[next++]);
  }));
}

export async function readRegistry(): Promise<AddedRegistry> {
  return (await readJson<AddedRegistry>('added/sources.json')) ?? { format: 1, sources: [] };
}

/**
 * Refuse a name the library already uses, before anything is sent. Every key
 * a new source writes starts with its issue id, so a new source and issue id
 * mean it cannot touch anything already published.
 */
export async function checkNewSource(pkg: SourcePackage): Promise<string | null> {
  const source = pkg.manifest.sources[0];
  const home = await readJson<AtlasHome>('index/v1/home.json');
  if (!home) return 'The Tea Atlas index could not be read. Nothing was sent.';
  if (home.sources.some(s => s.id === source.id)) return `The Tea Atlas already has a source called “${source.name}”. Give this one a different name.`;
  // In the registry but not on the home page: an earlier publish of this very
  // source stopped part way. Sending again finishes it.
  const issueIds = new Set<string>();
  for (const s of home.sources) {
    const page = await readJson<{ years: Array<{ issues: Array<{ id: string }> }> }>(`index/v1/sources/${s.id}.json`);
    for (const y of page?.years ?? []) for (const i of y.issues) issueIds.add(i.id);
  }
  for (const issue of source.issues) {
    if (issueIds.has(issue.id)) return `The Tea Atlas already has an issue with the id ${issue.id}. Change the name or year.`;
  }
  return null;
}

export async function publishSource(
  pkg: SourcePackage,
  pictures: Map<string, Blob>,
  onStep: (step: PublishStep) => void,
): Promise<void> {
  const source = pkg.manifest.sources[0];
  const problem = await checkNewSource(pkg);
  if (problem) throw new Error(problem);

  const used = new Set(pkg.articles.flatMap(a => a.blocks.flatMap(b => (b.t === 'img' ? [b.src] : []))));
  const media = [...used].filter(src => pictures.has(src));
  let done = 0;
  onStep({ label: 'Sending pictures', done, total: media.length });
  await pool(media, 4, async src => {
    await write(`media/${src}`, pictures.get(src)!, 'image/jpeg');
    onStep({ label: 'Sending pictures', done: ++done, total: media.length });
  });

  done = 0;
  onStep({ label: 'Sending articles', done, total: pkg.articles.length });
  await pool(pkg.articles, 4, async a => {
    await write(`articles/${a.id}.json`, JSON.stringify(a), 'application/json');
    onStep({ label: 'Sending articles', done: ++done, total: pkg.articles.length });
  });

  onStep({ label: 'Recording the source', done: 0, total: 1 });
  await write(`added/${source.id}/manifest.json`, JSON.stringify(pkg.manifest), 'application/json');
  const registry = await readRegistry();
  if (!registry.sources.some(s => s.id === source.id)) {
    registry.sources.push({ id: source.id, name: source.name, addedAt: new Date().toISOString() });
  }
  await write('added/sources.json', JSON.stringify(registry), 'application/json');

  onStep({ label: 'Reading the index', done: 0, total: 1 });
  const need = touchedBy(pkg);
  const home = await readJson<AtlasHome>('index/v1/home.json');
  const catalog = await readJson<AtlasCatalog>('index/v1/search/catalog.json');
  if (!home || !catalog) throw new Error('The Tea Atlas index could not be read.');
  const topics = new Map<string, AtlasTopicPage>();
  const shards = new Map<string, Shard>();
  done = 0;
  const reads = [...need.topics.map(t => ['topic', t] as const), ...need.shards.map(s => ['shard', s] as const)];
  await pool(reads, 6, async ([kind, name]) => {
    if (kind === 'topic') {
      const page = await readJson<AtlasTopicPage>(`index/v1/topics/${name}.json`);
      if (page) topics.set(name, page);
    } else {
      const shard = await readJson<Shard>(`index/v1/search/text/${name}.json`);
      if (shard) shards.set(name, shard);
    }
    onStep({ label: 'Reading the index', done: ++done, total: reads.length });
  });

  const files = mergeIntoIndex({ home, catalog, topics, shards }, pkg);
  const last = files.pop()!; // home.json
  done = 0;
  onStep({ label: 'Updating the index and search', done, total: files.length + 1 });
  await pool(files, 6, async ([key, body]) => {
    await write(`index/v1/${key}`, JSON.stringify(body), 'application/json');
    onStep({ label: 'Updating the index and search', done: ++done, total: files.length + 1 });
  });
  await write(`index/v1/${last[0]}`, JSON.stringify(last[1]), 'application/json');
  onStep({ label: 'Updating the index and search', done: files.length + 1, total: files.length + 1 });
}

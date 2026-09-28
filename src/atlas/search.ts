// Tea Atlas search: titles, authors and topics from the catalogue, then the
// full text from the index shards the query's words live in. Only those shards
// are fetched; the whole index is never loaded.

import { atlasJson } from './client';
import { decodePostings, shardFor, tokenize } from './searchText';
import type { AtlasCatalog, AtlasCatalogRow, AtlasHome } from './types';

export interface AtlasSearchResult {
  /** Title, author or topic matches, in reading order. */
  named: AtlasCatalogRow[];
  /** Articles whose text holds every word, not already in `named`. */
  text: AtlasCatalogRow[];
  /** Words searched in the full text (after common words are dropped). */
  terms: string[];
}

const fold = (s: string) => s.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase();

// The last word may still be being typed, so it also matches words it starts:
// "puer" finds puerh. Capped so a one-letter prefix cannot flood the results.
const PREFIX_TERMS = 40;

async function articlesWith(term: string, prefix: boolean): Promise<Set<number>> {
  let shard: Record<string, number[]>;
  try {
    shard = await atlasJson<Record<string, number[]>>(`search/text/${shardFor(term)}.json`);
  } catch {
    return new Set();
  }
  const hits = new Set<number>();
  const add = (gaps: number[]) => { for (const n of decodePostings(gaps)) hits.add(n); };
  if (shard[term]) add(shard[term]);
  if (prefix) {
    let taken = 0;
    for (const key of Object.keys(shard)) {
      if (key !== term && key.startsWith(term)) {
        add(shard[key]);
        if (++taken >= PREFIX_TERMS) break;
      }
    }
  }
  return hits;
}

export async function searchAtlas(query: string): Promise<AtlasSearchResult> {
  const q = fold(query.trim());
  if (!q) return { named: [], text: [], terms: [] };
  const [catalog, home] = await Promise.all([
    atlasJson<AtlasCatalog>('search/catalog.json'),
    atlasJson<AtlasHome>('home.json'),
  ]);

  // Every word of the query must appear somewhere in the title, the author
  // or a topic's name or alias, so "jian ware" finds the Jian ware topic.
  const words = q.split(/\s+/).filter(Boolean);
  const topicText = new Map(home.topics.map(t => [t.id, fold([t.name, ...t.aliases].join(' '))]));
  const namedIdx = new Set<number>();
  catalog.rows.forEach((row, i) => {
    const [, title, author, , , topics] = row;
    const haystack = [fold(title), fold(author || ''), ...topics.map(t => topicText.get(t) ?? '')].join(' ');
    if (words.every(w => haystack.includes(w))) namedIdx.add(i);
  });

  const terms = [...new Set(tokenize(query))];
  let textIdx: Set<number> | null = null;
  if (terms.length) {
    const sets = await Promise.all(terms.map((t, i) => articlesWith(t, i === terms.length - 1)));
    for (const set of sets) {
      textIdx = textIdx === null ? set : new Set([...textIdx].filter(n => set.has(n)));
    }
  }

  const named = [...namedIdx].sort((a, b) => a - b).map(i => catalog.rows[i]);
  const text = [...(textIdx ?? [])].filter(i => !namedIdx.has(i)).sort((a, b) => a - b).map(i => catalog.rows[i]).filter(Boolean);
  return { named, text, terms };
}

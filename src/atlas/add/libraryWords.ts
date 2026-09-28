// The Tea Atlas's own vocabulary, as a spelling reference: every word its
// full-text index holds. Used to put back letters a PDF lost (text.ts,
// repairLigatures). Loads only the index files the asked-about words need.

import { atlasJson } from '../client';
import { shardFor } from '../searchText.ts';
import type { PdfDoc } from './types.ts';
import { lostLigatureWords, repairLigatures } from './text.ts';

export async function withLigaturesRepaired(doc: PdfDoc): Promise<PdfDoc> {
  const lost = lostLigatureWords(doc);
  if (!lost.size) return doc;
  const words = [...lost.values()].flat().map(w => w.toLowerCase());
  const shards = new Map<string, Record<string, unknown>>();
  await Promise.all([...new Set(words.map(shardFor))].map(async name => {
    shards.set(name, await atlasJson<Record<string, unknown>>(`search/text/${name}.json`).catch(() => ({})));
  }));
  return repairLigatures(doc, word => Boolean(shards.get(shardFor(word))?.[word]));
}

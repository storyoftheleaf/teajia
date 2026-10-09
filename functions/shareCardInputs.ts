/**
 * What goes on each published Read piece's link-preview card. Read by the
 * script that draws the cards (scripts/share-cards.ts) and by the test that
 * fails when a card is missing or stale, so both agree on one answer.
 *
 * Not imported by the app: it reaches into the edge function's page map for
 * titles and descriptions, which the browser bundle has no need of.
 */
import { STATIC_META, readShareCardPath } from './_middleware';
import { isReadPathPublic } from '../src/pages/read/articleLive';
import { CONVERSATIONS } from '../src/pages/read/conversation/pieces';
import { shareCardFor, type ShareCard } from '../src/pages/read/conversation/spec';

export type ShareCardInput = ShareCard & { subtitle?: string };

export function shareCardInputs(): Record<string, ShareCardInput> {
  const out: Record<string, ShareCardInput> = {};
  for (const [path, meta] of Object.entries(STATIC_META)) {
    if (!path.startsWith('/read/') || !isReadPathPublic(path) || meta.image) continue;
    const spec = CONVERSATIONS.find((c) => c.path === path);
    out[path] = spec ? shareCardFor(spec) : { title: meta.title.replace(/\s*·\s*Teajia\s*$/, ''), subtitle: meta.description };
  }
  return out;
}

export { readShareCardPath };

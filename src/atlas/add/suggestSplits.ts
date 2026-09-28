// ─────────────────────────────────────────────────────────────────────────────
//  OPTIONAL AI STEP: "Suggest splits"      OFF BY DEFAULT · NOT BUILT · NEVER CALLED
// ─────────────────────────────────────────────────────────────────────────────
//
// For magazines too messy for the three code methods in split.ts (bookmarks,
// contents page, large headings), a model could propose where each article
// starts, the way ~/builds/tea-atlas.sh does for Global Tea Hut.
//
// The rule, if it is ever switched on (Adrian's): AI organises, it never
// rewrites. It would receive ONLY each page's first few lines (see
// `headingsPayload`), never the article text, about 2k tokens per document,
// and answer page numbers and titles. The person still checks every split in
// the review screen before anything is published.
//
// To build it: add a Worker route that forwards `headingsPayload(doc)` to the
// model and returns `ProposedSection[]`, flip SUGGEST_SPLITS_WITH_AI, and call
// `suggestSplitsWithAI` from the review screen's "Suggest splits" button. Until
// then the button does not exist and nothing here runs.

import { pageOffset, printedPage } from './text.ts';
import type { PdfDoc, ProposedSection } from './types.ts';

export const SUGGEST_SPLITS_WITH_AI = false;

/** What the model would be sent: page numbers and each page's first lines, nothing else. */
export function headingsPayload(doc: PdfDoc, linesPerPage = 4): string {
  const offset = pageOffset(doc);
  return doc.pages
    .map(p => `p${printedPage(p.index, offset)}: ${p.lines.slice(0, linesPerPage).map(l => l.text.slice(0, 70)).join(' | ') || '(picture only)'}`)
    .join('\n');
}

export async function suggestSplitsWithAI(_doc: PdfDoc): Promise<ProposedSection[]> {
  throw new Error('The AI split suggestion is switched off and not built. See src/atlas/add/suggestSplits.ts.');
}

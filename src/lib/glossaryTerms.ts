/**
 * Tea terms in a story become tappable definitions, on their FIRST mention per
 * story, found automatically against the glossary rather than marked by hand.
 *
 * Why automatic: a story arrives from the magazine pipeline as prose, and a
 * marker the writer has to remember is a marker that gets forgotten. The
 * glossary is the one list of terms, so matching against it means a term
 * added to the glossary starts linking in every story that mentions it, with
 * no edit to the story. The opt-out is per block (`noTerms` on an article
 * block) or per passage (`data-no-terms` on an element of a hand-built page),
 * and per term (`autoLink: false` on a glossary entry whose word is ordinary
 * English, like "rolling").
 *
 * Matching rules: case-insensitive, whole word (a letter or digit on either
 * side means no match, so "Oolongs" matches and "Oolongish" does not), a term
 * or any of its aliases, a trailing plural s/es allowed, a space or hyphen in
 * the term matching either, and the longest term wins where two overlap
 * ("Sheng Puerh" before "Puerh").
 */
import React from 'react';
import type { GlossaryTerm } from '../data/glossary';

export type TermSegment = string | { termId: string; text: string };

export interface TermIndex {
  regex: RegExp | null;
  /** lowercased, space/hyphen-normalised spelling → term id */
  byForm: Map<string, string>;
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/'/g, "['\u2019]");
const normForm = (s: string) => s.toLowerCase().replace(/\u2019/g, "'").replace(/[\s-]+/g, ' ').trim();

export function buildTermIndex(terms: GlossaryTerm[]): TermIndex {
  const byForm = new Map<string, string>();
  for (const t of terms) {
    if (t.autoLink === false) continue;
    for (const form of [t.term, ...(t.aliases ?? [])]) {
      const key = normForm(form);
      if (key && !byForm.has(key)) byForm.set(key, t.id);
    }
  }
  if (byForm.size === 0) return { regex: null, byForm };
  const forms = [...byForm.keys()].sort((a, b) => b.length - a.length);
  const alt = forms.map((f) => f.split(' ').map(escape).join('[\\s\\u00a0-]+')).join('|');
  const regex = new RegExp(`(?<![\\p{L}\\p{N}])(${alt})(?:e?s)?(?![\\p{L}\\p{N}])`, 'giu');
  return { regex, byForm };
}

/**
 * Splits one run of text into plain strings and term segments. Only a term not
 * already in `seen` is linked, and it is added to `seen`, so passing one Set
 * through a whole story in reading order gives first-mention-only.
 */
export function splitTerms(text: string, index: TermIndex, seen: Set<string>): TermSegment[] {
  if (!index.regex || !text) return [text];
  const out: TermSegment[] = [];
  let last = 0;
  index.regex.lastIndex = 0;
  for (const m of text.matchAll(index.regex)) {
    const termId = index.byForm.get(normForm(m[1]));
    if (!termId || seen.has(termId)) continue;
    seen.add(termId);
    const start = m.index ?? 0;
    if (start > last) out.push(text.slice(last, start));
    out.push({ termId, text: m[0] });
    last = start + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out.length ? out : [text];
}

// ── Hand-built stories: walk the JSX tree ────────────────────────────────────

// Never link inside these: headings and furniture are not prose, a link or a
// button cannot hold another control, and style/title hold text that is not
// read as words at all.
const SKIP_TAGS = new Set([
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'a', 'button', 'cite', 'figcaption',
  'code', 'pre', 'style', 'script', 'title', 'meta', 'textarea', 'input',
  'select', 'label', 'svg',
]);

type AnyProps = Record<string, unknown> & { children?: React.ReactNode };

function skipElement(el: React.ReactElement<AnyProps>): boolean {
  const p = el.props;
  if (typeof el.type === 'string' && SKIP_TAGS.has(el.type)) return true;
  if (p['aria-hidden'] || p['data-no-terms'] || p.to !== undefined || p.href !== undefined) return true;
  // A component can declare its children are not prose (EditableText's
  // children are the default value of an editable field, not markup).
  const type = el.type as { noGlossaryTerms?: boolean };
  return !!type && typeof type !== 'string' && !!type.noGlossaryTerms;
}

/**
 * Returns the tree with the first mention of each term wrapped by
 * `renderTerm`. Descends only through `props.children`, never into what a
 * component renders internally, which keeps it a pure function of the tree:
 * the same tree gives the same links on every render.
 */
export function linkTermsInTree(
  node: React.ReactNode,
  index: TermIndex,
  seen: Set<string>,
  renderTerm: (termId: string, text: string, key: string) => React.ReactNode,
): React.ReactNode {
  let n = 0;
  const walk = (nd: React.ReactNode): React.ReactNode => {
    if (typeof nd === 'string') {
      const segs = splitTerms(nd, index, seen);
      if (segs.length === 1 && typeof segs[0] === 'string') return nd;
      return React.createElement(
        React.Fragment,
        { key: `gt${n++}` },
        ...segs.map((s) => (typeof s === 'string' ? s : renderTerm(s.termId, s.text, `gt${n++}`))),
      );
    }
    if (Array.isArray(nd)) return nd.map(walk);
    if (React.isValidElement<AnyProps>(nd)) {
      if (skipElement(nd) || nd.props.children == null) return nd;
      const kids = nd.props.children;
      const next = Array.isArray(kids) ? kids.map(walk) : walk(kids);
      return Array.isArray(next)
        ? React.cloneElement(nd, undefined, ...next)
        : React.cloneElement(nd, undefined, next);
    }
    return nd;
  };
  return walk(node);
}

/** Links only the term ids selected for a text field. */
export function linkSelectedTermsInTree(
  node: React.ReactNode,
  index: TermIndex,
  selected: ReadonlySet<string>,
  renderTerm: (termId: string, text: string, key: string) => React.ReactNode,
): React.ReactNode {
  const seen = new Set([...index.byForm.values()].filter((id) => !selected.has(id)));
  return linkTermsInTree(node, index, seen, renderTerm);
}

/**
 * Tea terms in a story, tappable. One scope per story holds the open card; a
 * TermLink is the tappable word. The matching (which words, first mention
 * only) lives in src/lib/glossaryTerms.ts; this file is only what the reader
 * sees and touches.
 *
 * Two ways in:
 *  - a hand-built story wraps its <article> in <GlossaryTerms>, which links
 *    the first mention of each term anywhere in its prose;
 *  - the block renderer (renderBlock) wraps the page in <GlossaryScope> and
 *    asks `storyTermLinker()` to split each block's text in reading order.
 */
import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { GLOSSARY_TERMS, type GlossaryTerm } from '../../data/glossary';
import { buildTermIndex, linkTermsInTree, splitTerms, type TermIndex, type TermSegment } from '../../lib/glossaryTerms';
import FootnoteCard, { type FootnoteAnchor } from './FootnoteCard';

const TERMS_BY_ID = new Map(GLOSSARY_TERMS.map((t) => [t.id, t]));
let sharedIndex: TermIndex | null = null;
export function glossaryIndex(): TermIndex {
  if (!sharedIndex) sharedIndex = buildTermIndex(GLOSSARY_TERMS);
  return sharedIndex;
}

interface ScopeCtx {
  openId: string | null;
  open: (termId: string, trigger: HTMLElement) => void;
  close: () => void;
  fieldTermIds?: ReadonlyMap<string, ReadonlySet<string>>;
}
const Ctx = createContext<ScopeCtx | null>(null);

export const GlossaryScope: React.FC<{
  children: React.ReactNode;
  fieldTermIds?: ReadonlyMap<string, ReadonlySet<string>>;
}> = ({ children, fieldTermIds }) => {
  const [state, setState] = useState<{ term: GlossaryTerm; anchor: FootnoteAnchor } | null>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  const open = useCallback((termId: string, trigger: HTMLElement) => {
    const term = TERMS_BY_ID.get(termId);
    if (!term) return;
    // A word broken across two lines has two boxes; anchor to the first.
    const r = trigger.getClientRects()[0] ?? trigger.getBoundingClientRect();
    triggerRef.current = trigger;
    setState((s) => (s?.term.id === termId ? null : { term, anchor: { left: r.left, top: r.top, bottom: r.bottom, width: r.width } }));
  }, []);

  const close = useCallback(() => {
    setState(null);
    triggerRef.current?.focus({ preventScroll: true });
  }, []);

  const value = useMemo(() => ({ openId: state?.term.id ?? null, open, close, fieldTermIds }), [state, open, close, fieldTermIds]);

  return (
    <Ctx.Provider value={value}>
      {children}
      {state && (
        <FootnoteCard
          term={state.term.term}
          definition={state.term.definition}
          pronunciation={state.term.pronunciation}
          chineseCharacters={state.term.chineseCharacters}
          anchor={state.anchor}
          onDismiss={close}
        />
      )}
    </Ctx.Provider>
  );
};

export function useGlossaryFieldTermIds(field: string): ReadonlySet<string> | undefined {
  return useContext(Ctx)?.fieldTermIds?.get(field);
}

/** The tappable word. Outside a scope it renders as plain text. */
export const TermLink: React.FC<{ termId: string; children: React.ReactNode }> = ({ termId, children }) => {
  const ctx = useContext(Ctx);
  if (!ctx) return <>{children}</>;
  const expanded = ctx.openId === termId;
  return (
    <button
      type="button"
      data-term-link={termId}
      aria-haspopup="dialog"
      aria-expanded={expanded}
      onClick={(e) => ctx.open(termId, e.currentTarget)}
      className="tj-term"
    >
      {children}
    </button>
  );
};

const termStyle = `
  .tj-term{all:unset;display:inline;font:inherit;color:inherit;cursor:pointer;
    text-decoration:underline dotted;text-decoration-thickness:1px;text-underline-offset:0.22em;
    text-decoration-color:var(--tj-gold, rgb(var(--tea-gold-rgb)));-webkit-tap-highlight-color:transparent}
  .tj-term:hover,.tj-term[aria-expanded="true"]{text-decoration-style:solid}
  .tj-term:focus-visible{outline:1px solid var(--tj-gold, rgb(var(--tea-gold-rgb)));outline-offset:2px;border-radius:2px}
`;
/** Mount once per story page; the term's look lives here, not in each word. */
export const TermStyle: React.FC = () => <style>{termStyle}</style>;

/** Hand-built story: links the first mention of each term in its prose. */
export const GlossaryTerms: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const linked = linkTermsInTree(children, glossaryIndex(), new Set(), (termId, text, key) => (
    <TermLink key={key} termId={termId}>{text}</TermLink>
  ));
  return (
    <GlossaryScope>
      <TermStyle />
      {linked}
    </GlossaryScope>
  );
};

/**
 * Block renderer: one linker per render of a story, called on each block's
 * text in reading order, so a term links only where it first appears.
 */
export function storyTermLinker(): (text: string) => TermSegment[] {
  const seen = new Set<string>();
  const index = glossaryIndex();
  return (text) => splitTerms(text, index, seen);
}

/** Renders segments as plain text and TermLinks. */
export function renderSegments(segments: TermSegment[]): React.ReactNode {
  return segments.map((s, i) => (typeof s === 'string' ? s : <TermLink key={i} termId={s.termId}>{s.text}</TermLink>));
}

import React from 'react';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { buildTermIndex, linkSelectedTermsInTree, linkTermsInTree, splitTerms } from './glossaryTerms';
import { GLOSSARY_TERMS, type GlossaryTerm } from '../data/glossary';

const T = (id: string, term: string, extra: Partial<GlossaryTerm> = {}): GlossaryTerm =>
  ({ id, term, category: 'equipment', definition: `${term} def`, ...extra });

const index = buildTermIndex([
  T('gaiwan', 'Gaiwan'),
  T('puerh', 'Puerh', { aliases: ["pu'er", 'pu-erh'] }),
  T('sheng', 'Sheng Puerh'),
  T('ash-glaze', 'Ash Glaze'),
  T('rolling', 'Rolling', { autoLink: false }),
]);

const ids = (text: string, seen = new Set<string>()) =>
  splitTerms(text, index, seen).flatMap((s) => (typeof s === 'string' ? [] : [`${s.termId}:${s.text}`]));

describe('tea terms in a story', () => {
  it('links case-insensitively and keeps the words as written', () => {
    expect(ids('I poured from a GAIWAN.')).toEqual(['gaiwan:GAIWAN']);
  });

  it('links a whole word only, plurals allowed', () => {
    expect(ids('two gaiwans on the table')).toEqual(['gaiwan:gaiwans']);
    expect(ids('a gaiwanlike shape')).toEqual([]);
    expect(ids('the megaiwan')).toEqual([]);
  });

  it('matches aliases, curly apostrophes and a space for a hyphen', () => {
    expect(ids('aged pu’er')).toEqual(["puerh:pu’er"]);
    expect(ids('aged pu erh')).toEqual(['puerh:pu erh']);
    expect(ids('an ash-glaze bowl')).toEqual(['ash-glaze:ash-glaze']);
  });

  it('prefers the longest term where two overlap', () => {
    expect(ids('young Sheng Puerh')).toEqual(['sheng:Sheng Puerh']);
  });

  it('links only the first mention across a whole story', () => {
    const seen = new Set<string>();
    expect(ids('A gaiwan. Another gaiwan.', seen)).toEqual(['gaiwan:gaiwan']);
    expect(ids('Still a gaiwan in the next paragraph.', seen)).toEqual([]);
  });

  it('never links a term marked autoLink false', () => {
    expect(ids('rolling hills')).toEqual([]);
  });

  it('keeps every character of the text', () => {
    const text = 'Gaiwan, pu-erh and a gaiwan again.';
    const joined = splitTerms(text, index, new Set()).map((s) => (typeof s === 'string' ? s : s.text)).join('');
    expect(joined).toBe(text);
  });
});

describe('a hand-built story tree', () => {
  const link = (node: React.ReactNode) =>
    renderToStaticMarkup(
      React.createElement(React.Fragment, null,
        linkTermsInTree(node, index, new Set(), (id, text, key) => React.createElement('mark', { key, 'data-id': id }, text))),
    );

  it('links prose and skips headings, links and opted-out passages', () => {
    const html = link(
      React.createElement('div', null,
        React.createElement('h2', null, 'Gaiwan'),
        React.createElement('a', { href: '/x' }, 'gaiwan'),
        React.createElement('p', { 'data-no-terms': true }, 'gaiwan'),
        React.createElement('p', null, 'Pour from the ', React.createElement('em', null, 'gaiwan'), ' and a gaiwan'),
      ),
    );
    expect(html.match(/<mark/g)?.length).toBe(1);
    expect(html).toContain('<em><mark data-id="gaiwan">gaiwan</mark></em> and a gaiwan');
  });

  it('leaves a component that declares its children are not prose', () => {
    const Field = ({ children }: { children: string }) => React.createElement('span', null, children);
    (Field as unknown as { noGlossaryTerms: boolean }).noGlossaryTerms = true;
    expect(link(React.createElement(Field, null, 'gaiwan'))).not.toContain('<mark');
  });

  it('links only a selected first-mention field and links it once', () => {
    const html = renderToStaticMarkup(
      React.createElement('p', null,
        linkSelectedTermsInTree(
          'A gaiwan beside a puerh cake and another gaiwan.',
          index,
          new Set(['gaiwan']),
          (id, text, key) => React.createElement('mark', { key, 'data-id': id }, text),
        ),
      ),
    );
    expect(html).toContain('<mark data-id="gaiwan">gaiwan</mark>');
    expect(html).toContain('beside a puerh cake and another gaiwan.');
    expect(html).not.toContain('data-id="puerh"');
    expect(html.match(/data-id="gaiwan"/g)).toHaveLength(1);
  });
});

describe('the glossary itself', () => {
  it('gives every term a unique id and no spelling to two terms', () => {
    const seenIds = new Set<string>();
    const forms = new Map<string, string>();
    for (const t of GLOSSARY_TERMS) {
      expect(seenIds.has(t.id), t.id).toBe(false);
      seenIds.add(t.id);
      for (const f of [t.term, ...(t.aliases ?? [])]) {
        const k = f.toLowerCase().replace(/[\s-]+/g, ' ');
        expect(forms.get(k) ?? t.id, `${f} is claimed by ${forms.get(k)} and ${t.id}`).toBe(t.id);
        forms.set(k, t.id);
      }
    }
  });

  it('carries the queued magazine terms with their Chinese', () => {
    const byId = new Map(GLOSSARY_TERMS.map((t) => [t.id, t]));
    expect(byId.get('ash-glaze')?.chineseCharacters).toBe('灰釉');
    expect(byId.get('vitrification')?.chineseCharacters).toBe('玻化');
    expect(byId.get('ice-crackle')?.chineseCharacters).toBe('冰裂纹');
    expect(byId.get('rootless-water')?.chineseCharacters).toBe('无根水');
    expect(byId.get('an-cha')?.chineseCharacters).toBe('安茶');
  });

  it('links a real story sentence against the real glossary', () => {
    const real = buildTermIndex(GLOSSARY_TERMS);
    const got = splitTerms('The surface has been vitrified, like a gaiwan fired with an ash glaze.', real, new Set())
      .flatMap((s) => (typeof s === 'string' ? [] : [s.termId]));
    expect(got).toEqual(['vitrification', 'gaiwan', 'ash-glaze']);
  });
});

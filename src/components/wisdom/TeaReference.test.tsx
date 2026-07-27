import React from 'react';
import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import {
  TeaReference,
  namedTeaLine,
  recordFacts,
  resolveRecord,
  type TeaReferenceProduct,
} from './TeaReference';
import { findNamedTeaById } from '../../wisdom';

const product = (overrides: Partial<TeaReferenceProduct> = {}): TeaReferenceProduct => ({
  name: '',
  ...overrides,
});

const render = (input: TeaReferenceProduct) =>
  renderToString(
    <MemoryRouter>
      <TeaReference product={input} />
    </MemoryRouter>,
  );

describe('what the base can say about a product', () => {
  it('reads the maker out of the product name', () => {
    const facts = recordFacts(resolveRecord(product({ name: '2005 Menghai 7572 Ripe Cake' })));
    const maker = facts.find(fact => fact.label === 'Made by');
    expect(maker?.value).toBe('Menghai Tea Factory');
    expect(maker?.to).toBe('/wisdom/producer/menghai-tea-factory');
  });

  it('reads the mark, which is a different fact from the maker', () => {
    const facts = recordFacts(resolveRecord(product({ name: '2005 Menghai 7572 Ripe Cake' })));
    expect(facts.find(fact => fact.label === 'Mark')?.to).toBe('/wisdom/mark/7572');
  });

  it('reads the style when the name states one', () => {
    const facts = recordFacts(resolveRecord(product({ name: 'Xiao Qing Gan mandarin puerh' })));
    expect(facts.find(fact => fact.label === 'Style')?.to).toBe('/wisdom/style/xiao-qing-gan');
  });

  it('says nothing at all about a tea it does not recognise', () => {
    expect(recordFacts(resolveRecord(product({ name: 'Unlabelled bag from the market' })))).toEqual([]);
  });

  it('links every fact it states, because each one has a public page', () => {
    const facts = recordFacts(resolveRecord(product({ name: '2005 Menghai 7572 Ripe Cake' })));
    expect(facts.length).toBeGreaterThan(0);
    expect(facts.every(fact => Boolean(fact.to))).toBe(true);
  });
});

describe('a tea that arrived already named', () => {
  it('is recognised by its whole given name and carries its own page', () => {
    const facts = recordFacts(resolveRecord(product({ name: 'Courage' })));
    expect(facts.find(fact => fact.label === 'Given name')?.to).toBe('/wisdom/named/courage');
  });

  it('says the composition was never disclosed rather than leaving a blank to read as a gap', () => {
    const tea = findNamedTeaById('courage');
    expect(tea).not.toBeNull();
    const line = namedTeaLine({ ...tea!, provenance: 'undisclosed' });
    expect(line).toContain('arrived already named');
    expect(line).toContain('never disclosed');
    expect(line).toContain('the name is the identity');
    // The name is already the linked value directly above the sentence, so it
    // is not said a second time inside it.
    expect(line).not.toContain(tea!.name);
  });

  it('does not claim an origin was withheld when the record states one', () => {
    const tea = findNamedTeaById('courage');
    const line = namedTeaLine({ ...tea!, provenance: 'stated' });
    expect(line).not.toContain('never disclosed');
    expect(line).toContain('recorded in full');
  });

  it('never uses an em dash, in any of its three forms', () => {
    const tea = findNamedTeaById('courage')!;
    for (const provenance of ['undisclosed', 'partial', 'stated'] as const) {
      expect(namedTeaLine({ ...tea, provenance })).not.toContain('—');
    }
  });
});

describe('the reference band on a product page', () => {
  it('renders one hairline for the whole band, not one per part', () => {
    const html = render(product({ name: '2019 Rou Gui Yancha', origin: 'Wuyi Mountains' }));
    expect((html.match(/border-t border-tea-border/g) ?? []).length).toBe(1);
  });

  it('shows the maker even when the plant cannot be resolved', () => {
    const html = render(product({ name: '2005 Menghai 7572 Ripe Cake' }));
    expect(html).toContain('Menghai Tea Factory');
    expect(html).toContain('href="/wisdom/producer/menghai-tea-factory"');
  });

  it('renders nothing at all when the base recognises none of it', () => {
    expect(render(product({ name: 'Unlabelled bag from the market' }))).toBe('');
  });

  it('never nests a link inside a control', () => {
    const html = render(product({ name: '2005 Menghai 7572 Ripe Cake' }));
    expect(/<button[^>]*>[\s\S]*?<a\s/.test(html)).toBe(false);
  });
});

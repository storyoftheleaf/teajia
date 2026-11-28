import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { SessionTeaRow } from './SessionTeaRow';

const row = (tea: Parameters<typeof SessionTeaRow>[0]['tea']) =>
  renderToStaticMarkup(<MemoryRouter><SessionTeaRow tea={tea} /></MemoryRouter>);

describe('a tea the shop has not released, on a guest page', () => {
  it('shows by name, opens its Wisdom page and offers someone to ask', () => {
    const html = row({ kind: 'name', id: 'm1', name: 'Courage', wisdom: '/wisdom/named/courage', ask: '6281234567890' });
    expect(html).toContain('href="/wisdom/named/courage"');
    expect(html).toContain('href="https://wa.me/6281234567890?text=Hello%2C%20I%20would%20like%20to%20ask%20about%20Courage."');
    expect(html).toContain('Ask about this tea');
  });

  it('stays a plain name when there is nothing more to offer', () => {
    expect(row({ kind: 'name', id: 'm2', name: 'A typed tea' })).not.toContain('<a ');
  });
});

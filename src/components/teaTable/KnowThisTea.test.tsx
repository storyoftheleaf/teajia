import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const auth = { isAuthenticated: false };
vi.mock('../../hooks/useAuth', () => ({ useAuth: () => auth }));

import { AskAboutATea, AskForm, QuestionPiece } from './KnowThisTea';
import { KNOW_THIS_TEA_OPEN, knowThisTeaOpen } from '../../lib/knowThisTea';
import { questionPath, type TeaTableQuestion } from '../../lib/knowThisTeaContract';

// "Does anyone know this tea?" (Launch 5, M8): the piece on the table, the
// way in, and the switch. Nothing on the piece counts or ranks, and it is
// never called a feed or a reply.

const QUESTION: TeaTableQuestion = {
  kind: 'question', id: 'q-1', at: '2026-11-25 09:00:00',
  person: { name: 'Lin', path: null },
  where_from: 'A market stall in Fuzhou, wrapped in plain paper.',
  photograph: {
    id: 'q-1', small_url: 'https://media.teajia.co/family-photos/tea-table-questions/q-1-small.jpg',
    full_url: 'https://media.teajia.co/family-photos/tea-table-questions/q-1-full.jpg',
    small_width: 480, small_height: 360, shape: 'across', frame: null,
  },
  named: null,
};

function render(node: React.ReactNode) {
  const client = new QueryClient();
  return renderToStaticMarkup(<QueryClientProvider client={client}><MemoryRouter initialEntries={['/tea-table']}>{node}</MemoryRouter></QueryClientProvider>);
}
const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

describe('the switch', () => {
  it('ships open since Adrian turned it on, and an explicit setting wins either way', () => {
    expect(KNOW_THIS_TEA_OPEN).toBe(true);
    expect(knowThisTeaOpen({ KNOW_THIS_TEA_OPEN: 'true' })).toBe(true);
    expect(knowThisTeaOpen({ KNOW_THIS_TEA_OPEN: 'false' })).toBe(false);
  });
  it('gives each question its own step on the Tea Table', () => {
    expect(questionPath('q 1')).toBe('/tea-table?question=q%201');
  });
});

describe('a question on the table', () => {
  it('shows the heading, who asked, where it came from and its photograph, with nothing counted', () => {
    const html = render(<QuestionPiece item={QUESTION} mine={false} onOpen={() => {}} />);
    const words = text(html);
    expect(words).toContain('Does anyone know this tea?');
    expect(words).toContain('Asked by Lin');
    expect(words).toContain('A market stall in Fuzhou');
    expect(words).toContain('I know this tea');
    expect(words).not.toMatch(/\d/);
    expect(words).not.toMatch(/\b(likes?|comments?|repl(y|ies)|answers?|follow|views?|feed|trending|popular)\b/i);
    expect(html).toContain('data-testid="know-this-tea-photograph"');
    expect(html).not.toContain('know-this-tea-take-off');
  });

  it('links the asker when they have a page', () => {
    const html = render(<QuestionPiece item={{ ...QUESTION, person: { name: 'Lin Wei', path: '/people/lin' } }} mine={false} />);
    expect(html).toMatch(/href="\/people\/lin"[^>]*>Lin Wei</);
  });

  it('offers its asker what people told them and the way off the table', () => {
    const words = text(render(<QuestionPiece item={QUESTION} mine onOpen={() => {}} />));
    expect(words).toContain('What people told you');
    expect(words).toContain('Take off the table');
    expect(words).not.toContain('I know this tea');
  });

  it('once named, shows the tea with its shop link and who named it, and offers no more telling', () => {
    const named = { ...QUESTION, named: { name: 'Old Bush Shuixian', path: '/shop/product/old-bush-shuixian?store=teajia-bali', by: 'Mei' } };
    const html = render(<QuestionPiece item={named} mine={false} onOpen={() => {}} />);
    expect(text(html)).toContain('Named: Old Bush Shuixian · Named by Mei');
    expect(html).toContain('href="/shop/product/old-bush-shuixian?store=teajia-bali"');
    expect(text(html)).not.toContain('I know this tea');
    const typed = text(render(<QuestionPiece item={{ ...QUESTION, named: { name: 'Wuyi Shuixian', path: null, by: null } }} mine={false} />));
    expect(typed).toContain('Named: Wuyi Shuixian');
    expect(typed).not.toContain('Named by');
  });
});

describe('asking', () => {
  it('leads a signed-out visitor to sign in and back to the asking step', () => {
    auth.isAuthenticated = false;
    const html = render(<AskAboutATea onAsk={() => {}} />);
    expect(html).toContain('href="/signin?returnTo=%2Ftea-table%3Fask%3D1"');
    expect(text(render(<AskForm onCancel={() => {}} onAsked={() => {}} />))).toContain('Sign in to ask about a tea.');
  });

  it('asks a signed-in person for a photograph and where they got it, through the shared button', () => {
    auth.isAuthenticated = true;
    const html = render(<AskForm onCancel={() => {}} onAsked={() => {}} />);
    const words = text(html);
    expect(words).toContain('Does anyone know this tea?');
    expect(words).toContain('Only you will read what they write.');
    expect(words).toContain('Add photo');
    expect(words).toContain('Where you got it');
    expect(words).toContain('Put it on the table');
    expect(html).toMatch(/<input[^>]*type="file"[^>]*hidden/);
    auth.isAuthenticated = false;
  });
});

/**
 * Every conversation piece carries the one byline: A conversation / With them /
 * By Adrian / Length (Adrian, 2026-10-01: "It's a conversation with him by me").
 * The pieces are rendered for real, so a page that drops the shared byline or
 * brings back "Interview by" / "Told by" fails here, not on the live site.
 */
import { describe, expect, it } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { ConversationByline, lengthLine } from './Byline';
import RockRemembers from '../RockRemembers';
import EarthWaterFire from '../EarthWaterFire';
import TeaHouseQuietHours from '../TeaHouseQuietHours';
import ConversationArticle from './ConversationArticle';
import { porcelainAndTea } from './pieces/porcelainAndTea';

const render = (node: React.ReactNode) =>
  renderToStaticMarkup(
    <HelmetProvider>
      <MemoryRouter>{node}</MemoryRouter>
    </HelmetProvider>,
  );

/** The ledger's visible words, in reading order. */
const ledger = (html: string) => {
  const start = html.indexOf('tj-conv-byline"');
  expect(start, 'the shared byline is on the page').toBeGreaterThan(-1);
  const end = html.indexOf('</dl>', start);
  return html.slice(start, end).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
};

describe('the conversation byline', () => {
  it('names one person, then Adrian, then the length', () => {
    const text = ledger(render(<ConversationByline people={[{ name: 'Yan Jinwen', nameCn: '严金文' }]} minutes={6} photos={25} />));
    expect(text).toMatch(/A conversation With Yan Jinwen 严金文 By Adrian Rasmussen Length 6 minutes, 25 photographs/);
  });

  it('joins two people with "and"', () => {
    const text = ledger(render(<ConversationByline people={[{ name: 'Mei' }, { name: 'Tom Hale' }]} minutes={3} />));
    expect(text).toMatch(/With Mei and Tom Hale By/);
  });

  it('says only the minutes when a piece has no photographs yet', () => {
    expect(lengthLine(3)).toBe('3 minutes');
    expect(lengthLine(1, 1)).toBe('1 minute, 1 photograph');
  });

  const pieces: [string, React.ReactNode, RegExp][] = [
    ['Porcelain and Tea', <ConversationArticle spec={porcelainAndTea} />, /With Yan Jinwen 严金文 By Adrian Rasmussen/],
    ['The Rock Remembers', <RockRemembers />, /With Chén Wǔ 陈武 By Adrian Rasmussen/],
    ['Earth, Water, Fire', <EarthWaterFire />, /With Lín Yùzhēn 林玉珍 By Adrian Rasmussen/],
    ['Quiet Hours', <TeaHouseQuietHours />, /With Mei 梅 and Tom Hale By Adrian Rasmussen/],
  ];
  it.each(pieces)('%s carries it, and no other credit line', (_title, node, names) => {
    const html = render(node);
    expect(ledger(html)).toMatch(names);
    expect(html).not.toMatch(/Interview by|Told by|in (his|her|their) own words/i);
  });
});

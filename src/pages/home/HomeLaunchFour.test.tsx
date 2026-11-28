import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, expect, it, vi } from 'vitest';

const flags = vi.hoisted(() => ({ table: false, houses: false }));
vi.mock('../../lib/teaTable', () => ({ teaTableOpen: () => flags.table }));
vi.mock('../../lib/teaHouses', () => ({ teaHousesOpen: () => flags.houses }));

import { FromTheTeaTable, HomeFourDoors, TeaHousesStrip, consultPlatePath, homeDoorsLaunchFour } from './HomeLaunchFour';
import { housesDoor, tableDoor } from '../../components/navSections';

const recap = (id: string) => ({ kind: 'recap' as const, id, at: '2026-11-20', slug: `s-${id}`, title: `Session ${id}`, session_date: '2026-11-19', host: 'Mei', writing: '', teas: [], tea_type: null });

function render(node: React.ReactNode, seed: (client: QueryClient) => void = () => {}) {
  const client = new QueryClient();
  seed(client);
  return renderToStaticMarkup(<QueryClientProvider client={client}><MemoryRouter>{node}</MemoryRouter></QueryClientProvider>);
}

beforeEach(() => { flags.table = false; flags.houses = false; });

it('shows nothing from the Tea Table while it is shut, or empty', () => {
  expect(render(<FromTheTeaTable edge="" />)).toBe('');
  flags.table = true;
  expect(render(<FromTheTeaTable edge="" />, c => c.setQueryData(['tea-table', 'home'], { held: [], items: [], earlier: null }))).toBe('');
});

it('shows the latest three pieces, held first, with no counts', () => {
  flags.table = true;
  const html = render(<FromTheTeaTable edge="" />, c => c.setQueryData(['tea-table', 'home'], { held: [recap('h')], items: [recap('a'), recap('b'), recap('c')], earlier: null }));
  expect(html).toContain('What happened at the tables');
  expect([...html.matchAll(/Session (\w)/g)].map(m => m[1])).toEqual(['h', 'a', 'b']);
  expect(html).toContain('Hosted by Mei');
  expect(html).toContain('href="/tea-table"');
});

it('shows the houses only while the portfolio is open and has some', () => {
  expect(render(<TeaHousesStrip edge="" />)).toBe('');
  flags.houses = true;
  const html = render(<TeaHousesStrip edge="" />, c => c.setQueryData(['tea-houses', 'work'], { houses: [{ slug: 'moon', name: 'Moon House', place: 'Taipei, Taiwan', photograph: null }] }));
  expect(html).toContain('Moon House');
  expect(html).toContain('href="/tea-houses/work/moon"');
});

it('the four doors lead where the bar words lead, and the consult plate leads to Tea Houses once open', () => {
  expect(homeDoorsLaunchFour().map(door => door.to)).toEqual(['/read', '/shop', tableDoor(), housesDoor()]);
  expect(homeDoorsLaunchFour().map(door => door.to)).toEqual(['/read', '/shop', '/events', '/advise']);
  expect(consultPlatePath()).toBe('/advise');
  flags.table = true;
  flags.houses = true;
  expect(homeDoorsLaunchFour().map(door => door.to)).toEqual(['/read', '/shop', '/tea-table', '/tea-houses']);
  expect(consultPlatePath()).toBe('/tea-houses');
});

it('the four doors carry their words, in the order the line under the headline names them, with no em dash', () => {
  const html = render(<HomeFourDoors />);
  const doors = homeDoorsLaunchFour();
  expect(doors.map(door => door.accent)).toEqual(['Discover', 'Source', 'Deepen', 'Create']);
  expect(doors.map(door => door.words)).toEqual([
    'teachings, conversations and tea wisdom',
    'fine tea and teaware, old and new, found by hand',
    'journal your tastings, sit at a table, share what you found',
    'your tea space, designed with us or inspired to make your own',
  ]);
  for (const door of doors) expect(html).toContain(door.words);
  expect(html).toContain('aria-label="Homepage destinations"');
  expect(html).not.toMatch(new RegExp(String.fromCharCode(0x2014)));
});

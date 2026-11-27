import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { hostingRowActions } from '../admin/hostingRowActions';
import { tableLinks } from '../components/host/hostTableParts';
import { thanksGuests } from '../components/host/HostTableAfter';
import { addOpensOrder, forgetOrderVia, rememberOrderVia } from './orderVia';
import { usableSeat } from './mySeat';

const table = { id: 'ev1', slug: 'jun-table', public_visibility: 'public', lifecycle_status: 'completed' };
const guest = (id: string, status: any, attended: number | null) => ({ id, status, attended, full_name: id }) as any;

describe('U1-1: her own seat after signing in', () => {
  it('a seat with a page token and a live status is hers; cancelled, denied or tokenless is not', () => {
    expect(usableSeat({ magicToken: 't1', status: 'requested' })).toMatchObject({ magic_token: 't1' });
    expect(usableSeat({ magic_token: 't2', status: 'confirmed' })).toMatchObject({ magic_token: 't2' });
    expect(usableSeat({ magic_token: 't', status: 'cancelled' })).toBeNull();
    expect(usableSeat({ magic_token: 't', status: 'denied' })).toBeNull();
    expect(usableSeat({ magic_token: null, status: null })).toBeNull();
    expect(usableSeat(undefined)).toBeNull();
  });
});

describe('U1-2 and U1-14: a table page leads on', () => {
  it('the owner gets the recap, the Tea Table and the card, one tap each', () => {
    const links = tableLinks(table, { isAdmin: true, teaTable: true, card: true });
    expect(links.map(link => link.key)).toEqual(['recap', 'tea-table', 'card']);
    expect(links[0].to).toBe('/admin/events/ev1?tab=post-session');
    expect(links[0].label).toMatch(/Tea Table/);
    expect(links[2].to).toBe('/admin/events/jun-table/card');
  });
  it('closed parts offer nothing, and a host who is not the owner gets no Manage address', () => {
    expect(tableLinks(table, { isAdmin: true, teaTable: false, card: false }).map(link => link.key)).toEqual(['recap']);
    expect(tableLinks(table, { isAdmin: false, teaTable: true, card: true }).map(link => link.key)).toEqual(['tea-table']);
    expect(tableLinks(table, { isAdmin: false, teaTable: false, card: true })).toEqual([]);
  });
  it('no card for a private or cancelled table', () => {
    expect(tableLinks({ ...table, public_visibility: 'private' }, { isAdmin: true, teaTable: false, card: true }).map(l => l.key)).toEqual(['recap']);
    expect(tableLinks({ ...table, lifecycle_status: 'cancelled' }, { isAdmin: true, teaTable: false, card: true }).map(l => l.key)).toEqual(['recap']);
  });
});

describe('U1-5 and U1-6: hosting on the person row', () => {
  const on = { stoppingOpen: true };
  it('a person not yet hosting by link has Let host and Stop all hosting on the row', () => {
    expect(hostingRowActions({ may_host: false }, on)).toEqual(['let-host', 'stop-all']);
  });
  it('a host by link has Stop all hosting; a stopped one has Let host again', () => {
    expect(hostingRowActions({ may_host: true }, on)).toEqual(['stop-all']);
    expect(hostingRowActions({ may_host: true, hosting_stopped_at: '2026-11-01' }, on)).toEqual(['let-again']);
  });
  it('before the stopping part is open only Let host is offered', () => {
    expect(hostingRowActions({ may_host: false }, { stoppingOpen: false })).toEqual(['let-host']);
    expect(hostingRowActions({ may_host: true }, { stoppingOpen: false })).toEqual([]);
  });
});

describe('U1-7: the thank-you link beside every guest', () => {
  it('shows for each confirmed guest not marked absent, before and after Mark who came', () => {
    const list = [guest('a', 'confirmed', null), guest('b', 'confirmed', 1), guest('c', 'confirmed', 0), guest('d', 'waitlist', null)];
    expect(thanksGuests(list).map(each => each.id)).toEqual(['a', 'b']);
  });
});

describe('U1-8: buying from the thank-you opens the order at once', () => {
  it('only while a thank-you reference is held and unspent', () => {
    const ref = 'a1b2c3d4e5f6a1b2c3';
    let held: string | null = null;
    const store = { getItem: () => held, setItem: (_: string, v: string) => { held = v; }, removeItem: () => { held = null; } };
    (globalThis as any).localStorage = store;
    try {
      expect(addOpensOrder()).toBe(false);
      rememberOrderVia(ref);
      expect(addOpensOrder()).toBe(true);
      forgetOrderVia();
      expect(addOpensOrder()).toBe(false);
    } finally { delete (globalThis as any).localStorage; }
  });
});

describe('the ways on render as links', () => {
  it('lists the links as plain anchors', async () => {
    const { HostTableLinks } = await import('../components/host/HostTableLinks');
    const html = renderToStaticMarkup(<MemoryRouter><HostTableLinks tableId="ev1" detail={{ table } as any} /></MemoryRouter>);
    expect(html).not.toContain('Print a card');
  });
});

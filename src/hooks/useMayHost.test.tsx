import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { expect, it, vi } from 'vitest';
import type { HostingStatus } from '../lib/hostingApi';
import { useMayHost } from './useMayHost';

const state = vi.hoisted(() => ({ few: true, anyone: true, signedIn: true, userId: 'bo' }));
vi.mock('../lib/fewHosts', () => ({ fewHostsOpen: () => state.few }));
vi.mock('../lib/anyoneHosts', () => ({ anyoneHostsOpen: () => state.anyone }));
vi.mock('../lib/api', () => ({
  api: { hosting: { get: vi.fn() } },
  currentSignInToken: () => state.signedIn ? 'session' : null,
}));
vi.mock('../lib/store', () => ({
  useAppStore: (select: (value: { activeUserId: string }) => unknown) => select({ activeUserId: state.userId }),
}));

const eligible: HostingStatus = { approved: false, account_id: null, doors: ['request'] };

function renderAccess(settings: Partial<typeof state> = {}, hosting = eligible, cachedUser = 'bo') {
  Object.assign(state, { few: true, anyone: true, signedIn: true, userId: 'bo' }, settings);
  const client = new QueryClient();
  client.setQueryData(['me-hosting', cachedUser], hosting);
  let access: ReturnType<typeof useMayHost> | undefined;
  function Probe() {
    access = useMayHost();
    return null;
  }
  renderToStaticMarkup(<QueryClientProvider client={client}><Probe /></QueryClientProvider>);
  return access;
}

it.each([{ few: false }, { anyone: false }])('hides both options with flags %j', flags => {
  expect(renderAccess(flags)).toEqual({ mayHost: false, showSignIn: false });
  expect(renderAccess({ ...flags, signedIn: false })).toEqual({ mayHost: false, showSignIn: false });
});

it('offers hosting when the server returns a door', () => {
  expect(renderAccess()).toEqual({ mayHost: true, showSignIn: false });
});

it('hides the door for a stopped host', () => {
  expect(renderAccess({}, { ...eligible, stopped: true, doors: null })).toEqual({ mayHost: false, showSignIn: false });
});

it('offers sign-in when signed out, even with a previous hosting decision cached', () => {
  expect(renderAccess({ signedIn: false })).toEqual({ mayHost: false, showSignIn: true });
});

it('waits for the current person’s decision after a sign-in change', () => {
  expect(renderAccess({ userId: 'another-user' })).toEqual({ mayHost: false, showSignIn: false });
});

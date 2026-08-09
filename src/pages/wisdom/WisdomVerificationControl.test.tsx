import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { useAppStore } from '../../lib/store';
import { fingerprintWisdomEntry } from '../../wisdom/verificationFingerprint';
import {
  WisdomVerificationControl,
  loadWisdomVerification,
  saveWisdomVerification,
  noticeMatchesWisdomVerification,
  undoWisdomVerification,
  wisdomVerificationQueryKey,
  type WisdomVerificationInput,
  type WisdomVerificationQueryData,
} from './WisdomVerificationControl';

const input: WisdomVerificationInput = {
  entryKind: 'cultivar',
  entryId: 'rou-gui',
  entry: { id: 'rou-gui', name: 'Rou Gui', description: 'Mineral and aromatic.' },
  citations: [{
    id: 'citation-1', entryKind: 'cultivar', entryId: 'rou-gui', fields: ['description'],
    sourceIds: ['source-1'], usage: 'usable',
  }],
  potentialProfile: {
    entryKind: 'cultivar', entryId: 'rou-gui', tasting: { flavor: ['mineral'] }, citationIds: ['citation-1'],
  },
};

function setAccess(platformRole: 'platform_owner' | 'platform_admin' | null, activeAccountId: string | null) {
  useAppStore.setState({ platformRole, activeAccountId });
  Object.assign(useAppStore.getInitialState(), { platformRole, activeAccountId });
}

afterEach(() => {
  setAccess(null, null);
});

function renderControl(role: 'platform_owner' | 'platform_admin' | null, data?: WisdomVerificationQueryData) {
  setAccess(role, 'account-a');
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  if (data) client.setQueryData(wisdomVerificationQueryKey('account-a', input), data);
  return renderToStaticMarkup(
    <QueryClientProvider client={client}>
      <WisdomVerificationControl {...input} />
    </QueryClientProvider>,
  );
}

describe('WisdomVerificationControl role boundary', () => {
  it.each([
    ['public reader', null],
    ['platform admin', 'platform_admin'],
  ] as const)('renders nothing and cannot start an API query for a %s', (_label, role) => {
    setAccess(role, 'account-a');
    expect(renderToStaticMarkup(<WisdomVerificationControl {...input} />)).toBe('');
  });

  it('shows an icon-only 44px tap target only to the platform owner', () => {
    const html = renderControl('platform_owner');
    expect(html).toContain('aria-label="Verify this reference"');
    expect(html).toContain('tap-target');
    expect(html).toContain('h-11');
    expect(html).toContain('w-11');
    expect(html).not.toContain('platform_owner');
  });
});

describe('WisdomVerificationControl receipt states', () => {
  it('distinguishes no receipt, matching receipt, and changed receipt', async () => {
    const currentHash = await fingerprintWisdomEntry({
      entry: input.entry, citations: input.citations, potentialProfile: input.potentialProfile,
    });
    expect(renderControl('platform_owner', { currentHash, receipt: null })).toContain('aria-label="Verify this reference"');
    expect(renderControl('platform_owner', {
      currentHash,
      receipt: { entry_kind: 'cultivar', entry_id: 'rou-gui', content_hash: currentHash, verified_at: '2026-08-09T00:00:00Z' },
    })).toContain('aria-label="Reference verified"');
    expect(renderControl('platform_owner', {
      currentHash,
      receipt: { entry_kind: 'cultivar', entry_id: 'rou-gui', content_hash: '0'.repeat(64), verified_at: '2026-08-09T00:00:00Z' },
    })).toContain('aria-label="Reference changed since verification"');
  });

  it('fingerprints the complete entry, citations, and potential profile before GET and PUT', async () => {
    const client = {
      get: vi.fn().mockResolvedValue(null),
      put: vi.fn().mockResolvedValue({ entry_kind: 'cultivar', entry_id: 'rou-gui', content_hash: '', verified_at: 'now' }),
      delete: vi.fn(),
    };
    setAccess('platform_owner', 'account-a');
    const loaded = await loadWisdomVerification('account-a', input, client);
    await saveWisdomVerification('account-a', input, client);
    expect(client.get).toHaveBeenCalledWith('account-a', 'cultivar', 'rou-gui');
    expect(client.put).toHaveBeenCalledWith('account-a', 'cultivar', 'rou-gui', loaded.currentHash);

    const changedCitation = await loadWisdomVerification('account-a', {
      ...input,
      citations: [...input.citations, { ...input.citations[0], id: 'citation-2' }],
    }, client);
    const changedProfile = await loadWisdomVerification('account-a', {
      ...input,
      potentialProfile: { ...input.potentialProfile!, tasting: { flavor: ['orchid'] } },
    }, client);
    expect(changedCitation.currentHash).not.toBe(loaded.currentHash);
    expect(changedProfile.currentHash).not.toBe(loaded.currentHash);
  });

  it('reverses a successful PUT through DELETE', async () => {
    const client = {
      get: vi.fn(),
      put: vi.fn().mockResolvedValue({ entry_kind: 'cultivar', entry_id: 'rou-gui', content_hash: 'a'.repeat(64), verified_at: 'now' }),
      delete: vi.fn().mockResolvedValue(null),
    };
    setAccess('platform_owner', 'account-a');
    await saveWisdomVerification('account-a', input, client);
    await undoWisdomVerification('account-a', input, client);
    expect(client.put).toHaveBeenCalledOnce();
    expect(client.delete).toHaveBeenCalledWith('account-a', 'cultivar', 'rou-gui');
  });

  it('drops the notice when navigation or current content changes without retargeting Undo', async () => {
    const noticeForA = {
      accountId: 'account-a',
      entryKind: 'cultivar' as const,
      entryId: 'rou-gui',
      contentHash: 'a'.repeat(64),
    };
    const entryB = { ...input, entryId: 'jin-xuan', entry: { id: 'jin-xuan', name: 'Jin Xuan' } };
    const client = {
      get: vi.fn(),
      put: vi.fn(),
      delete: vi.fn().mockResolvedValue(null),
    };

    expect(noticeMatchesWisdomVerification(noticeForA, 'account-a', input, 'a'.repeat(64))).toBe(true);
    expect(noticeMatchesWisdomVerification(noticeForA, 'account-a', entryB, 'b'.repeat(64))).toBe(false);
    expect(noticeMatchesWisdomVerification(noticeForA, 'account-b', input, 'a'.repeat(64))).toBe(false);
    expect(noticeMatchesWisdomVerification(noticeForA, 'account-a', input, 'b'.repeat(64))).toBe(false);

    setAccess('platform_owner', 'account-a');
    await undoWisdomVerification('account-a', noticeForA, client);
    expect(client.delete).toHaveBeenCalledWith('account-a', 'cultivar', 'rou-gui');
    expect(client.delete).not.toHaveBeenCalledWith('account-a', 'cultivar', 'jin-xuan');
  });

  it('keeps captured account scope through request races and rejects stale starts', async () => {
    const entryB = { ...input, entryId: 'jin-xuan', entry: { id: 'jin-xuan', name: 'Jin Xuan' } };
    const client = {
      get: vi.fn(async () => {
        setAccess('platform_owner', 'account-b');
        return null;
      }),
      put: vi.fn(async (
        _accountId: string,
        entryKind: WisdomVerificationInput['entryKind'],
        entryId: string,
        contentHash: string,
      ) => {
        setAccess('platform_owner', 'account-b');
        return { entry_kind: entryKind, entry_id: entryId, content_hash: contentHash, verified_at: 'now' };
      }),
      delete: vi.fn(async () => {
        setAccess('platform_owner', 'account-b');
        return null;
      }),
    };

    setAccess('platform_owner', 'account-a');
    const loadedA = await loadWisdomVerification('account-a', input, client);
    expect(client.get).toHaveBeenLastCalledWith('account-a', 'cultivar', 'rou-gui');

    setAccess('platform_owner', 'account-a');
    const savedA = await saveWisdomVerification('account-a', input, client);
    expect(client.put).toHaveBeenLastCalledWith('account-a', 'cultivar', 'rou-gui', loadedA.currentHash);
    expect(noticeMatchesWisdomVerification({
      accountId: 'account-a', entryKind: 'cultivar', entryId: 'rou-gui', contentHash: savedA.currentHash,
    }, 'account-a', input, savedA.currentHash)).toBe(true);

    setAccess('platform_owner', 'account-a');
    await undoWisdomVerification('account-a', input, client);
    expect(client.delete).toHaveBeenLastCalledWith('account-a', 'cultivar', 'rou-gui');

    setAccess('platform_owner', 'account-b');
    await loadWisdomVerification('account-b', entryB, client);
    expect(client.get).toHaveBeenLastCalledWith('account-b', 'cultivar', 'jin-xuan');

    setAccess('platform_owner', 'account-b');
    await expect(saveWisdomVerification('account-a', input, client)).rejects.toThrow(/account changed/i);
    expect(client.put).toHaveBeenCalledOnce();
  });
});

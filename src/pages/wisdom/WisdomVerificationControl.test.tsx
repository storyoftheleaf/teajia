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
    const loaded = await loadWisdomVerification(input, client);
    await saveWisdomVerification(input, client);
    expect(client.get).toHaveBeenCalledWith('cultivar', 'rou-gui');
    expect(client.put).toHaveBeenCalledWith('cultivar', 'rou-gui', loaded.currentHash);

    const changedCitation = await loadWisdomVerification({
      ...input,
      citations: [...input.citations, { ...input.citations[0], id: 'citation-2' }],
    }, client);
    const changedProfile = await loadWisdomVerification({
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
    await saveWisdomVerification(input, client);
    await undoWisdomVerification(input, client);
    expect(client.put).toHaveBeenCalledOnce();
    expect(client.delete).toHaveBeenCalledWith('cultivar', 'rou-gui');
  });
});

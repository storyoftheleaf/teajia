import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { OwnerSitPhotoPermission } from './OwnerSitPhotoPermission';
import { teaTableConsent, teaTableOpen } from '../../lib/teaTable';

// The Tea Table is open on the live site; these cases hold it shut.
vi.mock('../../lib/teaTable', async importOriginal => {
  const actual = await importOriginal<typeof import('../../lib/teaTable')>();
  return { ...actual, teaTableOpen: () => false, teaTableConsent: () => false };
});

const scope = { accountId: 'shop', userId: 'guest' };

function render() {
  const client = new QueryClient();
  client.setQueryData(['sit-photo-owner-permission', scope.accountId, scope.userId, 'sit', 'photo'], { eligible: true, permission: null });
  return renderToStaticMarkup(
    <QueryClientProvider client={client}>
      <OwnerSitPhotoPermission setupId="sit" photoId="photo" scope={scope} />
    </QueryClientProvider>,
  );
}

describe('the public photo permission while the Tea Table is closed', () => {
  it('is shut here', () => {
    expect(teaTableOpen()).toBe(false);
  });

  it('asks only for the public recap, never for the Tea Table', () => {
    const html = render();
    expect(html).toContain('Public credit');
    expect(html).not.toMatch(/Tea Table|Brewing experiences/);
  });

  it('records no Tea Table consent', () => {
    expect(teaTableConsent(true)).toBe(false);
  });
});

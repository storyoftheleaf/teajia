import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';
import { OwnerSitPhotoPermission } from './OwnerSitPhotoPermission';
import { TEA_TABLE_OPEN, teaTableConsent } from '../../lib/teaTable';

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
  it('is switched off in what ships', () => {
    expect(TEA_TABLE_OPEN).toBe(false);
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

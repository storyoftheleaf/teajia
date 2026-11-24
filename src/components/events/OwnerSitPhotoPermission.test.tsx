import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';
import { OwnerSitPhotoPermission } from './OwnerSitPhotoPermission';
import { BREWING_EXPERIENCES_OPEN, brewingConsent } from '../../lib/brewingExperiences';

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

describe('the public photo permission while Brewing experiences is not approved', () => {
  it('is switched off in what ships', () => {
    expect(BREWING_EXPERIENCES_OPEN).toBe(false);
  });

  it('asks only for the public recap, never for Brewing experiences', () => {
    const html = render();
    expect(html).toContain('Public credit');
    expect(html).not.toMatch(/Brewing experiences/);
  });

  it('records no Brewing experiences consent', () => {
    expect(brewingConsent(true)).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';
import { classifyIncident } from './incidents';
import { ApiError } from './api';

describe('classifyIncident', () => {
  it('distinguishes missing service configuration from connectivity', () => {
    expect(classifyIncident(new ApiError('API upstream is not configured.', 503), {
      route: '/api/products/public', method: 'GET',
    })).toMatchObject({
      category: 'configuration',
      signature: 'configuration:get:api-products-public:503:upstream_not_configured',
      userMessage: 'A service configuration problem is preventing this from loading. Incident recorded.',
    });
  });

  it('files one signature for a route whose path carries an identifier', () => {
    // Every archive read is polled under a fresh job id, so a per-id signature
    // made one recurring fault a brand-new high-severity problem each time.
    const first = classifyIncident(new ApiError('Request failed (504)', 504), {
      route: '/api/curate/ar-create/requests/3504e462-73f9-4200-862f-d55de2fea535', method: 'GET',
    });
    const second = classifyIncident(new ApiError('Request failed (504)', 504), {
      route: '/api/curate/ar-create/requests/9bb1f0c2-1111-4222-8333-444455556666', method: 'GET',
    });

    expect(first.signature).toBe('server:get:api-curate-ar-create-requests-id:504:http_504');
    expect(second.signature).toBe(first.signature);
    // The id is still recorded as evidence; it just is not part of the identity.
    expect(first.route).toBe('/api/curate/ar-create/requests/3504e462-73f9-4200-862f-d55de2fea535');
  });

  it('leaves a long route word that is not an identifier alone', () => {
    expect(classifyIncident(new ApiError('Internal error', 500), {
      route: '/api/products/reset-stock-verification', method: 'POST',
    }).signature).toBe('server:post:api-products-reset-stock-verification:500:http_500');
  });

  it('classifies transport, server, session, and authorization failures separately', () => {
    expect(classifyIncident(new Error("Couldn't reach the server"), { route: '/api/x' }).category).toBe('network');
    expect(classifyIncident(new ApiError('Internal error', 500), { route: '/api/x' }).category).toBe('server');
    expect(classifyIncident(new ApiError('Session expired', 401), { route: '/api/x' }).category).toBe('auth');
    expect(classifyIncident(new ApiError('Account access denied', 403), { route: '/api/x' }).category).toBe('authorization');
  });
});

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

  it('classifies transport, server, session, and authorization failures separately', () => {
    expect(classifyIncident(new Error("Couldn't reach the server"), { route: '/api/x' }).category).toBe('network');
    expect(classifyIncident(new ApiError('Internal error', 500), { route: '/api/x' }).category).toBe('server');
    expect(classifyIncident(new ApiError('Session expired', 401), { route: '/api/x' }).category).toBe('auth');
    expect(classifyIncident(new ApiError('Account access denied', 403), { route: '/api/x' }).category).toBe('authorization');
  });
});

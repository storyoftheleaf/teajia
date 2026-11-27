import { describe, expect, it } from 'vitest';
import { classifyRequest } from '../src/allowanceGuard.mjs';
import { classifyTeajiaRequest } from '../src/agentAllowance';

const at = (path: string) => new Request(`https://api.teajia.com${path}`, { method: 'POST' });

describe('the agent door and the shared allowance', () => {
  it('counts /mcp and /mcp/public as interactive work, not background', () => {
    expect(classifyRequest(at('/mcp'))).toMatchObject({ priority: 'background', feature: 'agent' });
    expect(classifyTeajiaRequest(at('/mcp'))).toEqual({ priority: 'interactive', feature: 'agent' });
    expect(classifyTeajiaRequest(at('/mcp/public'))).toEqual({ priority: 'interactive', feature: 'agent' });
  });

  it('leaves every other route as the shared guard decides', () => {
    for (const path of ['/api/products', '/api/compass/sync', '/api/auth/me', '/cron', '/api/curate/ar-create/connector/x']) {
      expect(classifyTeajiaRequest(at(path))).toEqual(classifyRequest(at(path)));
    }
  });
});

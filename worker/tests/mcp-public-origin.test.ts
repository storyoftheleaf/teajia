import { describe, expect, it } from 'vitest';
import { mcpFetch, oauthAuthorizationServerMetadata, oauthProtectedResourceMetadata, originOf } from '../src/mcp';

const publicHeaders = { 'X-Teajia-Public-Origin': 'https://www.teajia.com' };

describe('MCP public origin metadata', () => {
  it('advertises the Pages origin in protected-resource metadata', async () => {
    const response = oauthProtectedResourceMetadata(new Request('https://teajia-api.lightcodes.workers.dev/.well-known/oauth-protected-resource', { headers: publicHeaders }));
    const body = await response.text();
    expect(body).toContain('https://www.teajia.com/mcp');
    expect(body).not.toContain('workers.dev');
  });

  it('advertises the Pages origin in authorization-server metadata', async () => {
    const response = oauthAuthorizationServerMetadata(new Request('https://teajia-api.lightcodes.workers.dev/.well-known/oauth-authorization-server', { headers: publicHeaders }));
    const body = await response.text();
    expect(body).toContain('https://www.teajia.com/oauth/authorize');
    expect(body).not.toContain('workers.dev');
  });

  it('uses the Pages origin in MCP challenges but rejects arbitrary spoofed origins', async () => {
    const response = await mcpFetch(new Request('https://teajia-api.lightcodes.workers.dev/mcp', { method: 'POST', headers: publicHeaders, body: '{}' }), {} as any);
    expect(response.headers.get('www-authenticate')).toContain('https://www.teajia.com/.well-known/oauth-protected-resource');
    expect(response.headers.get('www-authenticate')).not.toContain('workers.dev');
    expect(originOf(new Request('https://worker.example/mcp', { headers: { 'X-Teajia-Public-Origin': 'https://attacker.example' } }))).toBe('https://worker.example');
    expect(originOf(new Request('https://worker.example/mcp'))).toBe('https://worker.example');
  });
});

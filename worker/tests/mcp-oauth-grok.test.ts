import { describe, expect, it } from 'vitest';
import { oauthRegister } from '../src/mcp';

/*
 * Grok Bot (xAI with Cursor) connects to an MCP server by OAuth only. Its
 * registration sends three callbacks in one request, and this server refuses
 * the whole client if any one is off the allowlist, so a single missing host
 * means Grok Bot cannot connect at all and says nothing more useful than
 * "redirect_uri not allowed". The Grok app's own connectors return to
 * grok.com. Both are pinned here, and so is the rule that keeps a lookalike
 * host out.
 */

class ClientsDb {
  clients = new Map<string, any>();
  prepare(sql: string) {
    const normalized = sql.replace(/\s+/g, ' ').trim().toLowerCase();
    let values: any[] = [];
    const statement = {
      bind: (...input: any[]) => { values = input; return statement; },
      first: async () => {
        if (normalized.includes('from oauth_clients') && normalized.includes('client_name = ?')) {
          return [...this.clients.values()].find(c => c.client_name === values[0] && c.redirect_uris === values[1]
            && c.grant_types === values[2] && c.response_types === values[3]) || null;
        }
        return null;
      },
      run: async () => {
        if (normalized.startsWith('insert into oauth_clients')) {
          this.clients.set(values[0], { id: values[0], client_name: values[1], redirect_uris: values[2], grant_types: values[3], response_types: values[4] });
        }
        return { success: true, meta: { changes: 1 } };
      },
    };
    return statement;
  }
}

async function register(body: Record<string, unknown>) {
  const res = await oauthRegister(new Request('https://api.test/oauth/register', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ response_types: ['code'], ...body }),
  }), { DB: new ClientsDb(), JWT_SECRET: 'x', OAUTH_REGISTER_LIMITER: { limit: async () => ({ success: true }) } } as any);
  return { status: res.status, body: await res.json() as Record<string, any> };
}

describe('Grok can sign in to the shop', () => {
  it('registers Grok Bot with all three callbacks it sends, asking for refresh tokens too', async () => {
    const out = await register({
      client_name: 'Grok Bot',
      redirect_uris: [
        'cursor://anysphere.cursor-mcp/oauth/callback',
        'https://www.cursor.com/agents/mcp/oauth/callback',
        'http://localhost:8787/callback',
      ],
      grant_types: ['authorization_code', 'refresh_token'],
    });
    expect(out.status, JSON.stringify(out.body)).toBe(201);
    expect(out.body.client_id).toBeTruthy();
  });

  it('registers the Grok app connector callback', async () => {
    const out = await register({ client_name: 'Grok', redirect_uris: ['https://grok.com/connectors-oauth-exchange-code/'] });
    expect(out.status, JSON.stringify(out.body)).toBe(201);
  });

  it('still refuses a lookalike host', async () => {
    for (const uri of ['https://cursor.com.evil.example/cb', 'https://evilgrok.com/cb', 'http://www.cursor.com/agents/mcp/oauth/callback']) {
      const out = await register({ client_name: 'Fake', redirect_uris: [uri] });
      expect(out.status, uri).toBe(400);
    }
  });

  it('still refuses any grant other than authorization code and refresh token', async () => {
    for (const grants of [['client_credentials'], ['refresh_token'], ['authorization_code', 'implicit'], ['authorization_code', 'authorization_code']]) {
      const out = await register({ client_name: 'Odd', redirect_uris: ['https://claude.ai/oauth/callback'], grant_types: grants });
      expect(out.status, JSON.stringify(grants)).toBe(400);
    }
  });
});

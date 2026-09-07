// Answers one question without ever printing the answer's credential: does the
// token in TEAJIA_MCP_TOKEN reach the shop, and what is it allowed to do?
//
// The scopes are the point. Owner-tier boxes at /admin/mcp-tokens are UNTICKED
// by default, so the most likely outcome of minting a token is one that
// connects perfectly and cannot touch a price. A token that works for
// everything except the job it was minted for looks identical to a good one
// until the tool is called, which is why this prints the held scopes rather
// than "connected".
//
// The token is read from the environment and never written to stdout, not
// even truncated: a prefix is enough to correlate a leak against a log.

const ENDPOINT = process.env.TEAJIA_MCP_URL || 'https://api.teajia.com/mcp';
const PROTOCOL_VERSION = '2025-06-18';

// One tool per scope. Tool visibility IS the scope check: `visibleToolDefs`
// filters the list by what the token holds, so what comes back is authority,
// not documentation.
const PROBES = [
  ['inventory:read', 'search_tea'],
  ['stock:write', 'add_stock'],
  ['customers:read', 'find_customer'],
  ['sales:read', 'list_invoices'],
  ['sales:write', 'record_sale'],
  ['catalog:write', 'set_cost_currency'],
  ['customers:write', 'create_customer'],
  ['admin:write', 'update_account_settings'],
];

const OWNER_TIER = new Set(['catalog:write', 'customers:write', 'admin:write']);

async function rpc(token, method, params) {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  // Status and body only. Response headers are never echoed: a credentialed
  // response can carry a set-cookie the caller never held.
  const text = await res.text();
  return { status: res.status, text };
}

function parseBody(text) {
  const trimmed = text.trim();
  if (trimmed.startsWith('data:')) {
    const line = trimmed.split('\n').find((l) => l.startsWith('data:'));
    return JSON.parse(line.slice(5).trim());
  }
  return JSON.parse(trimmed);
}

async function main() {
  const token = process.env.TEAJIA_MCP_TOKEN;
  if (!token || token.trim() === '') {
    console.error('TEAJIA_MCP_TOKEN is not set in this shell.');
    console.error('');
    console.error('Mint one at https://www.teajia.com/admin/mcp-tokens (owner tier), tick');
    console.error('catalog:write, then store it with:');
    console.error('  infisical secrets set TEAJIA_MCP_TOKEN=<the token> --env=dev --path=/');
    console.error('and run this again under `npm run mcp:check`, which loads it from Infisical.');
    process.exit(1);
  }

  let init;
  try {
    init = await rpc(token, 'initialize', {
      protocolVersion: PROTOCOL_VERSION,
      capabilities: {},
      clientInfo: { name: 'teajia-token-check', version: '1' },
    });
  } catch (err) {
    console.error(`Could not reach ${ENDPOINT}: ${err.message}`);
    console.error('If this is a cloud session, api.teajia.com needs to be on its network allowlist.');
    process.exit(1);
  }

  if (init.status !== 200) {
    // A refusal from the shop arrives as JSON with an `error` field. A refusal
    // from something in between (an egress proxy, a corporate gateway) does
    // not, and it wears the same status code. Blaming the token for a proxy's
    // 403 sends the reader to mint a second token that will fail identically.
    let shopSaid = null;
    try {
      const body = parseBody(init.text);
      shopSaid = body?.error_description || body?.error || null;
    } catch { /* not the shop talking */ }

    if (!shopSaid) {
      console.error(`Something between here and the shop refused the request (HTTP ${init.status}).`);
      console.error(`It did not come from ${ENDPOINT}, so the token is not what is wrong.`);
      console.error('In a cloud session, api.teajia.com needs to be on the network allowlist.');
      process.exit(1);
    }
    if (init.status === 401) {
      console.error(`The shop refused the token: ${shopSaid}`);
      console.error('It was revoked, mistyped, or truncated. Mint a fresh one.');
      process.exit(1);
    }
    console.error(`The shop refused the request (HTTP ${init.status}): ${shopSaid}`);
    process.exit(1);
  }

  const server = parseBody(init.text)?.result?.serverInfo;
  console.log(`Connected to ${server?.name ?? 'the shop'}${server?.version ? ` ${server.version}` : ''} at ${ENDPOINT}`);

  const listed = await rpc(token, 'tools/list', {});
  const tools = parseBody(listed.text)?.result?.tools ?? [];
  const names = new Set(tools.map((t) => t.name));
  console.log(`${tools.length} tools visible to this token.`);
  console.log('');

  const held = [];
  const missing = [];
  for (const [scope, probe] of PROBES) {
    (names.has(probe) ? held : missing).push(scope);
  }

  console.log('Held:', held.length ? held.join(', ') : 'nothing');
  if (missing.length) console.log('Not held:', missing.join(', '));
  console.log('');

  if (!held.includes('catalog:write')) {
    console.error('This token cannot change a price or a cost currency.');
    console.error('catalog:write is owner tier and its box is UNTICKED by default at');
    console.error('/admin/mcp-tokens. Mint another one with it ticked; a token cannot be');
    console.error('widened after it is issued.');
    process.exit(1);
  }

  const jobs = ['list_unstated_costs', 'set_cost_currency', 'create_tea', 'update_tea_pricing'];
  const absent = jobs.filter((j) => !names.has(j));
  if (absent.length) {
    console.error(`Connected, but these tools are not visible: ${absent.join(', ')}`);
    process.exit(1);
  }

  console.log('The cost-currency and pricing tools are all reachable. Nothing else to do.');
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});

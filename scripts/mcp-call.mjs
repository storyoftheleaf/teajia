// Calls ONE tool on the shop's MCP server and prints what it answered.
//
// `check-mcp-token.mjs` answers "can this token reach the shop, and what may it
// do". This answers "do the thing". It exists because the alternative is a
// session pasting an ad-hoc `infisical run -- node -e '...'` into a shell, which
// is exactly the shape that leaks a token into a transcript. Here the token is
// read from the environment, used once, and never written to stdout.
//
// Usage, always through `npm run mcp:call` so Infisical injects the token:
//
//   npm run mcp:call -- list_collections
//   npm run mcp:call -- add_tea_to_collection '{"collection_id":"col_x","product":"1990 Bamboo"}'
//
// Mutating tools answer twice by design: the first call returns a
// confirmation_token and a preview of what WOULD change, the second call
// commits it. That is the shop's own guard against an agent changing a price
// nobody saw, so this script does not paper over it: pass the token back in the
// arguments to confirm. Read the preview before you do.

const ENDPOINT = process.env.TEAJIA_MCP_URL || 'https://api.teajia.com/mcp';
const PROTOCOL_VERSION = '2025-06-18';

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
  // Status and body only, as in check-mcp-token.mjs: a credentialed response
  // can carry a set-cookie the caller never held, so headers are not echoed.
  return { status: res.status, text: await res.text() };
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
    console.error('TEAJIA_MCP_TOKEN is not set. Run through `npm run mcp:call`, which injects it from Infisical.');
    process.exit(1);
  }

  const [tool, argsJson] = process.argv.slice(2);
  if (!tool) {
    console.error('Name a tool: npm run mcp:call -- <tool> \'{"json":"args"}\'');
    process.exit(1);
  }

  let args;
  try {
    args = argsJson ? JSON.parse(argsJson) : {};
  } catch (err) {
    console.error(`Arguments are not JSON: ${err.message}`);
    process.exit(1);
  }

  const init = await rpc(token, 'initialize', {
    protocolVersion: PROTOCOL_VERSION,
    capabilities: {},
    clientInfo: { name: 'mcp-call', version: '1.0.0' },
  });
  if (init.status !== 200) {
    // A shop refusal carries a JSON body; a blocked network allowlist carries
    // none at the same status. Telling them apart is the difference between
    // minting a new token and fixing the allowlist.
    console.error(
      init.text.trim()
        ? `The shop refused the token (${init.status}).`
        : `No answer from ${ENDPOINT} (${init.status}). If this is a cloud session, its network allowlist needs that host.`,
    );
    process.exit(1);
  }

  const res = await rpc(token, 'tools/call', { name: tool, arguments: args });
  if (res.status !== 200) {
    console.error(`${tool} answered ${res.status}.`);
    process.exit(1);
  }

  const body = parseBody(res.text);
  if (body.error) {
    console.error(`${tool}: ${body.error.message}`);
    process.exit(1);
  }
  const out = body.result?.structuredContent ?? body.result?.content?.[0]?.text ?? body.result;
  console.log(typeof out === 'string' ? out : JSON.stringify(out, null, 2));
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});

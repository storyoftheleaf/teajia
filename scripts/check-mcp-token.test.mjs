// The check script's whole reason to exist is to answer a question about a
// credential without handling the credential. That property is one careless
// template literal away from being false, and the failure is silent: the
// script keeps working, the answer stays correct, and the token is in a
// terminal buffer and a scrollback and possibly a pasted screenshot.
//
// So it is pinned here rather than trusted. A prefix is not safe either: it is
// enough to correlate a leak against a log, which is why the rule is that the
// value never reaches stdout in any form, truncated or hashed.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const SRC = readFileSync(new URL('./check-mcp-token.mjs', import.meta.url), 'utf8');

function stripComments(text) {
  return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

// Prose is not a reference. A message reading "the token is not what is wrong"
// contains the word and prints nothing, so the bare-identifier check runs
// against code only: quoted strings drop out, and a template keeps its
// `${...}` expressions and loses its text.
function codeOnly(args) {
  return args
    .replace(/`(?:[^`\\]|\\.)*`/g, (tpl) =>
      [...tpl.matchAll(/\$\{([^}]*)\}/g)].map((m) => m[1]).join(' , '))
    .replace(/'(?:[^'\\]|\\.)*'/g, '')
    .replace(/"(?:[^"\\]|\\.)*"/g, '');
}

test('the token never reaches stdout', () => {
  const code = stripComments(SRC);
  const printed = [...code.matchAll(/console\.(log|error|warn|info|debug)\(([\s\S]*?)\);/g)]
    .map((m) => m[2]);

  for (const args of printed) {
    // `token` as a value: interpolated, concatenated, sliced, or passed bare.
    assert.ok(
      !/\$\{\s*token\b/.test(args),
      `A console call interpolates the token: ${args.slice(0, 80)}`,
    );
    assert.ok(
      !/\btoken\s*\.\s*(slice|substring|substr)\b/.test(args),
      `A console call prints part of the token: ${args.slice(0, 80)}`,
    );
    assert.ok(
      !/(^|[(,+\s])token\s*($|[),+\s.])/.test(codeOnly(args).replace(/TEAJIA_MCP_TOKEN/g, '')),
      `A console call passes the token: ${args.slice(0, 80)}`,
    );
  }
});

test('response headers are never echoed', () => {
  const code = stripComments(SRC);
  assert.ok(
    !/res\.headers|\.headers\.forEach|Object\.fromEntries\(\s*res/.test(code),
    'A credentialed response can carry a set-cookie the caller never held; its headers stay unread.',
  );
});

test('the scope gap is checked, not just the connection', () => {
  // A token that connects and cannot write is the likely outcome of minting
  // one, because the owner-tier boxes are unticked by default. A checker that
  // stops at "connected" would call that success.
  assert.match(SRC, /catalog:write/);
  assert.match(SRC, /set_cost_currency/);
});

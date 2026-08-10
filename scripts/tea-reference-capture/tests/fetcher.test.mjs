import assert from 'node:assert/strict';
import test from 'node:test';

import { createCliFetcher } from '../fetcher.mjs';

test('CLI fetcher falls back to certificate-validating curl for a Node certificate-chain error', async () => {
  const certificateError = new TypeError('fetch failed', { cause: Object.assign(new Error('certificate'), { code: 'UNABLE_TO_VERIFY_LEAF_SIGNATURE' }) });
  const primaryFetch = async () => { throw certificateError; };
  let called = false;
  const curlExec = async (executable, args, options) => {
    called = true;
    assert.equal(executable, 'curl');
    assert.equal(args.includes('--insecure'), false);
    assert.equal(options.encoding, 'buffer');
    return { stdout: Buffer.from('<html>registry</html>\n__TEAJIA_CURL_META_7e44c93d__:200\ttext/html') };
  };
  const fetcher = createCliFetcher({ primaryFetch, curlExec });
  const response = await fetcher('https://registry.example/tea');
  assert.equal(called, true);
  assert.equal(response.ok, true);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'text/html');
  assert.equal(Buffer.from(await response.arrayBuffer()).toString('utf8'), '<html>registry</html>');
});

test('CLI fetcher does not hide ordinary primary-fetch failures', async () => {
  const primaryFetch = async () => { throw new TypeError('connection reset', { cause: Object.assign(new Error('reset'), { code: 'ECONNRESET' }) }); };
  const curlExec = async () => { throw new Error('curl must not be called'); };
  const fetcher = createCliFetcher({ primaryFetch, curlExec });
  await assert.rejects(fetcher('https://example.test/tea'), /connection reset/);
});

test('CLI fetcher uses the system transport only when the source explicitly requests it', async () => {
  const primaryFetch = async () => { throw new Error('primary transport must not be called'); };
  const curlExec = async () => ({
    stdout: Buffer.from('<html>industry source</html>\n__TEAJIA_CURL_META_7e44c93d__:200\ttext/html'),
  });
  const fetcher = createCliFetcher({ primaryFetch, curlExec });
  const response = await fetcher('https://association.example/tea', { teajiaTransport: 'system' });
  assert.equal(response.ok, true);
  assert.equal(Buffer.from(await response.arrayBuffer()).toString('utf8'), '<html>industry source</html>');
});

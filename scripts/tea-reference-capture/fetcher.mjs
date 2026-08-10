import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const META_MARKER = Buffer.from('\n__TEAJIA_CURL_META_7e44c93d__:');
const CERTIFICATE_ERRORS = new Set([
  'UNABLE_TO_GET_ISSUER_CERT',
  'UNABLE_TO_GET_ISSUER_CERT_LOCALLY',
  'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
]);

function certificateChainFailure(error) {
  let current = error;
  while (current) {
    if (CERTIFICATE_ERRORS.has(current.code)) return true;
    current = current.cause;
  }
  return false;
}

async function curlFetch(url, curlExec) {
  const { stdout } = await curlExec('curl', [
    '--fail-with-body',
    '--location',
    '--max-time', '45',
    '--retry', '1',
    '--retry-delay', '2',
    '--proto', '=https',
    '--proto-redir', '=https',
    '--silent',
    '--show-error',
    '--user-agent', 'Teajia-Research-Preview/1.0 (contact: https://teajia.com)',
    '--write-out', `${META_MARKER.toString('utf8')}%{http_code}\t%{content_type}`,
    url,
  ], { encoding: 'buffer', maxBuffer: 8 * 1024 * 1024 });
  const bytes = Buffer.isBuffer(stdout) ? stdout : Buffer.from(stdout);
  const markerIndex = bytes.lastIndexOf(META_MARKER);
  if (markerIndex < 0) throw new Error('System fetch returned no HTTP metadata');
  const body = bytes.subarray(0, markerIndex);
  const [statusText, contentType = ''] = bytes.subarray(markerIndex + META_MARKER.length).toString('utf8').split('\t');
  const status = Number(statusText);
  if (!Number.isInteger(status)) throw new Error('System fetch returned an invalid HTTP status');
  return Object.freeze({
    ok: status >= 200 && status < 300,
    status,
    headers: Object.freeze({ get: (name) => name.toLowerCase() === 'content-type' ? contentType : '' }),
    arrayBuffer: async () => body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength),
  });
}

export function createCliFetcher({ primaryFetch = globalThis.fetch, curlExec = execFileAsync } = {}) {
  if (typeof primaryFetch !== 'function') throw new Error('Primary fetch function is required');
  return async (url, options) => {
    try {
      return await primaryFetch(url, options);
    } catch (error) {
      if (!certificateChainFailure(error)) throw error;
      return curlFetch(url, curlExec);
    }
  };
}

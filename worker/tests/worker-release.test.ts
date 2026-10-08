import { describe, expect, it } from 'vitest';
import worker from '../src/index';
import { workerReleaseResponse } from '../src/workerRelease';

describe('public immutable Worker identity', () => {
  it('serves only the exact revision and running version, without caching', async () => {
    const response = workerReleaseResponse({
      RELEASE_GIT_SHA: 'a'.repeat(40),
      CF_VERSION_METADATA: { id: 'worker-version', tag: 'release', timestamp: 'date' },
      JWT_SECRET: 'private',
    } as any);
    expect(await response.json()).toEqual({ revision: 'a'.repeat(40), versionId: 'worker-version' });
    expect(response.headers.get('Cache-Control')).toContain('no-store');
  });
  it('serves the real public route without requiring a database or account', async () => {
    const response = await worker.fetch(new Request('https://worker.test/api/release'), {
      RELEASE_GIT_SHA: 'b'.repeat(40), CF_VERSION_METADATA: { id: 'runtime-version' },
    } as any);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ revision: 'b'.repeat(40), versionId: 'runtime-version' });
    expect(response.headers.get('Cache-Control')).toContain('no-store');
  });
  it('does not invent production identity for a local or unstamped deploy', async () => {
    expect(await workerReleaseResponse({}).json()).toEqual({ revision: null, versionId: null });
    expect((await workerReleaseResponse({ RELEASE_GIT_SHA: 'not-a-commit' }).json() as any).revision).toBeNull();
  });
});

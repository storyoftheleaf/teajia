/** Public deployment identity only: never expose bindings or configuration. */
export interface WorkerReleaseEnv {
  RELEASE_GIT_SHA?: string;
  CF_VERSION_METADATA?: { id: string; tag?: string; timestamp?: string };
}

export function workerReleaseResponse(env: WorkerReleaseEnv): Response {
  const revision = /^[a-f0-9]{40}$/i.test(env.RELEASE_GIT_SHA ?? '') ? env.RELEASE_GIT_SHA!.toLowerCase() : null;
  const versionId = env.CF_VERSION_METADATA?.id ?? null;
  return Response.json({ revision, versionId }, {
    headers: { 'Cache-Control': 'no-store, max-age=0' },
  });
}

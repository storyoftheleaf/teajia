// A protected immutable Pages URL is an authentication boundary, never an asset proof.
export const ACCESS_LOGIN_ORIGIN = 'https://soft-band-fe5b.cloudflareaccess.com';

export function recognizedAccessRedirect(response, immutableOrigin) {
  if (response.status !== 302) return false;
  let target;
  try { target = new URL(response.headers.get('location')); } catch { return false; }
  return target.origin === ACCESS_LOGIN_ORIGIN &&
    target.pathname === `/cdn-cgi/access/login/${new URL(immutableOrigin).hostname}`;
}

export function canonicalDeployment(project, candidate, immutableOrigin, deploymentId) {
  const d = project?.canonical_deployment;
  if (project?.name !== 'teajiafinal' || project.production_branch !== 'main' ||
    !project.domains?.includes('teajia.com') || !project.domains?.includes('www.teajia.com') ||
    d?.id !== deploymentId || d.environment !== 'production' ||
    d.latest_stage?.name !== 'deploy' || d.latest_stage?.status !== 'success' ||
    d.deployment_trigger?.metadata?.commit_hash !== candidate ||
    new URL(d.url).origin !== immutableOrigin) {
    throw new Error('Canonical Pages deployment does not prove the exact production candidate');
  }
  return { id: d.id, sourceRevision: candidate, immutableOrigin, environment: d.environment };
}

export function sameDeployment(before, after) {
  if (JSON.stringify(before) !== JSON.stringify(after)) throw new Error('Canonical Pages deployment changed during proof');
}

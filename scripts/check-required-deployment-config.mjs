import { pathToFileURL } from 'node:url';

export function validateDeploymentConfig(config) {
  const workerOrigin = config?.WORKER_ORIGIN;
  if (typeof workerOrigin !== 'string' || workerOrigin.trim() === '') {
    return ['WORKER_ORIGIN is required.'];
  }

  let parsed;
  try {
    parsed = new URL(workerOrigin);
  } catch {
    return ['WORKER_ORIGIN must be a valid HTTPS URL.'];
  }

  if (parsed.protocol !== 'https:') {
    return ['WORKER_ORIGIN must use HTTPS.'];
  }

  return [];
}

function runCli() {
  if (process.argv.includes('--if-cloudflare-pages') && process.env.CF_PAGES !== '1') {
    console.log('Skipped outside Cloudflare Pages; deployment configuration was not required.');
    return;
  }

  const errors = validateDeploymentConfig(process.env);
  if (errors.length === 0) {
    console.log('Required deployment configuration is present and valid.');
    return;
  }

  console.error(`Deployment configuration check failed:\n${errors.map((error) => `- ${error}`).join('\n')}`);
  process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runCli();
}

import { readdir, readFile } from 'node:fs/promises';
import { relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const RULES = [
  { kind: 'blocked-media', re: /(?:https?:)?\/\/(?:images\.unsplash\.com|source\.unsplash\.com|picsum\.photos)\b/g },
  { kind: 'browser-api-origin', re: /(?:https?:)?\/\/(?:teajia-api\.lightcodes\.workers\.dev|api\.teajia\.com)\b/g },
  { kind: 'google-font-runtime', re: /(?:https?:)?\/\/fonts\.(?:googleapis|gstatic)\.com\b/g },
];
const ROOTS = ['src', 'public', 'functions', 'dist'];
const BINARY_EXTENSIONS = /\.(?:png|jpe?g|gif|webp|avif|ico|woff2?|ttf|otf|pdf|zip|gz|mp[34]|mov)$/i;
const TEST_FILE = /(?:^|\/)(?:tests?|test-results)(?:\/|$)|\.(?:test|spec)\.[^/]+$/;

async function filesBelow(directory) {
  const files = [];
  let entries;
  try { entries = await readdir(directory, { withFileTypes: true }); } catch { return files; }
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) files.push(...await filesBelow(path));
    else files.push(path);
  }
  return files;
}

async function documentationChunks(root) {
  try {
    const manifest = JSON.parse(await readFile(resolve(root, 'dist/.vite/manifest.json'), 'utf8'));
    const isDocumentation = entry => typeof entry?.src === 'string' &&
      (entry.src.startsWith('docs/') || entry.src.includes('/docs/'));
    const runtimeReachable = new Set();
    const visit = key => {
      if (runtimeReachable.has(key)) return;
      runtimeReachable.add(key);
      const entry = manifest[key];
      for (const dependency of [...(entry?.imports || []), ...(entry?.dynamicImports || [])]) visit(dependency);
    };
    for (const [key, entry] of Object.entries(manifest)) {
      if (!isDocumentation(entry)) visit(key);
    }
    return new Set(Object.entries(manifest)
      .filter(([key, entry]) => isDocumentation(entry) && !runtimeReachable.has(key))
      .map(([, entry]) => `dist/${entry.file}`));
  } catch { return new Set(); }
}

export async function verifyBuiltReachabilityPolicy(root) {
  const issues = [];
  let headers = '';
  let serviceWorker = '';
  try { headers = await readFile(resolve(root, 'dist/_headers'), 'utf8'); } catch { return issues; }
  try { serviceWorker = await readFile(resolve(root, 'dist/sw.js'), 'utf8'); } catch { issues.push({ file: 'dist/sw.js', line: 1, kind: 'built-policy', value: 'missing service worker' }); return issues; }
  if (/teajia-api\.lightcodes\.workers\.dev|api\.teajia\.com/.test(headers)) issues.push({ file: 'dist/_headers', line: 1, kind: 'built-policy', value: 'blocked API origin in CSP' });
  const selfDestroying = /registration\.unregister\(\)/.test(serviceWorker) && /caches\.delete\(/.test(serviceWorker);
  const apiGetOnly = /startsWith\(["']\/api\/["']\)[\s\S]{0,500}["']GET["']/.test(serviceWorker);
  const ownedMedia = /startsWith\(["']\/media\/["']\)/.test(serviceWorker);
  // A cleanup-only worker has no fetch handler and removes all old caches, so
  // it cannot replay cross-origin or stale API/media responses.
  if (!selfDestroying && (!apiGetOnly || !ownedMedia)) issues.push({ file: 'dist/sw.js', line: 1, kind: 'built-policy', value: 'missing same-origin GET-only API/media policy' });
  if (/fonts\.(?:googleapis|gstatic)/.test(serviceWorker)) issues.push({ file: 'dist/sw.js', line: 1, kind: 'built-policy', value: 'Google Fonts runtime cache' });
  for (const route of ['/api/verify/request', '/api/verify/confirm']) {
    const block = headers.match(new RegExp(`${route.replace(/\//g, '\\/')}[\\s\\S]*?(?=\\n\\S|$)`))?.[0] || '';
    if (!/Cache-Control:\s*no-store/i.test(block)) issues.push({ file: 'dist/_headers', line: 1, kind: 'built-policy', value: `${route} is cacheable` });
  }
  return issues;
}

export async function scanChinaDependencies(root) {
  const absoluteRoot = resolve(root);
  const docChunks = await documentationChunks(absoluteRoot);
  const violations = [];
  const inventory = [];
  for (const scanRoot of ROOTS) {
    for (const file of await filesBelow(resolve(absoluteRoot, scanRoot))) {
      const displayFile = relative(absoluteRoot, file).split(sep).join('/');
      if (docChunks.has(displayFile)) continue;
      if (TEST_FILE.test(displayFile) || file.endsWith('.map') || BINARY_EXTENSIONS.test(file)) continue;
      let content;
      try { content = await readFile(file, 'utf8'); } catch { continue; }
      for (const rule of RULES) {
        rule.re.lastIndex = 0;
        for (const match of content.matchAll(rule.re)) {
          const line = content.slice(0, match.index).split('\n').length;
          const edgeOrigin = displayFile.startsWith('functions/') && rule.kind === 'browser-api-origin';
          const finding = { file: displayFile, line, kind: edgeOrigin ? 'edge-origin' : rule.kind, value: match[0] };
          inventory.push(finding);
          if (!edgeOrigin || rule.kind === 'browser-api-origin') violations.push(finding);
        }
      }
    }
  }
  const builtPolicy = await verifyBuiltReachabilityPolicy(absoluteRoot);
  violations.push(...builtPolicy);
  inventory.push(...builtPolicy);
  return { violations, inventory };
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : '';
if (invokedPath === fileURLToPath(import.meta.url)) {
  const root = process.argv[2] || '.';
  const result = await scanChinaDependencies(root);
  for (const violation of result.violations) {
    process.stderr.write(`${violation.file}:${violation.line} ${violation.kind} ${violation.value}\n`);
  }
  if (result.violations.length) {
    process.stderr.write(`China dependency audit failed: ${result.violations.length} runtime violation(s).\n`);
    process.exitCode = 1;
  } else {
    process.stdout.write('China dependency audit passed: 0 runtime violations.\n');
  }
}

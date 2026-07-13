import { readdir, readFile } from 'node:fs/promises';
import { relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const RULES = [
  { kind: 'blocked-media', re: /https:\/\/(?:images\.unsplash\.com|source\.unsplash\.com|picsum\.photos)\b/g },
  { kind: 'browser-api-origin', re: /https:\/\/teajia-api\.lightcodes\.workers\.dev\b/g },
  { kind: 'google-font-runtime', re: /https:\/\/fonts\.(?:googleapis|gstatic)\.com\b/g },
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

export async function scanChinaDependencies(root) {
  const absoluteRoot = resolve(root);
  const violations = [];
  const inventory = [];
  for (const scanRoot of ROOTS) {
    for (const file of await filesBelow(resolve(absoluteRoot, scanRoot))) {
      const displayFile = relative(absoluteRoot, file).split(sep).join('/');
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
          if (!edgeOrigin) violations.push(finding);
        }
      }
    }
  }
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

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { build } from 'vite';
import { readDeliveryPlugin, READ_ARTICLE_MODULES } from './read-delivery-plugin.mjs';

const MARKER = 'SYNTHETIC_UNPUBLISHED_DELIVERY_MARKER';
async function files(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  return (await Promise.all(entries.map(e => e.isDirectory() ? files(path.join(dir, e.name)) : path.join(dir, e.name)))).flat();
}

test('draft code and source maps never enter the public artifact; authorized delivery retains the same module', async () => {
  const root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'read-delivery-')));
  try {
    await fs.mkdir(path.join(root, 'functions'));
    await fs.mkdir(path.join(root, 'src/pages/read/conversation/pieces'), { recursive: true });
    await fs.writeFile(path.join(root, 'index.html'), '<script type="module" src="/main.js"></script>');
    await fs.writeFile(path.join(root, 'main.js'), `window.read = () => import('./draft.js'); window.live = () => import('./live.js');`);
    await fs.writeFile(path.join(root, 'draft.js'), `import { word } from './src/pages/read/conversation/pieces/draft-data.js'; export default '${MARKER}' + word;`);
    await fs.writeFile(path.join(root, 'src/pages/read/conversation/pieces/draft-data.js'), `export const word = 'SYNTHETIC_PRIVATE_DEPENDENCY';`);
    await fs.writeFile(path.join(root, 'live.js'), `export default 'SYNTHETIC_LIVE_CONTENT';`);
    await build({ root, configFile: false, logLevel: 'silent', plugins: [readDeliveryPlugin({
      articles: { '/read/draft': 'draft.js', '/read/live': 'live.js' },
    })], build: { sourcemap: 'hidden', minify: false } });
    const publicFiles = await files(path.join(root, 'dist'));
    const publicText = (await Promise.all(publicFiles.map(f => fs.readFile(f, 'utf8')))).join('\n');
    assert.ok(!publicText.includes(MARKER), 'draft prose reached public bytes');
    assert.ok(!publicText.includes('SYNTHETIC_PRIVATE_DEPENDENCY'), 'dependency prose reached public bytes');
    assert.ok(!publicText.includes('SYNTHETIC_LIVE_CONTENT'), 'a live story must support unpublishing without retained static bytes');
    const protectedModules = JSON.parse(await fs.readFile(path.join(root, 'functions/readAssets.generated.json'), 'utf8'));
    const draft = Object.values(protectedModules).find(v => v.paths.includes('/read/draft'));
    assert.ok(draft.code.includes(MARKER));
    assert.ok(draft.code.includes('SYNTHETIC_PRIVATE_DEPENDENCY'));
    assert.match(publicText, /read-assets\//, 'the existing dynamic import reaches protected delivery');
    assert.ok(!publicFiles.some(f => f.includes('/read-assets/')), 'no alternate direct asset may bypass the function');
    // A later public consumer must not turn story words into a shared asset.
    await fs.appendFile(path.join(root, 'main.js'), "import { word } from './src/pages/read/conversation/pieces/draft-data.js'; window.exposed = word;");
    await assert.rejects(build({ root, configFile: false, logLevel: 'silent', plugins: [readDeliveryPlugin({
      articles: { '/read/draft': 'draft.js', '/read/live': 'live.js' },
    })] }), /Private story data imported by public code/);

  } finally { await fs.rm(root, { recursive: true, force: true }); }
});

test('every curated route has a protected source module', async () => {
  const { ARTICLE_LIVE } = await import('../src/pages/read/articleLive.ts');
  assert.deepEqual(Object.keys(READ_ARTICLE_MODULES).sort(), Object.keys(ARTICLE_LIVE).sort());
  for (const file of Object.values(READ_ARTICLE_MODULES)) await fs.access(file);
});

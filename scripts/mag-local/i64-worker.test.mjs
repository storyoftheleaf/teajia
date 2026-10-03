import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runRequest } from './i64-worker.mjs';
const markdown = '---\nkind: transcript\ntitle: Tea\n---\n\n# Tea\n\nAdrian: Hello.\n';
const request = { action: 'export', config: { project: 'teajia' }, job: { id: 'recording', story: 'Tea' }, markdown };
test('source upload verifies content and transcript kind before archiving prior working version', async () => {
  const writes = [];
  const client = { get: async url => JSON.stringify(url.includes('/tree') ? { tree: { files: [], folders: [] } } : { content: '# Tea\n\nAdrian: Hello.', kind: 'transcript' }), post: async (url, body) => { writes.push({ url, body }); return JSON.stringify({ rel_path: url.endsWith('/file') ? 'Transcripts/recording/new.md' : 'archive/old.md' }); } };
  const result = await runRequest({ ...request, previous: { project: 'teajia', rel_path: 'Transcripts/recording/old.md' } }, client);
  assert.equal(result.rel_path, 'Transcripts/recording/new.md');
  assert.equal(writes.length, 2);
  assert.equal(Buffer.from(writes[0].body.content_base64, 'base64').toString(), markdown);
  assert.equal(writes[1].body.path, 'Transcripts/recording/old.md');
});
test('a changed or missing remote transcript never retires earlier export', async () => {
  const writes = [];
  const client = { get: async url => JSON.stringify(url.includes('/tree') ? { tree: { files: [], folders: [] } } : { content: 'wrong', kind: 'transcript' }), post: async (url, body) => { writes.push(url); return JSON.stringify({ rel_path: 'Transcripts/recording/new.md' }); } };
  await assert.rejects(runRequest({ ...request, previous: { project: 'teajia', rel_path: 'Transcripts/recording/old.md' } }, client), /verification failed/);
  assert.equal(writes.length, 1);
});
test('retry after lost upload response finds content hash filename without uploading again', async () => {
  let name;
  await runRequest(request, { get: async url => JSON.stringify(url.includes('/tree') ? { tree: { files: [], folders: [] } } : { content: '# Tea\n\nAdrian: Hello.', kind: 'transcript' }), post: async (url, body) => { name = body.file_name; return JSON.stringify({ rel_path: `Transcripts/recording/${name}` }); } });
  await runRequest(request, { get: async url => JSON.stringify(url.includes('/tree') ? { tree: { files: [{ rel_path: `Transcripts/recording/${name}` }], folders: [] } } : { content: '# Tea\n\nAdrian: Hello.', kind: 'transcript' }), post: () => { throw Error('duplicate upload'); } });
});

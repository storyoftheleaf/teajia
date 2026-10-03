import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
export async function runRequest(request, client) {
  const { config } = request, project = config.project || 'teajia';
  const get = async url => { request.stage = 'GET ' + url.split('?')[0]; return JSON.parse(await client.get(url)); };
  const post = async (url, body, method) => { request.stage = (method || 'POST') + ' ' + url; return JSON.parse(await client.post(url, body, method)); };
  if (request.action === 'connect') {
    const data = await get('/api/v1/projects/' + encodeURIComponent(project));
    const p = data.data.project;
    const chips = typeof p.launch_chips === 'string' ? JSON.parse(p.launch_chips) : (p.launch_chips || []);
    const next = chips.filter(c => c.label !== 'Transcribe');
    next.push({ label: 'Transcribe', kind: 'web', url: config.workshopUrl });
    await post('/api/v1/projects/' + encodeURIComponent(p.id), { launch_chips: next }, 'PATCH');
    const verified = await get('/api/v1/projects/' + encodeURIComponent(p.id));
    const recorded = verified.data.project.launch_chips;
    if (!JSON.stringify(recorded).includes(config.workshopUrl)) throw Error('i64 OS launcher link was not recorded.');
    return { connected: true, project, workshopUrl: config.workshopUrl };
  }
  const hash = createHash('sha256').update(request.markdown).digest('hex');
  const folder = `${config.folder || 'Transcripts'}/${request.job.id}`;
  const title = request.job.story.replace(/[^\p{L}\p{N} ._-]/gu, '-').slice(0, 100) || 'Transcript';
  const name = `${title}--${hash.slice(0, 16)}.md`;
  const query = rel => '?project=' + encodeURIComponent(project) + '&path=' + encodeURIComponent(rel);
  const tree = await get('/api/v1/wf/sources/tree?project=' + encodeURIComponent(project));
  const all = node => [...(node.files || []), ...(node.folders || []).flatMap(all)];
  let rel = all(tree.tree).find(f => f.rel_path === `${folder}/${name}`)?.rel_path;
  const desired = request.markdown;
  if (!rel) {
    const saved = await post('/api/v1/wf/sources/file', { project, folder, file_name: name, content_base64: Buffer.from(desired).toString('base64') });
    rel = saved.rel_path;
  }
  const read = await get('/api/v1/wf/sources/read' + query(rel));
  // The read endpoint returns the body with frontmatter stripped. Confirm exact text before retiring an earlier version.
  const body = desired.replace(/^---\n[\s\S]*?\n---\n?/, '').trim();
  if (read.content !== body || read.kind !== 'transcript') throw Error('i64 OS transcript verification failed. Local Markdown remains available.');
  const previous = request.previous;
  if (previous?.project === project && previous?.rel_path && previous.rel_path !== rel && previous.rel_path.startsWith(folder + '/')) {
    // Old working names/text stay recoverable in the shelf archive.
    try { await post('/api/v1/wf/sources/archive', { project, path: previous.rel_path }); }
    catch { return { project, rel_path: rel, hash, archiveWarning: 'Previous version could not be archived; both versions remain safe.' }; }
  }
  return { project, rel_path: rel, hash, url: 'https://i64os.com/studio/study?project=' + encodeURIComponent(project) };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url) && process.argv[2]) {
  let request;
  try {
    request = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
    const module = await import(pathToFileURL(path.join(request.config.repoRoot, 'apps/mcp/src/i64os-client.ts')));
    const cfg = module.loadConfig();
    const result = await runRequest(request, { get: url => module.getJsonText(cfg, url), post: (url, body, method) => module.postJsonText(cfg, url, body, method) });
    console.log('MAG_I64_RESULT ' + JSON.stringify(result));
  } catch (error) {
    let diagnostic;
    // Only the application's structured source error; never auth/Infisical output.
    if (request?.stage === 'POST /api/v1/wf/sources/file' && error.message.startsWith('500 ')) {
      try { if (JSON.parse(error.message.slice(error.message.indexOf('{'))).error?.message?.startsWith('EACCES:')) diagnostic = 'The Teajia source shelf is not writable by the i64 OS service.'; } catch {}
    }
    console.log('MAG_I64_RESULT ' + JSON.stringify({ error: `i64 OS sync failed at ${request?.stage || 'authentication'}${/^\d{3} /.test(error.message) ? ' (HTTP ' + error.message.slice(0,3) + ')' : ''}. Local transcript is safe; retry export.`, diagnostic })); process.exitCode = 1;
  }
}

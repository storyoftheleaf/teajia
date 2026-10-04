// Durable, detached local jobs: the workshop can restart without losing a recording.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readConfig, atomicJson, runIntake, safeStory } from './intake.mjs';
import { readableTranscript, markdownTranscript, writeWorkingOutputs, reviewEligibility } from './outputs.mjs';
export { readableTranscript } from './outputs.mjs';
import { transcriptPage } from './workshop-ui.mjs';
import { translateTranscript, translationStatus, loadTranslation, translatedMarkdown, translationLanguage, translationSourceDigest } from './translation.mjs';
const here = path.dirname(fileURLToPath(import.meta.url));
const alive = pid => { try { process.kill(pid, 0); return true; } catch { return false; } };
const root = config => path.join(config.magFiles, '.transcription-jobs');
const jobFile = (config, id) => {
  if (!/^[a-f0-9-]{36}$/.test(id)) throw new Error('Unknown job');
  return path.join(root(config), `${id}.json`);
};
function dispatch(config, job) {
  fs.mkdirSync(root(config), { recursive: true, mode: 0o700 });
  atomicJson(jobFile(config, job.id), job);
  const log = fs.openSync(path.join(root(config), `${job.id}.log`), 'a', 0o600);
  try {
    const child = spawn(process.execPath, [fileURLToPath(import.meta.url), 'run', job.id], { detached: true, stdio: ['ignore', log, log], env: process.env });
    child.on('error', error => {
      job.state = 'failed'; job.error = error.message; atomicJson(jobFile(config, job.id), job);
    });
    child.unref();
  } finally { fs.closeSync(log); }
}
export function startLocalIntake(story, file, options = {}) {
  const config = readConfig();
  const job = { id: randomUUID(), story: safeStory(story), file: path.basename(file), source: path.resolve(file), originalSource: path.resolve(file), state: 'running', stage: 'queued', started: new Date().toISOString(), ...options };
  dispatch(config, job);
  return job.id;
}
function readJob(config, id) {
  const file = jobFile(config, id);
  const job = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (job.state === 'running' && ((job.pid && !alive(job.pid)) || (!job.pid && Date.now() - Date.parse(job.started) > 60000))) {
    job.state = 'failed'; job.error = 'Processing was interrupted. Retry resumes the saved stages.'; atomicJson(file, job);
  }
  let progress;
  if (job.output) {
    try { progress = JSON.parse(fs.readFileSync(path.join(job.output, 'progress.json'), 'utf8')); } catch {}
  }
  return { ...job, stage: job.state === 'running' && job.stage !== 'filing' ? (progress && Date.parse(progress.updated_at) >= Date.parse(job.started) ? progress.stage : job.stage) : job.stage };
}
export async function waitForLocalIntake(id) {
  const config = readConfig();
  while (true) {
    const job = readJob(config, id);
    if (job.state === 'done') return job;
    if (job.state === 'failed') throw new Error(job.error || 'Local transcription failed.');
    await new Promise(resolve => setTimeout(resolve, 500));
  }
}
export function localJobs() {
  const config = readConfig();
  try {
    return fs.readdirSync(root(config)).filter(n => /^[a-f0-9-]{36}\.json$/.test(n))
      .map(n => readJob(config, n.slice(0, -5))).sort((a, b) => b.started.localeCompare(a.started));
  } catch { return []; }
}
const publicJob = job => ({ id: job.id, story: job.story, file: job.file, state: job.state, stage: job.stage, error: job.error, started: job.started, transcriptReady: !!job.transcriptReady, translations: job.transcriptReady ? translationStatus(job,JSON.parse(fs.readFileSync(path.join(job.output,'transcript.json'),'utf8'))) : [], ...(job.export ? { export: job.export } : {}) });
const send = (res, status, data) => { res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(data)); };
async function body(req) {
  let value = '';
  for await (const chunk of req) { value += chunk; if (value.length > 16000) throw new Error('Request too large'); }
  return JSON.parse(value);
}
export function serveAudio(req, res, file) {
  const size = fs.statSync(file).size;
  const types = { '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.aac': 'audio/aac', '.wav': 'audio/wav', '.ogg': 'audio/ogg', '.opus': 'audio/ogg', '.flac': 'audio/flac', '.mp4': 'video/mp4', '.mov': 'video/quicktime', '.webm': 'video/webm' };
  const headers = { 'Content-Type': types[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store', 'Accept-Ranges': 'bytes' };
  let start = 0, end = size - 1;
  if (req.headers.range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
    if (!match || (!match[1] && !match[2])) { res.writeHead(416, { ...headers, 'Content-Range': `bytes */${size}` }); res.end(); return; }
    if (!match[1]) start = Math.max(0, size - Number(match[2]));
    else { start = Number(match[1]); if (match[2]) end = Math.min(end, Number(match[2])); }
    if (start > end || start >= size || !Number.isSafeInteger(start) || !Number.isSafeInteger(end)) { res.writeHead(416, { ...headers, 'Content-Range': `bytes */${size}` }); res.end(); return; }
    headers['Content-Range'] = `bytes ${start}-${end}/${size}`;
  }
  res.writeHead(req.headers.range ? 206 : 200, { ...headers, 'Content-Length': Math.max(0, end - start + 1) });
  if (!size) { res.end(); return; }
  const stream = fs.createReadStream(file, { start, end });
  stream.on('error', () => res.destroy()); res.on('close', () => stream.destroy()); stream.pipe(res);
}
export async function handleLocalRoute(req, res, url) {
  const match = url.pathname.match(/^\/transcription\/([a-f0-9-]{36})(?:\/(view|retry|export-retry|translate|speakers|segment|review|audio|(?:transcript|translation)\.(?:json|txt|md)))?$/);
  if (!match) return false;
  try {
    const config = readConfig(), id = match[1], action = match[2] || '';
    const job = readJob(config, id);
    if (req.method === 'POST') {
      if (req.headers.origin && req.headers.origin !== `http://${req.headers.host}`) { send(res, 403, { error: 'not from this page' }); return true; }
      if (action === 'translate') {
        if (job.state !== 'done' || !job.transcriptReady) throw new Error('Transcript is not ready.');
        const input = await body(req), language = translationLanguage(input.language);
        const result = JSON.parse(fs.readFileSync(path.join(job.output,'transcript.json'),'utf8'));
        if (translationStatus(job,result).some(t => t.state === 'running' || t.state === 'queued')) { send(res,409,{error:'A translation is already running. Wait for it to finish.'}); return true; }
        const stateFile=path.join(job.output,'translations',`${language}.state.json`);
        fs.mkdirSync(path.dirname(stateFile),{recursive:true});
        atomicJson(stateFile,{language,state:'queued',sourceDigest:translationSourceDigest(result),completed:0,total:result.segments.length,updatedAt:new Date().toISOString()});
        const log=fs.openSync(path.join(job.output,'translations',`${language}.log`),'a',0o600);
        try {
          const child=spawn(process.execPath,[fileURLToPath(import.meta.url),'translate',id,language],{detached:true,stdio:['ignore',log,log],env:process.env});
          child.on('error',error=>atomicJson(stateFile,{language,state:'failed',error:error.message,sourceDigest:translationSourceDigest(result)}));child.unref();
        } finally {fs.closeSync(log);}
        send(res,202,{job:publicJob(job)});return true;
      }
      if (action === 'retry') {
        if (job.state !== 'failed') { send(res, 409, { error: 'Only failed jobs can be retried.' }); return true; }
        job.state = 'running'; job.stage = 'queued'; job.started = new Date().toISOString(); delete job.error; delete job.pid;
        dispatch(config, job); send(res, 202, { job: publicJob(job) }); return true;
      }
      if (action === 'export-retry') {
        if (job.state !== 'done' || !job.transcriptReady || !config.i64Export?.enabled) throw new Error('Export is not available.');
        const result = JSON.parse(fs.readFileSync(path.join(job.output, 'transcript.json'), 'utf8'));
        await writeWorkingOutputs(job, result, config); atomicJson(jobFile(config, id), job);
        send(res, 200, { job: publicJob(job), result }); return true;
      }
      if (action === 'speakers' || action === 'segment' || action === 'review') {
        if (job.state !== 'done' || !job.transcriptReady) throw new Error('Transcript is not ready.');
        const resultFile = path.join(job.output, 'transcript.json');
        const result = JSON.parse(fs.readFileSync(resultFile, 'utf8'));
        const input = await body(req);
        if (action === 'review') {
          if (input.confirmed !== true || !reviewEligibility(result)) throw new Error('Name every speaker and resolve unattributed segments before confirming review.');
          result.metadata = { ...result.metadata, review: { status: 'reviewed', reviewedAt: new Date().toISOString() } };
        } else if (action === 'segment') {
          const segment = result.segments?.[input.index];
          if (!Number.isInteger(input.index) || !segment || typeof input.text !== 'string' || !input.text.trim() || input.text.length > 12000 || typeof input.speaker !== 'string' || (input.speaker && !result.speakers.some(s => s.id === input.speaker))) throw new Error('Invalid transcript correction.');
          const speaker = input.speaker || null, text = input.text.trim();
          if (segment.speaker !== speaker || segment.text !== text) {
            if (segment.text !== text) {
              // Original alignment stays in transcribe.json; edited text has no proven word alignment.
              segment.words = [];
              segment.word_timestamps_status = 'invalidated_by_text_edit';
            } else {
              for (const word of segment.words || []) word.speaker = speaker;
            }
            segment.speaker = speaker; segment.text = text;
            result.metadata = { ...result.metadata, review: { status: 'unreviewed', reviewedAt: null } };
          }
        } else {
          let changed = false;
          if (!input.names || typeof input.names !== 'object' || Array.isArray(input.names)) throw new Error('Expected speaker names.');
          for (const [id, name] of Object.entries(input.names)) {
            const speaker = result.speakers.find(s => s.id === id);
            if (!speaker || typeof name !== 'string' || name.length > 120 || /[\x00-\x1f]/.test(name)) throw new Error('Invalid speaker name.');
            const value = name.trim() || null;
            changed ||= speaker.name !== value;
            speaker.name = value;
          }
          if (changed) result.metadata = { ...result.metadata, review: { status: 'unreviewed', reviewedAt: null } };
        }
        atomicJson(resultFile, result);
        await writeWorkingOutputs(job, result, config);
        atomicJson(jobFile(config, id), job);
        send(res, 200, { job: publicJob(job), result }); return true;
      }
      send(res, 404, { error: 'Unknown action' }); return true;
    }
    if (req.method !== 'GET') { send(res, 405, { error: 'Method not allowed' }); return true; }
    if (action === 'audio') {
      if (!job.source || !job.transcriptReady) throw new Error('Recording is not ready.');
      serveAudio(req, res, job.source); return true;
    }
    let result;
    if (job.transcriptReady) result = JSON.parse(fs.readFileSync(path.join(job.output, 'transcript.json'), 'utf8'));
    if (action === 'view') {
      const translation = url.searchParams.has('language') && result ? loadTranslation(job,result,url.searchParams.get('language')) : null;
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(transcriptPage(publicJob(job), result, translation));
    } else if (action.startsWith('translation.')) {
      if (!result) throw new Error('Transcript is not ready.');
      const translation=loadTranslation(job,result,url.searchParams.get('language'));
      if(!translation)throw new Error('Translation is not ready.');
      const extension=action.split('.').pop();
      res.writeHead(200,{'Content-Type':extension==='json'?'application/json; charset=utf-8':'text/plain; charset=utf-8','Cache-Control':'no-store','Content-Disposition':`attachment; filename*=UTF-8''${encodeURIComponent(`Transcript - ${job.story} - ${translation.language}.${extension}`)}`});
      res.end(extension==='json'?JSON.stringify(translation,null,2):extension==='md'?translatedMarkdown(job,translation,config):(translation.stale?'Original changed after translation; translate again to update.\n':'')+'Unreviewed machine translation. Timestamps refer to original audio.\n\n'+readableTranscript(translation));
    } else if (action === 'transcript.json' || action === 'transcript.txt' || action === 'transcript.md') {
      if (!result) throw new Error('Transcript is not ready.');
      res.writeHead(200, { 'Content-Type': action.endsWith('.json') ? 'application/json; charset=utf-8' : 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', 'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(`Transcript - ${job.story}.${action.split('.').pop()}`)}` });
      res.end(action.endsWith('.json') ? JSON.stringify(result, null, 2) : action.endsWith('.md') ? markdownTranscript(job, result, config) : readableTranscript(result));
    } else send(res, 200, { job: publicJob(job), ...(result ? { result } : {}) });
  } catch (error) { send(res, error.code === 'ENOENT' ? 404 : 400, { error: error.message }); }
  return true;
}
async function work(id) {
  const config = readConfig(), file = jobFile(config, id);
  const job = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (job.pid && alive(job.pid)) throw new Error('This job already has a worker.');
  job.pid = process.pid; atomicJson(file, job);
  // Serialize model jobs across uploads; waiting is handled by Node, never an LLM.
  const lock = path.join(root(config), 'model.lock');
  let acquired = false;
  try {
    while (!acquired) {
      try { fs.writeFileSync(lock, String(process.pid), { flag: 'wx', mode: 0o600 }); acquired = true; }
      catch (error) {
        if (error.code !== 'EEXIST') throw error;
        const owner = Number(fs.readFileSync(lock, 'utf8'));
        if ((owner && !alive(owner)) || (!owner && Date.now() - fs.statSync(lock).mtimeMs > 60000)) { fs.rmSync(lock, { force: true }); continue; }
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    await runIntake(config, job, () => atomicJson(file, job));
    job.state = 'done'; job.stage = 'complete'; delete job.error;
  } catch (error) { job.state = 'failed'; job.error = error.message; console.error(error); }
  finally {
    job.ended = new Date().toISOString(); atomicJson(file, job);
    if (acquired && fs.existsSync(lock) && Number(fs.readFileSync(lock, 'utf8')) === process.pid) fs.rmSync(lock);
  }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url) && process.argv[2] === 'run') await work(process.argv[3]);
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url) && process.argv[2] === 'translate') {
  const config=readConfig(),job=readJob(config,process.argv[3]),language=translationLanguage(process.argv[4]);
  const result=JSON.parse(fs.readFileSync(path.join(job.output,'transcript.json'),'utf8'));
  try {await translateTranscript(config,job,result,language);}
  catch(error){const file=path.join(job.output,'translations',`${language}.state.json`);let prior={};try{prior=JSON.parse(fs.readFileSync(file,'utf8'));}catch{} atomicJson(file,{...prior,language,state:'failed',error:error.message,sourceDigest:translationSourceDigest(result),updatedAt:new Date().toISOString()});}
}

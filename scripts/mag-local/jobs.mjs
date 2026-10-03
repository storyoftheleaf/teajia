// Durable, detached local jobs: the workshop can restart without losing a recording.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readConfig, atomicJson, runIntake, safeStory } from './intake.mjs';
import { transcriptPage } from './workshop-ui.mjs';
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
  return { ...job, stage: job.state === 'running' && job.stage !== 'filing' ? (progress?.stage || job.stage) : job.stage };
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
const publicJob = job => ({ id: job.id, story: job.story, file: job.file, state: job.state, stage: job.stage, error: job.error, started: job.started, transcriptReady: !!job.transcriptReady });
const send = (res, status, data) => { res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(data)); };
async function body(req) {
  let value = '';
  for await (const chunk of req) { value += chunk; if (value.length > 16000) throw new Error('Request too large'); }
  return JSON.parse(value);
}
export function readableTranscript(result) {
  const names = new Map(result.speakers.map((s, i) => [s.id, s.name || `Speaker ${i + 1}`]));
  const time = n => { n = Math.floor(n); return [Math.floor(n / 3600), Math.floor(n / 60) % 60, n % 60].map(x => String(x).padStart(2, '0')).join(':'); };
  return result.segments.map(s => `[${time(s.start)}] ${names.get(s.speaker) || 'Unassigned'}: ${s.text.trim()}`).join('\n') + '\n';
}
export async function handleLocalRoute(req, res, url) {
  const match = url.pathname.match(/^\/transcription\/([a-f0-9-]{36})(?:\/(view|retry|speakers|transcript\.json|transcript\.txt))?$/);
  if (!match) return false;
  try {
    const config = readConfig(), id = match[1], action = match[2] || '';
    const job = readJob(config, id);
    if (req.method === 'POST') {
      if (req.headers.origin && req.headers.origin !== `http://${req.headers.host}`) { send(res, 403, { error: 'not from this page' }); return true; }
      if (action === 'retry') {
        if (job.state !== 'failed') { send(res, 409, { error: 'Only failed jobs can be retried.' }); return true; }
        job.state = 'running'; job.stage = 'queued'; job.started = new Date().toISOString(); delete job.error; delete job.pid;
        dispatch(config, job); send(res, 202, { job: publicJob(job) }); return true;
      }
      if (action === 'speakers') {
        if (job.state !== 'done' || !job.transcriptReady) throw new Error('Transcript is not ready.');
        const resultFile = path.join(job.output, 'transcript.json');
        const result = JSON.parse(fs.readFileSync(resultFile, 'utf8'));
        const input = await body(req);
        if (!input.names || typeof input.names !== 'object' || Array.isArray(input.names)) throw new Error('Expected speaker names.');
        for (const [id, name] of Object.entries(input.names)) {
          const speaker = result.speakers.find(s => s.id === id);
          if (!speaker || typeof name !== 'string' || name.length > 120 || /[\x00-\x1f]/.test(name)) throw new Error('Invalid speaker name.');
          speaker.name = name.trim() || null;
        }
        atomicJson(resultFile, result);
        const textFile = path.join(job.output, 'transcript.txt');
        fs.writeFileSync(`${textFile}.part`, readableTranscript(result)); fs.renameSync(`${textFile}.part`, textFile);
        send(res, 200, { job: publicJob(job), result }); return true;
      }
      send(res, 404, { error: 'Unknown action' }); return true;
    }
    if (req.method !== 'GET') { send(res, 405, { error: 'Method not allowed' }); return true; }
    let result;
    if (job.transcriptReady) result = JSON.parse(fs.readFileSync(path.join(job.output, 'transcript.json'), 'utf8'));
    if (action === 'view') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(transcriptPage(publicJob(job), result));
    } else if (action === 'transcript.json' || action === 'transcript.txt') {
      if (!result) throw new Error('Transcript is not ready.');
      res.writeHead(200, { 'Content-Type': action.endsWith('.json') ? 'application/json; charset=utf-8' : 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(action.endsWith('.json') ? JSON.stringify(result, null, 2) : readableTranscript(result));
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

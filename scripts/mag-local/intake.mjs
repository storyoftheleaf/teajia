// Local model results enter the existing Mag RAW Inbox; RAW remains immutable.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { writeWorkingOutputs } from './outputs.mjs';

export const isMedia = file => /\.(m4a|mp3|wav|mov|mp4|aac|flac|ogg|opus|webm|mkv|aiff|aif|m4v)$/i.test(file);
export function safeStory(value) {
  const story = String(value).trim();
  if (!story || story === '.' || story === '..' || /^[.]/.test(story) || /[\/\\\x00-\x1f]/.test(story) || story.length > 120) throw new Error('Use a story name without slashes or control characters.');
  return story;
}
const configFile = () => path.join(path.dirname(fileURLToPath(import.meta.url)), 'config.json');
export const readConfig = () => JSON.parse(fs.readFileSync(process.env.MAG_LOCAL_CONFIG || configFile(), 'utf8'));
export function atomicJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const part = `${file}.${process.pid}.part`;
  fs.writeFileSync(part, JSON.stringify(value, null, 2) + '\n', { mode: 0o600 });
  fs.renameSync(part, file);
}
export function run(program, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(program, args, { stdio: 'inherit', ...options });
    child.on('error', reject);
    child.on('exit', (code, signal) => code === 0 ? resolve() : reject(new Error(`${path.basename(program)} stopped (${signal || code}). See the job log.`)));
  });
}
async function keep(source, folder) {
  const real = fs.realpathSync(source);
  const target = path.join(folder, path.basename(real));
  if (real === target) return target;
  if (fs.existsSync(target)) {
    // Never silently substitute another interview with the same filename.
    const digest = async file => { const hash = createHash('sha256'); for await (const chunk of fs.createReadStream(file)) hash.update(chunk); return hash.digest('hex'); };
    if (await digest(real) !== await digest(target)) throw new Error(`A different source named ${path.basename(real)} is already filed for this story.`);
  } else fs.copyFileSync(real, target, fs.constants.COPYFILE_EXCL);
  return target;
}
export function rawDocument(story, source, result, text, terms = '', note = '') {
  const scalar = v => JSON.stringify(v); // JSON quoted strings are valid YAML scalars.
  return `---\ntype: RAW\ntitle: ${scalar(story)}\nrecorded: ${scalar(new Date(fs.statSync(source).mtimeMs).toISOString().slice(0, 10))}\naudio: ${scalar(source)}\nphotos: ${scalar(path.join(path.dirname(source), 'Photos'))}\ncredit: Adrian Rasmussen\nlanguage: ${scalar(result.language || 'unknown')}\ntranscribed: ${scalar(`${new Date().toISOString().slice(0, 10)} locally; ${result.metadata?.asr_adapter || 'Whisper Large V3 MLX'}; ${result.metadata?.diarization_adapter || 'local diarization'}`)}\n${terms}---\n\n# RAW – ${story}\n\nMachine transcript, preserved as first produced. Speaker labels are automatic; names and corrections belong in SRC. Every quote is checked against this record.\n\n## Interview\n\n${text.trim()}\n${note ? `\n## Adrian's voice note\n\n${note.trim()}\n` : ''}`;
}
export async function runIntake(config, job, save = () => {}) {
  const story = safeStory(job.story);
  if (!isMedia(job.source)) {
    await run('bash', [config.legacyIntake, story, job.source], { env: { ...process.env, MAG_LOCAL_LEGACY: '1' } });
    return;
  }
  const raw = path.join(config.magVault, 'Workflow/0-Inbox', `RAW - ${story}.md`);
  if (fs.existsSync(raw)) {
    if (job.raw === raw && job.rawCandidateSha256 && createHash('sha256').update(fs.readFileSync(raw)).digest('hex') === job.rawCandidateSha256) {
      await writeWorkingOutputs(job, JSON.parse(fs.readFileSync(path.join(job.output, 'transcript.json'), 'utf8')), config);
      job.transcriptReady = true; save(); return; // recover a crash just after atomic publication
    }
    throw new Error('RAW already exists. Choose another story name; RAW is never overwritten.');
  }
  if (!fs.existsSync(path.dirname(raw))) throw new Error('Magazine Inbox is unavailable. Check MAG_VAULT.');
  const folder = path.join(config.magFiles, story);
  fs.mkdirSync(path.join(folder, 'Photos'), { recursive: true });
  const source = await keep(job.source, folder);
  job.source = source;
  job.output = path.join(folder, 'Transcription', job.id);
  save(); // source path persists before processing, so retry never depends on Drop.
  const processFile = async (input, output, language, prompt = '') => {
    // Vocabulary can change between retries; retain the ASR prompt used by this job.
    const manifest = path.join(output, 'job.json');
    if (fs.existsSync(manifest)) prompt = JSON.parse(fs.readFileSync(manifest, 'utf8')).prompt || '';
    const args = ['-m', 'transcription', 'process', input, '--output', output];
    if (language && language !== 'auto') args.push('--language', language);
    if (prompt) args.push('--prompt', prompt);
    try {
      await run(config.python, args, { cwd: config.repoRoot, env: { ...process.env, PYTHONUNBUFFERED: '1', PYANNOTE_METRICS_ENABLED: '0' } });
    } catch (error) {
      let progress; try { progress = JSON.parse(fs.readFileSync(path.join(output, 'progress.json'), 'utf8')); } catch {}
      throw new Error(progress?.error || error.message);
    }
    return { result: JSON.parse(fs.readFileSync(path.join(output, 'transcript.json'), 'utf8')), text: fs.readFileSync(path.join(output, 'transcript.txt'), 'utf8') };
  };
  let prompt = '';
  if (config.teaTerms && fs.existsSync(config.teaTerms)) {
    const args = [path.join(config.buildsDir, 'tea-terms.mjs'), '--prompt', '--lang', job.language === 'zh' ? 'zh' : 'en'];
    if (job.terms) args.push('--terms', job.terms);
    prompt = execFileSync(process.execPath, args, { encoding: 'utf8', env: { ...process.env, TEA_TERMS_FILE: config.teaTerms } }).trim();
  }
  const { result, text } = await processFile(source, job.output, job.language, prompt);
  if (!result.segments?.length || !text.trim()) throw new Error('No speech was found. Source has been kept for retry.');
  let note = '';
  if (job.note) {
    job.note = await keep(job.note, folder); save();
    note = (await processFile(job.note, path.join(job.output, 'voice-note'), 'auto')).text;
  }
  let terms = '';
  if (config.teaTerms && fs.existsSync(config.teaTerms)) {
    terms = execFileSync(process.execPath, [path.join(config.buildsDir, 'tea-terms.mjs'), '--scan', path.join(job.output, 'transcript.txt')], {
      encoding: 'utf8', env: { ...process.env, TEA_TERMS_FILE: config.teaTerms },
    });
  }
  job.stage = 'filing'; save();
  const document = rawDocument(story, source, result, text, terms, note);
  job.raw = raw; job.rawCandidateSha256 = createHash('sha256').update(document).digest('hex'); save();
  const temporary = `${raw}.${job.id}.part`;
  fs.writeFileSync(temporary, document, { mode: 0o600 });
  try { fs.linkSync(temporary, raw); } finally { fs.rmSync(temporary, { force: true }); }
  // The hard link atomically publishes complete bytes and refuses existing RAW.
  await writeWorkingOutputs(job, result, config);
  job.transcriptReady = true; save();
  // Source is safely filed AND RAW exists before clearing a Drop copy.
  if ((config.magDrops || []).some(d => path.resolve(d) === path.dirname(path.resolve(job.originalSource || '')))) {
    if (job.originalSource !== source) fs.rmSync(job.originalSource, { force: true });
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv[2] === '--legacy-cli') {
    const config = readConfig();
    const args = process.argv.slice(3), positional = [], opts = {};
    for (let i = 0; i < args.length; i++) {
      if (args[i] === '--lang' || args[i] === '--terms') opts[args[i].slice(2)] = args[++i];
      else positional.push(args[i]);
    }
    if (positional.length < 2 || !isMedia(positional[1])) {
      await run('bash', [config.legacyIntake, ...args], { env: { ...process.env, MAG_LOCAL_LEGACY: '1' } });
    } else {
      const { startLocalIntake, waitForLocalIntake } = await import('./jobs.mjs');
      const id = startLocalIntake(positional[0], positional[1], { language: opts.lang, terms: opts.terms, note: positional[2] });
      console.log(`Local intake queued: ${id}. Progress and transcript: http://localhost:8766/transcription/${id}/view`);
      try { await waitForLocalIntake(id); } catch (error) { console.error(error.message); process.exitCode = 1; }
    }
  }
}

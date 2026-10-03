import crypto from 'node:crypto';

export const PATCH_VERSION = 'mag-local-v1';
export const sourceHash = source => crypto.createHash('sha256').update(source).digest('hex');
const media = /\.(?:m4a|mp3|wav|mov|mp4|aac|flac|ogg|opus|aiff?|wma|webm|mkv|mpeg|mpg|m4v|caf|3gp)$/i;
export function intakeStory(story, file) { return story || (media.test(file) ? file.replace(/\.[^.]+$/, '').replace(/[\/\\]/g, '-').slice(0,80) : ''); }

function replaceOnce(source, before, after) {
  const count = source.split(before).length - 1;
  if (count !== 1) throw Error(`Workshop source changed: expected one anchor, found ${count}: ${before.slice(0,70)}`);
  return source.replace(before, after);
}

export function patchWorkshop(source) {
  if (source.includes(`// ${PATCH_VERSION}`)) return source;
  let patched = replaceOnce(source, "import os from 'os';", `import os from 'os';\n// ${PATCH_VERSION}\nimport { startLocalIntake, localJobs, handleLocalRoute } from './mag-local/jobs.mjs';\nimport { renderLocalJob, LOCAL_JOB_JS, LOCAL_TRANSCRIPT_CSS } from './mag-local/workshop-ui.mjs';`);
  const start = patched.indexOf("const JOBS = '/tmp/mag-intake-jobs';");
  const end = patched.indexOf('// A drop zone like Google Drive:', start);
  if (start < 0 || end < 0) throw Error('Workshop source changed: missing intake block');
  patched = patched.slice(0,start) + `const MAX_UPLOAD = 4 * 1024 ** 3;\nconst startIntake = startLocalIntake;\nconst jobs = localJobs;\n` + patched.slice(end);
  const rowStart = patched.indexOf('    ...js.map(j =>');
  const rowEnd = patched.indexOf('\n    ...drops.filter',rowStart);
  if (rowStart < 0 || rowEnd < 0) throw Error('Workshop source changed: missing coming-in rows');
  patched = patched.slice(0,rowStart) + '    ...js.map(renderLocalJob),' + patched.slice(rowEnd);
  patched = replaceOnce(patched, "const running = new Set(js.filter(j => j.state === 'running').map(j => j.file));", "const running = new Set(js.map(j => j.file));");
  patched = replaceOnce(patched, "const CSS = `:root", "const CSS = LOCAL_TRANSCRIPT_CSS + `:root");
  patched = replaceOnce(patched, 'const JS = `', 'const JS = LOCAL_JOB_JS + `');
  patched = replaceOnce(patched, "  const url = new URL(req.url, 'http://x');", "  const url = new URL(req.url, 'http://x');\n  if (await handleLocalRoute(req, res, url)) return;");
  patched = replaceOnce(patched, "        const job = story ? startIntake(story, dest) : '';", `        const automaticStory = /\\.(?:m4a|mp3|wav|mov|mp4|aac|flac|ogg|opus|aiff?|wma|webm|mkv|mpeg|mpg|m4v|caf|3gp)$/i.test(dest) ? path.basename(dest, path.extname(dest)).slice(0, 80) : '';\n        const job = story || automaticStory ? startIntake(story || automaticStory, dest) : '';`);
  patched = replaceOnce(patched, 'Story name, for a single file (optional): I start on it straight away', 'Story name, for a single file (optional): recordings start automatically');
  patched = replaceOnce(patched, "let failed=0;", "let failed=0,takingIn=0;");
  patched = replaceOnce(patched, "(story?'Uploaded. Taking it in now.':'Uploaded. They are in the drop folder.')", "(takingIn?'Uploaded. Transcribing locally now.':'Uploaded. They are in the drop folder.')");
  patched = replaceOnce(patched, "if(res.ok){st.textContent='done';fill.style.width='100%'}", "if(res.ok){if(res.job)takingIn++;st.textContent=res.job?'transcribing locally':'done';fill.style.width='100%'}");
  return patched;
}

export function patchLegacyIntake(source) {
  if (source.includes(`# ${PATCH_VERSION}`)) return source;
  return replaceOnce(source, 'set -euo pipefail\n', `set -euo pipefail\n\n# ${PATCH_VERSION}: one local engine for workshop uploads and /mag.\nif [[ "\u0024{MAG_LOCAL_LEGACY:-0}" != "1" && -f "$HOME/builds/mag-local/intake.mjs" ]]; then\n  exec node "$HOME/builds/mag-local/intake.mjs" --legacy-cli "$@"\nfi\n`);
}

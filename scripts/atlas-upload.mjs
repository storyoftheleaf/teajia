#!/usr/bin/env node
// Tea Atlas upload: sync the web package into the private R2 bucket the Worker
// reads, uploading only what changed. Contract: docs/TEA_ATLAS.md.
//
//   npm run atlas:upload                     upload what changed (remote bucket)
//   npm run atlas:upload -- --dry-run        say what would change, upload nothing
//   npm run atlas:upload -- --local          fill the local sandbox bucket instead
//   npm run atlas:upload -- --export <dir>   a package somewhere else
//   npm run atlas:upload -- --index-only     only the built index and search files
//
// "Changed" is by content hash, remembered in `_atlas-upload-state.json` inside
// the bucket (and cached on this machine), so a rerun after `tea-atlas` sends
// only the new issues. Uploads go through `wrangler r2 bulk put`, in batches, and
// the state is saved after every batch: an interrupted run resumes where it
// stopped. The raw package keys (`articles/`, `media/`) match
// ~/builds/tea-atlas-upload.sh, so the two never disagree about a file.

import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { createReadStream, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildAtlas } from './atlas-build.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const WORKER_DIR = join(ROOT, 'worker');
const BUCKET = 'teajia-atlas-private';
const STATE_KEY = '_atlas-upload-state.json';
const BATCH = 500;
// Cloudflare allows ~1,200 object API calls per 5 minutes per account, and each
// wrangler run paces itself only against its own calls. Pace across batches here.
const WINDOW_MS = 5 * 60 * 1000;
const WINDOW_CAP = 1000;
const RETRIES = 3;
const DEFAULT_EXPORT = join(homedir(), 'Documents/Files/2 Areas/Brands/Teajia/Reference/Tea wisdom/Atlas/_export');

const args = process.argv.slice(2);
const flag = name => args.includes(name);
const option = name => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const LOCAL = flag('--local');
const DRY = flag('--dry-run');
const INDEX_ONLY = flag('--index-only');
const EXPORT = resolve(option('--export') || DEFAULT_EXPORT);
const WHERE = LOCAL ? '--local' : '--remote';

const tty = process.stdout.isTTY;
const paint = code => s => (tty ? `\x1b[${code}m${s}\x1b[0m` : s);
const [green, red, cyan, dim, yellow] = [paint(32), paint(31), paint(36), paint(2), paint(33)];
const stage = s => console.log(cyan(`▶ ${s}`));
const ok = s => console.log(green(`✓ ${s}`));
const warn = s => console.log(yellow(`! ${s}`));
const die = s => { console.log(red(`✗ ${s}`)); process.exit(1); };

function wrangler(argv, { quiet = false } = {}) {
  return new Promise(resolvePromise => {
    const child = spawn('npx', ['wrangler', ...argv], { cwd: WORKER_DIR, env: process.env });
    let out = '';
    const onData = chunk => {
      const text = chunk.toString();
      out += text;
      if (quiet) return;
      for (const line of text.split('\n')) {
        if (line.trim() && !/Proxy environment variables/.test(line)) process.stdout.write(dim(`  ${line.trim()}\n`));
      }
    };
    child.stdout.on('data', onData);
    child.stderr.on('data', onData);
    child.on('close', code => resolvePromise({ code, out }));
  });
}

function hashFile(path) {
  return new Promise((res, rej) => {
    const h = createHash('sha1');
    createReadStream(path).on('data', d => h.update(d)).on('end', () => res(h.digest('hex'))).on('error', rej);
  });
}

const cacheFile = join(homedir(), '.config', 'teajia-atlas', `${BUCKET}${LOCAL ? '.local' : ''}.json`);

async function loadState(scratch) {
  if (existsSync(cacheFile)) {
    try { return JSON.parse(readFileSync(cacheFile, 'utf8')); } catch { /* fall through */ }
  }
  const target = join(scratch, 'state.json');
  const { code } = await wrangler(['r2', 'object', 'get', `${BUCKET}/${STATE_KEY}`, '--file', target, WHERE], { quiet: true });
  if (code === 0 && existsSync(target)) {
    try { return JSON.parse(readFileSync(target, 'utf8')); } catch { /* fall through */ }
  }
  return { files: {} };
}

function saveStateLocally(state) {
  mkdirSync(dirname(cacheFile), { recursive: true });
  writeFileSync(cacheFile, JSON.stringify(state));
}

async function main() {
  const started = Date.now();
  const scratch = mkdtempSync(join(process.env.TMPDIR || tmpdir(), 'teajia-atlas-'));
  try {
    if (!LOCAL) {
      stage('Checking the bucket is still private');
      const dev = await wrangler(['r2', 'bucket', 'dev-url', 'get', BUCKET], { quiet: true });
      if (!/disabled/i.test(dev.out)) die(`${BUCKET} has a public r2.dev address, or could not be checked. Refusing to upload.`);
      const dom = await wrangler(['r2', 'bucket', 'domain', 'list', BUCKET], { quiet: true });
      if (!/no custom domains/i.test(dom.out)) die(`${BUCKET} has a custom domain, or could not be checked. Refusing to upload.`);
      ok('Private: no public address, no custom domain');
    }

    stage(`Reading the package at ${EXPORT}`);
    const { objects, stats } = buildAtlas(EXPORT);
    ok(`${stats.articles} articles in ${stats.issues} issues, ${stats.topics} topics, ${stats.pictures} pictures, ${stats.terms} search words in ${stats.shards} shards`);

    stage('Finding what changed');
    const state = await loadState(scratch);
    const wanted = new Map();
    let built = 0;
    for (const o of objects) {
      let file = o.file;
      if (o.body !== undefined) {
        file = join(scratch, 'built', o.key);
        mkdirSync(dirname(file), { recursive: true });
        writeFileSync(file, o.body);
        built++;
      }
      wanted.set(o.key, { file, type: o.type, hash: await hashFile(file) });
    }
    // Files ~/builds/tea-atlas-upload.sh already sent land at the same keys.
    // Its ledger lists each as "<path> <size> <mtime>", written only after a
    // successful put; a package file that still matches its line is already in
    // the bucket, so it is recorded here instead of being sent twice.
    const ledgerPath = join(EXPORT, '..', '_build', 'uploaded.txt');
    let adopted = 0;
    if (!LOCAL && existsSync(ledgerPath)) {
      const ledger = new Set(readFileSync(ledgerPath, 'utf8').split('\n'));
      for (const [key, w] of wanted) {
        if (state.files[key] === w.hash || key.startsWith('index/')) continue;
        const st = statSync(w.file);
        if (ledger.has(`${relative(EXPORT, w.file)} ${st.size} ${Math.floor(st.mtimeMs / 1000)}`)) {
          state.files[key] = w.hash;
          adopted++;
        }
      }
      if (adopted) ok(`${adopted} files already sent by tea-atlas-upload, not sent again`);
    }
    const changed = [...wanted].filter(([key, w]) => state.files[key] !== w.hash && (!INDEX_ONLY || key.startsWith('index/')));
    const removed = INDEX_ONLY ? [] : Object.keys(state.files).filter(key => !wanted.has(key));
    const unchanged = [...wanted].filter(([key, w]) => state.files[key] === w.hash).length;
    ok(`${changed.length} to upload, ${removed.length} to remove, ${unchanged} unchanged${INDEX_ONLY ? ', package files skipped (--index-only)' : ''}`);

    if (DRY) {
      for (const [key] of changed.slice(0, 20)) console.log(dim(`  + ${key}`));
      if (changed.length > 20) console.log(dim(`  … and ${changed.length - 20} more`));
      for (const key of removed.slice(0, 20)) console.log(dim(`  - ${key}`));
      ok('Dry run: nothing uploaded');
      return;
    }

    // Index files last, so a reader never gets an index pointing at an article
    // or picture that has not landed yet.
    changed.sort(([a], [b]) => Number(a.startsWith('index/')) - Number(b.startsWith('index/')));
    const byType = new Map();
    for (const entry of changed) {
      const t = entry[1].type;
      if (!byType.has(t)) byType.set(t, []);
      byType.get(t).push(entry);
    }

    let done = 0;
    const sent = []; // [time, count] per batch, for the rolling rate window
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const waitForRoom = async count => {
      for (;;) {
        const now = Date.now();
        while (sent.length && now - sent[0][0] > WINDOW_MS) sent.shift();
        const used = sent.reduce((n, [, c]) => n + c, 0);
        if (used + count <= WINDOW_CAP) return;
        const wait = WINDOW_MS - (now - sent[0][0]) + 1000;
        console.log(dim(`  pausing ${Math.ceil(wait / 1000)}s for Cloudflare's rate limit`));
        await sleep(wait);
      }
    };
    for (const [type, entries] of [...byType].sort(([a], [b]) => Number(a === 'application/json') - Number(b === 'application/json'))) {
      for (let i = 0; i < entries.length; i += BATCH) {
        const batch = entries.slice(i, i + BATCH);
        const list = join(scratch, `batch-${done}.json`);
        writeFileSync(list, JSON.stringify(batch.map(([key, w]) => ({ key, file: w.file }))));
        stage(`Uploading ${batch.length} ${type === 'image/jpeg' ? 'pictures' : 'files'} (${done + batch.length} of ${changed.length})`);
        let code = 1;
        for (let attempt = 1; attempt <= RETRIES && code !== 0; attempt++) {
          if (!LOCAL) {
            if (attempt > 1) {
              console.log(dim(`  retrying (attempt ${attempt} of ${RETRIES}) after a full rate window`));
              sent.push([Date.now(), WINDOW_CAP]);
            }
            await waitForRoom(batch.length);
            sent.push([Date.now(), batch.length]);
          }
          ({ code } = await wrangler(['r2', 'bulk', 'put', BUCKET, '--filename', list, '--content-type', type, '--concurrency', '10', '--force', WHERE]));
        }
        if (code !== 0) {
          saveStateLocally(state);
          die(`Upload stopped at ${done} of ${changed.length}. Run it again to send only what is left.`);
        }
        for (const [key, w] of batch) state.files[key] = w.hash;
        done += batch.length;
        saveStateLocally(state);
      }
    }

    for (const key of removed) {
      const { code } = await wrangler(['r2', 'object', 'delete', `${BUCKET}/${key}`, WHERE], { quiet: true });
      if (code === 0) delete state.files[key];
      else warn(`could not remove ${key}; will retry next run`);
    }

    state.updatedAt = new Date().toISOString();
    saveStateLocally(state);
    const statePath = join(scratch, 'state-out.json');
    writeFileSync(statePath, JSON.stringify(state));
    const saved = await wrangler(['r2', 'object', 'put', `${BUCKET}/${STATE_KEY}`, '--file', statePath, '--content-type', 'application/json', WHERE], { quiet: true });
    if (saved.code !== 0) warn('could not save the upload record to the bucket; this machine still remembers it');

    ok(`Done in ${Math.round((Date.now() - started) / 1000)}s: ${changed.length} uploaded, ${removed.length} removed, bucket ${BUCKET}${LOCAL ? ' (local)' : ''}`);
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}

main().catch(err => die(err.message));

#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { patchWorkshop, patchLegacyIntake, sourceHash, PATCH_VERSION } from './workshop-patch.mjs';

const sourceDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(sourceDir, '../..');
const args = process.argv.slice(2);
function option(name, fallback) { const index = args.indexOf(name); if (index < 0) return fallback; if (!args[index+1] || args[index+1].startsWith('--')) throw Error(`Missing value for ${name}`); return path.resolve(args[index+1]); }
const buildsDir = option('--builds', path.join(os.homedir(),'builds'));
const python = option('--python', process.env.MAG_LOCAL_PYTHON || path.join(repoRoot,'.venv-transcription/bin/python'));
const destination = path.join(buildsDir,'mag-local');
const originals = { 'mag-preview.mjs':'eaa896c1a37b7bda4bb8e07d71b7483924141164973196412df66f82492a9103', 'mag-intake.sh':'9248a82cdf2d68aeb98aead9c7e06a58e8bf1886b3b65b5c668d01454e4f343e' };
const previous = fs.existsSync(path.join(destination,'install-manifest.json')) ? JSON.parse(fs.readFileSync(path.join(destination,'install-manifest.json'),'utf8')) : null;
const patches = Object.entries(originals).map(([name,originalHash]) => {
  const file = path.join(buildsDir,name), source=fs.readFileSync(file,'utf8'), hash=sourceHash(source);
  if (hash !== originalHash && hash !== previous?.files?.[name]?.installedHash) throw Error(`${name} changed since the reviewed version; refusing to overwrite it (${hash}).`);
  const patched = name.endsWith('.sh') ? patchLegacyIntake(source) : patchWorkshop(source);
  return {name,file,source,patched,originalHash,installedHash:sourceHash(patched)};
});

// Read the known assignment syntax without executing a user's shell configuration.
const shellConfig = fs.readFileSync(path.join(buildsDir,'mag-intake.config'),'utf8');
const values = {HOME:os.homedir()};
for (const match of shellConfig.matchAll(/\$\{([A-Z_]+):=([^}]*)\}/g)) {
  values[match[1]] = process.env[match[1]] || match[2].replace(/\$([A-Z_]+)/g,(_,name)=>values[name] || '');
}
const existingConfig = fs.existsSync(path.join(destination,'config.json')) ? JSON.parse(fs.readFileSync(path.join(destination,'config.json'),'utf8')) : {};
const config = {...existingConfig,repoRoot,python,buildsDir,magFiles:values.MAG_FILES,magVault:values.MAG_VAULT,teaTerms:values.TEA_TERMS,magDrops:(values.MAG_DROPS || '').split('|').map(s=>s.trim()).filter(Boolean),legacyIntake:path.join(buildsDir,'mag-intake.sh')};
if (!config.magFiles || !config.magVault) throw Error('mag-intake.config must define MAG_FILES and MAG_VAULT');
const modules = ['jobs.mjs','intake.mjs','workshop-ui.mjs','outputs.mjs','i64-export.mjs','i64-worker.mjs'];
for (const name of modules) if (!fs.existsSync(path.join(sourceDir,name))) throw Error(`Missing module: ${name}`);
for (const item of patches) {
  const temp = path.join(os.tmpdir(),`mag-local-check-${process.pid}${item.name.endsWith('.sh')?'.sh':'.mjs'}`);
  try {fs.writeFileSync(temp,item.patched);const check=spawnSync(item.name.endsWith('.sh')?'bash':process.execPath,[item.name.endsWith('.sh')?'-n':'--check',temp],{encoding:'utf8'});if(check.status!==0)throw Error(check.stderr||'Syntax check failed');} finally {fs.rmSync(temp,{force:true});}
}
if (!args.includes('--apply')) {
  console.log(JSON.stringify({mode:'dry-run',destination,config,files:patches.map(p=>({name:p.name,changed:p.source!==p.patched,sha256:p.installedHash})),next:'Run with --apply to install. Service restart and model installation are separate.'},null,2));
} else {
  if (!fs.existsSync(python)) throw Error(`Python environment does not exist: ${python}`);
  fs.mkdirSync(destination,{recursive:true});
  const stamp=new Date().toISOString().replace(/[:.]/g,'-');
  const writeAtomic=(file,content)=>{const temp=file+'.tmp-'+process.pid;fs.writeFileSync(temp,content);fs.renameSync(temp,file);};
  for (const name of modules) writeAtomic(path.join(destination,name),fs.readFileSync(path.join(sourceDir,name)));
  writeAtomic(path.join(destination,'config.json'),JSON.stringify(config,null,2)+'\n');
  const records={};
  for (const item of patches) {
    let backup=previous?.files?.[item.name]?.backup;
    if(item.source!==item.patched){backup=item.file+'.before-'+PATCH_VERSION+'-'+stamp;fs.copyFileSync(item.file,backup);writeAtomic(item.file,item.patched);if(item.name.endsWith('.sh'))fs.chmodSync(item.file,0o755);}
    records[item.name]={originalHash:item.originalHash,installedHash:item.installedHash,backup};
  }
  writeAtomic(path.join(destination,'install-manifest.json'),JSON.stringify({version:PATCH_VERSION,installedAt:new Date().toISOString(),files:records},null,2)+'\n');
  console.log(JSON.stringify({mode:'installed',destination,files:records,service:'Restart the existing preview service to load the integration.'},null,2));
}

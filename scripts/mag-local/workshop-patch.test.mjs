import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { spawnSync } from 'node:child_process';
import { patchWorkshop, patchLegacyIntake, intakeStory, sourceHash } from './workshop-patch.mjs';
import { renderTranscript, renderLocalJob, transcriptPage, LOCAL_JOB_JS, renderRecordings } from './workshop-ui.mjs';

const original = fs.readFileSync(new URL('./fixtures/mag-preview.original.mjs',import.meta.url),'utf8');
const shell = fs.readFileSync(new URL('./fixtures/mag-intake.original.sh',import.meta.url),'utf8');
test('reviewed workshop patch is syntactically valid, idempotent and keeps upload limits and original routes',()=>{
  assert.equal(sourceHash(original),'eaa896c1a37b7bda4bb8e07d71b7483924141164973196412df66f82492a9103');
  const result=patchWorkshop(original);
  assert.equal(patchWorkshop(result),result);
  assert.match(result,/const MAX_UPLOAD = 4 \* 1024 \*\* 3/);
  assert.match(result,/renderRecordings\(jobs\(\),remote\)/);
  assert.match(result,/if \(await handleLocalRoute\(req, res, url\)\) return/);
  assert.match(result,/size > MAX_UPLOAD/);
  assert.match(result,/url.pathname === '\/answer'/);
  assert.doesNotMatch(result,/\/tmp\/mag-intake-jobs|const lastLine/);
  const file=path.join(os.tmpdir(),`mag-patch-test-${process.pid}.mjs`);
  try {fs.writeFileSync(file,result);const check=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});assert.equal(check.status,0,check.stderr);} finally {fs.rmSync(file,{force:true});}
});
test('patch rejects changed anchors instead of silently partially patching',()=>assert.throws(()=>patchWorkshop(original.replace("import os from 'os';",'')),/expected one anchor/));
test('every media upload starts with its filename; unnamed text stays in Drop',()=>{
  for(const name of ['Interview.m4a','Tea.MP4','Part 2.flac','Voice.caf','Screen.webm'])assert.equal(intakeStory('',name),name.replace(/\.[^.]+$/,''));
  assert.equal(intakeStory('Chosen story','Clip.mp3'),'Chosen story');
  assert.equal(intakeStory('','Transcript.txt'),'');
  assert.equal(intakeStory('Transcript story','Transcript.md'),'Transcript story');
});
test('legacy shell dispatch remains syntax valid and bypassable',()=>{
  const result=patchLegacyIntake(shell);
  assert.equal(patchLegacyIntake(result),result);
  assert.match(result,/MAG_LOCAL_LEGACY:-0/);
  assert.match(result,/--legacy-cli "\$@"/);
  const check=spawnSync('bash',['-n'],{input:result,encoding:'utf8'});assert.equal(check.status,0,check.stderr);
});
test('transcript is readable with times, named speakers and escaped source text',()=>{
  const result={speakers:[{id:'SPEAKER_00',name:'Adrian <host>'}],segments:[{start:65,end:69,speaker:'SPEAKER_00',text:'Tea <script>alert(1)</script>'}]};
  const html=renderTranscript(result,{id:'test',story:'A & B',file:'Clip.m4a'});
  assert.match(html,/00:01:05–00:01:09/);
  assert.match(html,/Adrian &lt;host&gt;/);
  assert.match(html,/data-speaker="SPEAKER_00"/);
  assert.doesNotMatch(html,/<script>/);
  assert.match(html,/transcript\.txt/);
  assert.match(transcriptPage({id:'test',story:'A & B'},result),/<!doctype html>/);
});
test('coming-in rows expose progress, transcript and retry only in applicable states',()=>{
  assert.match(renderLocalJob({id:'1',story:'Tea',state:'running',stage:'Aligning words'}),/Aligning words/);
  assert.match(renderLocalJob({id:'1',story:'Tea',state:'done',transcriptReady:true}),/\/transcription\/1\/view/);
  assert.match(renderLocalJob({id:'1',story:'Tea',state:'failed',error:'model missing'}),/data-job-retry="1"/);
  assert.doesNotMatch(renderLocalJob({id:'1',story:'Tea',state:'done'}),/data-job-retry/);
});
test('running transcript page polls progress without offering missing downloads',()=>{
  const html=transcriptPage({id:'run',story:'Tea',state:'running',stage:'Identifying speakers'});
  assert.match(html,/data-local-job="run" data-state="running"/);
  assert.match(html,/Identifying speakers/);
  assert.doesNotMatch(html,/Download text|No speech was found/);
});
test('hostile names, ids and transcript text cannot create script or attribute tags',()=>{
  const attack='"><script>alert(1)</script>';
  const html=renderTranscript({speakers:[{id:attack,name:attack}],segments:[{speaker:attack,start:0,end:1,text:attack}]},{id:attack,story:attack,file:attack});
  assert.doesNotMatch(html,/<script>|data-speaker=""><|href="\/transcription\/">/);
  assert.match(html,/&lt;script&gt;/);
});

test('review UI has playback, named Markdown download, corrections and honest review gating',()=>{
  new vm.Script(LOCAL_JOB_JS);
  const result={speakers:[{id:'SPEAKER_00',name:null}],segments:[{start:3,end:5,speaker:'SPEAKER_00',text:'Text'}]};
  const html=renderTranscript(result,{id:'record',story:'Tea',export:{state:'failed',error:'Offline'}});
  assert.match(html,/data-recording-player controls/);
  assert.match(html,/data-audio-seek="3"/);
  assert.match(html,/transcript.md/);
  assert.match(html,/data-segment-form="record"/);
  assert.match(html,/Mark reviewed<\/button>/);
  assert.match(html,/type="submit" disabled>Mark reviewed/);
  assert.match(html,/data-export-retry="record"/);
  assert.match(html,/Saved locally; i64 OS export failed/);
});
test('studio exposes original and translated versions with separate downloads and safe stale state',()=>{
  const result={language:'zh',speakers:[{id:'SPEAKER_00',name:'Adrian'}],segments:[{start:0,end:2,speaker:'SPEAKER_00',text:'Original'}]};
  const html=renderTranscript(result,{id:'record',story:'Tea',translations:[{language:'en',state:'complete',stale:true}]},{...result,language:'en',stale:true});
  assert.match(html,/workspace-sidebar/);assert.match(html,/data-view="plain"/);assert.match(html,/data-view="segments"/);
  assert.match(html,/Translate &amp; save both|Translate & save both/);
  assert.match(html,/Original retained/);assert.match(html,/translation.md\?language=en/);assert.match(html,/transcript.md/);
  assert.match(html,/original changed after this translation/);
  assert.doesNotMatch(html,/data-segment-form/);
});
test('comparison pairs source and translation safely and is withheld when stale',()=>{
  const original={language:'zh',speakers:[{id:'SPEAKER_00',name:'Ada'}],segments:[{start:4,end:8,speaker:'SPEAKER_00',text:'原文 <safe>'}]};
  const translated={...original,language:'en',segments:[{...original.segments[0],text:'Translated <safe>'}]};
  const html=renderTranscript(original,{id:'compare',story:'Tea'},translated);
  assert.match(html,/data-view="compare"/);
  assert.match(html,/data-view-panel="compare"/);
  assert.match(html,/Original · zh/);
  assert.match(html,/原文 &lt;safe&gt;/);
  assert.match(html,/Translated &lt;safe&gt;/);
  assert.match(html,/data-search-text="Ada: 原文 &lt;safe&gt; Translated &lt;safe&gt;"/);
  assert.match(html,/data-copy-transcript/);
  assert.doesNotMatch(html,/data-segment-form/);
  assert.doesNotMatch(renderTranscript(original,{id:'compare'},{...translated,stale:true}),/data-view="compare"/);
});
test('recording drop and progress live separately from story approvals',()=>{
  const patched=patchWorkshop(original);
  const front=patched.slice(patched.indexOf('function frontPage(remote)'),patched.indexOf('// mag-transcription-page-v1'));
  assert.doesNotMatch(front,/\+ UPLOAD|dropSection|renderLocalJob/);
  assert.match(front,/href="\/transcription"/);
  const recordings=patched.slice(patched.indexOf('function transcriptionHome(remote)'),patched.indexOf('// ── Look:'));
  assert.match(recordings,/renderRecordings\(jobs\(\),remote\)/);
  assert.doesNotMatch(recordings,/section\('you'|card\(b/);
  assert.match(patched,/url.pathname === '\/transcription'/);
});

test('recording library presents state filters, one setup notice and escaped error details',()=>{
  const jobs=[
    {id:'ready',story:'Interview',state:'done',transcriptReady:true},
    {id:'busy',story:'Tea <audio>',state:'running',stage:'transcribe'},
    {id:'failed',story:'Part two',state:'failed',error:'Cannot access gated repo: you are not in the authorized list <secret>'}
  ];
  const html=renderRecordings(jobs);
  assert.match(html,/Choose audio or video files/);
  assert.match(html,/data-recording-filter="attention"/);
  assert.match(html,/data-recording-category="ready"/);
  assert.match(html,/data-recording-category="processing"/);
  assert.match(html,/Transcribing/);
  assert.equal(html.split('Speaker separation needs setup').length-1,1);
  assert.match(html,/Speaker model access required/);
  assert.match(html,/<summary>Error details<\/summary><p>Cannot access/);
  assert.match(html,/Tea &lt;audio&gt;/);
  assert.doesNotMatch(html,/<audio>|<secret>/);
  assert.doesNotMatch(renderRecordings([],true),/Open folder/);
  assert.match(renderRecordings([]),/Your transcripts will appear here/);
});

test('sparse model cluster IDs use the same displayed numbering as rename controls and exports',()=>{
  const html=renderTranscript({speakers:[{id:'SPEAKER_00',name:null},{id:'SPEAKER_07',name:null}],segments:[{start:0,end:1,speaker:'SPEAKER_07',text:'Sparse cluster'}]},{id:'sparse',story:'Check'});
  assert.match(html,/Speaker 2: /);
  assert.doesNotMatch(html,/Speaker 8:/);
});

test('multiple recorder files join by default and individual parts can be selected',()=>{
  const html=renderRecordings([{id:'abc',file:'part2.wav',story:'Part 2',state:'done',transcriptReady:true}]);
  assert.match(html,/data-join-upload checked/);
  assert.match(html,/data-join-recording="abc"/);
  assert.match(html,/data-join-form/);
  assert.match(LOCAL_JOB_JS,/defer=1/);
  assert.match(LOCAL_JOB_JS,/numeric:true/);
  assert.match(LOCAL_JOB_JS,/\/transcription\/join/);
});

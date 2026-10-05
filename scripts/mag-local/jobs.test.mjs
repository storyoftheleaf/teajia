import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { startLocalIntake, localJobs, handleLocalRoute, waitForLocalIntake } from './jobs.mjs';

test('detached intake survives the caller and exposes transcript, rename and immutable RAW', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mag-local-job-'));
  const prior = process.env.MAG_LOCAL_CONFIG;
  let server;
  try {
    const vault = path.join(dir,'vault'), files = path.join(dir,'files');
    fs.mkdirSync(path.join(vault,'Workflow/0-Inbox'),{recursive:true});
    fs.mkdirSync(path.join(files,'Drop'),{recursive:true});
    const fake = path.join(dir,'fake-python');
    fs.writeFileSync(fake, `#!/usr/bin/env python3\nimport json,sys,pathlib\nout=pathlib.Path(sys.argv[sys.argv.index('--output')+1]);out.mkdir(parents=True,exist_ok=True)\nresult={'language':'en','speakers':[{'id':'SPEAKER_00','name':None}],'segments':[{'speaker':'SPEAKER_00','start':3.12,'end':8.45,'text':'Synthetic test transcript.'}]}\n(out/'transcript.json').write_text(json.dumps(result))\n(out/'transcript.txt').write_text('[00:00:03] Speaker 1: Synthetic test transcript.\\n')\n(out/'progress.json').write_text(json.dumps({'stage':'complete','state':'completed'}))\n`,{mode:0o755});
    const config = path.join(dir,'config.json');
    fs.writeFileSync(config,JSON.stringify({repoRoot:dir,python:fake,magFiles:files,magVault:vault,magDrops:[path.join(files,'Drop')]}));
    process.env.MAG_LOCAL_CONFIG=config;
    const source=path.join(files,'Drop','test.m4a'); fs.writeFileSync(source,'synthetic bytes');
    const id=startLocalIntake('Synthetic test',source);
    let job;
    const deadline=Date.now()+5000;
    while(Date.now()<deadline){job=localJobs().find(j=>j.id===id);if(job?.state!=='running')break;await new Promise(r=>setTimeout(r,50));}
    assert.equal(job.state,'done',job.error);
    assert.equal((await waitForLocalIntake(id)).state,'done');
    assert.equal(fs.existsSync(source),false);
    assert.equal(fs.readFileSync(job.source,'utf8'),'synthetic bytes');
    assert.match(fs.readFileSync(path.join(job.output,'transcript.md'),'utf8'), /review_status: unreviewed/);
    const raw=fs.readFileSync(job.raw,'utf8');
    assert.ok(raw.includes('Synthetic test transcript.'));
    server=http.createServer(async(req,res)=>{if(req.url==='/api/generate'){res.writeHead(200,{'content-type':'application/json'});let body='';for await(const chunk of req)body+=chunk;const prompt=JSON.parse(JSON.parse(body).prompt);res.end(JSON.stringify({done:true,response:JSON.stringify({segments:prompt.segments.map(segment=>({id:segment.id,translated_text:'Transcripción de prueba.'}))})}));return;}if(!await handleLocalRoute(req,res,new URL(req.url,'http://localhost')))res.end('not found');});
    await new Promise(r=>server.listen(0,'127.0.0.1',r));
    const url=`http://127.0.0.1:${server.address().port}/transcription/${id}`;
    const updatedConfig=JSON.parse(fs.readFileSync(config));updatedConfig.translation={baseUrl:`http://127.0.0.1:${server.address().port}`,model:'qwen3:8b'};fs.writeFileSync(config,JSON.stringify(updatedConfig));
    let response=await fetch(url);assert.equal(response.status,200);
    assert.equal((await response.json()).result.speakers[0].name,null);
    response=await fetch(url+'/review',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({confirmed:true})});
    assert.equal(response.status,400);
    response=await fetch(url+'/speakers',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({names:{SPEAKER_00:'Adrian'}})});
    assert.equal(response.status,200);
    assert.equal((await response.json()).result.speakers[0].name,'Adrian');
    assert.ok((await(await fetch(url+'/transcript.txt')).text()).includes('Adrian:'));
    assert.match(fs.readFileSync(path.join(job.output,'transcript.md'),'utf8'), /Adrian/);
    response=await fetch(url+'/transcript.md'); assert.equal(response.status,200);
    assert.match(response.headers.get('content-disposition'), /Transcript%20-%20Synthetic%20test.md/);
    assert.match(await response.text(), /speaker_map:.*Adrian/);
    response=await fetch(url+'/audio',{headers:{range:'bytes=0-8'}});assert.equal(response.status,206);assert.equal(response.headers.get('content-range'),'bytes 0-8/15');assert.equal(await response.text(),'synthetic');
    response=await fetch(url+'/audio',{headers:{range:'bytes=-5'}});assert.equal(response.status,206);assert.equal(await response.text(),'bytes');
    response=await fetch(url+'/audio',{headers:{range:'bytes=100-200'}});assert.equal(response.status,416);
    response=await fetch(url+'/audio',{headers:{range:'bytes=0-1,4-5'}});assert.equal(response.status,416);
    response=await fetch(url+'/review',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({confirmed:false})});assert.equal(response.status,400);
    response=await fetch(url+'/review',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({confirmed:true})});assert.equal(response.status,200);assert.equal((await response.json()).result.metadata.review.status,'reviewed');
    assert.match(fs.readFileSync(path.join(job.output,'transcript.md'),'utf8'), /review_status: reviewed/);
    response=await fetch(url+'/speakers',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({names:{SPEAKER_00:'Adrian'}})});assert.equal((await response.json()).result.metadata.review.status,'reviewed');
    response=await fetch(url+'/segment',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({index:0,speaker:'SPEAKER_00',text:'Corrected test transcript.'})});assert.equal(response.status,200);assert.equal((await response.json()).result.metadata.review.status,'unreviewed');
    const corrected = (await (await fetch(url)).json()).result.segments[0];
    assert.deepEqual(corrected.words, []);
    assert.equal(corrected.word_timestamps_status, 'invalidated_by_text_edit');
    response=await fetch(url+'/review',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({confirmed:true})});assert.equal(response.status,200);
    response=await fetch(url+'/speakers',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({names:{SPEAKER_00:'Adrian R.'}})});assert.equal((await response.json()).result.metadata.review.status,'unreviewed');
    assert.equal(fs.readFileSync(job.raw,'utf8'),raw);
    response=await fetch(url+'/speakers',{method:'POST',headers:{origin:'https://other.example','content-type':'application/json'},body:'{}'});
    assert.equal(response.status,403);
    response=await fetch(url+'/retry',{method:'POST'});assert.equal(response.status,409);
    response=await fetch(url+'/view');assert.ok((await response.text()).includes('Adrian'));
    const beforeTranslation=fs.readFileSync(path.join(job.output,'transcript.json'),'utf8');
    response=await fetch(url+'/translate',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({language:'es'})});assert.equal(response.status,202);
    let translatedJob;
    for(let attempt=0;attempt<80;attempt++){translatedJob=(await(await fetch(url)).json()).job;if(translatedJob.translations.some(t=>t.state==='complete'))break;await new Promise(r=>setTimeout(r,50));}
    assert.equal(translatedJob.translations[0].state,'complete');
    response=await fetch(url+'/translation.md?language=es');assert.equal(response.status,200);assert.match(await response.text(),/Transcripción de prueba/);
    assert.equal(fs.readFileSync(path.join(job.output,'transcript.json'),'utf8'),beforeTranslation);
    assert.equal(fs.readFileSync(job.raw,'utf8'),raw);
    response=await fetch(url+'/view?language=es');assert.match(await response.text(),/Original retained/);
    response=await fetch(url+'/save',{method:'POST'});assert.equal(response.status,200);
    const saved=(await response.json()).saved;assert.equal(saved.state,'saved');assert.equal(saved.files.length,3);assert.equal(saved.excludedTranslations.length,0);
    assert.match(await(await fetch(new URL(saved.files[0].url,url))).text(),/Adrian R\./);
    assert.equal((await(await fetch(url)).json()).job.saved.savedAt,saved.savedAt);
    assert.equal(fs.readFileSync(job.raw,'utf8'),raw);
    response=await fetch(url+'/start',{method:'POST'});assert.equal(response.status,409);
    // A second source with this title fails without changing the existing quote record.
    fs.writeFileSync(source,'second source');const duplicate=startLocalIntake('Temporary staged title',source,{defer:true});
    assert.equal(localJobs().find(j=>j.id===duplicate).state,'saved');
    response=await fetch(`http://127.0.0.1:${server.address().port}/transcription/${duplicate}/start`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({story:'Synthetic test'})});
    assert.equal(response.status,202);assert.equal((await response.json()).job.story,'Synthetic test');
    while(Date.now()<deadline+5000){job=localJobs().find(j=>j.id===duplicate);if(job?.state!=='running')break;await new Promise(r=>setTimeout(r,50));}
    await assert.rejects(waitForLocalIntake(duplicate), /never overwritten/);
    assert.equal(job.state,'failed');assert.match(job.error,/never overwritten/);assert.equal(fs.readFileSync(job.raw || path.join(vault,'Workflow/0-Inbox/RAW - Synthetic test.md'),'utf8'),raw);
  } finally {
    if(server)await new Promise(r=>server.close(r));
    if(prior)process.env.MAG_LOCAL_CONFIG=prior;else delete process.env.MAG_LOCAL_CONFIG;
    fs.rmSync(dir,{recursive:true,force:true});
  }
});

test('recorder parts are ordered naturally by filename without mutating selection', async () => {
  const {orderConversationParts}=await import('./jobs.mjs');
  const parts=[{file:'TX00_MIC027_20261003_160859_orig.wav'},{file:'TX00_MIC025_20261003_150858_orig.wav'},{file:'TX00_MIC024_20261003_143858_orig.wav'},{file:'TX00_MIC026_20261003_153858_orig.wav'}];
  assert.deepEqual(orderConversationParts(parts).map(p=>p.file.match(/MIC\d+/)[0]),['MIC024','MIC025','MIC026','MIC027']);
  assert.match(parts[0].file,/MIC027/);
  assert.deepEqual(orderConversationParts([{file:'part10.wav'},{file:'part2.wav'}]).map(p=>p.file),['part2.wav','part10.wav']);
});

test('library metadata groups conversation parts and shows only available fresh languages', async () => {
  const { publicJob } = await import('./jobs.mjs');
  const { translationSourceDigest } = await import('./translation.mjs');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mag-library-metadata-'));
  try {
    const result = { language: 'zh', speakers: [{id:'SPEAKER_00',name:'Adrian'},{id:'SPEAKER_01',name:'Guest'}], segments: [{start:0,end:12,text:'茶',speaker:'SPEAKER_00'}], metadata: {duration_seconds:98,review:{status:'reviewed'}} };
    fs.mkdirSync(path.join(dir,'translations'));
    fs.writeFileSync(path.join(dir,'transcript.json'),JSON.stringify(result));
    const sourceDigest = translationSourceDigest(result);
    for (const [language,state,digest,version] of [['en','complete',sourceDigest,3],['es','complete','old',3],['fr','running',sourceDigest,3],['de','complete',sourceDigest,2],['it','complete',sourceDigest,3]]) {
      fs.writeFileSync(path.join(dir,'translations',language+'.state.json'),JSON.stringify({language,state,sourceDigest:digest,version,pid:process.pid}));
      if (language !== 'it') fs.writeFileSync(path.join(dir,'translation.'+language+'.json'),JSON.stringify({language,metadata:{translation:{sourceDigest:digest,version}}}));
    }
    const sourceJobs = ['11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222'];
    const saved = {state:'saved',savedAt:'2026-10-05T01:00:00Z',files:[]}, exported = {state:'failed',error:'Remote sync failed'};
    const data = publicJob({id:'33333333-3333-3333-3333-333333333333',story:'Conversation',file:'joined.wav',output:dir,source:'/private/original.wav',sourceJobs,transcriptReady:true,saved,export:exported,parts:[{source:'/private/part1.wav',start:0,end:12},{source:'/private/part2.wav',start:12,end:98}]});
    assert.equal(data.durationSeconds,98);assert.equal(data.speakerCount,2);assert.equal(data.reviewStatus,'reviewed');assert.equal(data.partCount,2);
    assert.deepEqual(data.availableLanguages,['zh','en']);assert.deepEqual(data.sourceJobs,sourceJobs);assert.deepEqual(data.saved,saved);assert.deepEqual(data.export,exported);
    assert.equal(data.parts[0].source,'part1.wav');assert.equal(data.output,undefined);assert.equal(data.source,undefined);
    delete result.metadata.duration_seconds;fs.writeFileSync(path.join(dir,'transcript.json'),JSON.stringify(result));assert.equal(publicJob({...data,output:dir}).durationSeconds,12);
    fs.rmSync(path.join(dir,'transcript.json'));assert.equal(publicJob({...data,output:dir}).transcriptReady,false);assert.match(publicJob({...data,output:dir}).transcriptError,/retained/);
  } finally {fs.rmSync(dir,{recursive:true,force:true});}
});

test('one missing transcript or malformed job does not remove the recording library', () => {
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mag-library-recovery-')), prior=process.env.MAG_LOCAL_CONFIG;
  try {
    fs.mkdirSync(path.join(dir,'.transcription-jobs'));const config=path.join(dir,'config.json');fs.writeFileSync(config,JSON.stringify({magFiles:dir}));process.env.MAG_LOCAL_CONFIG=config;
    const validId='11111111-1111-1111-1111-111111111111', missingId='22222222-2222-2222-2222-222222222222', brokenId='33333333-3333-3333-3333-333333333333';
    fs.writeFileSync(path.join(dir,'.transcription-jobs',validId+'.json'),JSON.stringify({id:validId,story:'Original',state:'saved',started:'2026-10-05T01:00:00Z'}));
    fs.writeFileSync(path.join(dir,'.transcription-jobs',missingId+'.json'),JSON.stringify({id:missingId,story:'Archived transcript',state:'done',started:'2026-10-05T02:00:00Z',transcriptReady:true,output:path.join(dir,'absent')}));
    fs.writeFileSync(path.join(dir,'.transcription-jobs',brokenId+'.json'),'{incomplete');
    const jobs=localJobs();assert.equal(jobs.length,3);assert.equal(jobs.find(j=>j.id===validId).story,'Original');assert.match(jobs.find(j=>j.id===missingId).transcriptError,/retained/);assert.equal(jobs.find(j=>j.id===brokenId).state,'failed');
  } finally {if(prior)process.env.MAG_LOCAL_CONFIG=prior;else delete process.env.MAG_LOCAL_CONFIG;fs.rmSync(dir,{recursive:true,force:true});}
});

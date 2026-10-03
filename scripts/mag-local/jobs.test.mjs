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
    const raw=fs.readFileSync(job.raw,'utf8');
    assert.ok(raw.includes('Synthetic test transcript.'));
    server=http.createServer(async(req,res)=>{if(!await handleLocalRoute(req,res,new URL(req.url,'http://localhost')))res.end('not found');});
    await new Promise(r=>server.listen(0,'127.0.0.1',r));
    const url=`http://127.0.0.1:${server.address().port}/transcription/${id}`;
    let response=await fetch(url);assert.equal(response.status,200);
    assert.equal((await response.json()).result.speakers[0].name,null);
    response=await fetch(url+'/speakers',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({names:{SPEAKER_00:'Adrian'}})});
    assert.equal(response.status,200);
    assert.equal((await response.json()).result.speakers[0].name,'Adrian');
    assert.ok((await(await fetch(url+'/transcript.txt')).text()).includes('Adrian:'));
    assert.equal(fs.readFileSync(job.raw,'utf8'),raw);
    response=await fetch(url+'/speakers',{method:'POST',headers:{origin:'https://other.example','content-type':'application/json'},body:'{}'});
    assert.equal(response.status,403);
    response=await fetch(url+'/retry',{method:'POST'});assert.equal(response.status,409);
    response=await fetch(url+'/view');assert.ok((await response.text()).includes('Adrian'));
    // A second source with this title fails without changing the existing quote record.
    fs.writeFileSync(source,'second source');const duplicate=startLocalIntake('Synthetic test',source);
    while(Date.now()<deadline+5000){job=localJobs().find(j=>j.id===duplicate);if(job?.state!=='running')break;await new Promise(r=>setTimeout(r,50));}
    await assert.rejects(waitForLocalIntake(duplicate), /never overwritten/);
    assert.equal(job.state,'failed');assert.match(job.error,/never overwritten/);assert.equal(fs.readFileSync(job.raw || path.join(vault,'Workflow/0-Inbox/RAW - Synthetic test.md'),'utf8'),raw);
  } finally {
    if(server)await new Promise(r=>server.close(r));
    if(prior)process.env.MAG_LOCAL_CONFIG=prior;else delete process.env.MAG_LOCAL_CONFIG;
    fs.rmSync(dir,{recursive:true,force:true});
  }
});

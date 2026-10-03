const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const base = id => '/transcription/' + encodeURIComponent(id);
const clock = seconds => { const s = Math.max(0, Math.floor(Number(seconds) || 0)); return [Math.floor(s / 3600), Math.floor(s / 60) % 60, s % 60].map(v => String(v).padStart(2, '0')).join(':'); };

export function renderLocalJob(job) {
  const status = job.state === 'running' ? job.stage || 'Preparing recording' : job.state === 'done' ? 'Transcript ready' : job.error || 'Could not transcribe this recording';
  return `<div class="dropped" data-local-job="${esc(job.id)}" data-state="${esc(job.state)}"><strong>${esc(job.story)}</strong><span data-job-status role="status">${esc(status)}</span><span data-job-actions>${job.transcriptReady ? `<a class="mini" href="${base(job.id)}/view">Read transcript →</a>` : ''}${job.state === 'failed' ? `<button class="mini" type="button" data-job-retry="${esc(job.id)}">Retry</button>` : ''}</span></div>`;
}

export const LOCAL_TRANSCRIPT_CSS = `.dropped strong,.dropped span{overflow-wrap:anywhere;min-width:0}.dropped [data-job-actions]{display:flex;gap:8px;flex-wrap:wrap}.transcript-segment{border-top:1px solid var(--line);padding:14px 0}.transcript-segment p{margin:4px 0;white-space:pre-wrap;overflow-wrap:anywhere}.transcript-time{font-size:13px;color:var(--dim)}.speaker-names{display:flex;flex-wrap:wrap;gap:12px;margin:18px 0}.speaker-names label{display:flex;flex-direction:column;gap:4px;flex:1 1 180px;font-size:13px;color:var(--dim)}.speaker-names input{width:100%;min-width:0;border:1px solid var(--line);background:var(--bg);color:var(--text);border-radius:8px;padding:8px 10px}.speaker-names button{align-self:end}.transcript-tools{display:flex;gap:8px;flex-wrap:wrap;margin:16px 0}button,a.mini{min-height:44px;display:inline-flex;align-items:center}button{cursor:pointer}`;

export const LOCAL_JOB_JS = String.raw`
document.addEventListener('click',async e=>{
  const button=e.target.closest('[data-job-retry]');if(!button)return;
  button.disabled=true;
  try{const r=await fetch('/transcription/'+encodeURIComponent(button.dataset.jobRetry)+'/retry',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});const b=await r.json();if(!r.ok||b.error)throw Error(b.error||'Retry failed');location.reload()}catch(error){button.disabled=false;const status=button.closest('[data-local-job]').querySelector('[data-job-status]');status.textContent=error.message}
});
document.addEventListener('submit',async e=>{
  const form=e.target.closest('[data-speaker-form]');if(!form)return;
  e.preventDefault();e.stopImmediatePropagation();
  const button=form.querySelector('button');button.disabled=true;
  const names=Object.fromEntries([...form.querySelectorAll('[data-speaker]')].map(input=>[input.dataset.speaker,input.value.trim()]));
  const status=form.querySelector('[role=status]');
  try{const r=await fetch('/transcription/'+encodeURIComponent(form.dataset.speakerForm)+'/speakers',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({names})});const b=await r.json();if(!r.ok||b.error)throw Error(b.error||'Could not save names');location.reload()}catch(error){status.textContent=error.message;button.disabled=false}
},true);
(async function pollLocalJobs(){
  const rows=[...document.querySelectorAll('[data-local-job][data-state="running"]')];if(!rows.length)return;
  let running=false;
  for(const row of rows){try{const r=await fetch('/transcription/'+encodeURIComponent(row.dataset.localJob));if(!r.ok)throw Error('Could not read progress');const {job}=await r.json();if(!job)throw Error('Missing progress');row.dataset.state=job.state;row.querySelector('[data-job-status]').textContent=job.state==='running'?(job.stage||'Preparing recording'):job.state==='done'?'Transcript ready':job.error||'Transcription failed';if(job.state==='running')running=true;else location.reload()}catch(error){running=true;row.querySelector('[data-job-status]').textContent='Progress temporarily unavailable; reconnecting…'}}
  if(running)setTimeout(pollLocalJobs,3000);
})();`;

export function renderTranscript(result, job = {}) {
  if (!result) return `<div class="top"><a href="/">← Stories</a></div><p class="eyebrow">Teajia Magazine · Local transcript</p><h1>${esc(job.story || 'Transcript')}</h1>${renderLocalJob(job)}`;
  const segments = result.segments || [];
  const names = result.speaker_names || result.speakerNames || result.names || Object.fromEntries((result.speakers || []).map(s => [s.id, s.name]));
  const speakers = [...new Set(segments.map(s => s.speaker).filter(Boolean))];
  const id = job.id || result.id || '';
  const label = speaker => names[speaker] || `Speaker ${speakers.indexOf(speaker) + 1}`;
  const renaming = speakers.length ? `<form class="speaker-names" data-speaker-form="${esc(id)}">${speakers.map(speaker => `<label>${esc(speaker)}<input data-speaker="${esc(speaker)}" value="${esc(names[speaker] || '')}" placeholder="Speaker name" maxlength="120"></label>`).join('')}<button class="save" type="submit">Save names</button><span role="status" aria-live="polite"></span></form><p class="meta">Names update this transcript. The original recording and RAW source remain unchanged.</p>` : '';
  const speakerLabel = speaker => names[speaker] || (/^SPEAKER_\d+$/.test(speaker) ? 'Speaker ' + (Number(speaker.split('_')[1]) + 1) : speaker);
  return `<div class="top"><a href="/">← Stories</a></div><p class="eyebrow">Teajia Magazine · Local transcript</p><h1>${esc(job.story || result.story || 'Transcript')}</h1><p class="meta">${esc(job.file || '')}</p><div class="transcript-tools"><a class="mini" href="${base(id)}/transcript.txt" download>Download text</a><a class="mini" href="${base(id)}/transcript.json" download>Download JSON</a></div>${renaming}<div>${segments.map(s => `<section class="transcript-segment"><span class="transcript-time">${clock(s.start)}–${clock(s.end)}</span>${s.speaker ? `<strong class="speaker"> ${esc(speakerLabel(s.speaker))}</strong>` : ''}<p>${esc(s.text)}</p></section>`).join('') || `<p>${esc(result.text || 'No speech was found in this recording.')}</p>`}</div>`;
}

// /view may use this standalone page; workshop pages inherit their existing CSS.
export function transcriptPage(job, result) {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(job.story)} · Transcript</title><style>:root{--bg:#faf9f5;--panel:#fff;--text:#1f1e1d;--dim:#73726c;--line:#e8e6dc;--accent:#c96442}@media(prefers-color-scheme:dark){:root{--bg:#262624;--panel:#30302e;--text:#f5f4ef;--dim:#a3a19a;--line:#3e3e3a;--accent:#d97757}}*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font:16px/1.75 ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif}.col{max-width:760px;margin:auto;padding:28px 20px 96px}a{color:var(--accent);text-decoration:none}h1{font-size:28px;line-height:1.25}.top,.meta,.eyebrow{font-size:13px;color:var(--dim)}button,input{font:inherit}.mini{border:1px solid var(--line);border-radius:7px;padding:4px 10px}.save{border:0;background:var(--accent);color:white;border-radius:8px;padding:7px 14px}.speaker{font-size:13px}${LOCAL_TRANSCRIPT_CSS}</style></head><body><main class="col">${renderTranscript(result,job)}</main><script>${LOCAL_JOB_JS}</script></body></html>`;
}

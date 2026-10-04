// Working exports may change; immutable RAW is never written here.
import fs from 'node:fs';
import path from 'node:path';
export const timestamp = seconds => {
  const n = Math.max(0, Math.floor(Number(seconds) || 0));
  return [Math.floor(n / 3600), Math.floor(n / 60) % 60, n % 60].map(v => String(v).padStart(2, '0')).join(':');
};
export function reviewEligibility(result) {
  const speakers = result.speakers || [], segments = result.segments || [];
  return segments.length > 0 && speakers.length > 0 && speakers.every(s => typeof s.name === 'string' && s.name.trim()) && segments.every(s => s.speaker && speakers.some(p => p.id === s.speaker));
}
export function readableTranscript(result) {
  const names = new Map((result.speakers || []).map((s, i) => [s.id, s.name || `Speaker ${i + 1}`]));
  return (result.segments || []).map(s => `[${timestamp(s.start)}] ${names.get(s.speaker) || 'Unassigned'}: ${s.text.trim()}`).join('\n') + '\n';
}
export function markdownTranscript(job, result, config = {}) {
  const scalar = JSON.stringify;
  const reviewed = result.metadata?.review?.status === 'reviewed';
  const names = new Map((result.speakers || []).map((s, i) => [s.id, s.name || `Speaker ${i + 1}`]));
  const text = (result.segments || []).map(s => `**[${timestamp(s.start)}–${timestamp(s.end)}] ${String(names.get(s.speaker) || 'Unassigned').replace(/([\\*_[\]<>])/g, '\\$1')}**\n\n${s.text.trim()}`).join('\n\n');
  const parts = result.metadata?.recording_parts || [];
  const partIndex = parts.length ? '\n## Recording parts\n\n' + parts.map(p=>`- ${timestamp(p.start)}–${timestamp(p.end)} · ${path.basename(p.source).replace(/([\\*_[\]<>])/g, '\\$1')}`).join('\n') + '\n\n## Conversation\n\n' : '';
  return `---\ntype: transcript\nkind: transcript\ntitle: ${scalar(job.story)}\nrecording_id: ${scalar(job.id)}\nsource_url: ${scalar(`${(config.reviewBaseUrl || "http://localhost:8766").replace(/\/$/, "")}/transcription/${encodeURIComponent(job.id)}/view`)}\naudio: ${scalar(job.source || '')}\nraw: ${scalar(job.raw || '')}\nlanguage: ${scalar(result.language || 'unknown')}\ndiarization_model: ${scalar(result.metadata?.diarization_model || result.metadata?.diarization_adapter || null)}\nreview_status: ${reviewed ? 'reviewed' : 'unreviewed'}\nreviewed_at: ${scalar(reviewed ? result.metadata.review.reviewedAt : null)}\nspeaker_map: ${scalar(Object.fromEntries((result.speakers || []).map(s => [s.id, s.name || null])))}\n---\n\n# ${job.story.replace(/[\r\n]/g, ' ')}\n\n${reviewed ? 'Human review confirmed speaker attribution and transcript text against the recording.' : 'Machine transcript. Speaker names are record-specific human mappings; attribution and text still need checking against the recording.'}\n\n${partIndex}${text}\n`;
}
function write(file, text) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const part = `${file}.${process.pid}.part`;
  fs.writeFileSync(part, text, { mode: 0o600 }); fs.renameSync(part, file);
}
export async function writeWorkingOutputs(job, result, config = {}, options = {}) {
  const markdown = markdownTranscript(job, result, config), file = path.join(job.output, 'transcript.md');
  write(path.join(job.output, 'transcript.txt'), readableTranscript(result));
  write(file, markdown);
  if (!options.freshTranslationsOnly && fs.existsSync(path.join(job.output,'translations'))) {
    const { refreshTranslationOutputs } = await import('./translation.mjs');
    await refreshTranslationOutputs(config,job,result);
  }
  if (config.i64Export?.enabled) {
    try {
      const { exportTranscript } = await import('./i64-export.mjs');
      const details = await exportTranscript(config, job, { markdown, file, result });
      job.export = { state: 'synced', updatedAt: new Date().toISOString(), ...(details ? { details } : {}) };
    } catch (error) {
      job.export = { state: 'failed', error: error.message, updatedAt: new Date().toISOString() };
    }
  }
  return file;
}

// An explicit save exposes one coherent current bundle. Old translations remain
// recoverable on disk, but are never presented as part of this saved revision.
export async function saveToMag(job, result, config = {}) {
  const { translationStatus, loadTranslation, translatedMarkdown } = await import('./translation.mjs');
  write(path.join(job.output, 'transcript.json'), JSON.stringify(result, null, 2) + '\n');
  await writeWorkingOutputs(job, result, config, { freshTranslationsOnly: true });
  const base = `/transcription/${encodeURIComponent(job.id)}`;
  const files = [
    { kind: 'original', format: 'md', name: `Transcript - ${job.story}.md`, url: `${base}/transcript.md` },
    { kind: 'structured', format: 'json', name: `Transcript - ${job.story}.json`, url: `${base}/transcript.json` },
  ];
  const excludedTranslations = [];
  for (const status of translationStatus(job, result)) {
    const translated = loadTranslation(job, result, status.language);
    if (status.state !== 'complete' || status.stale || status.outdated || !translated || translated.stale || translated.outdated) {
      excludedTranslations.push({ language: status.language, reason: translated?.stale ? 'Original changed; translate again.' : translated?.outdated ? 'Translate again with the current translator.' : 'Translation is not ready.' });
      continue;
    }
    const language = translated.language;
    write(path.join(job.output, `translation.${language}.json`), JSON.stringify(translated, null, 2) + '\n');
    write(path.join(job.output, `translation.${language}.md`), translatedMarkdown(job, translated, config));
    write(path.join(job.output, `translation.${language}.txt`), 'Unreviewed machine translation. Timestamps refer to original audio.\n\n' + readableTranscript(translated));
    files.push({ kind: 'translation', language, format: 'md', name: `Transcript - ${job.story} - ${language}.md`, url: `${base}/translation.md?language=${encodeURIComponent(language)}` });
  }
  return { state: 'saved', savedAt: new Date().toISOString(), files, excludedTranslations };
}

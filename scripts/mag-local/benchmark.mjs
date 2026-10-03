#!/usr/bin/env node
// Existing machine transcripts measure disagreement, never transcription accuracy.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export function tokenize(text) {
  // Each Han character is a token; other scripts use Unicode word tokens.
  return String(text).normalize('NFKC').toLowerCase()
    .replace(/(\p{Script=Han})/gu, ' $1 ')
    .match(/[\p{L}\p{M}\p{N}]+/gu) || [];
}

export function editCounts(reference, hypothesis) {
  // Linear memory, including operation counts. Prefer substitution on equal costs.
  let previous = Array.from({ length: hypothesis.length + 1 }, (_, i) =>
    ({ distance: i, substitutions: 0, deletions: 0, insertions: i }));
  for (let r = 1; r <= reference.length; r++) {
    const current = [{ distance: r, substitutions: 0, deletions: r, insertions: 0 }];
    for (let h = 1; h <= hypothesis.length; h++) {
      if (reference[r - 1] === hypothesis[h - 1]) {
        current.push(previous[h - 1]);
        continue;
      }
      const candidates = [
        [previous[h - 1], 'substitutions'],
        [previous[h], 'deletions'],
        [current[h - 1], 'insertions'],
      ];
      let [best, operation] = candidates[0];
      for (const [candidate, candidateOperation] of candidates.slice(1)) {
        if (candidate.distance < best.distance) [best, operation] = [candidate, candidateOperation];
      }
      current.push({ ...best, distance: best.distance + 1, [operation]: best[operation] + 1 });
    }
    previous = current;
  }
  return previous[hypothesis.length];
}

function summary(segments, duration, model) {
  if (!Array.isArray(segments)) throw new Error('Transcript has no segments array');
  let first = null, last = null, unknown = 0;
  const speakers = new Set();
  for (const segment of segments) {
    if (typeof segment.text !== 'string') throw new Error('Segment text must be a string');
    const start = Number(segment.start), end = Number(segment.end);
    if (segment.start == null || segment.end == null || !Number.isFinite(start)
      || !Number.isFinite(end) || start < 0 || end < start) throw new Error('Invalid segment timestamps');
    first = first === null ? start : Math.min(first, start);
    last = last === null ? end : Math.max(last, end);
    const speaker = segment.speaker ?? segment.speakerId;
    if (speaker === null || speaker === undefined || speaker === '') unknown++;
    else speakers.add(String(speaker));
  }
  const durationSeconds = duration == null ? null : Number(duration);
  if (durationSeconds !== null && (!Number.isFinite(durationSeconds) || durationSeconds <= 0)) {
    throw new Error('Invalid recording duration');
  }
  return { model: model || null, duration_seconds: durationSeconds,
    segment_count: segments.length, unknown_speaker_segments: unknown,
    speaker_count: speakers.size, speaker_labels: [...speakers].sort(),
    first_segment_start: first, last_segment_end: last };
}

export function compare(local, spokenly) {
  const entry = spokenly?.content?.fileTranscription?._0;
  const existing = entry?.state?.completed?._0;
  if (!existing) throw new Error('Spokenly history does not contain a completed file transcription');
  const localSummary = summary(local.segments, local.metadata?.duration_seconds, local.metadata?.asr_adapter);
  const existingSummary = summary(existing.segments, entry.audioFile?.duration, existing.modelId);
  const reference = tokenize(existing.segments.map(s => s.text).join(' '));
  const hypothesis = tokenize(local.segments.map(s => s.text).join(' '));
  const counts = editCounts(reference, hypothesis);
  const durationDelta = localSummary.duration_seconds !== null && existingSummary.duration_seconds !== null
    ? Math.abs(localSummary.duration_seconds - existingSummary.duration_seconds) : null;
  const warnings = [
    'Spokenly output is a machine baseline, not human ground truth. This is text disagreement, not accuracy.',
    'Speaker names and cluster IDs are not comparable without a reviewed identity mapping.',
    'Matching duration alone does not prove the same audio; verify the source bytes and any clip boundaries.',
  ];
  if (durationDelta !== null && durationDelta > 0.1) warnings.push('Recording durations differ; check source identity before interpreting the comparison.');
  if (!reference.length) warnings.push('Baseline text is empty; disagreement rate is undefined.');
  return {
    schema_version: 1, comparison: 'local_vs_existing_spokenly_machine_text',
    normalization: 'NFKC lowercase; punctuation ignored; Unicode words with Han characters individually tokenized',
    source: { local: local.metadata?.source || null, local_sha256: local.metadata?.source_sha256 || null,
      spokenly_original_filename: entry.fileName || null, duration_delta_seconds: durationDelta },
    text: { baseline_tokens: reference.length, local_tokens: hypothesis.length, ...counts,
      disagreement_rate: reference.length ? counts.distance / reference.length : null },
    local: localSummary, spokenly: existingSummary, warnings,
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv.length !== 4) throw new Error('Usage: node scripts/mag-local/benchmark.mjs local/transcript.json spokenly-history.json');
    const [local, spokenly] = process.argv.slice(2).map(file => JSON.parse(fs.readFileSync(file, 'utf8')));
    console.log(JSON.stringify(compare(local, spokenly), null, 2));
  } catch (error) {
    console.error(`Benchmark failed: ${error.message}`);
    process.exitCode = 1;
  }
}

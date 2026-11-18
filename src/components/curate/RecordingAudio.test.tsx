import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import { RecordingAudio, recordingAudioId } from './RecordingAudio';

it('recognizes only the scoped recording route and withholds it from an unauthenticated audio element', () => {
  const id = 'f40257a6-c043-4bd2-9793-1dbe6de8d77c';
  const src = `/api/transcriptions/${id}/audio`;
  expect(recordingAudioId(src)).toBe(id);
  expect(recordingAudioId(`https://other.test${src}`)).toBeUndefined();
  const markup = renderToStaticMarkup(<RecordingAudio controls src={src} />);
  expect(markup).toContain('<audio');
  expect(markup).not.toContain('src=');
  expect(markup).not.toContain(id);
});

it('preserves older audio URLs', () => {
  const markup = renderToStaticMarkup(<RecordingAudio controls src="/legacy-recording.mp3" />);
  expect(markup).toContain('src="/legacy-recording.mp3"');
});

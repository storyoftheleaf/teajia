import React from 'react';
import { Mic, Star } from 'lucide-react';
import { useVoiceCapture } from '../../hooks/useVoiceCapture';

export function appendSectionTranscript(text: string, transcript: string): string {
  return [text.trim(), transcript.trim()].filter(Boolean).join(' ');
}

interface JournalSectionVoiceNoteProps {
  text: string;
  starred: boolean;
  onTextChange: (text: string) => void;
  onStarChange: (starred: boolean) => void;
  starPending?: boolean;
  error?: string | null;
}

export function JournalSectionVoiceNote({
  text,
  starred,
  onTextChange,
  onStarChange,
  starPending = false,
  error,
}: JournalSectionVoiceNoteProps) {
  const voice = useVoiceCapture({
    onTranscribed: transcript => onTextChange(appendSectionTranscript(text, transcript)),
  });
  const isRecording = voice.state === 'recording';
  const isTranscribing = voice.state === 'transcribing';

  return (
    <div className="space-y-2 rounded-md border border-tea-border bg-tea-bg p-3">
      <textarea
        value={text}
        onChange={event => onTextChange(event.target.value)}
        aria-label="Note for this tasting"
        placeholder="What stayed with you?"
        rows={2}
        className="w-full resize-y rounded-md border border-tea-border bg-tea-surface px-3 py-2 text-ui-12 text-tea-text placeholder:text-tea-text-dim focus:border-tea-gold focus:outline-none focus:ring-2 focus:ring-tea-gold/30"
      />
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <button
          type="button"
          onClick={isRecording ? voice.stop : voice.start}
          disabled={isTranscribing}
          aria-label="Record note for this tasting"
          className="tap-target inline-flex items-center gap-1.5 text-ui-12 text-tea-text-sec transition-colors hover:text-tea-text disabled:opacity-50"
        >
          <Mic size={14} />
          {isRecording ? 'Stop' : isTranscribing ? 'Transcribing…' : 'Record'}
        </button>
        <button
          type="button"
          onClick={() => onStarChange(!starred)}
          disabled={starPending || !text.trim()}
          aria-pressed={starred}
          aria-label={starred ? 'Remove private review star' : 'Star this note for private review'}
          className="tap-target inline-flex items-center gap-1.5 text-ui-12 text-tea-text-sec transition-colors hover:text-tea-text disabled:opacity-50"
        >
          <Star size={14} fill={starred ? 'currentColor' : 'none'} />
          {starred ? 'Review candidate' : 'Mark for review'}
        </button>
      </div>
      {error && <p role="alert" className="text-ui-11 text-tea-text-sec">{error}</p>}
    </div>
  );
}

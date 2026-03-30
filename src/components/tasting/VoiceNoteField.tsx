import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Mic, Square, Loader2 } from 'lucide-react';
import { api } from '../../lib/api';

interface VoiceNoteFieldProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

type RecorderState = 'idle' | 'recording' | 'transcribing';

function getSupportedMimeType(): string {
  if (typeof MediaRecorder === 'undefined') return 'audio/webm';
  if (MediaRecorder.isTypeSupported('audio/webm')) return 'audio/webm';
  if (MediaRecorder.isTypeSupported('audio/mp4')) return 'audio/mp4';
  if (MediaRecorder.isTypeSupported('audio/wav')) return 'audio/wav';
  return 'audio/webm';
}

/**
 * Text area with an inline mic button.
 * Tap mic → record → stop → transcript appends to the text field.
 * Reuses the same transcription API as the Compass VoiceRecorder.
 */
const VoiceNoteFieldInner: React.FC<VoiceNoteFieldProps> = ({
  value,
  onChange,
  placeholder = 'How would you describe this tea to a friend?',
}) => {
  const [recState, setRecState] = useState<RecorderState>('idle');
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }
    };
  }, []);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mimeType = getSupportedMimeType();
      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        streamRef.current = null;

        const blob = new Blob(chunksRef.current, { type: mimeType });
        chunksRef.current = [];

        if (blob.size < 100) {
          setRecState('idle');
          return;
        }

        setRecState('transcribing');
        try {
          const result = await api.transcribeAudio(blob);
          if (result.text?.trim()) {
            const separator = value.trim() ? ' ' : '';
            onChange(value.trim() + separator + result.text.trim());
          }
        } catch {
          // Silently fail — the user can type instead
        }
        setRecState('idle');
      };

      recorder.start(250);
      setRecState('recording');
    } catch {
      setRecState('idle');
    }
  }, [value, onChange]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  }, []);

  const handleMicPress = useCallback(() => {
    if (recState === 'recording') {
      stopRecording();
    } else if (recState === 'idle') {
      startRecording();
    }
  }, [recState, startRecording, stopRecording]);

  return (
    <div className="tasting-voice-field">
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        rows={2}
        className="flex-1 px-3 py-2.5 bg-transparent text-sm text-tea-text placeholder:text-tea-text-dim/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus-visible:ring-offset-1 focus-visible:ring-offset-tea-bg resize-none"
        style={{ fontFamily: 'var(--font-body)' }}
      />
      <button
        type="button"
        onClick={handleMicPress}
        disabled={recState === 'transcribing'}
        className={`tasting-voice-btn ${recState === 'recording' ? 'tasting-voice-btn-recording' : ''}`}
        aria-label={recState === 'recording' ? 'Stop recording' : 'Record voice note'}
      >
        {recState === 'recording' ? (
          <>
            <motion.span
              className="absolute inset-0 rounded-full"
              style={{ border: '1px solid rgb(var(--tea-gold-rgb) / 0.2)' }}
              animate={{ scale: [1, 1.3, 1], opacity: [0.3, 0, 0.3] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            />
            <Square size={14} fill="currentColor" />
          </>
        ) : recState === 'transcribing' ? (
          <motion.span
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          >
            <Loader2 size={14} />
          </motion.span>
        ) : (
          <Mic size={14} />
        )}
      </button>
    </div>
  );
};

export const VoiceNoteField = React.memo(VoiceNoteFieldInner);
VoiceNoteField.displayName = 'VoiceNoteField';

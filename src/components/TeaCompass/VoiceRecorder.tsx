import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Mic, Square, Loader2 } from 'lucide-react';
import { api } from '../../lib/api';

interface VoiceRecorderProps {
  onTranscript: (text: string) => void;
}

type RecorderState = 'idle' | 'recording' | 'transcribing' | 'error';

function getSupportedMimeType(): string {
  if (typeof MediaRecorder === 'undefined') return 'audio/webm';
  if (MediaRecorder.isTypeSupported('audio/webm')) return 'audio/webm';
  if (MediaRecorder.isTypeSupported('audio/mp4')) return 'audio/mp4';
  if (MediaRecorder.isTypeSupported('audio/wav')) return 'audio/wav';
  return 'audio/webm';
}

export const VoiceRecorder: React.FC<VoiceRecorderProps> = ({ onTranscript }) => {
  const [state, setState] = useState<RecorderState>('idle');

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  // Silently recover from error after 2 seconds
  useEffect(() => {
    if (state === 'error') {
      const t = setTimeout(() => setState('idle'), 2000);
      return () => clearTimeout(t);
    }
  }, [state]);

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
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;

        const blob = new Blob(chunksRef.current, { type: mimeType });
        chunksRef.current = [];

        if (blob.size < 100) {
          setState('idle');
          return;
        }

        setState('transcribing');
        try {
          const result = await api.transcribeAudio(blob);
          if (result.text && result.text.trim()) {
            onTranscript(result.text.trim());
          }
          setState('idle');
        } catch {
          setState('error');
        }
      };

      recorder.start(250);
      setState('recording');
    } catch {
      setState('error');
    }
  }, [onTranscript]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  }, []);

  const handlePress = useCallback(() => {
    if (state === 'recording') {
      stopRecording();
    } else if (state === 'idle') {
      startRecording();
    }
  }, [state, startRecording, stopRecording]);

  return (
    <div className="fixed right-5 z-30 bottom-[calc(4.5rem+44px+env(safe-area-inset-bottom,0px))] lg:bottom-[4.5rem]">
      <motion.button
        type="button"
        onClick={handlePress}
        disabled={state === 'transcribing'}
        whileTap={state !== 'transcribing' ? { scale: 0.95 } : undefined}
        className={`relative w-12 h-12 rounded-full shadow-lg flex items-center justify-center transition-colors
          ${state === 'recording'
            ? 'bg-tea-gold/15 text-tea-gold'
            : state === 'transcribing'
              ? 'bg-tea-surface text-tea-text-dim cursor-wait'
              : 'bg-tea-surface text-tea-text-dim hover:text-tea-text border border-tea-border'
          }`}
        aria-label={state === 'recording' ? 'Stop recording' : 'Start voice note'}
      >
        {/* Subtle glow when recording */}
        {state === 'recording' && (
          <motion.span
            className="absolute inset-0 rounded-full border border-tea-gold/20"
            animate={{ scale: [1, 1.15, 1], opacity: [0.3, 0, 0.3] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
          />
        )}

        {state === 'recording' ? (
          <Square size={16} fill="currentColor" />
        ) : state === 'transcribing' ? (
          <motion.span
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          >
            <Loader2 size={16} />
          </motion.span>
        ) : (
          <Mic size={16} />
        )}
      </motion.button>
    </div>
  );
};

export default VoiceRecorder;

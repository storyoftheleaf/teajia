import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
  return 'audio/webm'; // fallback
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export const VoiceRecorder: React.FC<VoiceRecorderProps> = ({ onTranscript }) => {
  const [state, setState] = useState<RecorderState>('idle');
  const [duration, setDuration] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  // Clear error after a few seconds
  useEffect(() => {
    if (state === 'error') {
      const t = setTimeout(() => setState('idle'), 3000);
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
        // Stop all tracks
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;

        // Stop timer
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }

        const blob = new Blob(chunksRef.current, { type: mimeType });
        chunksRef.current = [];

        if (blob.size < 100) {
          setState('idle');
          return;
        }

        // Transcribe
        setState('transcribing');
        try {
          const result = await api.transcribeAudio(blob);
          if (result.text && result.text.trim()) {
            onTranscript(result.text.trim());
          }
          setState('idle');
        } catch (err: any) {
          console.error('Transcription failed:', err);
          const msg = typeof err?.message === 'string' ? err.message : 'Transcription failed';
          setErrorMsg(msg.slice(0, 60));
          setState('error');
        }
      };

      recorder.start(250); // collect in 250ms chunks
      setState('recording');
      setDuration(0);
      timerRef.current = setInterval(() => {
        setDuration((d) => d + 1);
      }, 1000);
    } catch (err: any) {
      console.error('Microphone access denied:', err);
      setErrorMsg('Microphone access denied');
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
    // Ignore press during transcribing/error states
  }, [state, startRecording, stopRecording]);

  return (
    <div className="fixed right-5 z-30 bottom-[calc(4.5rem+49px+env(safe-area-inset-bottom,0px))] lg:bottom-[4.5rem] flex flex-col items-center gap-1.5">
      {/* Duration / status label */}
      <AnimatePresence>
        {state === 'recording' && (
          <motion.span
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            className="text-[11px] text-tea-gold font-mono tabular-nums"
          >
            {formatDuration(duration)}
          </motion.span>
        )}
        {state === 'transcribing' && (
          <motion.span
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            className="text-[11px] text-tea-text-dim"
          >
            Transcribing...
          </motion.span>
        )}
        {state === 'error' && (
          <motion.span
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            className="text-[11px] text-tea-text-dim max-w-[120px] text-center leading-tight"
          >
            {errorMsg}
          </motion.span>
        )}
      </AnimatePresence>

      {/* Mic button */}
      <motion.button
        type="button"
        onClick={handlePress}
        disabled={state === 'transcribing'}
        whileHover={state !== 'transcribing' ? { scale: 1.05 } : undefined}
        whileTap={state !== 'transcribing' ? { scale: 0.95 } : undefined}
        className={`relative w-12 h-12 rounded-full shadow-lg flex items-center justify-center transition-colors
          ${state === 'recording'
            ? 'bg-tea-gold/15 text-tea-gold'
            : state === 'transcribing'
              ? 'bg-tea-surface text-tea-text-dim cursor-wait'
              : state === 'error'
                ? 'bg-tea-surface text-tea-text-dim'
                : 'bg-tea-surface text-tea-text-dim hover:text-tea-text border border-tea-border'
          }`}
        aria-label={state === 'recording' ? 'Stop recording' : 'Start voice note'}
      >
        {/* Pulsing ring when recording */}
        {state === 'recording' && (
          <motion.span
            className="absolute inset-0 rounded-full border border-tea-gold/30"
            animate={{ scale: [1, 1.2, 1], opacity: [0.4, 0, 0.4] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          />
        )}

        {state === 'recording' ? (
          <Square size={18} fill="currentColor" />
        ) : state === 'transcribing' ? (
          <motion.span
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          >
            <Loader2 size={18} />
          </motion.span>
        ) : (
          <Mic size={18} />
        )}
      </motion.button>
    </div>
  );
};

export default VoiceRecorder;

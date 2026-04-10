import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, Square, Loader2, X, Plus } from 'lucide-react';
import { api } from '../../lib/api';

interface VoiceNoteFieldProps {
  values: string[];
  onChange: (values: string[]) => void;
  startSignal?: number;
  stopSignal?: number;
}

type RecorderState = 'idle' | 'recording' | 'transcribing';

function getSupportedMimeType(): string {
  if (typeof MediaRecorder === 'undefined') return 'audio/mp4';
  if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) return 'audio/webm;codecs=opus';
  if (MediaRecorder.isTypeSupported('audio/webm')) return 'audio/webm';
  if (MediaRecorder.isTypeSupported('audio/mp4')) return 'audio/mp4';
  if (MediaRecorder.isTypeSupported('audio/wav')) return 'audio/wav';
  return 'audio/mp4';
}

const VoiceNoteFieldInner: React.FC<VoiceNoteFieldProps> = ({
  values,
  onChange,
  startSignal = 0,
  stopSignal = 0,
}) => {
  const [draft, setDraft] = useState('');
  const [recState, setRecState] = useState<RecorderState>('idle');
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const isMountedRef = useRef(true);
  const onChangeRef = useRef(onChange);
  const valuesRef = useRef(values);

  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);
  useEffect(() => { valuesRef.current = values; }, [values]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
    };
  }, []);

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
  }, []);

  const startRecording = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!isMountedRef.current) { stream.getTracks().forEach(t => t.stop()); return; }
      streamRef.current = stream;
      const mimeType = getSupportedMimeType();
      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onerror = () => {
        if (!isMountedRef.current) return;
        setError('Recording failed. Try typing instead.');
        setRecState('idle');
        stopStream();
      };
      recorder.onstop = async () => {
        stopStream();
        const blob = new Blob(chunksRef.current, { type: mimeType });
        chunksRef.current = [];
        if (blob.size < 100) { if (isMountedRef.current) setRecState('idle'); return; }
        if (isMountedRef.current) setRecState('transcribing');
        try {
          const result = await api.transcribeAudio(blob);
          if (!isMountedRef.current) return;
          if (result.text?.trim()) {
            onChangeRef.current([...valuesRef.current, result.text.trim()]);
          }
        } catch (err: unknown) {
          if (!isMountedRef.current) return;
          const msg = err instanceof Error ? err.message : '';
          if (msg.toLowerCase().includes('timeout') || msg.toLowerCase().includes('timed out')) {
            setError('Took too long. Try again or type instead.');
          } else if (msg.toLowerCase().includes('unauthorized') || msg.includes('401')) {
            setError('Sign in to use voice notes.');
          } else {
            setError(msg || 'Transcription failed. Try typing instead.');
          }
        }
        if (isMountedRef.current) setRecState('idle');
      };
      recorder.start(250);
      setRecState('recording');
    } catch {
      if (!isMountedRef.current) return;
      setRecState('idle');
      setError('Microphone access denied. Try typing instead.');
    }
  }, [stopStream]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  }, []);

  const handleMicPress = useCallback(() => {
    if (recState === 'recording') stopRecording();
    else if (recState === 'idle') startRecording();
  }, [recState, startRecording, stopRecording]);

  useEffect(() => {
    if (startSignal <= 0) return;
    const t = setTimeout(() => { if (isMountedRef.current) startRecording(); }, 50);
    return () => clearTimeout(t);
  }, [startSignal, startRecording]);

  useEffect(() => { if (stopSignal > 0) stopRecording(); }, [stopSignal, stopRecording]);

  const submitDraft = useCallback(() => {
    const trimmed = draft.trim();
    if (!trimmed) return;
    onChangeRef.current([...valuesRef.current, trimmed]);
    setDraft('');
  }, [draft]);

  const removeNote = useCallback((index: number) => {
    onChangeRef.current(valuesRef.current.filter((_, i) => i !== index));
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitDraft(); }
  };

  return (
    <div className="flex flex-col gap-2">

      {/* Saved notes — stack above the input */}
      <AnimatePresence initial={false}>
        {values.map((note, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, x: 10, scale: 0.96 }}
            transition={{ duration: 0.18 }}
            className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-tea-surface"
          >
            <p
              className="flex-1 text-[13px] text-tea-text leading-relaxed"
              style={{ fontFamily: 'var(--font-body)' }}
            >
              {note}
            </p>
            <button
              type="button"
              onClick={() => removeNote(i)}
              className="shrink-0 mt-0.5 p-1 text-tea-text-dim hover:text-tea-text transition-colors rounded"
              aria-label="Remove note"
            >
              <X size={12} />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Input row — always visible */}
      <div className="tasting-voice-field">
        {recState === 'recording' ? (
          <div className="flex-1 flex items-center px-3 py-2.5">
            <motion.span
              animate={{ opacity: [1, 0.4, 1] }}
              transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
              className="text-[13px] text-tea-gold/70"
              style={{ fontFamily: 'var(--font-body)' }}
            >
              Recording…
            </motion.span>
          </div>
        ) : (
          <textarea
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={values.length > 0 ? 'Add another note…' : 'Type a note, or tap the mic to record…'}
            rows={1}
            className="flex-1 px-3 py-2.5 bg-transparent text-[13px] text-tea-text placeholder:text-tea-text-dim/40 focus:outline-none resize-none"
            style={{ fontFamily: 'var(--font-body)' }}
          />
        )}

        {draft.trim() ? (
          <button
            type="button"
            onClick={submitDraft}
            className="tasting-voice-btn"
            aria-label="Add note"
          >
            <Plus size={14} />
          </button>
        ) : (
          <button
            type="button"
            onClick={handleMicPress}
            disabled={recState === 'transcribing'}
            className={`tasting-voice-btn ${recState === 'recording' ? 'tasting-voice-btn-recording' : ''}`}
            aria-label={recState === 'recording' ? 'Stop recording' : 'Tap to record a note'}
          >
            {recState === 'transcribing' ? (
              <motion.span animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>
                <Loader2 size={14} className="text-tea-gold" />
              </motion.span>
            ) : recState === 'recording' ? (
              <Square size={13} className="text-tea-gold" fill="currentColor" />
            ) : (
              <Mic size={14} className="text-tea-text-sec" />
            )}
          </button>
        )}
      </div>

      {error && (
        <p className="text-[12px] text-red-400" style={{ fontFamily: 'var(--font-body)' }}>
          {error}
        </p>
      )}
    </div>
  );
};

export const VoiceNoteField = React.memo(VoiceNoteFieldInner);
VoiceNoteField.displayName = 'VoiceNoteField';

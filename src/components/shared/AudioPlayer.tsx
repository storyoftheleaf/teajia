import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, Volume2, VolumeX } from 'lucide-react';

interface AudioPlayerProps {
  /** URL to the audio file */
  src: string;
  /** Short title shown alongside the player */
  title?: string;
  /** Optional subtitle (e.g., "2 min · Origin Story") */
  subtitle?: string;
  /** Compact mode for inline embedding on product pages */
  compact?: boolean;
}

/**
 * Minimal audio player for tea stories, origin guides, and tasting notes.
 * Designed to embed inline on product pages without disrupting the layout.
 */
export const AudioPlayer: React.FC<AudioPlayerProps> = ({
  src,
  title,
  subtitle,
  compact = false,
}) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTimeUpdate = () => {
      if (audio.duration) setProgress(audio.currentTime / audio.duration);
    };
    const onLoadedMetadata = () => setDuration(audio.duration);
    const onEnded = () => { setIsPlaying(false); setProgress(0); };

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('ended', onEnded);

    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('ended', onEnded);
    };
  }, []);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
    } else {
      audio.play();
    }
    setIsPlaying(!isPlaying);
  };

  const toggleMute = () => {
    if (audioRef.current) {
      audioRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    if (!audio || !audio.duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    audio.currentTime = pct * audio.duration;
    setProgress(pct);
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className={`flex items-center gap-3 ${compact ? 'p-2' : 'p-3 border border-tea-border rounded-xl bg-tea-surface/50'}`}>
      <audio ref={audioRef} src={src} preload="metadata" />

      {/* Play/Pause button */}
      <button
        onClick={togglePlay}
        className="w-9 h-9 rounded-full bg-tea-gold/15 text-tea-gold hover:bg-tea-gold/25 flex items-center justify-center shrink-0 transition-colors"
        aria-label={isPlaying ? 'Pause' : 'Play'}
      >
        {isPlaying ? <Pause size={14} /> : <Play size={14} className="ml-0.5" />}
      </button>

      {/* Info + progress */}
      <div className="flex-1 min-w-0">
        {(title || subtitle) && (
          <div className="flex items-baseline gap-2 mb-1">
            {title && <span className="text-xs text-tea-text truncate font-medium">{title}</span>}
            {subtitle && <span className="text-[10px] text-tea-text-sec truncate">{subtitle}</span>}
          </div>
        )}

        {/* Progress bar */}
        <div
          className="h-1 bg-tea-border/50 rounded-full cursor-pointer group"
          onClick={handleSeek}
        >
          <div
            className="h-full bg-tea-gold rounded-full transition-[width] duration-100 relative"
            style={{ width: `${progress * 100}%` }}
          >
            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-tea-gold opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        </div>

        {/* Time */}
        <div className="flex justify-between mt-0.5">
          <span className="text-[9px] text-tea-text-dim num">
            {formatTime(progress * duration)}
          </span>
          <span className="text-[9px] text-tea-text-dim num">
            {formatTime(duration)}
          </span>
        </div>
      </div>

      {/* Mute toggle */}
      {!compact && (
        <button
          onClick={toggleMute}
          className="p-1.5 text-tea-text-sec hover:text-tea-text transition-colors shrink-0"
          aria-label={isMuted ? 'Unmute' : 'Mute'}
        >
          {isMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
        </button>
      )}
    </div>
  );
};

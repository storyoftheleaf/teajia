import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Volume2, VolumeX } from 'lucide-react';

/**
 * Audio files should be placed at /public/audio/:
 *   rain.mp3, forest.mp3, teahouse.mp3
 *
 * SoundscapePlayer: Ambient audio toggle component.
 * Cycles through: off -> track1 -> track2 -> ... -> off
 * Does NOT autoplay, user must opt in.
 * Saves preference to localStorage under `soundscape_pref`.
 * Volume is fixed at 15% (0.15). Loop is enabled.
 * Renders null if the Audio API is not supported.
 */

interface Track {
  name: string;
  src: string;
}

interface SoundscapePlayerProps {
  tracks: Track[];
  defaultTrack?: string;
}

const STORAGE_KEY = 'soundscape_pref';

const SoundscapePlayer: React.FC<SoundscapePlayerProps> = ({
  tracks,
  defaultTrack,
}) => {
  const [supported] = useState(() => typeof Audio !== 'undefined');
  // trackIndex: -1 = off, 0..n = active track
  const [trackIndex, setTrackIndex] = useState<number>(-1);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Restore preference on mount
  useEffect(() => {
    if (!supported) return;
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const idx = tracks.findIndex((t) => t.src === saved);
      if (idx !== -1) {
        // Don't autoplay, just remember preference
      }
    }
  }, [supported, tracks]);

  // Handle audio switching when trackIndex changes
  useEffect(() => {
    if (!supported) return;

    if (trackIndex === -1) {
      // Stop audio
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        audioRef.current = null;
      }
      localStorage.removeItem(STORAGE_KEY);
      return;
    }

    const track = tracks[trackIndex];
    if (!track) return;

    // Clean up previous audio
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }

    const audio = new Audio(track.src);
    audio.volume = 0.15;
    audio.loop = true;
    audioRef.current = audio;

    audio.play().catch(() => {
      // Autoplay blocked, user interaction already happened, this is a fallback
    });

    localStorage.setItem(STORAGE_KEY, track.src);

    return () => {
      audio.pause();
      audio.currentTime = 0;
    };
  }, [trackIndex, tracks, supported]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const handleCycle = useCallback(() => {
    setTrackIndex((prev) => {
      // Cycle: -1 -> 0 -> 1 -> ... -> n-1 -> -1
      if (prev === -1) return 0;
      if (prev >= tracks.length - 1) return -1;
      return prev + 1;
    });
  }, [tracks.length]);

  if (!supported) return null;

  const isPlaying = trackIndex !== -1;
  const currentTrack = isPlaying ? tracks[trackIndex] : null;

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleCycle}
        aria-label={isPlaying ? `Playing: ${currentTrack?.name}. Tap to change.` : 'Play ambient soundscape'}
        className="flex items-center justify-center w-11 h-11 rounded-full bg-tea-surface text-tea-text-sec hover:bg-tea-elevated transition-colors"
      >
        {isPlaying ? (
          <Volume2 size={20} className="text-tea-gold" />
        ) : (
          <VolumeX size={20} />
        )}
      </button>

      {isPlaying && currentTrack && (
        <span className="text-xs text-tea-text-dim leading-none">
          {currentTrack.name}
        </span>
      )}
    </div>
  );
};

export default SoundscapePlayer;

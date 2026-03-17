type SoundType = 'click' | 'success' | 'toggle';

const frequencies: Record<SoundType, number> = {
  click: 600,
  success: 880,
  toggle: 440,
};

const durations: Record<SoundType, number> = {
  click: 50,
  success: 100,
  toggle: 60,
};

let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  try {
    if (!audioContext) {
      audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return audioContext;
  } catch {
    return null;
  }
}

export function playSound(type: SoundType): void {
  try {
    const enabled = localStorage.getItem('soundEnabled');
    if (enabled === 'false') return;

    const ctx = getAudioContext();
    if (!ctx) return;

    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(frequencies[type], ctx.currentTime);

    const volume = 0.06;
    const durationSec = durations[type] / 1000;

    gainNode.gain.setValueAtTime(volume, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + durationSec);

    if (type === 'success') {
      oscillator.frequency.setValueAtTime(660, ctx.currentTime);
      oscillator.frequency.setValueAtTime(880, ctx.currentTime + durationSec * 0.5);
    }

    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + durationSec);
  } catch {
    // Silently fail -- sounds are non-critical
  }
}

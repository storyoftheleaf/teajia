import React, { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

interface BreathPacerProps {
  active: boolean;
  onToggle: () => void;
}

type BreathPhase = 'inhale' | 'hold' | 'exhale';

interface PhaseConfig {
  label: string;
  duration: number; // seconds
  scale: number;
}

const PHASES: Record<BreathPhase, PhaseConfig> = {
  inhale: { label: 'Inhale', duration: 4, scale: 1.4 },
  hold: { label: 'Hold', duration: 7, scale: 1.4 },
  exhale: { label: 'Exhale', duration: 8, scale: 1.0 },
};

const PHASE_ORDER: BreathPhase[] = ['inhale', 'hold', 'exhale'];

/**
 * BreathPacer — 4-7-8 breathing guide with animated circle.
 * Inhale 4s (scale up), Hold 7s (sustain), Exhale 8s (scale down).
 * Uses Framer Motion for animation. Respects prefers-reduced-motion.
 * Positioned absolute at bottom-center of parent.
 */
const BreathPacer: React.FC<BreathPacerProps> = ({ active, onToggle }) => {
  const [phaseIndex, setPhaseIndex] = useState(0);
  const shouldReduceMotion = useReducedMotion();

  const currentPhase = PHASE_ORDER[phaseIndex];
  const config = PHASES[currentPhase];

  useEffect(() => {
    if (!active) {
      setPhaseIndex(0);
      return;
    }

    const timer = setTimeout(() => {
      setPhaseIndex((prev) => (prev + 1) % PHASE_ORDER.length);
    }, config.duration * 1000);

    return () => clearTimeout(timer);
  }, [active, phaseIndex, config.duration]);

  // Determine target scale for animation
  const targetScale = shouldReduceMotion ? 1.0 : config.scale;

  // Determine animation type per phase
  const getAnimateProps = () => {
    if (shouldReduceMotion) return { scale: 1.0 };
    if (currentPhase === 'inhale') return { scale: 1.4 };
    if (currentPhase === 'hold') return { scale: 1.4 };
    return { scale: 1.0 };
  };

  return (
    <>
      {/* Toggle button — leaf/lotus icon using Unicode */}
      <button
        onClick={onToggle}
        aria-label={active ? 'Stop breath pacer' : 'Start 4-7-8 breath pacer'}
        className="flex items-center justify-center w-11 h-11 rounded-full bg-tea-surface text-tea-text-sec hover:bg-tea-elevated transition-colors"
      >
        {/* Lotus-like symbol */}
        <span className="text-xl leading-none select-none" style={{ color: active ? 'var(--color-tea-gold, #c9a84c)' : undefined }}>
          ❀
        </span>
      </button>

      {/* Breathing circle — positioned at bottom-center of page */}
      {active && (
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-3 pointer-events-none z-20">
          <motion.div
            className="rounded-full bg-tea-gold"
            style={{ opacity: 0.12, width: 80, height: 80 }}
            animate={getAnimateProps()}
            transition={{
              duration: config.duration,
              ease: currentPhase === 'hold' ? 'linear' : 'easeInOut',
            }}
          />
          <motion.span
            key={currentPhase}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.3 }}
            className="text-xs text-tea-text-dim tracking-widest uppercase"
          >
            {config.label}
          </motion.span>
        </div>
      )}
    </>
  );
};

export default BreathPacer;

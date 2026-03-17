import React, { useEffect, useState } from 'react';

interface CartFlyAnimationProps {
  startX: number;
  startY: number;
  imageUrl?: string;
  onComplete: () => void;
}

/** Small sparkle particle */
const Sparkle: React.FC<{ delay: number; angle: number; distance: number }> = ({ delay, angle, distance }) => {
  const rad = (angle * Math.PI) / 180;
  const tx = Math.cos(rad) * distance;
  const ty = Math.sin(rad) * distance;

  return (
    <div
      className="absolute w-1.5 h-1.5 rounded-full bg-tea-gold"
      style={{
        left: '50%',
        top: '50%',
        transform: 'translate(-50%, -50%) scale(1)',
        opacity: 1,
        transition: `all 0.5s cubic-bezier(0.2, 0.8, 0.2, 1) ${delay}ms`,
      }}
      ref={(el) => {
        if (el) {
          requestAnimationFrame(() => {
            el.style.transform = `translate(calc(-50% + ${tx}px), calc(-50% + ${ty}px)) scale(0)`;
            el.style.opacity = '0';
          });
        }
      }}
    />
  );
};

export const CartFlyAnimation: React.FC<CartFlyAnimationProps> = ({
  startX,
  startY,
  imageUrl,
  onComplete,
}) => {
  const [phase, setPhase] = useState<'fly' | 'done'>('fly');

  // Cart icon is top-right corner
  const endX = window.innerWidth - 40;
  const endY = 24;

  useEffect(() => {
    const timer = setTimeout(() => {
      setPhase('done');
      onComplete();
    }, 600);
    return () => clearTimeout(timer);
  }, [onComplete]);

  if (phase === 'done') return null;

  // Generate sparkle angles
  const sparkles = Array.from({ length: 6 }, (_, i) => ({
    angle: i * 60 + Math.random() * 20 - 10,
    distance: 20 + Math.random() * 15,
    delay: 50 + i * 30,
  }));

  return (
    <>
      {/* Sparkle burst at origin */}
      <div
        className="fixed z-toast pointer-events-none"
        style={{ left: startX, top: startY, width: 48, height: 48 }}
      >
        {sparkles.map((s, i) => (
          <Sparkle key={i} {...s} />
        ))}
      </div>

      {/* Flying item */}
      <div
        className="fixed z-toast pointer-events-none"
        style={{
          left: startX,
          top: startY,
          width: 48,
          height: 48,
          transition: 'all 0.55s cubic-bezier(0.2, 0.8, 0.2, 1)',
          transform: `translate(${endX - startX}px, ${endY - startY}px) scale(0.15)`,
          opacity: 0.3,
        }}
      >
        {imageUrl ? (
          <img
            src={imageUrl}
            className="w-full h-full object-cover rounded-full shadow-lg ring-2 ring-tea-gold"
            alt=""
          />
        ) : (
          <div className="w-full h-full bg-tea-gold rounded-full shadow-lg" />
        )}
      </div>
    </>
  );
};

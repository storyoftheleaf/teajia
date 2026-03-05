import React, { useEffect, useState } from 'react';

interface CartFlyAnimationProps {
  startX: number;
  startY: number;
  imageUrl?: string;
  onComplete: () => void;
}

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
    }, 500);
    return () => clearTimeout(timer);
  }, [onComplete]);

  if (phase === 'done') return null;

  return (
    <div
      className="fixed z-[300] pointer-events-none"
      style={{
        left: startX,
        top: startY,
        width: 48,
        height: 48,
        transition: 'all 0.5s cubic-bezier(0.2, 0.8, 0.2, 1)',
        transform: `translate(${endX - startX}px, ${endY - startY}px) scale(0.2)`,
        opacity: 0.4,
      }}
    >
      {imageUrl ? (
        <img
          src={imageUrl}
          className="w-full h-full object-cover rounded-full shadow-lg ring-2 ring-tea-seal"
          alt=""
        />
      ) : (
        <div className="w-full h-full bg-tea-seal rounded-full shadow-lg" />
      )}
    </div>
  );
};

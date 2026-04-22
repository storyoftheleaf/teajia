import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface Annotation {
  id: number;
  x: number; // 0-100 percentage
  y: number; // 0-100 percentage
  label: string;
}

interface AnnotatedImageProps {
  src: string;
  alt: string;
  annotations: Annotation[];
}

/**
 * AnnotatedImage — Image with numbered callout markers and legend below.
 * Markers are 24x24px gold circles with white number text.
 * Tap/hover a marker to expand it and show a tooltip.
 * Legend lists all annotations below the image.
 */
const AnnotatedImage: React.FC<AnnotatedImageProps> = ({
  src,
  alt,
  annotations,
}) => {
  const [activeId, setActiveId] = useState<number | null>(null);

  const handleToggle = (id: number) => {
    setActiveId((prev) => (prev === id ? null : id));
  };

  return (
    <div className="flex flex-col gap-4 w-full">
      {/* Image with markers */}
      <div className="relative w-full">
        <img src={src} alt={alt} className="w-full block rounded-lg" loading="lazy" />

        {annotations.map((ann) => {
          const isActive = activeId === ann.id;
          return (
            <div
              key={ann.id}
              className="absolute"
              style={{
                left: `${ann.x}%`,
                top: `${ann.y}%`,
                transform: 'translate(-50%, -50%)',
                zIndex: isActive ? 20 : 10,
              }}
            >
              {/* Circle marker */}
              <motion.button
                onClick={() => handleToggle(ann.id)}
                aria-label={`Annotation ${ann.id}: ${ann.label}`}
                aria-expanded={isActive}
                animate={{ scale: isActive ? 1.25 : 1 }}
                transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                className="w-6 h-6 rounded-full bg-tea-gold flex items-center justify-center shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus-visible:ring-offset-1 focus-visible:ring-offset-tea-bg"
              >
                <span className="text-tea-bg text-xs font-bold leading-none select-none">
                  {ann.id}
                </span>
              </motion.button>

              {/* Tooltip */}
              <AnimatePresence>
                {isActive && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.85, y: 4 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.85, y: 4 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                    className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-tea-surface text-tea-text text-xs rounded-lg px-3 py-2 shadow-xl whitespace-nowrap max-w-40 text-center"
                    style={{
                      backdropFilter: 'blur(8px)',
                      WebkitBackdropFilter: 'blur(8px)',
                    }}
                  >
                    {ann.label}
                    {/* Arrow */}
                    <div
                      className="absolute top-full left-1/2 -translate-x-1/2"
                      style={{
                        width: 0,
                        height: 0,
                        borderLeft: '5px solid transparent',
                        borderRight: '5px solid transparent',
                        borderTop: '5px solid var(--color-tea-surface, #f5f0e8)',
                      }}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <ol className="space-y-1.5 pl-2">
        {annotations.map((ann) => (
          <li
            key={ann.id}
            className="flex items-start gap-2 text-xs text-tea-text-sec cursor-pointer hover:text-tea-text transition-colors"
            onClick={() => handleToggle(ann.id)}
          >
            <span
              className="flex-shrink-0 w-5 h-5 rounded-full bg-tea-gold flex items-center justify-center mt-0.5"
            >
              <span className="text-tea-bg font-bold text-xs leading-none">
                {ann.id}
              </span>
            </span>
            <span className={activeId === ann.id ? 'text-tea-text font-medium' : ''}>
              {ann.label}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
};

export default AnnotatedImage;

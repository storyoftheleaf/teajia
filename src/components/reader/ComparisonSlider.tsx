import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

interface ComparisonSliderProps {
  imageA: string;
  imageB: string;
  labelA?: string;
  labelB?: string;
  initialPosition?: number; // 0-100, default 50
}

/**
 * ComparisonSlider — Drag-to-compare two images.
 * Image A clips on the left portion; Image B is fully visible underneath.
 * Supports mouse and touch drag. Labels fade in near the handle.
 */
const ComparisonSlider: React.FC<ComparisonSliderProps> = ({
  imageA,
  imageB,
  labelA,
  labelB,
  initialPosition = 50,
}) => {
  const [position, setPosition] = useState(initialPosition);
  const [dragging, setDragging] = useState(false);
  const [hovered, setHovered] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const updatePosition = useCallback((clientX: number) => {
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const x = clientX - rect.left;
    const pct = Math.min(Math.max((x / rect.width) * 100, 0), 100);
    setPosition(pct);
  }, []);

  // Mouse events
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setDragging(true);
  };

  useEffect(() => {
    if (!dragging) return;

    const handleMouseMove = (e: MouseEvent) => updatePosition(e.clientX);
    const handleMouseUp = () => setDragging(false);

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragging, updatePosition]);

  // Touch events
  const handleTouchStart = (e: React.TouchEvent) => {
    e.preventDefault();
    setDragging(true);
    updatePosition(e.touches[0].clientX);
  };

  useEffect(() => {
    if (!dragging) return;

    const handleTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      updatePosition(e.touches[0].clientX);
    };
    const handleTouchEnd = () => setDragging(false);

    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleTouchEnd);
    return () => {
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [dragging, updatePosition]);

  const showLabels = hovered || dragging;

  return (
    <div
      ref={containerRef}
      className="relative w-full overflow-hidden rounded-lg select-none"
      style={{ cursor: dragging ? 'col-resize' : 'default' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Image B — base layer (full) */}
      <img
        src={imageB}
        alt={labelB ?? 'After'}
        className="w-full block"
        draggable={false}
      />

      {/* Image A — clipped overlay */}
      <div
        className="absolute inset-0 overflow-hidden"
        style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}
      >
        <img
          src={imageA}
          alt={labelA ?? 'Before'}
          className="absolute inset-0 w-full h-full object-cover"
          draggable={false}
        />
      </div>

      {/* Divider line */}
      <div
        className="absolute top-0 bottom-0 w-0.5 bg-tea-gold"
        style={{ left: `${position}%`, transform: 'translateX(-50%)' }}
      />

      {/* Handle circle */}
      <div
        className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-tea-gold flex items-center justify-center shadow-lg cursor-col-resize z-10"
        style={{ left: `${position}%` }}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        role="slider"
        aria-valuenow={Math.round(position)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Comparison slider"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'ArrowLeft') setPosition((p) => Math.max(0, p - 2));
          if (e.key === 'ArrowRight') setPosition((p) => Math.min(100, p + 2));
        }}
      >
        <span className="text-tea-bg text-xs font-bold select-none">⇄</span>
      </div>

      {/* Labels */}
      {labelA && (
        <div
          className="absolute bottom-3 left-3 text-xs font-medium text-tea-bg bg-tea-text/60 px-2 py-0.5 rounded transition-opacity duration-200"
          style={{ opacity: showLabels ? 1 : 0 }}
        >
          {labelA}
        </div>
      )}
      {labelB && (
        <div
          className="absolute bottom-3 right-3 text-xs font-medium text-tea-bg bg-tea-text/60 px-2 py-0.5 rounded transition-opacity duration-200"
          style={{ opacity: showLabels ? 1 : 0 }}
        >
          {labelB}
        </div>
      )}
    </div>
  );
};

export default ComparisonSlider;

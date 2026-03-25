import React from 'react';

interface CompassIconProps {
  className?: string;
  filled?: boolean;
}

export const CompassIcon: React.FC<CompassIconProps> = ({ className = '', filled = false }) => {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {/* Outer circle */}
      <circle cx="12" cy="12" r="10" />

      {/* Inner circle */}
      <circle cx="12" cy="12" r="3" fill={filled ? 'currentColor' : 'none'} />

      {/* Compass needle — north (filled diamond) */}
      <polygon
        points="12,2.5 13.2,9.2 12,10 10.8,9.2"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth={0.5}
      />

      {/* Compass needle — south (outline diamond) */}
      <polygon
        points="12,21.5 13.2,14.8 12,14 10.8,14.8"
        fill={filled ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth={0.5}
      />

      {/* East tick */}
      <line x1="19.5" y1="12" x2="21" y2="12" strokeWidth={1.5} />

      {/* West tick */}
      <line x1="3" y1="12" x2="4.5" y2="12" strokeWidth={1.5} />

      {/* NE tick */}
      <line x1="18.2" y1="5.8" x2="19.3" y2="4.7" strokeWidth={1} />

      {/* NW tick */}
      <line x1="5.8" y1="5.8" x2="4.7" y2="4.7" strokeWidth={1} />

      {/* SE tick */}
      <line x1="18.2" y1="18.2" x2="19.3" y2="19.3" strokeWidth={1} />

      {/* SW tick */}
      <line x1="5.8" y1="18.2" x2="4.7" y2="19.3" strokeWidth={1} />
    </svg>
  );
};

export default CompassIcon;

import React from 'react';

interface LogoIconProps {
  size?: number;
  className?: string;
  filled?: boolean;
}

/**
 * Compact nav icon derived from the LogoEmblem geometry.
 * The emblem's outer form is a compass star, 4 cardinal points + 4 diagonal.
 * This version is stroke-based so it reads cleanly at 14–20px.
 */
export const LogoIcon: React.FC<LogoIconProps> = ({
  size = 16,
  className = '',
  filled = false,
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={filled ? 0 : 1.4}
    strokeLinejoin="round"
    className={className}
    role="img"
    aria-label="Teajia"
  >
    {/* 8-pointed compass star, outer geometry of the LogoEmblem */}
    <path
      d="M12 1.5 L13.9 7.4 L19.8 4.2 L16.6 10.1 L22.5 12 L16.6 13.9 L19.8 19.8 L13.9 16.6 L12 22.5 L10.1 16.6 L4.2 19.8 L7.4 13.9 L1.5 12 L7.4 10.1 L4.2 4.2 L10.1 7.4 Z"
      fill={filled ? 'currentColor' : 'none'}
    />
    {/* Center point, references the circle in the original emblem */}
    <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
  </svg>
);

export default LogoIcon;

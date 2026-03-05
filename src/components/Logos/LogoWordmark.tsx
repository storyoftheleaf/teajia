import React from 'react';

interface LogoWordmarkProps {
  size?: number;
  color?: string;
  className?: string;
  ariaLabel?: string;
}

export const LogoWordmark: React.FC<LogoWordmarkProps> = ({
  size = 150,
  color = '#231f20',
  className = '',
  ariaLabel = 'Teajia wordmark'
}) => {
  return (
    <img
      src="/logos/wordmark.svg"
      alt={ariaLabel}
      height={size}
      className={`inline-block ${className}`}
      style={{ color }}
      role="img"
      aria-label={ariaLabel}
    />
  );
};

export default LogoWordmark;

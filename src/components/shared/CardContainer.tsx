import React from 'react';

interface CardContainerProps {
  children: React.ReactNode;
  className?: string;
  variant?: 'light' | 'dark';
  style?: React.CSSProperties;
}

/**
 * Unified card container with consistent styling
 * Used by all card types: Magazine, Teaware, Tea, Education
 * Memoized to prevent unnecessary re-renders when props haven't changed
 */
const CardContainerComponent: React.FC<CardContainerProps> = ({
  children,
  className = '',
  variant = 'dark',
  style,
}) => {
  const baseStyles = 'rounded-lg border border-tea-border overflow-hidden transition-all duration-300';

  const variantStyles = variant === 'dark'
    ? 'bg-tea-surface'
    : 'bg-tea-surface';

  return (
    <div className={`${baseStyles} ${variantStyles} ${className}`} style={style}>
      {children}
    </div>
  );
};

export const CardContainer = React.memo(CardContainerComponent);

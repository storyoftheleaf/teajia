import React from 'react';

interface CardContainerProps {
  children: React.ReactNode;
  className?: string;
  variant?: 'light' | 'dark';
}

/**
 * Unified card container with consistent styling
 * Used by all card types: Magazine, Teaware, Tea, Education
 * Memoized to prevent unnecessary re-renders when props haven't changed
 */
const CardContainerComponent: React.FC<CardContainerProps> = ({
  children,
  className = '',
  variant = 'dark'
}) => {
  const baseStyles = 'rounded-[1px] overflow-hidden transition-all duration-300';

  const variantStyles = variant === 'dark'
    ? 'bg-tea-surface border border-tea-border'
    : 'bg-tea-surface border border-tea-border';

  return (
    <div className={`${baseStyles} ${variantStyles} ${className}`}>
      {children}
    </div>
  );
};

export const CardContainer = React.memo(CardContainerComponent);

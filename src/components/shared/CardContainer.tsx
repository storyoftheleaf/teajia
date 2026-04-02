import React from 'react';

interface CardContainerProps {
  children: React.ReactNode;
  className?: string;
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
  style,
}) => {
  return (
    <div className={`rounded-lg overflow-hidden transition-all duration-300 bg-tea-surface ${className}`} style={style}>
      {children}
    </div>
  );
};

export const CardContainer = React.memo(CardContainerComponent);

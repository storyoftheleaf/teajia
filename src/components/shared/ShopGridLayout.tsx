import React from 'react';

interface ShopGridLayoutProps {
  children: React.ReactNode;
  className?: string;
}

export const ShopGridLayout: React.FC<ShopGridLayoutProps> = ({ children, className = '' }) => (
  <div className={`grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-3 md:gap-x-4 lg:gap-x-5 gap-y-6 animate-[fadeIn_0.5s_ease-out] ${className}`}>
    {children}
  </div>
);

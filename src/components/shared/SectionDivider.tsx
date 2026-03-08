import React from 'react';

interface SectionDividerProps {
  label: string;
  subtitle?: string;
  className?: string;
}

export const SectionDivider: React.FC<SectionDividerProps> = ({ label, subtitle, className = '' }) => (
  <div className={`py-4 mt-6 first:mt-2 ${className}`}>
    <div className="flex items-center gap-4 opacity-80">
      <span className="text-sm uppercase tracking-[0.25em] text-tea-text font-serif shrink-0 pl-1">
        {label}
      </span>
      <div className="h-[1px] bg-tea-text/10 flex-1" />
    </div>
    {subtitle && (
      <p className="text-xs text-tea-text/60 font-serif italic mt-1 pl-1">
        {subtitle}
      </p>
    )}
  </div>
);

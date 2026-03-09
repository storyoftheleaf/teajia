import React from 'react';

interface PageHeaderSubtitleProps {
  children: React.ReactNode;
  rightContent?: React.ReactNode;
  className?: string;
}

export const PageHeaderSubtitle: React.FC<PageHeaderSubtitleProps> = ({
  children,
  rightContent,
  className = ''
}) => {
  return (
    <div className={`px-4 md:px-6 lg:px-10 py-6 ${className}`} style={{ boxShadow: 'inset 0 1px 0 rgba(184,146,78,0.06), inset 0 -1px 0 rgba(184,146,78,0.06)' }}>
      <div className="flex items-center justify-between gap-6">
        <div className="text-tea-text/70">
          {children}
        </div>
        {rightContent && (
          <div className="flex items-center gap-4 text-xs text-tea-text/60 whitespace-nowrap">
            {rightContent}
          </div>
        )}
      </div>
    </div>
  );
};

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
    <div className={`px-4 md:px-6 lg:px-10 py-6 border-y border-tea-ink/10 dark:border-white/10 ${className}`}>
      <div className="flex items-center justify-between gap-6">
        <div className="text-tea-ink/70 dark:text-tea-paper/70">
          {children}
        </div>
        {rightContent && (
          <div className="flex items-center gap-4 text-xs text-tea-ink/60 dark:text-tea-paper/60 whitespace-nowrap">
            {rightContent}
          </div>
        )}
      </div>
    </div>
  );
};

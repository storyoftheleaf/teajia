import React from 'react';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, subtitle, action, className = '' }: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center py-16 text-center ${className}`}>
      {icon && <div className="text-tea-text-dim mb-4">{icon}</div>}
      <p className="text-tea-text-sec text-sm font-medium">{title}</p>
      {subtitle && <p className="text-tea-text-dim text-xs mt-1 max-w-[240px]">{subtitle}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

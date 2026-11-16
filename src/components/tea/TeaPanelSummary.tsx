import type { ReactNode } from 'react';

interface TeaPanelSummaryProps {
  title: ReactNode;
  subtitle?: ReactNode;
  metadata?: ReactNode;
  trailing?: ReactNode;
  accent?: string;
}

export function TeaPanelSummary({ title, subtitle, metadata, trailing, accent }: TeaPanelSummaryProps) {
  return (
    <header className="admin-card relative flex min-w-0 items-start justify-between gap-3 overflow-hidden py-3 pl-4 pr-3">
      {accent && <span aria-hidden="true" className="absolute inset-y-0 left-0 w-0.5" style={{ background: accent }} />}
      <div className="min-w-0 flex-1">
        <div className="break-words font-sans text-ui-17 font-medium leading-tight text-tea-text">{title}</div>
        {subtitle && <div className="mt-1 min-w-0 break-words text-ui-13 leading-tight text-tea-text-sec">{subtitle}</div>}
        {metadata && <div className="mt-1.5 flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-ui-12 text-tea-text-sec">{metadata}</div>}
      </div>
      {trailing && <div className="flex shrink-0 flex-col items-end gap-2">{trailing}</div>}
    </header>
  );
}

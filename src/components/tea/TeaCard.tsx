import type { ComponentPropsWithoutRef, CSSProperties, ReactNode } from 'react';
import { getStockTypeFinish } from '../../admin/themeUtils';
import { TYPOGRAPHY_CLASSES as T } from '../../designTokens';

interface TeaCardProps {
  title: ReactNode;
  trailing?: ReactNode;
  meta?: ReactNode;
  metrics?: ReactNode;
  metricsLabel?: string;
  metricsLeading?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
  teaType?: string;
  testId?: string;
}

export function TeaCard({
  title,
  trailing,
  meta,
  metrics,
  metricsLabel,
  metricsLeading,
  actions,
  children,
  className,
  teaType = '',
  testId,
}: TeaCardProps) {
  const finish = getStockTypeFinish(teaType);
  const style = {
    '--library-accent': finish.text,
    '--library-metal-hue': finish.tint,
    '--library-metal-l': finish.lightness,
  } as CSSProperties;
  const figures = metrics && <TeaCardMetrics label={metricsLabel}>{metrics}</TeaCardMetrics>;

  return (
    <article className={['library-tea-card', className].filter(Boolean).join(' ')} data-testid={testId} style={style}>
      <header className="library-tea-identity">
        <div className="library-card-title-row">
          {title}
          {trailing}
        </div>
        {meta && <div className="library-card-subrow">{meta}</div>}
      </header>
      {metricsLeading ? <div className="library-workbar">{metricsLeading}{figures}</div> : figures}
      {children}
      {actions && <div className={metricsLeading ? 'library-tea-actions' : 'tea-card-action-row'}>{actions}</div>}
    </article>
  );
}

export function TeaCardTitle({ children, as: Heading = 'h3', className = '', ...props }: ComponentPropsWithoutRef<'h3'> & { as?: 'h2' | 'h3' }) {
  return <Heading {...props} className={`${T.h3} library-card-name tea-card-title text-tea-text ${className}`}>{children}</Heading>;
}

export function TeaCardMeta({ primary, type, trailing }: {
  primary?: ReactNode;
  type?: ReactNode;
  trailing?: ReactNode;
}) {
  return (
    <>
      <span className="library-card-meta-primary min-w-0 flex-1 truncate text-ui-12 text-tea-text-sec">{primary}</span>
      {type && <span className="library-card-type">{type}</span>}
      {trailing && <span className="shrink-0 text-ui-12 tabular-nums text-tea-text-sec">{trailing}</span>}
    </>
  );
}

export function TeaCardMetrics({ label, children }: { label?: string; children: ReactNode }) {
  return <div className="library-ribbon-prices tea-card-metrics" role={label ? 'group' : undefined} aria-label={label}>{children}</div>;
}

export function TeaCardMetric({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <div className="library-ribbon-metric">
      <span className="text-ui-10 text-tea-text-dim">{label}</span>
      {typeof children === 'string' || typeof children === 'number'
        ? <strong className="text-ui-16 text-tea-text">{children}</strong>
        : children}
    </div>
  );
}

export function TeaCardControlRow({ children }: { children: ReactNode }) {
  return <div className="tea-card-control-row">{children}</div>;
}

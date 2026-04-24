import React from 'react';

export const NewDot: React.FC<{ title?: string }> = ({ title = 'Recently added' }) => (
  <span
    className="inline-block w-1.5 h-1.5 rounded-full bg-tea-gold/70 shrink-0"
    title={title}
    aria-label={title}
  />
);

export const SectionHeader: React.FC<{ children: React.ReactNode; meta?: React.ReactNode }> = ({ children, meta }) => (
  <div className="flex items-baseline justify-between px-6 pt-6 pb-2">
    <span className="text-[10px] uppercase tracking-[0.28em] text-tea-text-dim font-medium">{children}</span>
    {meta && <span className="text-[10px] text-tea-text-dim">{meta}</span>}
  </div>
);

interface RowProps {
  label: string;
  onClick: () => void;
  meta?: React.ReactNode;
  isNew?: boolean;
  trailing?: React.ReactNode;
  subdued?: boolean;
}

export const Row: React.FC<RowProps> = ({ label, onClick, meta, isNew, trailing, subdued }) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center gap-3 px-6 py-2.5 text-left transition-colors border-b border-tea-border last:border-0 hover:bg-tea-surface/40 ${
      subdued ? 'opacity-70' : ''
    }`}
    style={{ WebkitTapHighlightColor: 'transparent' }}
  >
    <span className="flex-1 min-w-0 flex items-center gap-2">
      <span className="font-serif text-[14px] text-tea-text leading-tight truncate">{label}</span>
      {isNew && <NewDot />}
    </span>
    {meta != null && (
      <span className="text-[11px] text-tea-text-sec tabular-nums shrink-0 font-sans">{meta}</span>
    )}
    {trailing}
  </button>
);

interface AttentionItem {
  id: string;
  label: string;
  meta?: string;
  onClick: () => void;
  urgent?: boolean;
}

export const NeedsAttention: React.FC<{ items: AttentionItem[] }> = ({ items }) => {
  if (items.length === 0) return null;
  return (
    <div className="mx-6 mt-5 mb-1 border-t border-b border-tea-border divide-y divide-tea-border">
      {items.map(item => (
        <button
          key={item.id}
          onClick={item.onClick}
          className="w-full flex items-center gap-3 py-3 text-left hover:bg-tea-surface/40 transition-colors px-1"
          style={{ WebkitTapHighlightColor: 'transparent' }}
        >
          <span
            className={`w-1 h-1 rounded-full shrink-0 ${item.urgent ? 'bg-tea-gold' : 'bg-tea-text-dim'}`}
            aria-hidden="true"
          />
          <span className="flex-1 min-w-0 font-serif text-[13px] text-tea-text leading-snug truncate">
            {item.label}
          </span>
          {item.meta && (
            <span className="text-[10px] uppercase tracking-[0.15em] text-tea-text-sec shrink-0">
              {item.meta}
            </span>
          )}
        </button>
      ))}
    </div>
  );
};

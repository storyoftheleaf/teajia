import React from 'react';

// ── Editorial helpers (shared across all role views) ──────────────────────

export function getInitials(nameOrEmail: string): string {
  return nameOrEmail.split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

const DAY_WORDS = ['', 'one', 'two', 'three', 'four', 'five', 'six'] as const;

export function daysWord(n: number): string {
  return DAY_WORDS[n] ?? String(n);
}

export function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function daysSince(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}

export function truncate(s: string, max: number): string {
  const clean = s.replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  return clean.slice(0, max).replace(/[\s,.;:—-]+$/, '') + '…';
}

// ── Reusable typography classes (panel-local) ─────────────────────────────
// These set the readable floor inside AccountPanel. The general design
// system sits at 17px body / 11px label; the panel runs slightly tighter
// because it is a 400px drawer, but never below WCAG-safe sizes.

export const HINT_CLASS = 'text-[11px] uppercase tracking-[0.24em] text-tea-text-sec font-medium';
export const META_CLASS = 'text-[12px] text-tea-text-sec tracking-[0.02em]';
export const META_DIM_CLASS = 'text-[12px] text-tea-text-dim tracking-[0.02em]';
export const FOOTER_LINK_CLASS = 'py-2 -my-2 hover:text-tea-gold transition-colors';

// ── Building blocks ────────────────────────────────────────────────────────

export const NewDot: React.FC<{ title?: string }> = ({ title = 'Recently added' }) => (
  <span
    className="inline-block w-1.5 h-1.5 rounded-full bg-tea-gold shrink-0"
    title={title}
    aria-label={title}
  />
);

export const Hint: React.FC<{ children: React.ReactNode; icon?: React.ReactNode }> = ({ children, icon }) => (
  <div className={`${HINT_CLASS} mb-3 flex items-center gap-2`}>
    {icon && <span className="text-tea-gold/70 shrink-0 flex items-center" aria-hidden="true">{icon}</span>}
    <span>{children}</span>
  </div>
);

export const SectionHeader: React.FC<{ children: React.ReactNode; meta?: React.ReactNode }> = ({ children, meta }) => (
  <div className="flex items-baseline justify-between px-6 pt-6 pb-2">
    <span className={HINT_CLASS}>{children}</span>
    {meta && <span className="text-[11px] text-tea-text-sec">{meta}</span>}
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
    className={`w-full flex items-center gap-3 px-6 py-3 text-left transition-colors border-b border-tea-border last:border-0 hover:bg-tea-surface/40 ${
      subdued ? 'opacity-80' : ''
    }`}
    style={{ WebkitTapHighlightColor: 'transparent' }}
  >
    <span className="flex-1 min-w-0 flex items-center gap-2">
      <span className="font-serif text-[15px] text-tea-text leading-tight truncate">{label}</span>
      {isNew && <NewDot />}
    </span>
    {meta != null && (
      <span className="text-[12px] text-tea-text-sec tabular-nums shrink-0 font-sans">{meta}</span>
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
            className={`w-1.5 h-1.5 rounded-full shrink-0 ${item.urgent ? 'bg-tea-gold' : 'bg-tea-text-sec'}`}
            aria-hidden="true"
          />
          <span className="flex-1 min-w-0 font-serif text-[14px] text-tea-text leading-snug truncate">
            {item.label}
          </span>
          {item.meta && (
            <span className="text-[11px] uppercase tracking-[0.15em] text-tea-text-sec shrink-0">
              {item.meta}
            </span>
          )}
        </button>
      ))}
    </div>
  );
};

// ── Shared content-preview block (extracted from MemberView/OperatorView) ──

export const PreviewBlock: React.FC<{
  hint: string;
  onClick: () => void;
  children: React.ReactNode;
  icon?: React.ReactNode;
}> = ({ hint, onClick, children, icon }) => (
  <button
    onClick={onClick}
    className="w-full text-left px-6 py-6 hover:bg-tea-surface/40 transition-colors border-t border-tea-border"
    style={{ WebkitTapHighlightColor: 'transparent' }}
  >
    <Hint icon={icon}>{hint}</Hint>
    {children}
  </button>
);

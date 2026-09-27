import React from 'react';

// The pieces of Your Table still in use. The rest of this file (rows,
// instrument tiles, identity cards, pills) was an earlier panel's kit and was
// removed once nothing rendered it.

const DAY_WORDS = ['', 'one', 'two', 'three', 'four', 'five', 'six'] as const;

export function daysWord(n: number): string {
  return DAY_WORDS[n] ?? String(n);
}

const META_DIM_CLASS = 'text-ui-12 text-tea-text-dim';

interface AttentionItem {
  id: string;
  label: string;
  /**
   * What kind of waiting this is, in plain words ("waiting to be priced").
   * Optional: a row that says enough in its label alone leaves it off and
   * renders exactly as it always did.
   */
  note?: string;
  meta?: string;
  onClick: () => void;
  urgent?: boolean;
}

/**
 * Zone three of the panel IA: the things waiting on whoever is reading.
 *
 * `className` replaces the block's own spacing. The default keeps the inset
 * every existing caller was built against; pass `""` when the surrounding
 * section already owns the margins.
 */
export const NeedsAttention: React.FC<{ items: AttentionItem[]; className?: string }> = ({
  items,
  className = 'mx-6 mt-5 mb-1',
}) => {
  if (items.length === 0) return null;
  return (
    <div className={`${className} border-t border-b border-tea-border divide-y divide-tea-border`}>
      {items.map(item => (
        <button
          key={item.id}
          onClick={item.onClick}
          className="w-full min-h-[44px] flex items-center gap-3 py-3 text-left hover:bg-tea-accent-sub transition-colors px-1"
          style={{ WebkitTapHighlightColor: 'transparent' }}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full shrink-0 ${item.urgent ? 'bg-tea-gold' : 'bg-tea-text-sec'}`}
            aria-hidden="true"
          />
          <span className="flex-1 min-w-0">
            <span className="block font-display text-ui-15 text-tea-text leading-snug truncate">
              {item.label}
            </span>
            {item.note && (
              <span className={`block ${META_DIM_CLASS} leading-snug mt-0.5 truncate`}>
                {item.note}
              </span>
            )}
          </span>
          {item.meta && (
            <span className="text-ui-11 uppercase tracking-[0.15em] text-tea-text-sec shrink-0">
              {item.meta}
            </span>
          )}
        </button>
      ))}
    </div>
  );
};

// ── ListShell: the bordered, rounded list surface the sub-views share.

export const ListShell: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
  <ul
    className={[
      'divide-y divide-tea-border bg-tea-surface border border-tea-border rounded-xl overflow-hidden',
      className ?? '',
    ].join(' ')}
  >
    {children}
  </ul>
);

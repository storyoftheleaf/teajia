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

export const HINT_CLASS = 'text-ui-11 uppercase tracking-[0.15em] text-tea-text-dim';
export const META_CLASS = 'text-ui-12 text-tea-text-sec';
export const META_DIM_CLASS = 'text-ui-12 text-tea-text-dim';
export const FOOTER_LINK_CLASS = 'py-2 -my-2 text-tea-text-sec hover:text-tea-text transition-colors';

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
    {icon && <span className="text-tea-text-sec shrink-0 flex items-center" aria-hidden="true">{icon}</span>}
    <span>{children}</span>
  </div>
);

export const SectionHeader: React.FC<{ children: React.ReactNode; meta?: React.ReactNode }> = ({ children, meta }) => (
  <div className="flex items-baseline justify-between px-6 pt-6 pb-2">
    <span className={HINT_CLASS}>{children}</span>
    {meta && <span className="text-ui-11 text-tea-text-sec">{meta}</span>}
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
    className={`w-full flex items-center gap-3 px-6 py-3 text-left transition-colors border-b border-tea-border last:border-0 hover:bg-tea-accent-sub ${
      subdued ? 'opacity-80' : ''
    }`}
    style={{ WebkitTapHighlightColor: 'transparent' }}
  >
    <span className="flex-1 min-w-0 flex items-center gap-2">
      <span className="font-display text-ui-15 text-tea-text leading-tight truncate">{label}</span>
      {isNew && <NewDot />}
    </span>
    {meta != null && (
      <span className="text-ui-12 text-tea-text-sec font-mono tabular-nums shrink-0">{meta}</span>
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
          className="w-full flex items-center gap-3 py-3 text-left hover:bg-tea-accent-sub transition-colors px-1"
          style={{ WebkitTapHighlightColor: 'transparent' }}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full shrink-0 ${item.urgent ? 'bg-tea-gold' : 'bg-tea-text-sec'}`}
            aria-hidden="true"
          />
          <span className="flex-1 min-w-0 font-display text-ui-15 text-tea-text leading-snug truncate">
            {item.label}
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

// ── Instrument tile (Console grid) ────────────────────────────────────────
// A typeset, filled tile with a mono numeral and a serif small-caps label.
// Built from the same hairline-border + warm surface vocabulary used
// elsewhere in the app, so it reads as instrument-typeset-into-page rather
// than dropped-on-top app chrome. `urgent` promotes a single tile to the
// bronze-fill state — only one tile per grid should ever be urgent.

interface InstrumentProps {
  value: number | string | null;
  label: string;
  sublabel?: string;
  onClick?: () => void;
  urgent?: boolean;
  disabled?: boolean;
  size?: 'hero' | 'small';
}

export const Instrument: React.FC<InstrumentProps> = ({
  value,
  label,
  sublabel,
  onClick,
  urgent,
  disabled,
  size = 'small',
}) => {
  const display =
    value == null || value === 0 || value === '' ? '—' : value;
  const isQuiet = display === '—' || disabled;
  const Tag: any = onClick && !disabled ? 'button' : 'div';
  const isHero = size === 'hero';
  return (
    <Tag
      onClick={onClick && !disabled ? onClick : undefined}
      disabled={disabled}
      className={[
        'relative flex flex-col justify-between text-left',
        isHero ? 'px-5 py-4 min-h-[112px]' : 'px-3.5 py-3 min-h-[78px]',
        'border border-tea-border',
        urgent
          ? 'bg-tea-gold/12'
          : 'bg-tea-surface',
        onClick && !disabled
          ? urgent
            ? 'hover:bg-tea-gold/16 active:bg-tea-gold/20 active:translate-y-[0.5px]'
            : 'hover:bg-tea-elevated active:bg-tea-elevated active:translate-y-[0.5px]'
          : '',
        'transition-[background-color,transform] duration-150',
        'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-tea-gold focus-visible:ring-offset-0',
        disabled ? 'opacity-50 cursor-default' : '',
      ].join(' ')}
      style={{ WebkitTapHighlightColor: 'transparent' }}
    >
      <span
        className={[
          'font-mono tabular-nums leading-none',
          isHero ? 'text-[44px]' : 'text-ui-26',
          urgent
            ? 'text-tea-gold'
            : isQuiet
            ? 'text-tea-text-dim'
            : 'text-tea-text',
        ].join(' ')}
        style={{ fontFamily: 'var(--font-mono)' }}
      >
        {display}
      </span>
      <div className={isHero ? 'mt-3' : 'mt-2'}>
        <div
          className={[
            'uppercase font-medium leading-tight',
            isHero
              ? 'text-ui-11 tracking-[0.24em] text-tea-text'
              : 'text-ui-10 tracking-[0.22em] text-tea-text-sec',
          ].join(' ')}
        >
          {label}
        </div>
        {sublabel && (
          <div
            className={[
              'leading-tight italic mt-0.5',
              isHero ? 'text-ui-13 text-tea-text-sec' : 'text-ui-11 text-tea-text-dim',
            ].join(' ')}
            style={{ fontFamily: 'var(--font-display)' }}
          >
            {sublabel}
          </div>
        )}
      </div>
    </Tag>
  );
};

// Asymmetric console: one hero row, then a 2×2 of smaller tiles below.
// The first child is rendered as the hero (full width); children 2–5 fall
// into the 2×2 grid. Pass exactly five children.
export const ConsoleGrid: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const items = React.Children.toArray(children);
  const [hero, ...rest] = items;
  return (
    <div className="px-4 pt-3 pb-1 space-y-2">
      <div className="grid grid-cols-1">{hero}</div>
      <div className="grid grid-cols-2 gap-2">{rest}</div>
    </div>
  );
};

// ── Primary verb (single bronze CTA, state-driven) ────────────────────────
// One verb per screen. Filled bronze when there's an urgent action,
// bordered bronze when the action is the daily default. Never two
// bronze fills on the same screen — the urgent Instrument tile and the
// PrimaryVerb fill must not both be bronze at once. The component itself
// can't enforce that — call sites must.

interface PrimaryVerbProps {
  label: string;
  onClick: () => void;
  variant?: 'filled' | 'bordered';
}

export const PrimaryVerb: React.FC<PrimaryVerbProps> = ({ label, onClick, variant = 'bordered' }) => (
  <div className="px-4 pt-4 pb-1">
    <button
      onClick={onClick}
      className={[
        'w-full min-h-[52px] px-5',
        'flex items-center justify-center gap-2',
        'text-ui-13 uppercase tracking-[0.22em] font-medium',
        'transition-[background-color,border-color,transform] duration-150',
        'active:translate-y-[0.5px]',
        'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-tea-gold focus-visible:ring-offset-2 focus-visible:ring-offset-tea-bg',
        'border',
        variant === 'filled'
          ? 'bg-tea-gold text-tea-bg border-tea-gold hover:bg-tea-gold-lt hover:border-tea-gold-lt'
          : 'bg-transparent text-tea-gold border-tea-gold/50 hover:bg-tea-gold/10 hover:border-tea-gold',
      ].join(' ')}
      style={{ WebkitTapHighlightColor: 'transparent' }}
    >
      {label}
    </button>
  </div>
);

// ── Shared content-preview block (extracted from MemberView/OperatorView) ──

export const PreviewBlock: React.FC<{
  hint: string;
  onClick: () => void;
  children: React.ReactNode;
  icon?: React.ReactNode;
}> = ({ hint, onClick, children, icon }) => (
  <button
    onClick={onClick}
    className="w-full text-left px-6 py-6 hover:bg-tea-accent-sub transition-colors border-t border-tea-border"
    style={{ WebkitTapHighlightColor: 'transparent' }}
  >
    <Hint icon={icon}>{hint}</Hint>
    {children}
  </button>
);

// ── Identity card (§19) ───────────────────────────────────────────────────
// Canonical bordered identity block. Avatar 48px (initials in font-display
// text-ui-15 text-tea-text-sec on bg-tea-elevated). Name as .h3, email as
// text-ui-13 text-tea-text-sec mt-0.5, meta as text-ui-12 text-tea-text-dim
// mt-0.5. Optional status pill row at bottom. `avatarBadge` is an optional
// small mark stamped onto the avatar's bottom-right corner (e.g. SealIcon
// for owner/platform roles).

interface IdentityCardProps {
  user: { name?: string; email: string } | null;
  avatarDataUrl: string | null;
  onAvatarClick: () => void;
  fallbackTitle?: string;
  meta?: React.ReactNode;
  status?: React.ReactNode;
  avatarBadge?: React.ReactNode;
}

export const IdentityCard: React.FC<IdentityCardProps> = ({
  user,
  avatarDataUrl,
  onAvatarClick,
  fallbackTitle = 'Welcome',
  meta,
  status,
  avatarBadge,
}) => {
  const displayName = user?.name?.trim() || user?.email?.split('@')[0] || fallbackTitle;
  const showEmail = !!user?.email && (!user.name || user.name.trim() !== user.email);
  return (
    <div className="mx-6 mt-5 bg-tea-surface border border-tea-border rounded-xl p-5 flex items-start gap-4">
      <button
        onClick={onAvatarClick}
        className="relative w-12 h-12 rounded-full bg-tea-elevated flex items-center justify-center border border-tea-border overflow-hidden shrink-0"
        title={user?.name || user?.email || 'Change photo'}
        aria-label="Change photo"
        style={{ WebkitTapHighlightColor: 'transparent' }}
      >
        {avatarDataUrl ? (
          <img src={avatarDataUrl} alt="" className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <span className="font-display text-ui-15 text-tea-text-sec">
            {user ? getInitials(user.name || user.email) : '茶'}
          </span>
        )}
        {avatarBadge && (
          <span
            className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-tea-bg border border-tea-border flex items-center justify-center"
            aria-hidden="true"
          >
            {avatarBadge}
          </span>
        )}
      </button>
      <div className="flex-1 min-w-0">
        <h2 className="h3 truncate">{displayName}</h2>
        {showEmail && (
          <p className="text-ui-13 text-tea-text-sec mt-0.5 truncate">{user!.email}</p>
        )}
        {meta && (
          <p className="text-ui-12 text-tea-text-dim mt-0.5 truncate">{meta}</p>
        )}
        {status && <div className="mt-3 flex flex-wrap items-center gap-1.5">{status}</div>}
      </div>
    </div>
  );
};

// ── Status pill (§19 identity card row) ───────────────────────────────────
// A small inset pill for role/seal/status. Default tone is bronze; pass
// `tone="muted"` for a quieter inactive pill.

export const StatusPill: React.FC<{
  children: React.ReactNode;
  tone?: 'gold' | 'muted';
  icon?: React.ReactNode;
}> = ({ children, tone = 'gold', icon }) => (
  <span
    className={[
      'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-ui-9 uppercase tracking-caps shrink-0',
      tone === 'gold'
        ? 'bg-tea-gold/10 text-tea-text ring-1 ring-inset ring-tea-gold/40'
        : 'bg-tea-elevated text-tea-text-sec',
    ].join(' ')}
  >
    {icon}
    {children}
  </span>
);

// ── ListShell / ListRow (§19 list rows for orders, samples, saved, reading)
// Canonical sub-view list: bordered, rounded-xl surface that divides between
// rows. Title in font-display text-ui-15 text-tea-text; meta in
// text-ui-12 text-tea-text-dim mt-1; right-aligned status pill or chevron
// via `trailing`. Use `as="div"` when the row contains nested interactive
// elements (nesting buttons is invalid HTML).

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

interface ListRowProps {
  title: string;
  meta?: React.ReactNode;
  onClick?: () => void;
  trailing?: React.ReactNode;
  leading?: React.ReactNode;
  as?: 'button' | 'div';
  children?: React.ReactNode;
}

export const ListRow: React.FC<ListRowProps> = ({
  title,
  meta,
  onClick,
  trailing,
  leading,
  as = 'button',
  children,
}) => {
  const Tag = as === 'button' ? 'button' : 'div';
  return (
    <li>
      <Tag
        onClick={onClick}
        className={[
          'w-full text-left px-4 md:px-6 py-4 flex items-center gap-3 transition-colors',
          onClick ? 'hover:bg-tea-accent-sub' : '',
        ].join(' ')}
        style={onClick ? { WebkitTapHighlightColor: 'transparent' } : undefined}
      >
        {leading && <div className="shrink-0">{leading}</div>}
        <div className="flex-1 min-w-0">
          <div className="font-display text-ui-15 text-tea-text truncate">{title}</div>
          {meta && <div className="text-ui-12 text-tea-text-dim mt-1 truncate">{meta}</div>}
          {children}
        </div>
        {trailing && <div className="shrink-0 ml-2">{trailing}</div>}
      </Tag>
    </li>
  );
};

import React from 'react';

/**
 * The few shapes the full "Edit all fields" card is made of, so every field in
 * it is dressed the same way TeaFace is: a Lora capital label on the left, the
 * value on the right, a divider under the line.
 */

/** A section heading: the word large, a gold hairline under it (as Today draws one). */
export const CardHeading: React.FC<{ title: string; testId?: string }> = ({ title, testId }) => (
  <div className="curate-v2-heading" data-testid={testId}>
    <h3>{title}</h3>
  </div>
);

/** One line of the card. A `label` element when it wraps a control, so a tap anywhere on it reaches the control. */
export const CardLine: React.FC<{
  label: string;
  children: React.ReactNode;
  as?: 'div' | 'label';
  className?: string;
  testId?: string;
  htmlFor?: string;
}> = ({ label, children, as = 'div', className = '', testId, htmlFor }) => {
  const Tag = as as 'div';
  return (
    <Tag className={`curate-v2-line ${className}`} data-testid={testId} {...(htmlFor ? { htmlFor } : {})}>
      <span className="curate-v2-label">{label}</span>
      {children}
    </Tag>
  );
};

/** A choice in a sheet's list: the word in Cormorant, a gold word once chosen. */
export const SheetRow: React.FC<{
  label: string;
  hint?: string;
  selected?: boolean;
  hasSubflow?: boolean;
  onSelect: () => void;
}> = ({ label, hint, selected, hasSubflow, onSelect }) => (
  <button type="button" onClick={onSelect} aria-pressed={selected} className="curate-v2-sheetrow">
    <span className="min-w-0 flex-1 truncate">
      {label}
      {hint && <span className="curate-v2-label ml-3 normal-case tracking-normal">{hint}</span>}
    </span>
    {hasSubflow && <span className="font-mono text-ui-15 text-tea-text-sec" aria-hidden>›</span>}
    {selected && !hasSubflow && <span className="font-mono text-ui-11 uppercase tracking-[0.16em] text-tea-gold">chosen</span>}
  </button>
);

/** A line that opens a picker: the value in Cormorant, or a gold "choose" while it is empty. */
export const PickLine: React.FC<{
  label: string;
  value?: string | null;
  onClick: () => void;
  testId?: string;
  ariaLabel?: string;
  ariaExpanded?: boolean;
  ariaControls?: string;
  style?: React.CSSProperties;
}> = ({ label, value, onClick, testId, ariaLabel, ariaExpanded, ariaControls, style }) => (
  <button
    type="button"
    onClick={onClick}
    className="curate-v2-line w-full text-left"
    data-testid={testId}
    data-curate-action
    aria-label={ariaLabel}
    aria-haspopup="dialog"
    aria-expanded={ariaExpanded}
    aria-controls={ariaControls}
  >
    <span className="curate-v2-label">{label}</span>
    <span className={`min-w-0 flex-1 truncate text-right ${value ? 'font-display text-ui-17 text-tea-text' : 'font-mono text-ui-13 text-tea-gold'}`} style={style}>{value || 'choose'}</span>
  </button>
);

import React from 'react';
import { LoadingSpinner } from './LoadingSpinner';

/**
 * The seven button variants. Each is one class in src/styles/tokens.css (the
 * master style file, section 6), which decides shape, height, padding, type
 * and colour; this component only picks the class. `ghost` is the old name
 * for `quiet`; `danger` is the secondary outline in the error tone; `plain`
 * renders a bare <button> for callers that style themselves.
 */
type ButtonVariant =
  | 'primary' | 'secondary' | 'quiet' | 'icon' | 'tab' | 'chip' | 'field'
  | 'ghost' | 'danger' | 'plain';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ComponentPropsWithRef<'button'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: React.ReactNode;
  children?: React.ReactNode;
  fullWidth?: boolean;
}

const VARIANT_CLASS: Record<Exclude<ButtonVariant, 'plain'>, string> = {
  primary: 'btn-primary',
  secondary: 'btn-secondary',
  quiet: 'btn-quiet',
  ghost: 'btn-quiet',
  icon: 'btn-icon',
  tab: 'btn-tab',
  chip: 'btn-chip',
  field: 'btn-field',
  danger: 'btn-secondary btn-danger',
};

const SIZE_CLASS: Record<ButtonSize, string> = { sm: 'btn-sm', md: '', lg: 'btn-lg' };

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  children,
  fullWidth = false,
  disabled,
  className = '',
  ...props
}) => {
  if (variant === 'plain') {
    return (
      <button className={className} disabled={disabled || loading} {...props}>
        {children}
      </button>
    );
  }

  const classes = [VARIANT_CLASS[variant], SIZE_CLASS[size], fullWidth ? 'w-full' : '', className]
    .filter(Boolean)
    .join(' ');

  return (
    <button className={classes} disabled={disabled || loading} {...props}>
      {loading ? (
        <LoadingSpinner size="sm" className={variant === 'primary' ? 'border-t-tea-bg' : 'border-t-tea-gold'} />
      ) : (
        <>
          {icon && <span className="flex-shrink-0">{icon}</span>}
          {children && <span>{children}</span>}
        </>
      )}
    </button>
  );
};

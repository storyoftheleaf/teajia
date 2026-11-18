import React from 'react';
import { LoadingSpinner } from './LoadingSpinner';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'icon' | 'danger' | 'plain';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ComponentPropsWithRef<'button'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: React.ReactNode;
  children?: React.ReactNode;
  fullWidth?: boolean;
}

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

  // docs/DESIGN_SYSTEM.md §7: sans 12px semibold, title case, no tracking,
  // 4px corners, no lift on hover. Heights come from the control tokens in
  // tailwind.css (28 / 32 / 36px with a mouse); --tap-min keeps every size at
  // 44px on a touch screen.
  const baseClasses = 'inline-flex items-center justify-center gap-1.5 font-sans font-semibold rounded-control min-w-tap min-h-tap transition-colors duration-150 disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus-visible:ring-offset-2 focus-visible:ring-offset-tea-bg';

  // `primary` carries no colour of its own. `.cta-solid` (card-utilities.css) is
  // the one measured solid-bronze treatment: the hand-written `bg-tea-gold
  // text-tea-bg` this used to spell out resolves to cream on #8e6d2e in light
  // mode, which is 4.10:1 and under the 4.5:1 floor. `.cta-solid` fills with
  // `--tea-gold-solid`, identical to `--tea-gold` on espresso and darkened to
  // #806229 on parchment, which measures 4.91:1 with the same cream.
  const variantClasses = {
    primary: 'cta-solid',
    secondary: 'bg-transparent text-tea-text-sec border border-tea-border hover:text-tea-text hover:bg-tea-accent-sub',
    ghost: 'bg-transparent text-tea-text-sec hover:text-tea-text hover:bg-tea-accent-sub',
    icon: 'bg-transparent text-tea-text-sec hover:text-tea-text hover:bg-tea-accent-sub',
    danger: 'bg-tea-error text-tea-bg hover:bg-tea-error/90',
  };

  const sizeClasses = {
    sm: variant === 'icon' ? 'h-control-sm w-control-sm text-ui-12' : 'h-control-sm px-2.5 text-ui-12',
    md: variant === 'icon' ? 'h-control w-control text-ui-13' : 'h-control px-3 text-ui-12',
    lg: variant === 'icon' ? 'h-control-lg w-control-lg text-ui-14' : 'h-control-lg px-4 text-ui-13',
  };

  const widthClass = fullWidth ? 'w-full' : '';

  return (
    <button
      className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${widthClass} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
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

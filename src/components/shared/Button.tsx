import React from 'react';
import { LoadingSpinner } from './LoadingSpinner';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: React.ReactNode;
  children: React.ReactNode;
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
  const baseClasses = 'inline-flex items-center justify-center gap-2 font-sans font-semibold tracking-wide rounded-sm transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed min-w-[44px] min-h-[44px] focus-visible:outline-2 focus-visible:outline-tea-seal focus-visible:outline-offset-2 focus-visible:ring-4 focus-visible:ring-tea-gold/20';

  const variantClasses = {
    primary: 'bg-tea-gold text-tea-bg hover:bg-tea-gold/90 active:bg-tea-gold/80',
    secondary: 'bg-tea-text/10 text-tea-text hover:bg-tea-text/20',
    ghost: 'bg-transparent text-tea-text hover:bg-tea-text/10',
    danger: 'bg-red-600 text-white hover:bg-red-700 active:bg-red-800'
  };

  const sizeClasses = {
    sm: 'px-3 py-2 text-sm',
    md: 'px-4 py-3 text-base',
    lg: 'px-6 py-4 text-lg'
  };

  const widthClass = fullWidth ? 'w-full' : '';

  return (
    <button
      className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${widthClass} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <LoadingSpinner size="sm" className={variant === 'primary' ? 'border-t-tea-paper' : 'border-t-tea-seal'} />
      ) : (
        <>
          {icon && <span className="flex-shrink-0">{icon}</span>}
          <span>{children}</span>
        </>
      )}
    </button>
  );
};

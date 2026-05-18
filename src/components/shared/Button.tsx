import React from 'react';
import { motion } from 'framer-motion';
import { LoadingSpinner } from './LoadingSpinner';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'icon' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
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
  const baseClasses = 'inline-flex items-center justify-center gap-2 font-sans font-medium tracking-wide transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus-visible:ring-offset-2 focus-visible:ring-offset-tea-bg';

  const variantClasses = {
    primary: 'bg-tea-gold text-tea-bg hover:bg-tea-gold-lt active:bg-tea-gold/80 rounded-xl min-w-[44px] min-h-[44px]',
    secondary: 'bg-tea-surface text-tea-text border border-tea-border hover:bg-tea-elevated rounded-xl min-w-[44px] min-h-[44px]',
    ghost: 'bg-transparent text-tea-text-sec hover:text-tea-text hover:bg-tea-accent-sub rounded-xl min-w-[44px] min-h-[44px]',
    icon: 'bg-transparent text-tea-text-sec hover:text-tea-text hover:bg-tea-accent-sub rounded-xl min-w-[44px] min-h-[44px]',
    danger: 'bg-tea-error text-tea-bg hover:bg-tea-error active:bg-tea-error/90 rounded-xl min-w-[44px] min-h-[44px]',
  };

  const sizeClasses = {
    sm: variant === 'icon' ? 'p-2 text-sm' : 'px-3 py-2 text-sm',
    md: variant === 'icon' ? 'p-2.5 text-base' : 'px-5 py-2.5 text-base',
    lg: variant === 'icon' ? 'p-3 text-lg' : 'px-6 py-3 text-lg',
  };

  const widthClass = fullWidth ? 'w-full' : '';

  return (
    <motion.button
      className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${widthClass} ${className}`}
      disabled={disabled || loading}
      whileHover={!disabled ? { y: -1 } : undefined}
      whileTap={!disabled ? { scale: 0.97 } : undefined}
      transition={{ duration: 0.15 }}
      {...(props as any)}
    >
      {loading ? (
        <LoadingSpinner size="sm" className={variant === 'primary' ? 'border-t-tea-bg' : 'border-t-tea-gold'} />
      ) : (
        <>
          {icon && <span className="flex-shrink-0">{icon}</span>}
          {children && <span>{children}</span>}
        </>
      )}
    </motion.button>
  );
};

import React from 'react';
import { cn } from '../../lib/utils';

/**
 * Button Component
 * Modern button with multiple variants and sizes
 * 
 * Variants: default, primary, secondary, outline, ghost, destructive, link
 * Sizes: sm, default, lg, icon
 */

const Button = React.forwardRef(({
  className,
  variant = 'default',
  size = 'default',
  children,
  disabled,
  loading,
  asChild = false,
  ...props
}, ref) => {
  const baseStyles = 'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50';
  
  const variants = {
    default: 'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] hover:bg-[hsl(var(--primary))]/90 shadow-sm hover:shadow-md hover:-translate-y-0.5',
    primary: 'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] hover:bg-[hsl(var(--primary))]/90 shadow-sm hover:shadow-md hover:-translate-y-0.5',
    secondary: 'bg-[hsl(var(--secondary))] text-[hsl(var(--secondary-foreground))] hover:bg-[hsl(var(--secondary))]/80',
    outline: 'border border-[hsl(var(--border))] bg-transparent hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))]',
    ghost: 'hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))]',
    destructive: 'bg-[hsl(var(--destructive))] text-[hsl(var(--destructive-foreground))] hover:bg-[hsl(var(--destructive))]/90',
    link: 'text-[hsl(var(--primary))] underline-offset-4 hover:underline',
  };
  
  const sizes = {
    default: 'h-9 px-4 py-2',
    sm: 'h-8 rounded-md px-3 text-xs',
    lg: 'h-10 rounded-md px-6',
    icon: 'h-9 w-9',
  };

  const Comp = asChild ? React.Slot : 'button';

  return (
    <Comp
      ref={ref}
      className={cn(
        baseStyles,
        variants[variant],
        sizes[size],
        className
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading && (
        <svg
          className="animate-spin h-4 w-4"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      )}
      {children}
    </Comp>
  );
});

Button.displayName = 'Button';

export { Button };

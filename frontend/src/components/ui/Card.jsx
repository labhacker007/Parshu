import React from 'react';
import { cn } from '../../lib/utils';

/**
 * Card Component Family
 * Modern card components with glassmorphism support
 */

// Main Card
const Card = React.forwardRef(({ className, glass = false, hover = true, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      'rounded-xl border text-[hsl(var(--card-foreground))] shadow-sm',
      glass ? 'glass-card' : 'bg-[hsl(var(--card))] border-[hsl(var(--border))]',
      hover && 'card-hover cursor-pointer',
      className
    )}
    {...props}
  />
));
Card.displayName = 'Card';

// Card Header
const CardHeader = React.forwardRef(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('flex flex-col space-y-1.5 p-6', className)}
    {...props}
  />
));
CardHeader.displayName = 'CardHeader';

// Card Title
const CardTitle = React.forwardRef(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn('font-semibold leading-none tracking-tight', className)}
    {...props}
  />
));
CardTitle.displayName = 'CardTitle';

// Card Description
const CardDescription = React.forwardRef(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn('text-sm text-[hsl(var(--muted-foreground))]', className)}
    {...props}
  />
));
CardDescription.displayName = 'CardDescription';

// Card Content
const CardContent = React.forwardRef(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('p-6 pt-0', className)} {...props} />
));
CardContent.displayName = 'CardContent';

// Card Footer
const CardFooter = React.forwardRef(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('flex items-center p-6 pt-0', className)}
    {...props}
  />
));
CardFooter.displayName = 'CardFooter';

// Stat Card - Specialized for dashboard stats
const StatCard = React.forwardRef(({
  className,
  title,
  value,
  icon: Icon,
  trend,
  trendUp,
  glass = false,
  delay = 0,
  ...props
}, ref) => (
  <Card
    ref={ref}
    className={cn('p-6', className)}
    glass={glass}
    style={{ animationDelay: `${delay}ms` }}
    {...props}
  >
    <div className="flex items-center justify-between">
      <div className={cn(
        'p-2 rounded-lg',
        glass ? 'bg-[hsl(var(--primary))]/20' : 'bg-[hsl(var(--primary))]/10'
      )}>
        {Icon && <Icon className="h-5 w-5 text-[hsl(var(--primary))]" />}
      </div>
      {trend && (
        <span className={cn(
          'text-xs font-medium flex items-center gap-1',
          trendUp === true ? 'text-[hsl(var(--success))]' : 
          trendUp === false ? 'text-[hsl(var(--critical))]' : 'text-[hsl(var(--muted-foreground))]'
        )}>
          {trendUp === true && '↑'}
          {trendUp === false && '↓'}
          {trend}
        </span>
      )}
    </div>
    <div className="mt-4">
      <div className="text-2xl font-bold text-[hsl(var(--foreground))]">
        {value}
      </div>
      <div className="text-sm text-[hsl(var(--muted-foreground))]">
        {title}
      </div>
    </div>
  </Card>
));
StatCard.displayName = 'StatCard';

// Feature Card - For feature highlights
const FeatureCard = React.forwardRef(({
  className,
  icon: Icon,
  title,
  description,
  glass = true,
  delay = 0,
  ...props
}, ref) => (
  <div
    ref={ref}
    className={cn(
      'rounded-xl p-4 animate-fade-up card-hover',
      glass ? 'glass-card' : 'bg-[hsl(var(--card))] border border-[hsl(var(--border))]',
      className
    )}
    style={{ animationDelay: `${delay}ms` }}
    {...props}
  >
    <div className="flex items-start gap-3">
      <div className={cn(
        'p-2 rounded-lg shrink-0',
        glass ? 'bg-[hsl(var(--primary))]/20' : 'bg-[hsl(var(--primary))]/10'
      )}>
        {Icon && <Icon className="h-5 w-5 text-[hsl(var(--primary))]" />}
      </div>
      <div>
        <h4 className="font-medium text-sm text-[hsl(var(--foreground))]">{title}</h4>
        <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">{description}</p>
      </div>
    </div>
  </div>
));
FeatureCard.displayName = 'FeatureCard';

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardDescription,
  CardContent,
  StatCard,
  FeatureCard,
};

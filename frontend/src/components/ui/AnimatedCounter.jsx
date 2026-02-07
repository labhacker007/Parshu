import React, { useState, useEffect, useRef } from 'react';

/**
 * AnimatedCounter Component
 * Animates counting up to a target number
 * 
 * Props:
 * - value: Target number
 * - duration: Animation duration in ms (default: 2000)
 * - prefix: String to prepend (e.g., "$")
 * - suffix: String to append (e.g., "%")
 * - className: Additional CSS classes
 */

export function AnimatedCounter({
  value,
  duration = 2000,
  prefix = '',
  suffix = '',
  className = '',
  format = true,
}) {
  const [count, setCount] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    // Use IntersectionObserver to start animation when visible
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!isVisible) return;

    let startTime = null;
    let animationFrame;

    const animate = (timestamp) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      
      // Easing function for smooth animation
      const easeOutQuart = 1 - Math.pow(1 - progress, 4);
      
      setCount(Math.floor(easeOutQuart * value));

      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate);
      }
    };

    animationFrame = requestAnimationFrame(animate);

    return () => {
      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
      }
    };
  }, [isVisible, value, duration]);

  const formattedCount = format 
    ? count.toLocaleString() 
    : count.toString();

  return (
    <span ref={ref} className={`tabular-nums ${className}`}>
      {prefix}{formattedCount}{suffix}
    </span>
  );
}

/**
 * LiveStatCard Component
 * Live stat display with animated counter
 */
export function LiveStatCard({
  label,
  value,
  icon: Icon,
  trend,
  trendUp,
  delay = 0,
  glass = true,
}) {
  return (
    <div
      className={`
        rounded-xl p-4 animate-fade-up
        ${glass ? 'glass-card' : 'bg-[hsl(var(--card))] border border-[hsl(var(--border))]'}
      `}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-center justify-between">
        <div className={`
          p-2 rounded-lg
          ${glass ? 'bg-[hsl(var(--primary))]/20' : 'bg-[hsl(var(--primary))]/10'}
        `}>
          {Icon && <Icon className="w-4 h-4 text-[hsl(var(--primary))]" />}
        </div>
        {trend && (
          <span className={`
            text-xs flex items-center gap-1
            ${trendUp === true ? 'text-[hsl(var(--success))]' : 
              trendUp === false ? 'text-[hsl(var(--critical))]' : 
              'text-[hsl(var(--muted-foreground))]'}
          `}>
            {trendUp === true && '↑'}
            {trendUp === false && '↓'}
            {trend}
          </span>
        )}
      </div>
      <div className="mt-3">
        <div className="text-2xl font-bold">
          <AnimatedCounter value={value} />
        </div>
        <div className="text-xs text-[hsl(var(--muted-foreground))]">{label}</div>
      </div>
    </div>
  );
}

export default AnimatedCounter;

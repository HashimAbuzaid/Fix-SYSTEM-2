import { motion } from 'framer-motion';
import type { ReactNode } from 'react';

/* ─────────────────────────────────────────────────────────────
   StatCard v2.1
   Uses the updated design-system card variant tokens.
   No gradient icon backgrounds — accent-tinted surface instead.
   Trend badge uses semantic text colors without heavy fills.
   ───────────────────────────────────────────────────────────── */

interface StatCardProps {
  title: string;
  value: string | number;
  change?: string;
  icon?: ReactNode;
  color?: 'blue' | 'green' | 'purple' | 'orange' | 'red';
  trend?: 'up' | 'down' | 'neutral';
  delay?: number;
}

// Accent-tinted icon container — matches da-card-stat surface language.
const iconSurface: Record<string, string> = {
  blue:   'bg-primary-50   dark:bg-primary-950  text-primary-600   dark:text-primary-400',
  green:  'bg-success-50   dark:bg-success-950  text-success-600   dark:text-success-400',
  purple: 'bg-brand-50     dark:bg-brand-950    text-brand-600     dark:text-brand-400',
  orange: 'bg-warning-50   dark:bg-warning-950  text-warning-600   dark:text-warning-400',
  red:    'bg-error-50     dark:bg-error-950    text-error-600     dark:text-error-400',
};

// Trend badge — text-only color, translucent bg, no harsh solid fill.
const trendStyles: Record<string, string> = {
  up:      'text-success-600 dark:text-success-400 bg-success-50 dark:bg-success-950',
  down:    'text-error-600   dark:text-error-400   bg-error-50   dark:bg-error-950',
  neutral: 'text-neutral-500 dark:text-neutral-400 bg-neutral-100 dark:bg-neutral-800',
};

const trendIcon: Record<string, string> = {
  up: '↑',
  down: '↓',
  neutral: '→',
};

export function StatCard({
  title,
  value,
  change,
  icon,
  color = 'blue',
  trend = 'neutral',
  delay = 0,
}: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        delay,
        duration: 0.3,
        ease: [0.22, 1, 0.36, 1],
      }}
      whileHover={{ y: -2, transition: { duration: 0.18 } }}
      // da-card-interactive from the updated design system
      className={[
        'group rounded-xl border cursor-default',
        'bg-white dark:bg-neutral-900',
        'border-neutral-100 dark:border-neutral-800',
        'shadow-[0_1px_2px_rgba(0,0,0,0.04),0_2px_6px_rgba(0,0,0,0.04)]',
        'dark:shadow-[0_1px_2px_rgba(0,0,0,0.3),0_2px_6px_rgba(0,0,0,0.28)]',
        'hover:border-neutral-200 dark:hover:border-neutral-700',
        'hover:shadow-[0_2px_4px_rgba(0,0,0,0.06),0_8px_20px_rgba(0,0,0,0.07)]',
        'dark:hover:shadow-[0_2px_4px_rgba(0,0,0,0.4),0_8px_20px_rgba(0,0,0,0.38)]',
        'transition-all duration-200',
        'p-5',
      ].join(' ')}
    >
      {/* Header row — icon + trend badge */}
      <div className="flex items-start justify-between mb-4">
        {icon && (
          <div
            className={[
              'p-2.5 rounded-lg text-base leading-none',
              iconSurface[color],
            ].join(' ')}
            aria-hidden="true"
          >
            {icon}
          </div>
        )}

        {change && (
          <span
            className={[
              'text-xs font-medium px-2 py-1 rounded-md',
              'flex items-center gap-0.5',
              trendStyles[trend],
            ].join(' ')}
          >
            <span className="text-[10px]" aria-hidden="true">
              {trendIcon[trend]}
            </span>
            {change}
          </span>
        )}
      </div>

      {/* Label */}
      <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-1 tracking-wide uppercase">
        {title}
      </p>

      {/* Value */}
      <motion.p
        className="text-2xl font-bold text-neutral-900 dark:text-neutral-50 leading-tight tracking-tight"
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: delay + 0.08, duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
      >
        {value}
      </motion.p>
    </motion.div>
  );
}

export default StatCard;

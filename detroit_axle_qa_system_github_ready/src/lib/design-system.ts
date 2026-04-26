/**
 * Advanced Design System v2.0
 * Semantic tokens, color scales, and design patterns
 * Inspired by Linear, Vercel, and Stripe
 */

// ═══════════════════════════════════════════════════════════════
// Color Scales
// ═══════════════════════════════════════════════════════════════

export const colorScales = {
  // Primary - Blue (Trust, Action)
  primary: {
    50: '#f0f9ff',
    100: '#e0f2fe',
    200: '#bae6fd',
    300: '#7dd3fc',
    400: '#38bdf8',
    500: '#0ea5e9',
    600: '#0284c7',
    700: '#0369a1',
    800: '#075985',
    900: '#0c3d66',
  },

  // Success - Green (Positive, Complete)
  success: {
    50: '#f0fdf4',
    100: '#dcfce7',
    200: '#bbf7d0',
    300: '#86efac',
    400: '#4ade80',
    500: '#22c55e',
    600: '#16a34a',
    700: '#15803d',
    800: '#166534',
    900: '#145231',
  },

  // Warning - Amber (Caution, Attention)
  warning: {
    50: '#fffbeb',
    100: '#fef3c7',
    200: '#fde68a',
    300: '#fcd34d',
    400: '#fbbf24',
    500: '#f59e0b',
    600: '#d97706',
    700: '#b45309',
    800: '#92400e',
    900: '#78350f',
  },

  // Error - Red (Danger, Failure)
  error: {
    50: '#fef2f2',
    100: '#fee2e2',
    200: '#fecaca',
    300: '#fca5a5',
    400: '#f87171',
    500: '#ef4444',
    600: '#dc2626',
    700: '#b91c1c',
    800: '#991b1b',
    900: '#7f1d1d',
  },

  // Info - Cyan (Information, Help)
  info: {
    50: '#ecf8ff',
    100: '#cff0ff',
    200: '#a5e8ff',
    300: '#67deff',
    400: '#22d3ee',
    500: '#06b6d4',
    600: '#0891b2',
    700: '#0e7490',
    800: '#155e75',
    900: '#164e63',
  },

  // Neutral - Gray (Background, Text)
  neutral: {
    50: '#f9fafb',
    100: '#f3f4f6',
    200: '#e5e7eb',
    300: '#d1d5db',
    400: '#9ca3af',
    500: '#6b7280',
    600: '#4b5563',
    700: '#374151',
    800: '#1f2937',
    900: '#111827',
    950: '#030712',
  },

  // Brand - Purple (Premium, Exclusive)
  brand: {
    50: '#faf5ff',
    100: '#f3e8ff',
    200: '#e9d5ff',
    300: '#d8b4fe',
    400: '#c084fc',
    500: '#a855f7',
    600: '#9333ea',
    700: '#7e22ce',
    800: '#6b21a8',
    900: '#581c87',
  },
};

// ═══════════════════════════════════════════════════════════════
// Semantic Tokens
// ═══════════════════════════════════════════════════════════════

export const semanticTokens = {
  // Surfaces
  surface: {
    primary: 'bg-neutral-50 dark:bg-neutral-950',
    secondary: 'bg-neutral-100 dark:bg-neutral-900',
    tertiary: 'bg-neutral-200 dark:bg-neutral-800',
    overlay: 'bg-black/50 dark:bg-black/70',
  },

  // Text
  text: {
    primary: 'text-neutral-900 dark:text-neutral-50',
    secondary: 'text-neutral-600 dark:text-neutral-400',
    tertiary: 'text-neutral-500 dark:text-neutral-500',
    muted: 'text-neutral-400 dark:text-neutral-600',
    inverse: 'text-neutral-50 dark:text-neutral-900',
  },

  // Borders
  border: {
    primary: 'border-neutral-200 dark:border-neutral-800',
    secondary: 'border-neutral-300 dark:border-neutral-700',
    focus: 'border-primary-500 dark:border-primary-400',
    error: 'border-error-500 dark:border-error-400',
  },

  // Interactive
  interactive: {
    hover: 'hover:bg-neutral-100 dark:hover:bg-neutral-800',
    active: 'active:bg-neutral-200 dark:active:bg-neutral-700',
    disabled: 'disabled:opacity-50 disabled:cursor-not-allowed',
    focus: 'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-neutral-950',
  },

  // Shadows
  shadow: {
    xs: 'shadow-sm',
    sm: 'shadow',
    md: 'shadow-md',
    lg: 'shadow-lg',
    xl: 'shadow-xl',
    '2xl': 'shadow-2xl',
    inner: 'shadow-inner',
    none: 'shadow-none',
  },

  // Spacing
  spacing: {
    xs: '0.25rem',
    sm: '0.5rem',
    md: '1rem',
    lg: '1.5rem',
    xl: '2rem',
    '2xl': '3rem',
    '3xl': '4rem',
  },

  // Border Radius
  radius: {
    none: '0',
    sm: '0.375rem',
    md: '0.5rem',
    lg: '0.75rem',
    xl: '1rem',
    '2xl': '1.5rem',
    full: '9999px',
  },
};

// ═══════════════════════════════════════════════════════════════
// Component Variants
// ═══════════════════════════════════════════════════════════════

export const componentVariants = {
  button: {
    primary: 'bg-primary-600 text-white hover:bg-primary-700 active:bg-primary-800',
    secondary: 'bg-neutral-200 text-neutral-900 hover:bg-neutral-300 dark:bg-neutral-800 dark:text-neutral-50 dark:hover:bg-neutral-700',
    tertiary: 'bg-transparent text-primary-600 hover:bg-primary-50 dark:text-primary-400 dark:hover:bg-primary-950',
    ghost: 'bg-transparent text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800',
    danger: 'bg-error-600 text-white hover:bg-error-700 active:bg-error-800',
    success: 'bg-success-600 text-white hover:bg-success-700 active:bg-success-800',
  },

  card: {
    default: 'bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg shadow-sm',
    elevated: 'bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg shadow-md hover:shadow-lg transition-shadow',
    interactive: 'bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg shadow-sm hover:border-primary-500 hover:shadow-md transition-all cursor-pointer',
    glass: 'bg-white/80 dark:bg-neutral-900/80 backdrop-blur-md border border-neutral-200/50 dark:border-neutral-800/50 rounded-lg shadow-sm',
  },

  input: {
    default: 'bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-md px-3 py-2 text-neutral-900 dark:text-neutral-50 placeholder-neutral-500 dark:placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent',
    error: 'bg-white dark:bg-neutral-900 border border-error-500 dark:border-error-400 rounded-md px-3 py-2 text-neutral-900 dark:text-neutral-50 focus:outline-none focus:ring-2 focus:ring-error-500 focus:border-transparent',
    disabled: 'bg-neutral-100 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-md px-3 py-2 text-neutral-500 dark:text-neutral-400 cursor-not-allowed opacity-50',
  },

  badge: {
    primary: 'bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-200',
    success: 'bg-success-100 dark:bg-success-900 text-success-700 dark:text-success-200',
    warning: 'bg-warning-100 dark:bg-warning-900 text-warning-700 dark:text-warning-200',
    error: 'bg-error-100 dark:bg-error-900 text-error-700 dark:text-error-200',
    info: 'bg-info-100 dark:bg-info-900 text-info-700 dark:text-info-200',
  },
};

// ═══════════════════════════════════════════════════════════════
// Typography Scale
// ═══════════════════════════════════════════════════════════════

export const typography = {
  display: {
    lg: 'text-5xl font-bold leading-tight tracking-tight',
    md: 'text-4xl font-bold leading-tight tracking-tight',
    sm: 'text-3xl font-bold leading-tight tracking-tight',
  },

  heading: {
    lg: 'text-2xl font-bold leading-tight tracking-tight',
    md: 'text-xl font-semibold leading-tight tracking-tight',
    sm: 'text-lg font-semibold leading-tight tracking-tight',
    xs: 'text-base font-semibold leading-tight tracking-tight',
  },

  body: {
    lg: 'text-base leading-relaxed',
    md: 'text-sm leading-relaxed',
    sm: 'text-xs leading-relaxed',
  },

  mono: {
    lg: 'font-mono text-base',
    md: 'font-mono text-sm',
    sm: 'font-mono text-xs',
  },
};

// ═══════════════════════════════════════════════════════════════
// Z-Index Scale
// ═══════════════════════════════════════════════════════════════

export const zIndex = {
  hide: -1,
  base: 0,
  dropdown: 1000,
  sticky: 1020,
  fixed: 1030,
  backdrop: 1040,
  offcanvas: 1050,
  modal: 1060,
  popover: 1070,
  tooltip: 1080,
  notification: 1090,
};

// ═══════════════════════════════════════════════════════════════
// Animation Easing
// ═══════════════════════════════════════════════════════════════

export const easing = {
  linear: 'cubic-bezier(0, 0, 1, 1)',
  easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
  easeOut: 'cubic-bezier(0, 0, 0.2, 1)',
  easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
  smooth: 'cubic-bezier(0.22, 1, 0.36, 1)',
  bounce: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
  elastic: 'cubic-bezier(0.175, 0.885, 0.32, 1.275)',
};

// ═══════════════════════════════════════════════════════════════
// Breakpoints
// ═══════════════════════════════════════════════════════════════

export const breakpoints = {
  xs: '320px',
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
  '2xl': '1536px',
};

export default {
  colorScales,
  semanticTokens,
  componentVariants,
  typography,
  zIndex,
  easing,
  breakpoints,
};

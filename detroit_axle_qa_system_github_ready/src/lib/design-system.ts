/**
 * Advanced Design System v2.1
 * Redesigned form inputs and card variants — Claude-aesthetic
 * Semantic tokens, color scales, and design patterns
 */

// ═══════════════════════════════════════════════════════════════
// Color Scales (unchanged)
// ═══════════════════════════════════════════════════════════════

export const colorScales = {
  primary: {
    50: '#f0f9ff', 100: '#e0f2fe', 200: '#bae6fd', 300: '#7dd3fc',
    400: '#38bdf8', 500: '#0ea5e9', 600: '#0284c7', 700: '#0369a1',
    800: '#075985', 900: '#0c3d66',
  },
  success: {
    50: '#f0fdf4', 100: '#dcfce7', 200: '#bbf7d0', 300: '#86efac',
    400: '#4ade80', 500: '#22c55e', 600: '#16a34a', 700: '#15803d',
    800: '#166534', 900: '#145231',
  },
  warning: {
    50: '#fffbeb', 100: '#fef3c7', 200: '#fde68a', 300: '#fcd34d',
    400: '#fbbf24', 500: '#f59e0b', 600: '#d97706', 700: '#b45309',
    800: '#92400e', 900: '#78350f',
  },
  error: {
    50: '#fef2f2', 100: '#fee2e2', 200: '#fecaca', 300: '#fca5a5',
    400: '#f87171', 500: '#ef4444', 600: '#dc2626', 700: '#b91c1c',
    800: '#991b1b', 900: '#7f1d1d',
  },
  info: {
    50: '#ecf8ff', 100: '#cff0ff', 200: '#a5e8ff', 300: '#67deff',
    400: '#22d3ee', 500: '#06b6d4', 600: '#0891b2', 700: '#0e7490',
    800: '#155e75', 900: '#164e63',
  },
  neutral: {
    50: '#f9fafb', 100: '#f3f4f6', 200: '#e5e7eb', 300: '#d1d5db',
    400: '#9ca3af', 500: '#6b7280', 600: '#4b5563', 700: '#374151',
    800: '#1f2937', 900: '#111827', 950: '#030712',
  },
  brand: {
    50: '#faf5ff', 100: '#f3e8ff', 200: '#e9d5ff', 300: '#d8b4fe',
    400: '#c084fc', 500: '#a855f7', 600: '#9333ea', 700: '#7e22ce',
    800: '#6b21a8', 900: '#581c87',
  },
};

// ═══════════════════════════════════════════════════════════════
// Semantic Tokens (unchanged)
// ═══════════════════════════════════════════════════════════════

export const semanticTokens = {
  surface: {
    primary:   'bg-neutral-50 dark:bg-neutral-950',
    secondary: 'bg-neutral-100 dark:bg-neutral-900',
    tertiary:  'bg-neutral-200 dark:bg-neutral-800',
    overlay:   'bg-black/50 dark:bg-black/70',
  },
  text: {
    primary:   'text-neutral-900 dark:text-neutral-50',
    secondary: 'text-neutral-600 dark:text-neutral-400',
    tertiary:  'text-neutral-500 dark:text-neutral-500',
    muted:     'text-neutral-400 dark:text-neutral-600',
    inverse:   'text-neutral-50 dark:text-neutral-900',
  },
  border: {
    primary:   'border-neutral-200 dark:border-neutral-800',
    secondary: 'border-neutral-300 dark:border-neutral-700',
    focus:     'border-primary-500 dark:border-primary-400',
    error:     'border-error-500 dark:border-error-400',
  },
  interactive: {
    hover:    'hover:bg-neutral-100 dark:hover:bg-neutral-800',
    active:   'active:bg-neutral-200 dark:active:bg-neutral-700',
    disabled: 'disabled:opacity-50 disabled:cursor-not-allowed',
    focus:    'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-neutral-950',
  },
  shadow: {
    xs: 'shadow-sm', sm: 'shadow', md: 'shadow-md',
    lg: 'shadow-lg', xl: 'shadow-xl', '2xl': 'shadow-2xl',
    inner: 'shadow-inner', none: 'shadow-none',
  },
  spacing: {
    xs: '0.25rem', sm: '0.5rem', md: '1rem', lg: '1.5rem',
    xl: '2rem', '2xl': '3rem', '3xl': '4rem',
  },
  radius: {
    none: '0', sm: '0.375rem', md: '0.5rem', lg: '0.75rem',
    xl: '1rem', '2xl': '1.5rem', full: '9999px',
  },
};

// ═══════════════════════════════════════════════════════════════
// Component Variants — UPDATED inputs and cards
// ═══════════════════════════════════════════════════════════════

export const componentVariants = {
  button: {
    primary:   'bg-primary-600 text-white hover:bg-primary-700 active:bg-primary-800',
    secondary: 'bg-neutral-200 text-neutral-900 hover:bg-neutral-300 dark:bg-neutral-800 dark:text-neutral-50 dark:hover:bg-neutral-700',
    tertiary:  'bg-transparent text-primary-600 hover:bg-primary-50 dark:text-primary-400 dark:hover:bg-primary-950',
    ghost:     'bg-transparent text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800',
    danger:    'bg-error-600 text-white hover:bg-error-700 active:bg-error-800',
    success:   'bg-success-600 text-white hover:bg-success-700 active:bg-success-800',
  },

  // ── Inputs — redesigned ──────────────────────────────────────
  // All share a consistent height, radius, placeholder color,
  // and accent-colored focus ring. Error state uses rose border
  // without an oppressive background fill.
  input: {
    // Base: light-gray bg in light, dark-gray in dark.
    // Thin border; accent ring on focus; no box-shadow otherwise.
    default: [
      'w-full h-10 px-3 py-2 rounded-lg text-sm',
      'bg-neutral-50 dark:bg-neutral-900',
      'border border-neutral-200 dark:border-neutral-700',
      'text-neutral-900 dark:text-neutral-100',
      'placeholder:text-neutral-400 dark:placeholder:text-neutral-500',
      'transition-colors duration-150',
      'focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500',
      'dark:focus:ring-primary-400/40 dark:focus:border-primary-400',
      'hover:border-neutral-300 dark:hover:border-neutral-600',
    ].join(' '),

    // Error: border turns rose; ring is rose-tinted; no red bg.
    error: [
      'w-full h-10 px-3 py-2 rounded-lg text-sm',
      'bg-neutral-50 dark:bg-neutral-900',
      'border border-error-400 dark:border-error-500',
      'text-neutral-900 dark:text-neutral-100',
      'placeholder:text-neutral-400 dark:placeholder:text-neutral-500',
      'transition-colors duration-150',
      'focus:outline-none focus:ring-2 focus:ring-error-400/30 focus:border-error-500',
      'dark:focus:ring-error-500/30 dark:focus:border-error-400',
    ].join(' '),

    // Disabled: muted bg, no pointer, reduced opacity.
    disabled: [
      'w-full h-10 px-3 py-2 rounded-lg text-sm',
      'bg-neutral-100 dark:bg-neutral-800',
      'border border-neutral-200 dark:border-neutral-700',
      'text-neutral-400 dark:text-neutral-600',
      'placeholder:text-neutral-300 dark:placeholder:text-neutral-700',
      'cursor-not-allowed opacity-60',
    ].join(' '),

    // Textarea — same tokens, auto-height.
    textarea: [
      'w-full px-3 py-2 rounded-lg text-sm resize-y min-h-[80px]',
      'bg-neutral-50 dark:bg-neutral-900',
      'border border-neutral-200 dark:border-neutral-700',
      'text-neutral-900 dark:text-neutral-100',
      'placeholder:text-neutral-400 dark:placeholder:text-neutral-500',
      'transition-colors duration-150',
      'focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500',
      'dark:focus:ring-primary-400/40 dark:focus:border-primary-400',
      'hover:border-neutral-300 dark:hover:border-neutral-600',
    ].join(' '),

    // Select — same base with custom chevron.
    select: [
      'w-full h-10 pl-3 pr-8 rounded-lg text-sm appearance-none',
      'bg-neutral-50 dark:bg-neutral-900',
      'border border-neutral-200 dark:border-neutral-700',
      'text-neutral-900 dark:text-neutral-100',
      'transition-colors duration-150',
      'focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500',
      'dark:focus:ring-primary-400/40 dark:focus:border-primary-400',
      'hover:border-neutral-300 dark:hover:border-neutral-600',
      // chevron via background-image applied in CSS (see globalCss patch)
    ].join(' '),

    // Checkbox — 16px square, accent fill when checked.
    checkbox: [
      'h-4 w-4 rounded',
      'border border-neutral-300 dark:border-neutral-600',
      'bg-white dark:bg-neutral-900',
      'text-primary-600 dark:text-primary-400',
      'focus:ring-2 focus:ring-primary-500/40',
      'transition-colors duration-150',
      'cursor-pointer',
    ].join(' '),

    // Radio — same as checkbox but rounded-full.
    radio: [
      'h-4 w-4 rounded-full',
      'border border-neutral-300 dark:border-neutral-600',
      'bg-white dark:bg-neutral-900',
      'text-primary-600 dark:text-primary-400',
      'focus:ring-2 focus:ring-primary-500/40',
      'transition-colors duration-150',
      'cursor-pointer',
    ].join(' '),
  },

  // ── Cards — redesigned ───────────────────────────────────────
  // Soft shadows, rounded corners, off-white/dark-gray surfaces.
  // Four tiers: flat, raised, interactive, glass.
  card: {
    // Flat: no shadow; barely-there border; slight off-white bg.
    default: [
      'rounded-xl border',
      'bg-white dark:bg-neutral-900',
      'border-neutral-100 dark:border-neutral-800',
      'p-5',
    ].join(' '),

    // Raised: subtle multi-layer shadow; lifts off the page.
    elevated: [
      'rounded-xl border',
      'bg-white dark:bg-neutral-900',
      'border-neutral-100 dark:border-neutral-800',
      'shadow-[0_1px_2px_rgba(0,0,0,0.05),0_4px_16px_rgba(0,0,0,0.06)]',
      'dark:shadow-[0_1px_2px_rgba(0,0,0,0.3),0_4px_16px_rgba(0,0,0,0.3)]',
      'p-5',
    ].join(' '),

    // Interactive: border brightens and shadow lifts on hover.
    interactive: [
      'rounded-xl border cursor-pointer',
      'bg-white dark:bg-neutral-900',
      'border-neutral-100 dark:border-neutral-800',
      'shadow-[0_1px_2px_rgba(0,0,0,0.04),0_2px_8px_rgba(0,0,0,0.04)]',
      'dark:shadow-[0_1px_2px_rgba(0,0,0,0.25),0_2px_8px_rgba(0,0,0,0.25)]',
      'transition-all duration-200',
      'hover:border-primary-300 dark:hover:border-primary-700',
      'hover:shadow-[0_2px_4px_rgba(0,0,0,0.06),0_8px_24px_rgba(0,0,0,0.08)]',
      'dark:hover:shadow-[0_2px_4px_rgba(0,0,0,0.35),0_8px_24px_rgba(0,0,0,0.35)]',
      'p-5',
    ].join(' '),

    // Glass: frosted; works over imagery or gradient backgrounds.
    glass: [
      'rounded-xl border backdrop-blur-md',
      'bg-white/75 dark:bg-neutral-900/75',
      'border-neutral-200/60 dark:border-neutral-700/60',
      'shadow-[0_2px_8px_rgba(0,0,0,0.06)]',
      'dark:shadow-[0_2px_8px_rgba(0,0,0,0.3)]',
      'p-5',
    ].join(' '),

    // Stat card: dense metric display; secondary bg, no border.
    stat: [
      'rounded-xl',
      'bg-neutral-50 dark:bg-neutral-800/60',
      'p-4',
    ].join(' '),
  },

  badge: {
    primary: 'bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-200',
    success: 'bg-success-100 dark:bg-success-900 text-success-700 dark:text-success-200',
    warning: 'bg-warning-100 dark:bg-warning-900 text-warning-700 dark:text-warning-200',
    error:   'bg-error-100 dark:bg-error-900 text-error-700 dark:text-error-200',
    info:    'bg-info-100 dark:bg-info-900 text-info-700 dark:text-info-200',
  },
};

// ═══════════════════════════════════════════════════════════════
// Typography Scale (unchanged)
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
// Z-Index Scale (unchanged)
// ═══════════════════════════════════════════════════════════════

export const zIndex = {
  hide: -1, base: 0, dropdown: 1000, sticky: 1020, fixed: 1030,
  backdrop: 1040, offcanvas: 1050, modal: 1060, popover: 1070,
  tooltip: 1080, notification: 1090,
};

// ═══════════════════════════════════════════════════════════════
// Animation Easing (unchanged)
// ═══════════════════════════════════════════════════════════════

export const easing = {
  linear:    'cubic-bezier(0, 0, 1, 1)',
  easeIn:    'cubic-bezier(0.4, 0, 1, 1)',
  easeOut:   'cubic-bezier(0, 0, 0.2, 1)',
  easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
  smooth:    'cubic-bezier(0.22, 1, 0.36, 1)',
  bounce:    'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
  elastic:   'cubic-bezier(0.175, 0.885, 0.32, 1.275)',
};

// ═══════════════════════════════════════════════════════════════
// Breakpoints (unchanged)
// ═══════════════════════════════════════════════════════════════

export const breakpoints = {
  xs: '320px', sm: '640px', md: '768px',
  lg: '1024px', xl: '1280px', '2xl': '1536px',
};

export default {
  colorScales, semanticTokens, componentVariants,
  typography, zIndex, easing, breakpoints,
};
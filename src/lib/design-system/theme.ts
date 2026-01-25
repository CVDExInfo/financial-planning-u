/**
 * Design System Theme
 * 
 * Centralizes color palette, spacing, and other design tokens
 * for the Tier 3 UX refactor. All values use CSS variables
 * defined in index.css for consistency.
 */

/**
 * Spacing scale - standardized increments
 * Use these values for padding, margins, gaps
 */
export const spacing = {
  xs: '0.5rem',    // 8px
  sm: '0.75rem',   // 12px
  md: '1rem',      // 16px
  lg: '1.5rem',    // 24px
  xl: '2rem',      // 32px
  '2xl': '3rem',   // 48px
} as const;

/**
 * Grid system configuration
 */
export const grid = {
  columns: 12,
  gutter: '1rem',    // 16px
  margin: '1.5rem',  // 24px
  breakpoints: {
    sm: '640px',
    md: '768px',
    lg: '1024px',
    xl: '1280px',
    '2xl': '1400px',
  },
} as const;

/**
 * Color palette using CSS variables
 * These map to the existing Ikusi brand colors in index.css
 */
export const colors = {
  // Primary (Ikusi Green)
  primary: {
    DEFAULT: 'var(--primary)',
    foreground: 'var(--primary-foreground)',
  },
  // Secondary (Soft mint)
  secondary: {
    DEFAULT: 'var(--secondary)',
    foreground: 'var(--secondary-foreground)',
  },
  // Status colors
  status: {
    success: 'oklch(0.65 0.15 145)',  // Green
    warning: 'oklch(0.75 0.15 85)',   // Yellow
    error: 'oklch(0.65 0.2 30)',      // Red
    info: 'oklch(0.60 0.15 230)',     // Blue
  },
  // Neutral scale
  neutral: {
    50: 'oklch(0.98 0.01 160)',
    100: 'oklch(0.96 0.01 160)',
    200: 'oklch(0.93 0.01 160)',
    300: 'oklch(0.87 0.01 160)',
    400: 'oklch(0.70 0.01 160)',
    500: 'oklch(0.55 0.01 160)',
    600: 'oklch(0.45 0.01 160)',
    700: 'oklch(0.35 0.01 160)',
    800: 'oklch(0.25 0.01 160)',
    900: 'oklch(0.15 0.01 160)',
  },
  // Border and input
  border: 'var(--border)',
  input: 'var(--input)',
  ring: 'var(--ring)',
} as const;

/**
 * Border radius scale
 */
export const borderRadius = {
  sm: 'var(--radius-sm)',
  md: 'var(--radius-md)',
  lg: 'var(--radius-lg)',
  xl: 'var(--radius-xl)',
  '2xl': 'var(--radius-2xl)',
  full: 'var(--radius-full)',
} as const;

/**
 * Shadow depths for cards and elevation
 */
export const shadows = {
  sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
  md: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
  lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
  xl: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
} as const;

/**
 * Typography scale
 */
export const typography = {
  fontSize: {
    xs: '0.75rem',    // 12px
    sm: '0.875rem',   // 14px
    base: '1rem',     // 16px
    lg: '1.125rem',   // 18px
    xl: '1.25rem',    // 20px
    '2xl': '1.5rem',  // 24px
  },
  fontWeight: {
    normal: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },
} as const;

/**
 * Helper function to get spacing value
 */
export function getSpacing(key: keyof typeof spacing): string {
  return spacing[key];
}

/**
 * Helper function to create responsive grid classes
 * Note: Returns Tailwind-compatible classes only. For custom gap values, use inline styles.
 */
export function getGridClasses(cols?: number): string {
  const colClass = cols ? `grid-cols-${cols}` : 'grid-cols-12';
  // Use gap-4 (16px) which matches our grid.gutter value of 1rem
  return `grid ${colClass} gap-4`;
}

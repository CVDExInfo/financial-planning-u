/**
 * DashboardLayout Component
 * 
 * Provides a consistent 12-column grid layout for all finance dashboards.
 * Features:
 * - Responsive 12-column grid with 16px gutters
 * - 24px margins on all sides
 * - Consistent spacing and alignment
 * - Support for full-width sections
 */

import { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { grid, spacing } from '@/lib/design-system/theme';

interface DashboardLayoutProps extends ComponentProps<'div'> {
  /**
   * Layout children - can be DashboardSection components or any ReactNode
   */
  children: ReactNode;
  /**
   * Maximum width constraint (defaults to full width with max container)
   */
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';
  /**
   * Additional CSS classes
   */
  className?: string;
}

// Explicit maxWidth mapping to avoid Tailwind purge issues
const MAX_WIDTH_CLASSES = {
  'sm': 'max-w-sm',
  'md': 'max-w-md',
  'lg': 'max-w-lg',
  'xl': 'max-w-xl',
  '2xl': 'max-w-2xl',
  'full': 'w-full',
} as const;

/**
 * Main dashboard layout container
 */
export function DashboardLayout({ 
  children, 
  maxWidth = '2xl',
  className,
  ...props 
}: DashboardLayoutProps) {
  const maxWidthClass = MAX_WIDTH_CLASSES[maxWidth];
  
  return (
    <div 
      className={cn(
        'w-full mx-auto',
        maxWidthClass,
        className
      )}
      style={{
        padding: spacing.lg, // 24px margins
      }}
      {...props}
    >
      <div 
        className="grid grid-cols-12"
        style={{
          gap: grid.gutter, // 16px gutters
        }}
      >
        {children}
      </div>
    </div>
  );
}

interface DashboardSectionProps extends ComponentProps<'div'> {
  /**
   * Number of columns to span (1-12)
   */
  colSpan?: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;
  /**
   * Responsive column spans for different breakpoints
   */
  responsive?: {
    sm?: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;
    md?: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;
    lg?: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;
    xl?: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;
  };
  /**
   * Section content
   */
  children: ReactNode;
  /**
   * Additional CSS classes
   */
  className?: string;
}

// Explicit column span mapping to avoid Tailwind purge issues
const COL_SPAN_CLASSES = {
  1: 'col-span-1',
  2: 'col-span-2',
  3: 'col-span-3',
  4: 'col-span-4',
  5: 'col-span-5',
  6: 'col-span-6',
  7: 'col-span-7',
  8: 'col-span-8',
  9: 'col-span-9',
  10: 'col-span-10',
  11: 'col-span-11',
  12: 'col-span-12',
} as const;

const SM_COL_SPAN_CLASSES = {
  1: 'sm:col-span-1',
  2: 'sm:col-span-2',
  3: 'sm:col-span-3',
  4: 'sm:col-span-4',
  5: 'sm:col-span-5',
  6: 'sm:col-span-6',
  7: 'sm:col-span-7',
  8: 'sm:col-span-8',
  9: 'sm:col-span-9',
  10: 'sm:col-span-10',
  11: 'sm:col-span-11',
  12: 'sm:col-span-12',
} as const;

const MD_COL_SPAN_CLASSES = {
  1: 'md:col-span-1',
  2: 'md:col-span-2',
  3: 'md:col-span-3',
  4: 'md:col-span-4',
  5: 'md:col-span-5',
  6: 'md:col-span-6',
  7: 'md:col-span-7',
  8: 'md:col-span-8',
  9: 'md:col-span-9',
  10: 'md:col-span-10',
  11: 'md:col-span-11',
  12: 'md:col-span-12',
} as const;

const LG_COL_SPAN_CLASSES = {
  1: 'lg:col-span-1',
  2: 'lg:col-span-2',
  3: 'lg:col-span-3',
  4: 'lg:col-span-4',
  5: 'lg:col-span-5',
  6: 'lg:col-span-6',
  7: 'lg:col-span-7',
  8: 'lg:col-span-8',
  9: 'lg:col-span-9',
  10: 'lg:col-span-10',
  11: 'lg:col-span-11',
  12: 'lg:col-span-12',
} as const;

const XL_COL_SPAN_CLASSES = {
  1: 'xl:col-span-1',
  2: 'xl:col-span-2',
  3: 'xl:col-span-3',
  4: 'xl:col-span-4',
  5: 'xl:col-span-5',
  6: 'xl:col-span-6',
  7: 'xl:col-span-7',
  8: 'xl:col-span-8',
  9: 'xl:col-span-9',
  10: 'xl:col-span-10',
  11: 'xl:col-span-11',
  12: 'xl:col-span-12',
} as const;

/**
 * Dashboard section - occupies grid columns
 */
export function DashboardSection({ 
  colSpan = 12,
  responsive,
  children,
  className,
  ...props
}: DashboardSectionProps) {
  // Build responsive classes using explicit mappings
  const responsiveClasses = responsive 
    ? [
        responsive.sm && SM_COL_SPAN_CLASSES[responsive.sm],
        responsive.md && MD_COL_SPAN_CLASSES[responsive.md],
        responsive.lg && LG_COL_SPAN_CLASSES[responsive.lg],
        responsive.xl && XL_COL_SPAN_CLASSES[responsive.xl],
      ].filter(Boolean).join(' ')
    : '';

  return (
    <div 
      className={cn(
        COL_SPAN_CLASSES[colSpan],
        responsiveClasses,
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

interface DashboardRowProps extends ComponentProps<'div'> {
  /**
   * Row content - typically DashboardSection components
   */
  children: ReactNode;
  /**
   * Vertical spacing between sections
   */
  gap?: keyof typeof spacing;
  /**
   * Additional CSS classes
   */
  className?: string;
}

/**
 * Dashboard row - groups sections horizontally
 * Automatically creates a new 12-column grid context
 */
export function DashboardRow({ 
  children,
  gap = 'md',
  className,
  ...props
}: DashboardRowProps) {
  return (
    <div 
      className={cn(
        'col-span-12 grid grid-cols-12',
        className
      )}
      style={{
        gap: spacing[gap],
      }}
      {...props}
    >
      {children}
    </div>
  );
}

/**
 * Utility: Full-width section (spans all 12 columns)
 */
export function DashboardFullWidth({ 
  children,
  className,
  ...props
}: ComponentProps<'div'>) {
  return (
    <DashboardSection colSpan={12} className={className} {...props}>
      {children}
    </DashboardSection>
  );
}

/**
 * Utility: Half-width section (spans 6 columns)
 * Responsive: full-width on mobile, half on md+
 */
export function DashboardHalf({ 
  children,
  className,
  ...props
}: ComponentProps<'div'>) {
  return (
    <DashboardSection 
      colSpan={12}
      responsive={{ md: 6 }}
      className={className}
      {...props}
    >
      {children}
    </DashboardSection>
  );
}

/**
 * Utility: Third-width section (spans 4 columns)
 * Responsive: full-width on mobile, half on sm, third on lg+
 */
export function DashboardThird({ 
  children,
  className,
  ...props
}: ComponentProps<'div'>) {
  return (
    <DashboardSection 
      colSpan={12}
      responsive={{ sm: 6, lg: 4 }}
      className={className}
      {...props}
    >
      {children}
    </DashboardSection>
  );
}

/**
 * Utility: Quarter-width section (spans 3 columns)
 * Responsive: full-width on mobile, half on sm, quarter on lg+
 */
export function DashboardQuarter({ 
  children,
  className,
  ...props
}: ComponentProps<'div'>) {
  return (
    <DashboardSection 
      colSpan={12}
      responsive={{ sm: 6, md: 3 }}
      className={className}
      {...props}
    >
      {children}
    </DashboardSection>
  );
}

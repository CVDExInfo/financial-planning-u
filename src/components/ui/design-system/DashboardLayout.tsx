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

/**
 * Main dashboard layout container
 */
export function DashboardLayout({ 
  children, 
  maxWidth = '2xl',
  className,
  ...props 
}: DashboardLayoutProps) {
  const maxWidthClass = maxWidth === 'full' ? 'w-full' : `max-w-${maxWidth}`;
  
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
  // Build responsive classes
  const responsiveClasses = responsive 
    ? [
        responsive.sm && `sm:col-span-${responsive.sm}`,
        responsive.md && `md:col-span-${responsive.md}`,
        responsive.lg && `lg:col-span-${responsive.lg}`,
        responsive.xl && `xl:col-span-${responsive.xl}`,
      ].filter(Boolean).join(' ')
    : '';

  return (
    <div 
      className={cn(
        `col-span-${colSpan}`,
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

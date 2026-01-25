/**
 * Chip Component
 * 
 * A versatile chip/badge component with three distinct variants:
 * - Status: For success/warning/error states with icons
 * - Category: For neutral categorization (MOD, OPEX, etc.)
 * - Tag: For lightweight labels with outline style
 */

import { ComponentProps, ReactNode } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { TrendingUp, TrendingDown, AlertCircle, CheckCircle, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

const chipVariants = cva(
  'inline-flex items-center justify-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium whitespace-nowrap shrink-0 transition-colors',
  {
    variants: {
      variant: {
        // Status chips: colored backgrounds with icons
        success: 'bg-emerald-100 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800',
        warning: 'bg-amber-100 text-amber-700 border border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800',
        error: 'bg-red-100 text-red-700 border border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800',
        info: 'bg-blue-100 text-blue-700 border border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800',
        
        // Category chips: neutral gray
        category: 'bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
        
        // Tag chips: outlined style
        tag: 'bg-transparent text-slate-600 border border-slate-300 dark:text-slate-400 dark:border-slate-600',
        
        // Legacy variants for compatibility with existing Badge usage
        default: 'bg-primary text-primary-foreground border-transparent',
        secondary: 'bg-secondary text-secondary-foreground border-transparent',
        destructive: 'bg-destructive text-white border-transparent',
        outline: 'text-foreground border-border',
      },
      size: {
        sm: 'text-xs px-1.5 py-0.5',
        md: 'text-xs px-2 py-0.5',
        lg: 'text-sm px-2.5 py-1',
      },
    },
    defaultVariants: {
      variant: 'category',
      size: 'md',
    },
  }
);

export interface ChipProps 
  extends Omit<ComponentProps<'span'>, 'children'>, 
    VariantProps<typeof chipVariants> {
  /**
   * Optional icon to display before the label
   */
  icon?: ReactNode;
  /**
   * Auto icon - automatically selects icon based on variant
   */
  autoIcon?: boolean;
  /**
   * Chip label text
   */
  children?: ReactNode;
  /**
   * Optional value to display after the label
   */
  value?: ReactNode;
}

/**
 * Get the appropriate icon for a status variant
 */
function getStatusIcon(variant: ChipProps['variant']): ReactNode | null {
  const iconClass = 'h-3 w-3';
  
  switch (variant) {
    case 'success':
      return <CheckCircle className={iconClass} />;
    case 'warning':
      return <AlertCircle className={iconClass} />;
    case 'error':
      return <AlertCircle className={iconClass} />;
    case 'info':
      return <Info className={iconClass} />;
    default:
      return null;
  }
}

/**
 * Chip component
 */
export function Chip({
  variant,
  size,
  icon,
  autoIcon = false,
  children,
  value,
  className,
  ...props
}: ChipProps) {
  // Determine which icon to show
  const displayIcon = autoIcon ? getStatusIcon(variant) : icon;

  return (
    <span
      className={cn(chipVariants({ variant, size }), className)}
      role="status"
      aria-label={typeof children === 'string' ? children : undefined}
      {...props}
    >
      {displayIcon}
      {children}
      {value && <span className="font-semibold">{value}</span>}
    </span>
  );
}

/**
 * Status Chip - Convenience wrapper for status indicators
 */
export interface StatusChipProps extends Omit<ChipProps, 'variant' | 'autoIcon'> {
  status: 'success' | 'warning' | 'error' | 'info';
}

export function StatusChip({ status, ...props }: StatusChipProps) {
  return <Chip variant={status} autoIcon {...props} />;
}

/**
 * Category Chip - Convenience wrapper for category labels
 */
export function CategoryChip(props: Omit<ChipProps, 'variant'>) {
  return <Chip variant="category" {...props} />;
}

/**
 * Tag Chip - Convenience wrapper for tag labels
 */
export function TagChip(props: Omit<ChipProps, 'variant'>) {
  return <Chip variant="tag" {...props} />;
}

/**
 * Variance Chip - Specialized chip for displaying financial variances
 * Shows trend icon (up/down) with value and percentage
 */
export interface VarianceChipProps extends Omit<ChipProps, 'variant' | 'icon' | 'children'> {
  /**
   * Variance amount (positive = over budget, negative = under budget)
   */
  variance: number;
  /**
   * Variance percentage (optional)
   */
  percentage?: number;
  /**
   * Format function for the variance value
   * Note: This should handle currency formatting if needed.
   * Default formats as decimal: (v) => v.toFixed(2)
   * For currency, provide custom formatter: (v) => formatCurrency(v)
   */
  formatValue?: (value: number) => string;
  /**
   * Threshold for determining warning vs error state
   * Absolute percentage value
   */
  warningThreshold?: number;
  errorThreshold?: number;
}

export function VarianceChip({
  variance,
  percentage,
  formatValue = (v) => v.toFixed(2),
  warningThreshold = 10,
  errorThreshold = 20,
  className,
  ...props
}: VarianceChipProps) {
  const absPercentage = Math.abs(percentage ?? 0);
  const isOverBudget = variance > 0;
  const isUnderBudget = variance < 0;
  const isOnTarget = variance === 0;

  // Determine variant based on variance and thresholds
  let variant: 'success' | 'warning' | 'error' | 'info' = 'info';
  if (isOnTarget) {
    variant = 'success';
  } else if (absPercentage >= errorThreshold) {
    variant = 'error';
  } else if (absPercentage >= warningThreshold) {
    variant = 'warning';
  } else {
    variant = 'info';
  }

  // Determine icon
  const icon = isOverBudget 
    ? <TrendingUp className="h-3 w-3" />
    : isUnderBudget
    ? <TrendingDown className="h-3 w-3" />
    : <CheckCircle className="h-3 w-3" />;

  // Format display text
  const displayValue = formatValue(Math.abs(variance));
  const displayPercentage = percentage !== undefined ? ` (${Math.abs(percentage).toFixed(1)}%)` : '';

  return (
    <Chip
      variant={variant}
      icon={icon}
      className={className}
      {...props}
    >
      {displayValue}{displayPercentage}
    </Chip>
  );
}

// Export the variants for external use
export { chipVariants };

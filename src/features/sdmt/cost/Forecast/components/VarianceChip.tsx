/**
 * VarianceChip Component
 * 
 * Displays variance value with percent in a compact, color-coded chip.
 * 
 * Behavior:
 * - Shows currency-formatted value with +/- prefix
 * - Shows percent with 1 decimal place or "—" when percent is null
 * - Colors: Red for overspend (positive), Green for savings (negative), Muted for zero
 * - Supports aria-label for accessibility
 */

import { formatCurrency } from '@/components/shared/CurrencySelector';

export interface VarianceChipProps {
  /** The variance value (positive = overspend, negative = savings) */
  value: number;
  
  /** The variance percentage (null when denominator is 0) */
  percent: number | null;
  
  /** Optional aria-label for accessibility */
  ariaLabel?: string;
}

export default function VarianceChip({ value, percent, ariaLabel }: VarianceChipProps) {
  // Determine color based on variance value
  const getColorClass = (): string => {
    if (value > 0) {
      // Positive variance = overspend = red
      return 'text-red-600';
    }
    if (value < 0) {
      // Negative variance = savings = green
      return 'text-green-600';
    }
    // Zero variance = muted
    return 'text-muted-foreground';
  };

  // Format value with +/- prefix
  const formatValue = (): string => {
    const formatted = formatCurrency(Math.abs(value), 'USD', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
    
    if (value > 0) {
      return `+${formatted}`;
    }
    if (value < 0) {
      return `−${formatted}`; // Use minus sign (U+2212) for better typography
    }
    return formatted;
  };

  // Format percent with 1 decimal place or "—" when null
  const formatPercent = (): string => {
    if (percent === null) {
      return '—';
    }
    
    const sign = percent > 0 ? '+' : percent < 0 ? '' : '';
    return `${sign}${percent.toFixed(1)}%`;
  };

  const colorClass = getColorClass();

  return (
    <div className={`inline-flex flex-col items-end ${colorClass} font-medium`} aria-label={ariaLabel}>
      <div className="text-sm">
        {formatValue()}
      </div>
      <div className="text-xs">
        ({formatPercent()})
      </div>
    </div>
  );
}

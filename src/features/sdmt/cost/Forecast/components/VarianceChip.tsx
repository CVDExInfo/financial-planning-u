/**
 * VarianceChip Component
 * 
 * Displays variance value with percent in a compact, neutral-styled chip with icons.
 * 
 * Tier 1 UX Improvements:
 * - Uses neutral base colors (slate-100/slate-800 for backgrounds)
 * - Includes Lucide icons (TrendingUp, TrendingDown, Minus)
 * - Maintains accessible color contrasts
 * - Follows 8/12/16px spacing scale
 * 
 * Behavior:
 * - Shows currency-formatted value with +/- prefix
 * - Shows percent with 1 decimal place or "—" when percent is null
 * - Colors: Neutral slate backgrounds with subtle icon colors
 * - Supports aria-label for accessibility
 */

import { formatCurrency } from '@/components/shared/CurrencySelector';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

export interface VarianceChipProps {
  /** The variance value (positive = overspend, negative = savings) */
  value: number;
  
  /** The variance percentage (null when denominator is 0) */
  percent: number | null;
  
  /** Optional aria-label for accessibility */
  ariaLabel?: string;
}

export default function VarianceChip({ value, percent, ariaLabel }: VarianceChipProps) {
  // Determine neutral color classes based on variance value
  const getColorClasses = (): {
    bg: string;
    text: string;
    icon: React.ReactNode;
  } => {
    if (value > 0) {
      // Positive variance = overspend = subtle red
      return {
        bg: 'bg-slate-100 dark:bg-slate-800',
        text: 'text-slate-700 dark:text-slate-300',
        icon: <TrendingUp size={14} className="text-red-500 dark:text-red-400" />,
      };
    }
    if (value < 0) {
      // Negative variance = savings = subtle green
      return {
        bg: 'bg-slate-100 dark:bg-slate-800',
        text: 'text-slate-700 dark:text-slate-300',
        icon: <TrendingDown size={14} className="text-green-500 dark:text-green-400" />,
      };
    }
    // Zero variance = neutral
    return {
      bg: 'bg-slate-100 dark:bg-slate-800',
      text: 'text-slate-500 dark:text-slate-400',
      icon: <Minus size={14} className="text-slate-400 dark:text-slate-500" />,
    };
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

  const { bg, text, icon } = getColorClasses();

  return (
    <div 
      className={`inline-flex items-center gap-1.5 ${bg} ${text} font-medium rounded px-3 py-2`}
      aria-label={ariaLabel}
    >
      {icon}
      <div className="flex flex-col items-start">
        <div className="text-sm">
          {formatValue()}
        </div>
        <div className="text-xs opacity-75">
          ({formatPercent()})
        </div>
      </div>
    </div>
  );
}

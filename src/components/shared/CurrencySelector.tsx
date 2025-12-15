/**
 * Shared Currency Selector Component
 * 
 * Reusable component for selecting currency in financial forms.
 * Supports USD, COP, EUR, and MXN currencies used throughout the application.
 */

import React from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import type { Currency } from '@/types/domain';

export interface CurrencySelectorProps {
  /** Current selected currency */
  value: Currency;
  
  /** Callback when currency changes */
  onChange: (currency: Currency) => void;
  
  /** Whether the selector is disabled */
  disabled?: boolean;
  
  /** Optional label text (defaults to "Moneda") */
  label?: string;
  
  /** Optional ID for the select element */
  id?: string;
  
  /** Whether to show the label */
  showLabel?: boolean;
  
  /** Additional class names */
  className?: string;
  
  /** Whether the field is required */
  required?: boolean;
}

const CURRENCY_OPTIONS: Array<{ value: Currency; label: string; symbol: string }> = [
  { value: 'USD', label: 'USD - Dólar Estadounidense', symbol: '$' },
  { value: 'COP', label: 'COP - Peso Colombiano', symbol: '$' },
  { value: 'EUR', label: 'EUR - Euro', symbol: '€' },
  { value: 'MXN', label: 'MXN - Peso Mexicano', symbol: '$' },
];

export default function CurrencySelector({
  value,
  onChange,
  disabled = false,
  label = 'Moneda',
  id = 'currency',
  showLabel = true,
  className = '',
  required = false,
}: CurrencySelectorProps) {
  return (
    <div className={`space-y-2 ${className}`}>
      {showLabel && (
        <Label htmlFor={id}>
          {label}
          {required && <span className="text-destructive ml-1">*</span>}
        </Label>
      )}
      <Select
        value={value}
        onValueChange={(newValue) => onChange(newValue as Currency)}
        disabled={disabled}
        required={required}
      >
        <SelectTrigger id={id} name={id}>
          <SelectValue placeholder="Selecciona moneda" />
        </SelectTrigger>
        <SelectContent>
          {CURRENCY_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/**
 * Format a number as currency
 * 
 * @param amount The amount to format
 * @param currency The currency code (USD, COP, EUR, MXN)
 * @param options Additional Intl.NumberFormat options
 * @returns Formatted currency string
 */
export function formatCurrency(
  amount: number,
  currency: Currency = 'USD',
  options?: Intl.NumberFormatOptions
): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
    ...options,
  }).format(amount);
}

/**
 * Get currency symbol for a given currency code
 * 
 * @param currency The currency code
 * @returns Currency symbol
 */
export function getCurrencySymbol(currency: Currency): string {
  const option = CURRENCY_OPTIONS.find((opt) => opt.value === currency);
  return option?.symbol || '$';
}

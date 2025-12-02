/**
 * FormField Component
 * 
 * Accessible form field wrapper that ensures every input has:
 * - A stable id attribute
 * - A name attribute for form submission
 * - An associated label for accessibility
 * 
 * Follows WCAG 2.1 guidelines and React best practices.
 */

import React, { useId } from 'react';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

interface FormFieldProps {
  /**
   * Label text to display
   */
  label: string;
  
  /**
   * Name attribute for the form field
   * Used for form submission and React Hook Form
   */
  name: string;
  
  /**
   * Optional custom id. If not provided, generates one automatically
   */
  id?: string;
  
  /**
   * The input element to render (Input, Select, Textarea, etc.)
   */
  children: React.ReactElement;
  
  /**
   * Optional error message to display
   */
  error?: string;
  
  /**
   * Optional helper text
   */
  helperText?: string;
  
  /**
   * Whether the field is required
   */
  required?: boolean;
  
  /**
   * Additional CSS classes for the container
   */
  className?: string;
  
  /**
   * Hide the visual label but keep it accessible to screen readers
   */
  srOnly?: boolean;
}

/**
 * FormField component that wraps form inputs with proper accessibility attributes
 */
export function FormField({
  label,
  name,
  id: customId,
  children,
  error,
  helperText,
  required = false,
  className,
  srOnly = false,
}: FormFieldProps) {
  // Generate a unique ID if none provided
  const autoId = useId();
  const fieldId = customId || `field-${name}-${autoId}`;
  const errorId = error ? `${fieldId}-error` : undefined;
  const helperId = helperText ? `${fieldId}-helper` : undefined;
  
  // Clone the child element and inject accessibility props
  const childWithProps = React.cloneElement(children, {
    id: fieldId,
    name: name,
    'aria-invalid': error ? 'true' : undefined,
    'aria-describedby': [errorId, helperId].filter(Boolean).join(' ') || undefined,
    'aria-required': required ? 'true' : undefined,
  });

  return (
    <div className={cn('space-y-2', className)}>
      <Label
        htmlFor={fieldId}
        className={cn(
          srOnly && 'sr-only'
        )}
      >
        {label}
        {required && <span className="text-destructive ml-1" aria-label="required">*</span>}
      </Label>
      
      {childWithProps}
      
      {helperText && !error && (
        <p
          id={helperId}
          className="text-sm text-muted-foreground"
        >
          {helperText}
        </p>
      )}
      
      {error && (
        <p
          id={errorId}
          className="text-sm text-destructive font-medium"
          role="alert"
        >
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * Simplified FormField for inline usage without visual label
 * Useful for search boxes, filters, etc. where context is clear
 */
export function InlineFormField({
  label,
  name,
  id: customId,
  children,
  className,
}: Pick<FormFieldProps, 'label' | 'name' | 'id' | 'children' | 'className'>) {
  return (
    <FormField
      label={label}
      name={name}
      id={customId}
      srOnly={true}
      className={className}
    >
      {children}
    </FormField>
  );
}

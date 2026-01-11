// src/utils/invoiceValidation.ts
/**
 * Invoice payload validation utilities
 * Provides client-side validation with user-friendly error messages
 */

export interface InvoicePayloadForValidation {
  line_item_id?: string | null;
  month_start?: number | null;
  month_end?: number | null;
  amount?: number | string | null;
  vendor?: string | null;
  invoice_date?: string | null;
  file?: File | null;
}

export interface ValidationError {
  field: string;
  message: string;
}

/**
 * Validates invoice payload before submission
 * Returns array of validation errors (empty if valid)
 */
export function validateInvoicePayload(
  payload: InvoicePayloadForValidation,
  options?: { requireFile?: boolean }
): ValidationError[] {
  const errors: ValidationError[] = [];
  const requireFile = options?.requireFile !== false; // Default to true

  // Validate line_item_id (rubro)
  if (!payload.line_item_id || payload.line_item_id.trim() === '') {
    errors.push({
      field: 'line_item_id',
      message: 'Selecciona un rubro antes de continuar'
    });
  }

  // Validate month_start
  if (payload.month_start == null) {
    errors.push({
      field: 'month_start',
      message: 'Mes de inicio es requerido'
    });
  } else {
    const monthStart = Number(payload.month_start);
    if (!Number.isInteger(monthStart) || monthStart < 1 || monthStart > 12) {
      errors.push({
        field: 'month_start',
        message: 'Mes de inicio debe ser un número entero entre 1 y 12'
      });
    }
  }

  // Validate month_end
  if (payload.month_end == null) {
    errors.push({
      field: 'month_end',
      message: 'Mes de fin es requerido'
    });
  } else {
    const monthEnd = Number(payload.month_end);
    if (!Number.isInteger(monthEnd) || monthEnd < 1 || monthEnd > 12) {
      errors.push({
        field: 'month_end',
        message: 'Mes de fin debe ser un número entero entre 1 y 12'
      });
    }
  }

  // Validate month range
  if (
    payload.month_start != null &&
    payload.month_end != null &&
    Number(payload.month_start) > Number(payload.month_end)
  ) {
    errors.push({
      field: 'month_range',
      message: 'Mes de inicio no puede ser mayor que mes de fin'
    });
  }

  // Validate amount
  if (payload.amount == null || payload.amount === '') {
    errors.push({
      field: 'amount',
      message: 'Monto de factura es requerido'
    });
  } else {
    const amount = typeof payload.amount === 'string' 
      ? parseFloat(payload.amount) 
      : payload.amount;
    
    if (Number.isNaN(amount)) {
      errors.push({
        field: 'amount',
        message: 'Monto de factura debe ser un número válido'
      });
    } else if (amount <= 0) {
      errors.push({
        field: 'amount',
        message: 'Monto de factura debe ser mayor a cero'
      });
    }
  }

  // Validate vendor
  if (!payload.vendor || payload.vendor.trim() === '') {
    errors.push({
      field: 'vendor',
      message: 'Proveedor es requerido para conciliación'
    });
  }

  // Validate invoice_date
  if (!payload.invoice_date || payload.invoice_date.trim() === '') {
    errors.push({
      field: 'invoice_date',
      message: 'Fecha de factura es requerida para conciliación'
    });
  } else {
    const parsedDate = Date.parse(payload.invoice_date);
    if (Number.isNaN(parsedDate)) {
      errors.push({
        field: 'invoice_date',
        message: 'Fecha de factura debe ser una fecha válida'
      });
    }
  }

  // Validate file (if required)
  if (requireFile && !payload.file) {
    errors.push({
      field: 'file',
      message: 'Documento de factura es requerido'
    });
  }

  return errors;
}

/**
 * Formats validation errors for display to user
 */
export function formatValidationErrors(errors: ValidationError[]): string {
  if (errors.length === 0) return '';
  if (errors.length === 1) return errors[0].message;
  
  return `Por favor corrige los siguientes errores:\n${errors.map(e => `• ${e.message}`).join('\n')}`;
}

/**
 * Logs invoice payload for debugging (excluding sensitive data)
 */
export function logInvoicePayload(
  payload: Record<string, unknown>,
  file?: File
): void {
  // Only log in development mode
  const isDev = typeof import.meta !== 'undefined' && import.meta.env?.DEV;
  if (!isDev) {
    return;
  }

  const safePayload = {
    line_item_id: payload.line_item_id,
    month: payload.month,
    amount: payload.amount,
    vendor: payload.vendor ? '***' : undefined, // Mask vendor
    invoice_number: payload.invoice_number ? '***' : undefined, // Mask invoice number
    invoice_date: payload.invoice_date,
    has_description: !!payload.description,
    file_info: file ? {
      name: file.name,
      size: file.size,
      type: file.type
    } : undefined
  };

  console.debug('[Invoice] Payload for submission:', safePayload);
}

/**
 * Extracts user-friendly error message from server response
 */
export function extractServerError(error: unknown): string {
  // Handle structured error response
  if (error && typeof error === 'object') {
    const err = error as Record<string, unknown>;
    
    // Check for error message in common locations
    if (typeof err.message === 'string') {
      return err.message;
    }
    
    // Check for validation errors array
    if (Array.isArray(err.errors)) {
      const messages = err.errors
        .map((e: unknown) => {
          if (typeof e === 'string') return e;
          if (e && typeof e === 'object' && 'message' in e) {
            return String((e as { message: unknown }).message);
          }
          return null;
        })
        .filter(Boolean);
      
      if (messages.length > 0) {
        return messages.join('; ');
      }
    }
    
    // Check for error field
    if (typeof err.error === 'string') {
      return err.error;
    }
  }
  
  // Handle Error instances
  if (error instanceof Error) {
    return error.message;
  }
  
  // Fallback
  return 'Error inesperado al subir factura. Por favor intenta nuevamente.';
}

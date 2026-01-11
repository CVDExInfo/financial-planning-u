// src/utils/__tests__/invoiceValidation.test.ts
import { describe, it, expect } from 'vitest';
import {
  validateInvoicePayload,
  formatValidationErrors,
  extractServerError,
  type InvoicePayloadForValidation,
  type ValidationError,
} from '../invoiceValidation';

describe('validateInvoicePayload', () => {
  const validPayload: InvoicePayloadForValidation = {
    line_item_id: 'R-12345',
    month_start: 1,
    month_end: 1,
    amount: 1000,
    vendor: 'Test Vendor',
    invoice_date: '2025-01-15',
    file: new File(['test'], 'test.pdf', { type: 'application/pdf' }),
  };

  it('should return no errors for valid payload', () => {
    const errors = validateInvoicePayload(validPayload);
    expect(errors).toHaveLength(0);
  });

  it('should validate line_item_id is required', () => {
    const payload = { ...validPayload, line_item_id: '' };
    const errors = validateInvoicePayload(payload);
    expect(errors).toContainEqual({
      field: 'line_item_id',
      message: expect.stringContaining('rubro'),
    });
  });

  it('should validate line_item_id is not null', () => {
    const payload = { ...validPayload, line_item_id: null };
    const errors = validateInvoicePayload(payload);
    expect(errors.some(e => e.field === 'line_item_id')).toBe(true);
  });

  it('should validate month_start is required', () => {
    const payload = { ...validPayload, month_start: null };
    const errors = validateInvoicePayload(payload);
    expect(errors.some(e => e.field === 'month_start')).toBe(true);
  });

  it('should validate month_start is integer between 1-12', () => {
    const invalidMonths = [0, 13, -1, 1.5];
    invalidMonths.forEach(month => {
      const payload = { ...validPayload, month_start: month };
      const errors = validateInvoicePayload(payload);
      expect(errors.some(e => e.field === 'month_start')).toBe(true);
    });
  });

  it('should validate month_end is required', () => {
    const payload = { ...validPayload, month_end: null };
    const errors = validateInvoicePayload(payload);
    expect(errors.some(e => e.field === 'month_end')).toBe(true);
  });

  it('should validate month_end is integer between 1-12', () => {
    const invalidMonths = [0, 13, -1, 1.5];
    invalidMonths.forEach(month => {
      const payload = { ...validPayload, month_end: month };
      const errors = validateInvoicePayload(payload);
      expect(errors.some(e => e.field === 'month_end')).toBe(true);
    });
  });

  it('should validate month_start <= month_end', () => {
    const payload = { ...validPayload, month_start: 5, month_end: 3 };
    const errors = validateInvoicePayload(payload);
    expect(errors).toContainEqual({
      field: 'month_range',
      message: expect.stringContaining('mayor que mes de fin'),
    });
  });

  it('should validate amount is required', () => {
    const payload = { ...validPayload, amount: null };
    const errors = validateInvoicePayload(payload);
    expect(errors.some(e => e.field === 'amount')).toBe(true);
  });

  it('should validate amount is a valid number', () => {
    const payload = { ...validPayload, amount: 'invalid' };
    const errors = validateInvoicePayload(payload);
    expect(errors.some(e => e.field === 'amount')).toBe(true);
  });

  it('should validate amount is greater than zero', () => {
    const payload = { ...validPayload, amount: 0 };
    const errors = validateInvoicePayload(payload);
    expect(errors).toContainEqual({
      field: 'amount',
      message: expect.stringContaining('mayor a cero'),
    });
  });

  it('should accept amount as string if parseable', () => {
    const payload = { ...validPayload, amount: '1000.50' };
    const errors = validateInvoicePayload(payload);
    expect(errors.some(e => e.field === 'amount')).toBe(false);
  });

  it('should validate vendor is required', () => {
    const payload = { ...validPayload, vendor: '' };
    const errors = validateInvoicePayload(payload);
    expect(errors).toContainEqual({
      field: 'vendor',
      message: expect.stringContaining('Proveedor'),
    });
  });

  it('should validate invoice_date is required', () => {
    const payload = { ...validPayload, invoice_date: '' };
    const errors = validateInvoicePayload(payload);
    expect(errors.some(e => e.field === 'invoice_date')).toBe(true);
  });

  it('should validate invoice_date is valid date', () => {
    const payload = { ...validPayload, invoice_date: 'invalid-date' };
    const errors = validateInvoicePayload(payload);
    expect(errors).toContainEqual({
      field: 'invoice_date',
      message: expect.stringContaining('fecha válida'),
    });
  });

  it('should validate file is required by default', () => {
    const payload = { ...validPayload, file: null };
    const errors = validateInvoicePayload(payload);
    expect(errors).toContainEqual({
      field: 'file',
      message: expect.stringContaining('Documento'),
    });
  });

  it('should allow file to be optional when requireFile is false', () => {
    const payload = { ...validPayload, file: null };
    const errors = validateInvoicePayload(payload, { requireFile: false });
    expect(errors.some(e => e.field === 'file')).toBe(false);
  });

  it('should return multiple errors for multiple invalid fields', () => {
    const payload: InvoicePayloadForValidation = {
      line_item_id: '',
      month_start: 0,
      month_end: 13,
      amount: -100,
      vendor: '',
      invoice_date: 'invalid',
      file: null,
    };
    const errors = validateInvoicePayload(payload);
    expect(errors.length).toBeGreaterThan(5);
  });
});

describe('formatValidationErrors', () => {
  it('should return empty string for no errors', () => {
    const result = formatValidationErrors([]);
    expect(result).toBe('');
  });

  it('should return single error message for one error', () => {
    const errors: ValidationError[] = [
      { field: 'amount', message: 'Amount is required' },
    ];
    const result = formatValidationErrors(errors);
    expect(result).toBe('Amount is required');
  });

  it('should format multiple errors as bullet list', () => {
    const errors: ValidationError[] = [
      { field: 'amount', message: 'Amount is required' },
      { field: 'vendor', message: 'Vendor is required' },
    ];
    const result = formatValidationErrors(errors);
    expect(result).toContain('•');
    expect(result).toContain('Amount is required');
    expect(result).toContain('Vendor is required');
  });
});

describe('extractServerError', () => {
  it('should extract message from error object', () => {
    const error = { message: 'Server error message' };
    const result = extractServerError(error);
    expect(result).toBe('Server error message');
  });

  it('should extract message from Error instance', () => {
    const error = new Error('Error instance message');
    const result = extractServerError(error);
    expect(result).toBe('Error instance message');
  });

  it('should extract errors array', () => {
    const error = {
      errors: [
        { message: 'Error 1' },
        { message: 'Error 2' },
      ],
    };
    const result = extractServerError(error);
    expect(result).toBe('Error 1; Error 2');
  });

  it('should extract errors array with strings', () => {
    const error = {
      errors: ['Error 1', 'Error 2'],
    };
    const result = extractServerError(error);
    expect(result).toBe('Error 1; Error 2');
  });

  it('should extract error field', () => {
    const error = { error: 'Error field message' };
    const result = extractServerError(error);
    expect(result).toBe('Error field message');
  });

  it('should return fallback message for unknown error', () => {
    const error = { someField: 'some value' };
    const result = extractServerError(error);
    expect(result).toContain('Error inesperado');
  });

  it('should return fallback message for null', () => {
    const result = extractServerError(null);
    expect(result).toContain('Error inesperado');
  });

  it('should return fallback message for undefined', () => {
    const result = extractServerError(undefined);
    expect(result).toContain('Error inesperado');
  });
});

describe('validateInvoicePayload - MOD (Mano de Obra) Support', () => {
  const basePayload: InvoicePayloadForValidation = {
    line_item_id: 'R-MOD-001',
    month_start: 1,
    month_end: 1,
    amount: 1000,
    vendor: 'Labor Vendor',
    invoice_date: '2025-01-15',
    invoice_number: '',
    file: null,
  };

  describe('MOD items (requireFile: false, requireInvoiceNumber: false)', () => {
    it('should allow MOD payload without file', () => {
      const errors = validateInvoicePayload(basePayload, {
        requireFile: false,
        requireInvoiceNumber: false,
      });
      expect(errors).toHaveLength(0);
    });

    it('should allow MOD payload without invoice_number', () => {
      const payload = { ...basePayload, invoice_number: '' };
      const errors = validateInvoicePayload(payload, {
        requireFile: false,
        requireInvoiceNumber: false,
      });
      expect(errors).toHaveLength(0);
    });

    it('should still validate other required fields for MOD', () => {
      const payload = { ...basePayload, amount: null };
      const errors = validateInvoicePayload(payload, {
        requireFile: false,
        requireInvoiceNumber: false,
      });
      expect(errors.some(e => e.field === 'amount')).toBe(true);
    });

    it('should validate month range for MOD', () => {
      const payload = { ...basePayload, month_start: 5, month_end: 3 };
      const errors = validateInvoicePayload(payload, {
        requireFile: false,
        requireInvoiceNumber: false,
      });
      expect(errors.some(e => e.field === 'month_range')).toBe(true);
    });

    it('should validate vendor is required for MOD', () => {
      const payload = { ...basePayload, vendor: '' };
      const errors = validateInvoicePayload(payload, {
        requireFile: false,
        requireInvoiceNumber: false,
      });
      expect(errors.some(e => e.field === 'vendor')).toBe(true);
    });

    it('should validate invoice_date is required for MOD', () => {
      const payload = { ...basePayload, invoice_date: '' };
      const errors = validateInvoicePayload(payload, {
        requireFile: false,
        requireInvoiceNumber: false,
      });
      expect(errors.some(e => e.field === 'invoice_date')).toBe(true);
    });
  });

  describe('Non-MOD items (requireFile: true, requireInvoiceNumber: true - defaults)', () => {
    it('should require file for non-MOD items', () => {
      const payload = { ...basePayload, file: null };
      const errors = validateInvoicePayload(payload); // Default options
      expect(errors).toContainEqual({
        field: 'file',
        message: 'Documento de factura es requerido',
      });
    });

    it('should require invoice_number for non-MOD items', () => {
      const payload = {
        ...basePayload,
        invoice_number: '',
        file: new File(['test'], 'test.pdf', { type: 'application/pdf' }),
      };
      const errors = validateInvoicePayload(payload); // Default options
      expect(errors).toContainEqual({
        field: 'invoice_number',
        message: 'Número de factura es requerido',
      });
    });

    it('should accept valid non-MOD payload with file and invoice_number', () => {
      const payload = {
        ...basePayload,
        invoice_number: 'INV-12345',
        file: new File(['test'], 'test.pdf', { type: 'application/pdf' }),
      };
      const errors = validateInvoicePayload(payload);
      expect(errors).toHaveLength(0);
    });
  });

  describe('Mixed scenarios', () => {
    it('should allow file for MOD even when not required', () => {
      const payload = {
        ...basePayload,
        file: new File(['test'], 'test.pdf', { type: 'application/pdf' }),
      };
      const errors = validateInvoicePayload(payload, {
        requireFile: false,
        requireInvoiceNumber: false,
      });
      expect(errors).toHaveLength(0);
    });

    it('should allow invoice_number for MOD even when not required', () => {
      const payload = { ...basePayload, invoice_number: 'INV-12345' };
      const errors = validateInvoicePayload(payload, {
        requireFile: false,
        requireInvoiceNumber: false,
      });
      expect(errors).toHaveLength(0);
    });
  });
});

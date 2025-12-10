/**
 * Tests for payroll validation schemas
 */

import {
  PayrollKindSchema,
  PayrollEntrySchema,
  PayrollEntryCreateSchema,
  parsePayrollEntry,
  parsePayrollEntryCreate,
  safeParsePayrollEntry,
  safeParsePayrollEntryCreate,
} from '../../src/validation/payroll';

describe('PayrollKindSchema', () => {
  it('should accept valid kind values', () => {
    expect(PayrollKindSchema.parse('plan')).toBe('plan');
    expect(PayrollKindSchema.parse('forecast')).toBe('forecast');
    expect(PayrollKindSchema.parse('actual')).toBe('actual');
  });

  it('should reject invalid kind values', () => {
    expect(() => PayrollKindSchema.parse('invalid')).toThrow();
    expect(() => PayrollKindSchema.parse('PLAN')).toThrow();
    expect(() => PayrollKindSchema.parse('')).toThrow();
  });
});

describe('PayrollEntrySchema', () => {
  const validEntry = {
    id: 'payroll_plan_abc1234567',
    projectId: 'P-GOLDEN-1',
    period: '2025-01',
    kind: 'plan' as const,
    amount: 12000,
    currency: 'USD',
  };

  it('should validate a complete valid entry', () => {
    const result = PayrollEntrySchema.parse(validEntry);
    expect(result).toEqual(validEntry);
  });

  it('should accept proj_ format projectId', () => {
    const entry = {
      ...validEntry,
      projectId: 'proj_abc1234567',
    };
    const result = PayrollEntrySchema.parse(entry);
    expect(result.projectId).toBe('proj_abc1234567');
  });

  it('should accept all three kind values', () => {
    const planEntry = { ...validEntry, kind: 'plan', id: 'payroll_plan_abc1234567' };
    const forecastEntry = { ...validEntry, kind: 'forecast', id: 'payroll_forecast_abc1234567' };
    const actualEntry = { ...validEntry, kind: 'actual', id: 'payroll_actual_abc1234567' };

    expect(PayrollEntrySchema.parse(planEntry).kind).toBe('plan');
    expect(PayrollEntrySchema.parse(forecastEntry).kind).toBe('forecast');
    expect(PayrollEntrySchema.parse(actualEntry).kind).toBe('actual');
  });

  it('should reject negative amount', () => {
    const invalidEntry = { ...validEntry, amount: -100 };
    expect(() => PayrollEntrySchema.parse(invalidEntry)).toThrow();
  });

  it('should accept zero amount', () => {
    const entry = { ...validEntry, amount: 0 };
    const result = PayrollEntrySchema.parse(entry);
    expect(result.amount).toBe(0);
  });

  it('should reject invalid period format', () => {
    const invalidEntry = { ...validEntry, period: '2025-1' };
    expect(() => PayrollEntrySchema.parse(invalidEntry)).toThrow();

    const invalidEntry2 = { ...validEntry, period: '25-01' };
    expect(() => PayrollEntrySchema.parse(invalidEntry2)).toThrow();

    const invalidEntry3 = { ...validEntry, period: '2025-13' };
    expect(() => PayrollEntrySchema.parse(invalidEntry3)).toThrow();
  });

  it('should reject invalid currency length', () => {
    const invalidEntry = { ...validEntry, currency: 'US' };
    expect(() => PayrollEntrySchema.parse(invalidEntry)).toThrow();

    const invalidEntry2 = { ...validEntry, currency: 'USDD' };
    expect(() => PayrollEntrySchema.parse(invalidEntry2)).toThrow();
  });

  it('should convert currency to uppercase', () => {
    const entry = { ...validEntry, currency: 'usd' };
    const result = PayrollEntrySchema.parse(entry);
    expect(result.currency).toBe('USD');
  });

  it('should accept optional fields', () => {
    const entryWithOptionals = {
      ...validEntry,
      allocationId: 'alloc_xyz1234567',
      rubroId: 'RB0001',
      resourceCount: 3,
      source: 'excel',
      uploadedBy: 'user@example.com',
      uploadedAt: '2025-01-15T10:00:00.000Z',
      notes: 'Test notes',
      pk: 'PROJECT#P-GOLDEN-1#MONTH#2025-01',
      sk: 'PAYROLL#PLAN#payroll_plan_abc1234567',
      createdAt: '2025-01-15T10:00:00.000Z',
      createdBy: 'user@example.com',
      updatedAt: '2025-01-15T10:00:00.000Z',
      updatedBy: 'user@example.com',
    };

    const result = PayrollEntrySchema.parse(entryWithOptionals);
    expect(result.allocationId).toBe('alloc_xyz1234567');
    expect(result.rubroId).toBe('RB0001');
    expect(result.resourceCount).toBe(3);
    expect(result.notes).toBe('Test notes');
  });

  it('should validate without optional fields', () => {
    const result = PayrollEntrySchema.parse(validEntry);
    expect(result.allocationId).toBeUndefined();
    expect(result.rubroId).toBeUndefined();
    expect(result.notes).toBeUndefined();
  });

  it('should reject invalid email format in uploadedBy', () => {
    const invalidEntry = {
      ...validEntry,
      uploadedBy: 'not-an-email',
    };
    expect(() => PayrollEntrySchema.parse(invalidEntry)).toThrow();
  });

  it('should reject notes exceeding 500 characters', () => {
    const longNotes = 'x'.repeat(501);
    const invalidEntry = {
      ...validEntry,
      notes: longNotes,
    };
    expect(() => PayrollEntrySchema.parse(invalidEntry)).toThrow();
  });

  it('should reject invalid resourceCount (non-integer)', () => {
    const invalidEntry = {
      ...validEntry,
      resourceCount: 3.5,
    };
    expect(() => PayrollEntrySchema.parse(invalidEntry)).toThrow();
  });

  it('should reject negative resourceCount', () => {
    const invalidEntry = {
      ...validEntry,
      resourceCount: -1,
    };
    expect(() => PayrollEntrySchema.parse(invalidEntry)).toThrow();
  });
});

describe('PayrollEntryCreateSchema', () => {
  const validCreate = {
    projectId: 'P-GOLDEN-1',
    period: '2025-01',
    kind: 'forecast' as const,
    amount: 15000,
    currency: 'USD',
  };

  it('should validate a valid create payload', () => {
    const result = PayrollEntryCreateSchema.parse(validCreate);
    expect(result).toEqual(validCreate);
  });

  it('should omit id, pk, sk, and timestamps', () => {
    const withExtraFields = {
      ...validCreate,
      id: 'payroll_forecast_abc1234567',
      pk: 'PROJECT#P-GOLDEN-1#MONTH#2025-01',
      sk: 'PAYROLL#FORECAST#payroll_forecast_abc1234567',
      uploadedAt: '2025-01-15T10:00:00.000Z',
      createdAt: '2025-01-15T10:00:00.000Z',
      updatedAt: '2025-01-15T10:00:00.000Z',
    };

    const result = PayrollEntryCreateSchema.parse(withExtraFields);
    expect((result as any).id).toBeUndefined();
    expect((result as any).pk).toBeUndefined();
    expect((result as any).sk).toBeUndefined();
    expect((result as any).uploadedAt).toBeUndefined();
    expect((result as any).createdAt).toBeUndefined();
    expect((result as any).updatedAt).toBeUndefined();
  });

  it('should require all mandatory fields', () => {
    const missingProjectId = { ...validCreate };
    delete (missingProjectId as any).projectId;
    expect(() => PayrollEntryCreateSchema.parse(missingProjectId)).toThrow();

    const missingPeriod = { ...validCreate };
    delete (missingPeriod as any).period;
    expect(() => PayrollEntryCreateSchema.parse(missingPeriod)).toThrow();

    const missingKind = { ...validCreate };
    delete (missingKind as any).kind;
    expect(() => PayrollEntryCreateSchema.parse(missingKind)).toThrow();

    const missingAmount = { ...validCreate };
    delete (missingAmount as any).amount;
    expect(() => PayrollEntryCreateSchema.parse(missingAmount)).toThrow();

    const missingCurrency = { ...validCreate };
    delete (missingCurrency as any).currency;
    expect(() => PayrollEntryCreateSchema.parse(missingCurrency)).toThrow();
  });

  it('should accept optional metadata fields', () => {
    const withMetadata = {
      ...validCreate,
      source: 'hr_system',
      uploadedBy: 'admin@example.com',
      rubroId: 'RB0002',
      allocationId: 'alloc_test123456',
      resourceCount: 5,
      notes: 'Initial forecast for Q1',
      createdBy: 'admin@example.com',
      updatedBy: 'admin@example.com',
    };

    const result = PayrollEntryCreateSchema.parse(withMetadata);
    expect(result.source).toBe('hr_system');
    expect(result.uploadedBy).toBe('admin@example.com');
    expect(result.rubroId).toBe('RB0002');
    expect(result.resourceCount).toBe(5);
    expect(result.notes).toBe('Initial forecast for Q1');
  });
});

describe('parsePayrollEntry', () => {
  it('should parse valid data', () => {
    const data = {
      id: 'payroll_actual_abc1234567',
      projectId: 'P-TEST-1',
      period: '2025-02',
      kind: 'actual',
      amount: 10000,
      currency: 'EUR',
    };

    const result = parsePayrollEntry(data);
    expect(result.id).toBe(data.id);
    expect(result.kind).toBe('actual');
  });

  it('should throw on invalid data', () => {
    const invalidData = {
      id: 'invalid-id',
      projectId: 'P-TEST-1',
      period: '2025-02',
      kind: 'actual',
      amount: -1,
      currency: 'EUR',
    };

    expect(() => parsePayrollEntry(invalidData)).toThrow();
  });
});

describe('parsePayrollEntryCreate', () => {
  it('should parse valid create data', () => {
    const data = {
      projectId: 'proj_test123456',
      period: '2025-03',
      kind: 'plan',
      amount: 20000,
      currency: 'COP',
    };

    const result = parsePayrollEntryCreate(data);
    expect(result.projectId).toBe(data.projectId);
    expect(result.kind).toBe('plan');
    expect(result.currency).toBe('COP');
  });

  it('should throw on invalid data', () => {
    const invalidData = {
      projectId: 'invalid',
      period: '2025',
      kind: 'wrong',
      amount: 0,
      currency: 'USD',
    };

    expect(() => parsePayrollEntryCreate(invalidData)).toThrow();
  });
});

describe('safeParsePayrollEntry', () => {
  it('should return success for valid data', () => {
    const data = {
      id: 'payroll_forecast_xyz9876543',
      projectId: 'P-SAFE-1',
      period: '2025-04',
      kind: 'forecast',
      amount: 5000,
      currency: 'MXN',
    };

    const result = safeParsePayrollEntry(data);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.kind).toBe('forecast');
    }
  });

  it('should return error for invalid data', () => {
    const invalidData = {
      id: 'invalid',
      projectId: 'P-SAFE-1',
      period: '2025-04',
      kind: 'forecast',
      amount: -500,
      currency: 'MXN',
    };

    const result = safeParsePayrollEntry(invalidData);
    expect(result.success).toBe(false);
  });
});

describe('safeParsePayrollEntryCreate', () => {
  it('should return success for valid create data', () => {
    const data = {
      projectId: 'P-CREATE-1',
      period: '2025-05',
      kind: 'actual',
      amount: 8000,
      currency: 'USD',
    };

    const result = safeParsePayrollEntryCreate(data);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.amount).toBe(8000);
    }
  });

  it('should return error for invalid create data', () => {
    const invalidData = {
      period: '2025-05',
      kind: 'actual',
      amount: 8000,
      currency: 'USD',
      // Missing required projectId
    };

    const result = safeParsePayrollEntryCreate(invalidData);
    expect(result.success).toBe(false);
  });
});

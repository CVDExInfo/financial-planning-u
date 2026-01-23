/**
 * Unit tests for validateRubro module
 * 
 * Tests both audit mode and strict mode validation of canonical rubro IDs
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import {
  validateCanonicalRubro,
  validateCanonicalRubros,
  checkRubroValidity,
  getValidRubroIds,
  buildRubroValidationError,
} from '../validateRubro';

describe('validateRubro', () => {
  // Save original env
  const originalEnv = process.env.STRICT_RUBRO_VALIDATION;
  
  beforeEach(() => {
    // Reset env before each test
    delete process.env.STRICT_RUBRO_VALIDATION;
  });
  
  afterEach(() => {
    // Restore original env
    if (originalEnv !== undefined) {
      process.env.STRICT_RUBRO_VALIDATION = originalEnv;
    } else {
      delete process.env.STRICT_RUBRO_VALIDATION;
    }
  });

  describe('validateCanonicalRubro', () => {
    it('should accept canonical rubro IDs', () => {
      expect(validateCanonicalRubro('MOD-ING')).toBe('MOD-ING');
      expect(validateCanonicalRubro('MOD-SDM')).toBe('MOD-SDM');
      expect(validateCanonicalRubro('GSV-REU')).toBe('GSV-REU');
      expect(validateCanonicalRubro('TEC-LIC-MON')).toBe('TEC-LIC-MON');
    });

    it('should be case-insensitive for canonical IDs', () => {
      expect(validateCanonicalRubro('mod-ing')).toBe('MOD-ING');
      expect(validateCanonicalRubro('Mod-Sdm')).toBe('MOD-SDM');
      expect(validateCanonicalRubro('GSV-reu')).toBe('GSV-REU');
    });

    it('should throw error for empty/null rubro', () => {
      expect(() => validateCanonicalRubro('')).toThrow('Missing rubro');
      expect(() => validateCanonicalRubro(null as any)).toThrow('Missing rubro');
      expect(() => validateCanonicalRubro(undefined)).toThrow('Missing rubro');
      expect(() => validateCanonicalRubro('   ')).toThrow('Missing rubro');
    });

    it('should throw error for unknown rubro', () => {
      expect(() => validateCanonicalRubro('INVALID-RUBRO')).toThrow('Unknown rubro');
      expect(() => validateCanonicalRubro('FAKE-123')).toThrow('Unknown rubro');
    });

    it('should map legacy IDs to canonical in audit mode', () => {
      process.env.STRICT_RUBRO_VALIDATION = 'false';
      
      expect(validateCanonicalRubro('RB0001')).toBe('MOD-ING');
      expect(validateCanonicalRubro('RB0002')).toBe('MOD-LEAD');
      expect(validateCanonicalRubro('RB0003')).toBe('MOD-SDM');
      expect(validateCanonicalRubro('RUBRO-001')).toBe('MOD-ING');
      expect(validateCanonicalRubro('project-manager')).toBe('MOD-LEAD');
      expect(validateCanonicalRubro('MOD-PM')).toBe('MOD-LEAD');
    });

    it('should accept legacy IDs in audit mode without throwing', () => {
      process.env.STRICT_RUBRO_VALIDATION = 'false';
      
      // Should not throw, should return canonical
      expect(() => validateCanonicalRubro('RB0001')).not.toThrow();
      expect(validateCanonicalRubro('RB0001')).toBe('MOD-ING');
    });

    it('should reject legacy IDs in strict mode', () => {
      process.env.STRICT_RUBRO_VALIDATION = 'true';
      
      expect(() => validateCanonicalRubro('RB0001')).toThrow('must be canonical ID');
      expect(() => validateCanonicalRubro('project-manager')).toThrow('must be canonical ID');
      expect(() => validateCanonicalRubro('MOD-PM')).toThrow('must be canonical ID');
    });

    it('should accept canonical IDs in strict mode', () => {
      process.env.STRICT_RUBRO_VALIDATION = 'true';
      
      expect(validateCanonicalRubro('MOD-ING')).toBe('MOD-ING');
      expect(validateCanonicalRubro('GSV-REU')).toBe('GSV-REU');
    });

    it('should respect strict parameter over environment variable', () => {
      process.env.STRICT_RUBRO_VALIDATION = 'false';
      
      // Explicit strict=true should reject legacy IDs
      expect(() => validateCanonicalRubro('RB0001', true)).toThrow('must be canonical ID');
      
      process.env.STRICT_RUBRO_VALIDATION = 'true';
      
      // Explicit strict=false should allow legacy IDs
      expect(validateCanonicalRubro('RB0001', false)).toBe('MOD-ING');
    });

    it('should include helpful error messages', () => {
      try {
        validateCanonicalRubro('INVALID');
        fail('Should have thrown');
      } catch (err: any) {
        expect(err.message).toContain('Unknown rubro');
        expect(err.message).toContain('INVALID');
        expect(err.message).toContain('Acceptable canonical examples');
        expect(err.statusCode).toBe(400);
      }
    });
  });

  describe('validateCanonicalRubros', () => {
    it('should validate multiple rubros', () => {
      const result = validateCanonicalRubros(['MOD-ING', 'MOD-SDM', 'GSV-REU']);
      expect(result).toEqual(['MOD-ING', 'MOD-SDM', 'GSV-REU']);
    });

    it('should throw if array is empty', () => {
      expect(() => validateCanonicalRubros([])).toThrow('at least one rubro_id is required');
    });

    it('should throw if any rubro is invalid', () => {
      expect(() => validateCanonicalRubros(['MOD-ING', 'INVALID', 'GSV-REU'])).toThrow('Unknown rubro');
    });

    it('should map legacy IDs in audit mode', () => {
      process.env.STRICT_RUBRO_VALIDATION = 'false';
      
      const result = validateCanonicalRubros(['RB0001', 'MOD-SDM', 'project-manager']);
      expect(result).toEqual(['MOD-ING', 'MOD-SDM', 'MOD-LEAD']);
    });
  });

  describe('checkRubroValidity', () => {
    it('should return valid result for canonical IDs', () => {
      const result = checkRubroValidity('MOD-ING');
      expect(result.isValid).toBe(true);
      expect(result.canonical).toBe('MOD-ING');
      expect(result.error).toBeUndefined();
    });

    it('should return invalid result for unknown IDs', () => {
      const result = checkRubroValidity('INVALID');
      expect(result.isValid).toBe(false);
      expect(result.canonical).toBeNull();
      expect(result.error).toBeDefined();
      expect(result.error).toContain('Unknown rubro');
    });

    it('should not throw for invalid IDs', () => {
      expect(() => checkRubroValidity('INVALID')).not.toThrow();
    });
  });

  describe('getValidRubroIds', () => {
    it('should return array of canonical IDs', () => {
      const ids = getValidRubroIds();
      expect(Array.isArray(ids)).toBe(true);
      expect(ids.length).toBeGreaterThan(0);
      expect(ids).toContain('MOD-ING');
      expect(ids).toContain('MOD-SDM');
      expect(ids).toContain('GSV-REU');
    });
  });

  describe('buildRubroValidationError', () => {
    it('should build error object with examples', () => {
      const error = buildRubroValidationError('INVALID', 'Custom error message');
      expect(error.error).toBe('Custom error message');
      expect(error.rubroId).toBe('INVALID');
      expect(Array.isArray(error.validExamples)).toBe(true);
      expect(error.validExamples.length).toBeGreaterThan(0);
      expect(error.documentation).toContain('/data/rubros.taxonomy.json');
    });

    it('should use default message if not provided', () => {
      const error = buildRubroValidationError('INVALID');
      expect(error.error).toContain('Invalid rubro_id');
      expect(error.error).toContain('INVALID');
    });
  });
});

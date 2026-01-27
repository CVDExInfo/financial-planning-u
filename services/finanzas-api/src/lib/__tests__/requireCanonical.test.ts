/**
 * Unit tests for requireCanonicalRubro enforcement helper (Backend)
 */

import { requireCanonicalRubro } from '../requireCanonical';

describe('requireCanonicalRubro (backend)', () => {
  describe('valid canonical IDs', () => {
    it('should return canonical ID for valid canonical input', () => {
      expect(requireCanonicalRubro('MOD-SDM')).toBe('MOD-SDM');
      expect(requireCanonicalRubro('MOD-LEAD')).toBe('MOD-LEAD');
      expect(requireCanonicalRubro('MOD-ING')).toBe('MOD-ING');
      expect(requireCanonicalRubro('TEC-HW-FIELD')).toBe('TEC-HW-FIELD');
    });

    it('should return canonical ID for lowercase canonical input', () => {
      expect(requireCanonicalRubro('mod-sdm')).toBe('MOD-SDM');
      expect(requireCanonicalRubro('mod-lead')).toBe('MOD-LEAD');
    });
  });

  describe('valid aliases', () => {
    it('should return canonical ID for legacy aliases', () => {
      expect(requireCanonicalRubro('mod-lead-ingeniero-delivery')).toBe('MOD-LEAD');
      expect(requireCanonicalRubro('mod-sdm-service-delivery-manager')).toBe('MOD-SDM');
      expect(requireCanonicalRubro('service-delivery-manager')).toBe('MOD-SDM');
    });

    it('should return canonical ID for old RB#### format', () => {
      expect(requireCanonicalRubro('RB0001')).toBe('MOD-ING');
      expect(requireCanonicalRubro('RB0002')).toBe('MOD-LEAD');
      expect(requireCanonicalRubro('RB0003')).toBe('MOD-SDM');
    });

    it('should return canonical ID for human-readable role names', () => {
      expect(requireCanonicalRubro('project-manager')).toBe('MOD-LEAD');
      expect(requireCanonicalRubro('Ingeniero Delivery')).toBe('MOD-LEAD');
    });
  });

  describe('invalid inputs', () => {
    it('should throw for unknown rubro ID', () => {
      expect(() => requireCanonicalRubro('INVALID-RUBRO')).toThrow(
        /Unknown or non-canonical rubro id.*INVALID-RUBRO.*operation blocked/
      );
    });

    it('should throw for undefined input', () => {
      expect(() => requireCanonicalRubro(undefined)).toThrow(
        /Unknown or non-canonical rubro id.*undefined.*operation blocked/
      );
    });

    it('should throw for empty string', () => {
      expect(() => requireCanonicalRubro('')).toThrow(
        /Unknown or non-canonical rubro id.*operation blocked/
      );
    });

    it('should throw for null input', () => {
      expect(() => requireCanonicalRubro(null as any)).toThrow(
        /Unknown or non-canonical rubro id.*null.*operation blocked/
      );
    });
  });

  describe('edge cases', () => {
    it('should handle whitespace in canonical IDs', () => {
      expect(requireCanonicalRubro('  MOD-SDM  ')).toBe('MOD-SDM');
    });

    it('should throw for invalid legacy format', () => {
      expect(() => requireCanonicalRubro('RUBRO-999')).toThrow(
        /Unknown or non-canonical rubro id.*RUBRO-999.*operation blocked/
      );
    });
  });

  describe('enforcement guarantees', () => {
    it('should always return a value from canonical taxonomy', () => {
      const validIds = ['MOD-SDM', 'MOD-LEAD', 'MOD-ING', 'TEC-HW-FIELD'];
      
      validIds.forEach(id => {
        const result = requireCanonicalRubro(id);
        expect(result).toBeTruthy();
        expect(typeof result).toBe('string');
        expect(result.length).toBeGreaterThan(0);
      });
    });

    it('should never return null or undefined for valid input', () => {
      const result = requireCanonicalRubro('MOD-SDM');
      expect(result).not.toBeNull();
      expect(result).not.toBeUndefined();
    });

    it('should always throw for invalid input', () => {
      const invalidIds = ['INVALID', 'NOT-A-RUBRO', 'FAKE-123', ''];
      
      invalidIds.forEach(id => {
        expect(() => requireCanonicalRubro(id)).toThrow();
      });
    });
  });
});

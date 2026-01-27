/**
 * Unit tests for requireCanonicalRubro enforcement helper (Backend)
 */

import { requireCanonicalRubro } from '../requireCanonical';

describe('requireCanonicalRubro (backend)', () => {
  describe('missing input', () => {
    it('should throw on undefined input', () => {
      expect(() => requireCanonicalRubro(undefined)).toThrow('[rubro] missing input');
    });

    it('should throw on empty string', () => {
      expect(() => requireCanonicalRubro('')).toThrow('[rubro] missing input');
    });

    it('should throw on null input', () => {
      expect(() => requireCanonicalRubro(null as any)).toThrow('[rubro] missing input');
    });
  });

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
        /Unknown rubro \(no canonical mapping\).*INVALID-RUBRO/
      );
    });

    it('should throw for invalid legacy format', () => {
      expect(() => requireCanonicalRubro('RUBRO-999')).toThrow(
        /Unknown rubro \(no canonical mapping\).*RUBRO-999/
      );
    });
  });

  describe('edge cases', () => {
    it('should handle whitespace in canonical IDs', () => {
      expect(requireCanonicalRubro('  MOD-SDM  ')).toBe('MOD-SDM');
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
      const invalidIds = ['INVALID', 'NOT-A-RUBRO', 'FAKE-123'];
      
      invalidIds.forEach(id => {
        expect(() => requireCanonicalRubro(id)).toThrow();
      });
    });
  });

  describe('taxonomy validation', () => {
    it('should validate that taxonomy entry exists for canonical ID', () => {
      // All valid canonical IDs should have taxonomy entries
      const canonical = requireCanonicalRubro('MOD-SDM');
      expect(canonical).toBe('MOD-SDM');
    });
  });
});

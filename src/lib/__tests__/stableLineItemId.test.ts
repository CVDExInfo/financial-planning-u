import { describe, it, expect } from '@jest/globals';
import { stableLineItemId, stableIdFromParts } from '../stableLineItemId';

describe('stableLineItemId', () => {
  describe('basic functionality', () => {
    it('should generate stable ID from canonical rubro ID only', () => {
      const result = stableLineItemId('MOD-SDM');
      expect(result).toBe('mod-sdm');
    });

    it('should generate stable ID from canonical rubro ID and role', () => {
      const result = stableLineItemId('MOD-SDM', 'Service Delivery Manager');
      expect(result).toBe('mod-sdm-service-delivery-manager');
    });

    it('should generate stable ID from all parameters', () => {
      const result = stableLineItemId('MOD-SDM', 'Service Delivery Manager', 'MOD');
      expect(result).toBe('mod-sdm-service-delivery-manager-mod');
    });
  });

  describe('normalization', () => {
    it('should normalize uppercase to lowercase', () => {
      const result = stableLineItemId('MOD-LEAD', 'LEAD ENGINEER');
      expect(result).toBe('mod-lead-lead-engineer');
    });

    it('should normalize spaces to hyphens', () => {
      const result = stableLineItemId('GSV-RPT', 'Informes Mensuales');
      expect(result).toBe('gsv-rpt-informes-mensuales');
    });

    it('should normalize accented characters', () => {
      const result = stableLineItemId('MOD-ING', 'Ingeniero Señor');
      expect(result).toBe('mod-ing-ingeniero-senor');
    });

    it('should normalize special characters', () => {
      const result = stableLineItemId('MOD-DEV', 'Developer@123!');
      expect(result).toBe('mod-dev-developer-123');
    });

    it('should handle multiple consecutive spaces/special chars', () => {
      const result = stableLineItemId('GSV-TOOL', 'Herramientas   &   Utilidades!!!');
      expect(result).toBe('gsv-tool-herramientas-utilidades');
    });

    it('should remove leading and trailing hyphens', () => {
      const result = stableLineItemId('  -MOD-SDM-  ', '  -Role-  ');
      expect(result).toBe('mod-sdm-role');
    });
  });

  describe('edge cases', () => {
    it('should filter out null values', () => {
      const result = stableLineItemId('MOD-SDM', null, 'MOD');
      expect(result).toBe('mod-sdm-mod');
    });

    it('should filter out undefined values', () => {
      const result = stableLineItemId('MOD-SDM', undefined, undefined);
      expect(result).toBe('mod-sdm');
    });

    it('should filter out empty strings', () => {
      const result = stableLineItemId('MOD-SDM', '', '   ');
      expect(result).toBe('mod-sdm');
    });

    it('should throw if no canonical ID provided', () => {
      expect(() => stableLineItemId(null)).toThrow('[stableLineItemId] At least canonicalRubroId must be provided');
      expect(() => stableLineItemId(undefined)).toThrow('[stableLineItemId] At least canonicalRubroId must be provided');
      expect(() => stableLineItemId('')).toThrow('[stableLineItemId] At least canonicalRubroId must be provided');
    });
  });

  describe('determinism', () => {
    it('should produce same output for same inputs', () => {
      const result1 = stableLineItemId('MOD-SDM', 'Service Delivery Manager', 'MOD');
      const result2 = stableLineItemId('MOD-SDM', 'Service Delivery Manager', 'MOD');
      expect(result1).toBe(result2);
    });

    it('should be case-insensitive deterministic', () => {
      const result1 = stableLineItemId('mod-sdm', 'service delivery manager', 'mod');
      const result2 = stableLineItemId('MOD-SDM', 'SERVICE DELIVERY MANAGER', 'MOD');
      expect(result1).toBe(result2);
      expect(result1).toBe('mod-sdm-service-delivery-manager-mod');
    });

    it('should handle whitespace variations deterministically', () => {
      const result1 = stableLineItemId('MOD-SDM', '  Service   Delivery   Manager  ');
      const result2 = stableLineItemId('MOD-SDM', 'Service Delivery Manager');
      expect(result1).toBe(result2);
      expect(result1).toBe('mod-sdm-service-delivery-manager');
    });
  });

  describe('real-world examples', () => {
    it('should handle MOD rubros', () => {
      expect(stableLineItemId('MOD-SDM', 'Service Delivery Manager', 'MOD'))
        .toBe('mod-sdm-service-delivery-manager-mod');
      expect(stableLineItemId('MOD-ING', 'Ingeniero Soporte N1', 'MOD'))
        .toBe('mod-ing-ingeniero-soporte-n1-mod');
      expect(stableLineItemId('MOD-LEAD', 'Technical Lead', 'MOD'))
        .toBe('mod-lead-technical-lead-mod');
    });

    it('should handle GSV rubros', () => {
      expect(stableLineItemId('GSV-RPT', 'Informes mensuales', 'GSV'))
        .toBe('gsv-rpt-informes-mensuales-gsv');
      expect(stableLineItemId('GSV-TOOL', 'Herramientas de gestión', 'GSV'))
        .toBe('gsv-tool-herramientas-de-gestion-gsv');
    });

    it('should handle INF rubros', () => {
      expect(stableLineItemId('INF-CLOUD', 'Servicios Cloud AWS', 'INF'))
        .toBe('inf-cloud-servicios-cloud-aws-inf');
    });
  });

  describe('stableIdFromParts alias', () => {
    it('should work as alias for stableLineItemId', () => {
      const result1 = stableLineItemId('MOD-SDM', 'Manager', 'MOD');
      const result2 = stableIdFromParts('MOD-SDM', 'Manager', 'MOD');
      expect(result1).toBe(result2);
    });
  });
});

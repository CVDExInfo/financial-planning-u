import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { stableLineItemId, stableIdFromParts } from '../stableLineItemId';

describe('stableLineItemId', () => {
  describe('basic functionality', () => {
    it('should generate stable ID from canonical rubro ID only', () => {
      const result = stableLineItemId('MOD-SDM');
      assert.strictEqual(result, 'mod-sdm');
    });

    it('should generate stable ID from canonical rubro ID and role', () => {
      const result = stableLineItemId('MOD-SDM', 'Service Delivery Manager');
      assert.strictEqual(result, 'mod-sdm-service-delivery-manager');
    });

    it('should generate stable ID from all parameters', () => {
      const result = stableLineItemId('MOD-SDM', 'Service Delivery Manager', 'MOD');
      assert.strictEqual(result, 'mod-sdm-service-delivery-manager-mod');
    });
  });

  describe('normalization', () => {
    it('should normalize uppercase to lowercase', () => {
      const result = stableLineItemId('MOD-LEAD', 'LEAD ENGINEER');
      assert.strictEqual(result, 'mod-lead-lead-engineer');
    });

    it('should normalize spaces to hyphens', () => {
      const result = stableLineItemId('GSV-RPT', 'Informes Mensuales');
      assert.strictEqual(result, 'gsv-rpt-informes-mensuales');
    });

    it('should normalize accented characters', () => {
      const result = stableLineItemId('MOD-ING', 'Ingeniero Señor');
      assert.strictEqual(result, 'mod-ing-ingeniero-senor');
    });

    it('should normalize special characters', () => {
      const result = stableLineItemId('MOD-DEV', 'Developer@123!');
      assert.strictEqual(result, 'mod-dev-developer-123');
    });

    it('should handle multiple consecutive spaces/special chars', () => {
      const result = stableLineItemId('GSV-TOOL', 'Herramientas   &   Utilidades!!!');
      assert.strictEqual(result, 'gsv-tool-herramientas-utilidades');
    });

    it('should remove leading and trailing hyphens', () => {
      const result = stableLineItemId('  -MOD-SDM-  ', '  -Role-  ');
      assert.strictEqual(result, 'mod-sdm-role');
    });
  });

  describe('edge cases', () => {
    it('should filter out null values', () => {
      const result = stableLineItemId('MOD-SDM', null, 'MOD');
      assert.strictEqual(result, 'mod-sdm-mod');
    });

    it('should filter out undefined values', () => {
      const result = stableLineItemId('MOD-SDM', undefined, undefined);
      assert.strictEqual(result, 'mod-sdm');
    });

    it('should filter out empty strings', () => {
      const result = stableLineItemId('MOD-SDM', '', '   ');
      assert.strictEqual(result, 'mod-sdm');
    });

    it('should throw if no canonical ID provided', () => {
      assert.throws(
        () => stableLineItemId(null),
        /\[stableLineItemId\] At least canonicalRubroId must be provided/
      );
      assert.throws(
        () => stableLineItemId(undefined),
        /\[stableLineItemId\] At least canonicalRubroId must be provided/
      );
      assert.throws(
        () => stableLineItemId(''),
        /\[stableLineItemId\] At least canonicalRubroId must be provided/
      );
    });
  });

  describe('determinism', () => {
    it('should produce same output for same inputs', () => {
      const result1 = stableLineItemId('MOD-SDM', 'Service Delivery Manager', 'MOD');
      const result2 = stableLineItemId('MOD-SDM', 'Service Delivery Manager', 'MOD');
      assert.strictEqual(result1, result2);
    });

    it('should be case-insensitive deterministic', () => {
      const result1 = stableLineItemId('mod-sdm', 'service delivery manager', 'mod');
      const result2 = stableLineItemId('MOD-SDM', 'SERVICE DELIVERY MANAGER', 'MOD');
      assert.strictEqual(result1, result2);
      assert.strictEqual(result1, 'mod-sdm-service-delivery-manager-mod');
    });

    it('should handle whitespace variations deterministically', () => {
      const result1 = stableLineItemId('MOD-SDM', '  Service   Delivery   Manager  ');
      const result2 = stableLineItemId('MOD-SDM', 'Service Delivery Manager');
      assert.strictEqual(result1, result2);
      assert.strictEqual(result1, 'mod-sdm-service-delivery-manager');
    });
  });

  describe('real-world examples', () => {
    it('should handle MOD rubros', () => {
      assert.strictEqual(
        stableLineItemId('MOD-SDM', 'Service Delivery Manager', 'MOD'),
        'mod-sdm-service-delivery-manager-mod'
      );
      assert.strictEqual(
        stableLineItemId('MOD-ING', 'Ingeniero Soporte N1', 'MOD'),
        'mod-ing-ingeniero-soporte-n1-mod'
      );
      assert.strictEqual(
        stableLineItemId('MOD-LEAD', 'Technical Lead', 'MOD'),
        'mod-lead-technical-lead-mod'
      );
    });

    it('should handle GSV rubros', () => {
      assert.strictEqual(
        stableLineItemId('GSV-RPT', 'Informes mensuales', 'GSV'),
        'gsv-rpt-informes-mensuales-gsv'
      );
      assert.strictEqual(
        stableLineItemId('GSV-TOOL', 'Herramientas de gestión', 'GSV'),
        'gsv-tool-herramientas-de-gestion-gsv'
      );
    });

    it('should handle INF rubros', () => {
      assert.strictEqual(
        stableLineItemId('INF-CLOUD', 'Servicios Cloud AWS', 'INF'),
        'inf-cloud-servicios-cloud-aws-inf'
      );
    });
  });

  describe('stableIdFromParts alias', () => {
    it('should work as alias for stableLineItemId', () => {
      const result1 = stableLineItemId('MOD-SDM', 'Manager', 'MOD');
      const result2 = stableIdFromParts('MOD-SDM', 'Manager', 'MOD');
      assert.strictEqual(result1, result2);
    });
  });
});

/**
 * Unit tests for requireCanonicalRubro enforcement helper
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { requireCanonicalRubro } from '../requireCanonical';

describe('requireCanonicalRubro', () => {
  describe('valid canonical IDs', () => {
    it('should return canonical ID for valid canonical input', () => {
      assert.equal(requireCanonicalRubro('MOD-SDM'), 'MOD-SDM');
      assert.equal(requireCanonicalRubro('MOD-LEAD'), 'MOD-LEAD');
      assert.equal(requireCanonicalRubro('MOD-ING'), 'MOD-ING');
      assert.equal(requireCanonicalRubro('TEC-HW-FIELD'), 'TEC-HW-FIELD');
    });

    it('should return canonical ID for lowercase canonical input', () => {
      assert.equal(requireCanonicalRubro('mod-sdm'), 'MOD-SDM');
      assert.equal(requireCanonicalRubro('mod-lead'), 'MOD-LEAD');
    });
  });

  describe('valid aliases', () => {
    it('should return canonical ID for legacy aliases', () => {
      assert.equal(requireCanonicalRubro('mod-lead-ingeniero-delivery'), 'MOD-LEAD');
      assert.equal(requireCanonicalRubro('mod-sdm-service-delivery-manager'), 'MOD-SDM');
      assert.equal(requireCanonicalRubro('service-delivery-manager'), 'MOD-SDM');
    });

    it('should return canonical ID for old RB#### format', () => {
      assert.equal(requireCanonicalRubro('RB0001'), 'MOD-ING');
      assert.equal(requireCanonicalRubro('RB0002'), 'MOD-LEAD');
      assert.equal(requireCanonicalRubro('RB0003'), 'MOD-SDM');
    });

    it('should return canonical ID for human-readable role names', () => {
      assert.equal(requireCanonicalRubro('project-manager'), 'MOD-LEAD');
      assert.equal(requireCanonicalRubro('Ingeniero Delivery'), 'MOD-LEAD');
    });
  });

  describe('invalid inputs', () => {
    it('should throw for unknown rubro ID', () => {
      assert.throws(
        () => requireCanonicalRubro('INVALID-RUBRO'),
        /Unknown or non-canonical rubro id.*INVALID-RUBRO.*operation blocked/
      );
    });

    it('should throw for undefined input', () => {
      assert.throws(
        () => requireCanonicalRubro(undefined),
        /Unknown or non-canonical rubro id.*undefined.*operation blocked/
      );
    });

    it('should throw for empty string', () => {
      assert.throws(
        () => requireCanonicalRubro(''),
        /Unknown or non-canonical rubro id.*operation blocked/
      );
    });

    it('should throw for null input', () => {
      assert.throws(
        () => requireCanonicalRubro(null as any),
        /Unknown or non-canonical rubro id.*null.*operation blocked/
      );
    });
  });

  describe('edge cases', () => {
    it('should handle whitespace in canonical IDs', () => {
      assert.equal(requireCanonicalRubro('  MOD-SDM  '), 'MOD-SDM');
    });

    it('should throw for invalid legacy format', () => {
      assert.throws(
        () => requireCanonicalRubro('RUBRO-999'),
        /Unknown or non-canonical rubro id.*RUBRO-999.*operation blocked/
      );
    });
  });
});

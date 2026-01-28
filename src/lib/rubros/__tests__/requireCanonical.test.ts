/**
 * Unit tests for requireCanonicalRubro enforcement helper
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { requireCanonicalRubro } from '../requireCanonical';

describe('requireCanonicalRubro', () => {
  describe('missing input', () => {
    it('should throw on undefined input', () => {
      assert.throws(
        () => requireCanonicalRubro(undefined),
        /\[rubro\] missing input/
      );
    });

    it('should throw on empty string', () => {
      assert.throws(
        () => requireCanonicalRubro(''),
        /\[rubro\] missing input/
      );
    });

    it('should throw on null input', () => {
      assert.throws(
        () => requireCanonicalRubro(null as any),
        /\[rubro\] missing input/
      );
    });
  });

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
        /Unknown rubro \(no canonical mapping\).*INVALID-RUBRO/
      );
    });

    it('should throw for invalid legacy format', () => {
      assert.throws(
        () => requireCanonicalRubro('RUBRO-999'),
        /Unknown rubro \(no canonical mapping\).*RUBRO-999/
      );
    });
  });

  describe('edge cases', () => {
    it('should handle whitespace in canonical IDs', () => {
      assert.equal(requireCanonicalRubro('  MOD-SDM  '), 'MOD-SDM');
    });
  });

  describe('taxonomy validation', () => {
    it('should validate that taxonomy entry exists', () => {
      // Valid canonical IDs should have taxonomy entries
      const canonical = requireCanonicalRubro('MOD-SDM');
      assert.equal(canonical, 'MOD-SDM');
    });
  });
});

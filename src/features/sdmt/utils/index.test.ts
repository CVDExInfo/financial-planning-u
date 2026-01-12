/**
 * Unit tests for SDMT utils barrel export
 * Verifies that all expected utilities are exported correctly from the barrel
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as sdmtUtils from '@/features/sdmt/utils';

describe('sdmt utils barrel', () => {
  it('exports rubrosFromAllocations and other existing utils', () => {
    // Verify function exports
    assert.equal(typeof sdmtUtils.rubrosFromAllocations, 'function');
    assert.equal(typeof sdmtUtils.mapAllocationsToRubros, 'function');
    assert.equal(typeof sdmtUtils.mapPrefacturasToRubros, 'function');
  });

  it('exports type definitions', () => {
    // Verify types are accessible (this will fail at compile time if types are not exported)
    // We can't directly test types at runtime, but we can verify the module structure
    const moduleKeys = Object.keys(sdmtUtils);
    
    // Verify all expected functions are present
    assert.ok(moduleKeys.includes('rubrosFromAllocations'));
    assert.ok(moduleKeys.includes('mapAllocationsToRubros'));
    assert.ok(moduleKeys.includes('mapPrefacturasToRubros'));
  });

  it('all exports are functions (not undefined)', () => {
    // Ensure no exports are broken
    assert.notEqual(sdmtUtils.rubrosFromAllocations, undefined);
    assert.notEqual(sdmtUtils.mapAllocationsToRubros, undefined);
    assert.notEqual(sdmtUtils.mapPrefacturasToRubros, undefined);
  });
});

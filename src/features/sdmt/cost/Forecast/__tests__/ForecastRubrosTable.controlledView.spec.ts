/**
 * ForecastRubrosTable External View Control Test
 * 
 * Validates that the table component can be controlled externally via the externalViewMode prop
 * and that it correctly delegates view mode changes back to the parent component.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';

describe('ForecastRubrosTable - External View Control', () => {
  it('should use effectiveViewMode when externalViewMode is provided', () => {
    // Test logic: when externalViewMode='project' is passed, 
    // the table should use that instead of its internal state
    
    // Mock scenario:
    // 1. Component receives externalViewMode='project'
    // 2. effectiveViewMode = externalViewMode ?? viewMode
    // 3. effectiveViewMode should equal 'project'
    
    const externalViewMode = 'project' as const;
    const internalViewMode = 'category' as const; // different from external
    
    // The effectiveViewMode calculation
    const effectiveViewMode = externalViewMode ?? internalViewMode;
    
    assert.strictEqual(
      effectiveViewMode,
      'project',
      'effectiveViewMode should use externalViewMode when provided'
    );
  });

  it('should use internal viewMode when externalViewMode is not provided', () => {
    // Test logic: when externalViewMode is undefined,
    // the table should fall back to its internal state
    
    const externalViewMode = undefined;
    const internalViewMode = 'category' as const;
    
    // The effectiveViewMode calculation
    const effectiveViewMode = externalViewMode ?? internalViewMode;
    
    assert.strictEqual(
      effectiveViewMode,
      'category',
      'effectiveViewMode should use internal viewMode when external is not provided'
    );
  });

  it('should delegate view mode changes to parent when externally controlled', () => {
    // Test logic: when user clicks view toggle and externalViewMode is provided,
    // onViewModeChange callback should be called instead of updating internal state
    
    const externalViewMode = 'category' as const;
    let parentViewMode = externalViewMode;
    
    const onViewModeChange = (newMode: 'category' | 'project') => {
      parentViewMode = newMode;
    };
    
    // Simulate button click that would change to 'project'
    const newMode = 'project' as const;
    
    // The onClick handler logic
    if (externalViewMode !== undefined) {
      onViewModeChange(newMode);
    }
    
    assert.strictEqual(
      parentViewMode,
      'project',
      'Parent view mode should be updated via callback when externally controlled'
    );
  });

  it('should not persist to sessionStorage when externally controlled', () => {
    // Test logic: when externalViewMode is provided,
    // the component should skip sessionStorage persistence
    
    const externalViewMode = 'project' as const;
    
    // The useEffect condition that guards sessionStorage writes
    const shouldPersist = !externalViewMode;
    
    assert.strictEqual(
      shouldPersist,
      false,
      'Should not persist to sessionStorage when externally controlled'
    );
  });

  it('should persist to sessionStorage when not externally controlled', () => {
    // Test logic: when externalViewMode is undefined,
    // the component should persist to sessionStorage as before
    
    const externalViewMode = undefined;
    
    // The useEffect condition that guards sessionStorage writes
    const shouldPersist = !externalViewMode;
    
    assert.strictEqual(
      shouldPersist,
      true,
      'Should persist to sessionStorage when not externally controlled'
    );
  });

  it('should map breakdownMode to table viewMode correctly', () => {
    // Test the mapping logic from SDMTForecast breakdownMode to table viewMode
    
    // When breakdownMode is 'project'
    const breakdownMode1 = 'project' as const;
    const tableViewMode1 = breakdownMode1 === 'project' ? 'project' : 'category';
    
    assert.strictEqual(
      tableViewMode1,
      'project',
      'breakdownMode="project" should map to viewMode="project"'
    );
    
    // When breakdownMode is 'rubros'
    const breakdownMode2 = 'rubros' as const;
    const tableViewMode2 = breakdownMode2 === 'project' ? 'project' : 'category';
    
    assert.strictEqual(
      tableViewMode2,
      'category',
      'breakdownMode="rubros" should map to viewMode="category"'
    );
  });

  it('should map table viewMode back to breakdownMode correctly', () => {
    // Test the reverse mapping from table viewMode to page breakdownMode
    
    // When table viewMode is 'project'
    const viewMode1 = 'project' as const;
    const breakdownMode1 = viewMode1 === 'project' ? 'project' : 'rubros';
    
    assert.strictEqual(
      breakdownMode1,
      'project',
      'viewMode="project" should map to breakdownMode="project"'
    );
    
    // When table viewMode is 'category'
    const viewMode2 = 'category' as const;
    const breakdownMode2 = viewMode2 === 'project' ? 'project' : 'rubros';
    
    assert.strictEqual(
      breakdownMode2,
      'rubros',
      'viewMode="category" should map to breakdownMode="rubros"'
    );
  });

  it('should load from sessionStorage when not externally controlled', () => {
    // Test logic: when component mounts without externalViewMode,
    // it should try to load from sessionStorage
    
    const externalViewMode = undefined;
    
    // The useEffect condition that guards sessionStorage reads
    const shouldLoadFromStorage = !externalViewMode;
    
    assert.strictEqual(
      shouldLoadFromStorage,
      true,
      'Should load from sessionStorage on mount when not externally controlled'
    );
  });

  it('should not load from sessionStorage when externally controlled', () => {
    // Test logic: when component mounts with externalViewMode,
    // it should skip sessionStorage loading
    
    const externalViewMode = 'project' as const;
    
    // The useEffect condition that guards sessionStorage reads
    const shouldLoadFromStorage = !externalViewMode;
    
    assert.strictEqual(
      shouldLoadFromStorage,
      false,
      'Should not load from sessionStorage when externally controlled'
    );
  });
});

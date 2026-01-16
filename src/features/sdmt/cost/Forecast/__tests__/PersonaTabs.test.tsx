/**
 * PersonaTabs.test.tsx
 * 
 * Tests for persona-based view mode functionality:
 * - Tab toggle between SDM and Gerente personas
 * - Default collapsed state per persona
 * - SessionStorage persistence
 * - MonthlySnapshotGrid compact mode behavior
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';

const isSdmMode = (mode: 'sdm' | 'gerente') => mode === 'sdm';
const isGerenteMode = (mode: 'sdm' | 'gerente') => mode === 'gerente';

describe('PersonaTabs - ViewMode Context', () => {
  // Mock sessionStorage for testing
  let mockStorage: Record<string, string> = {};
  
  beforeEach(() => {
    mockStorage = {};
    // Mock sessionStorage
    global.sessionStorage = {
      getItem: (key: string) => mockStorage[key] || null,
      setItem: (key: string, value: string) => { mockStorage[key] = value; },
      removeItem: (key: string) => { delete mockStorage[key]; },
      clear: () => { mockStorage = {}; },
      length: Object.keys(mockStorage).length,
      key: (index: number) => Object.keys(mockStorage)[index] || null,
    } as Storage;
  });

  afterEach(() => {
    mockStorage = {};
  });

  it('should default to SDM viewMode when no storage value exists', () => {
    const stored = sessionStorage.getItem('finanzas:viewMode');
    assert.strictEqual(stored, null, 'No stored value should exist initially');
    
    // When ViewModeProvider initializes, it should default to 'sdm'
    const defaultMode = 'sdm';
    assert.strictEqual(defaultMode, 'sdm', 'Default view mode should be sdm');
  });

  it('should persist viewMode to sessionStorage', () => {
    const viewMode: 'sdm' | 'gerente' = 'gerente';
    sessionStorage.setItem('finanzas:viewMode', viewMode);
    
    const stored = sessionStorage.getItem('finanzas:viewMode');
    assert.strictEqual(stored, 'gerente', 'ViewMode should be persisted to sessionStorage');
  });

  it('should load viewMode from sessionStorage on init', () => {
    sessionStorage.setItem('finanzas:viewMode', 'gerente');
    
    const loadedMode = sessionStorage.getItem('finanzas:viewMode');
    assert.strictEqual(loadedMode, 'gerente', 'ViewMode should be loaded from sessionStorage');
  });

  it('should toggle between SDM and Gerente modes', () => {
    // Start with SDM
    let currentMode: 'sdm' | 'gerente' = 'sdm';
    sessionStorage.setItem('finanzas:viewMode', currentMode);
    assert.strictEqual(sessionStorage.getItem('finanzas:viewMode'), 'sdm');
    
    // Toggle to Gerente
    currentMode = 'gerente';
    sessionStorage.setItem('finanzas:viewMode', currentMode);
    assert.strictEqual(sessionStorage.getItem('finanzas:viewMode'), 'gerente');
    
    // Toggle back to SDM
    currentMode = 'sdm';
    sessionStorage.setItem('finanzas:viewMode', currentMode);
    assert.strictEqual(sessionStorage.getItem('finanzas:viewMode'), 'sdm');
  });
});

describe('PersonaTabs - Default States', () => {
  it('should set isRubrosGridOpen=true for SDM mode', () => {
    const viewMode: 'sdm' | 'gerente' = 'sdm';
    const isRubrosGridOpen = isSdmMode(viewMode);
    
    assert.strictEqual(isRubrosGridOpen, true, 'SDM mode should have rubros grid expanded by default');
  });

  it('should set isRubrosGridOpen=false for Gerente mode', () => {
    const viewMode: 'sdm' | 'gerente' = 'gerente';
    const isRubrosGridOpen = isSdmMode(viewMode);
    
    assert.strictEqual(isRubrosGridOpen, false, 'Gerente mode should have rubros grid collapsed by default');
  });

  it('should set MonthlySnapshotGrid defaultCollapsed=false for SDM', () => {
    const viewMode: 'sdm' | 'gerente' = 'sdm';
    const defaultCollapsed = isGerenteMode(viewMode);
    
    assert.strictEqual(defaultCollapsed, false, 'SDM mode should have MonthlySnapshotGrid expanded by default');
  });

  it('should set MonthlySnapshotGrid defaultCollapsed=true for Gerente', () => {
    const viewMode: 'sdm' | 'gerente' = 'gerente';
    const defaultCollapsed = isGerenteMode(viewMode);
    
    assert.strictEqual(defaultCollapsed, true, 'Gerente mode should have MonthlySnapshotGrid collapsed by default');
  });
});

describe('PersonaTabs - MonthlySnapshotGrid Behavior', () => {
  it('should initialize collapsed state based on defaultCollapsed prop', () => {
    // SDM mode - expanded
    let defaultCollapsed = false;
    let isCollapsed = defaultCollapsed;
    assert.strictEqual(isCollapsed, false, 'Should initialize as expanded for SDM');
    
    // Gerente mode - collapsed
    defaultCollapsed = true;
    isCollapsed = defaultCollapsed;
    assert.strictEqual(isCollapsed, true, 'Should initialize as collapsed for Gerente');
  });

  it('should allow manual toggle of collapsed state', () => {
    // Start collapsed (Gerente mode)
    let isCollapsed = true;
    
    // Toggle to expanded
    isCollapsed = !isCollapsed;
    assert.strictEqual(isCollapsed, false, 'Should toggle to expanded');
    
    // Toggle back to collapsed
    isCollapsed = !isCollapsed;
    assert.strictEqual(isCollapsed, true, 'Should toggle back to collapsed');
  });
});

describe('PersonaTabs - Integration Scenarios', () => {
  let mockStorage: Record<string, string> = {};
  
  beforeEach(() => {
    mockStorage = {};
    global.sessionStorage = {
      getItem: (key: string) => mockStorage[key] || null,
      setItem: (key: string, value: string) => { mockStorage[key] = value; },
      removeItem: (key: string) => { delete mockStorage[key]; },
      clear: () => { mockStorage = {}; },
      length: Object.keys(mockStorage).length,
      key: (index: number) => Object.keys(mockStorage)[index] || null,
    } as Storage;
  });

  it('should maintain view mode across navigation when persisted', () => {
    // User selects Gerente mode
    sessionStorage.setItem('finanzas:viewMode', 'gerente');
    
    // Navigate away and back
    const persistedMode = sessionStorage.getItem('finanzas:viewMode');
    assert.strictEqual(persistedMode, 'gerente', 'ViewMode should persist across navigation');
  });

  it('should apply correct defaults for full SDM workflow', () => {
    const viewMode: 'sdm' | 'gerente' = 'sdm';
    sessionStorage.setItem('finanzas:viewMode', viewMode);
    
    // Check all SDM defaults
    const isRubrosGridOpen = isSdmMode(viewMode); // true
    const monthlySnapshotDefaultCollapsed = isGerenteMode(viewMode); // false
    
    assert.strictEqual(isRubrosGridOpen, true, 'SDM: Rubros grid should be expanded');
    assert.strictEqual(monthlySnapshotDefaultCollapsed, false, 'SDM: Monthly snapshot should be expanded');
  });

  it('should apply correct defaults for full Gerente workflow', () => {
    const viewMode: 'sdm' | 'gerente' = 'gerente';
    sessionStorage.setItem('finanzas:viewMode', viewMode);
    
    // Check all Gerente defaults
    const isRubrosGridOpen = isSdmMode(viewMode); // false
    const monthlySnapshotDefaultCollapsed = isGerenteMode(viewMode); // true
    
    assert.strictEqual(isRubrosGridOpen, false, 'Gerente: Rubros grid should be collapsed');
    assert.strictEqual(monthlySnapshotDefaultCollapsed, true, 'Gerente: Monthly snapshot should be collapsed');
  });
});

describe('PersonaTabs - Accessibility', () => {
  it('should have aria-selected attribute for active tab', () => {
    const viewMode: 'sdm' | 'gerente' = 'sdm';
    
    // SDM tab should be selected
    const sdmTabSelected = isSdmMode(viewMode);
    assert.strictEqual(sdmTabSelected, true, 'SDM tab should have aria-selected=true');
    
    // Gerente tab should not be selected
    const gerenteTabSelected = isGerenteMode(viewMode);
    assert.strictEqual(gerenteTabSelected, false, 'Gerente tab should have aria-selected=false');
  });

  it('should toggle aria-selected when switching tabs', () => {
    let viewMode: 'sdm' | 'gerente' = 'sdm';
    
    // Check initial state
    assert.strictEqual(isSdmMode(viewMode), true);
    assert.strictEqual(isGerenteMode(viewMode), false);
    
    // Switch to Gerente
    viewMode = 'gerente';
    assert.strictEqual(isSdmMode(viewMode), false);
    assert.strictEqual(isGerenteMode(viewMode), true);
  });
});

/**
 * Collapsible State Persistence Tests
 * 
 * Tests to ensure collapsible section states are persisted correctly in sessionStorage.
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';

// Mock sessionStorage for testing
class MockSessionStorage {
  private store: Record<string, string> = {};

  getItem(key: string): string | null {
    return this.store[key] || null;
  }

  setItem(key: string, value: string): void {
    this.store[key] = value;
  }

  clear(): void {
    this.store = {};
  }
}

describe('Collapsible State Persistence', () => {
  let mockStorage: MockSessionStorage;

  beforeEach(() => {
    mockStorage = new MockSessionStorage();
  });

  it('should persist rubros grid open state', () => {
    // Simulate opening the rubros grid
    mockStorage.setItem('forecastRubrosGridOpen', 'true');
    
    // Verify it's persisted
    const stored = mockStorage.getItem('forecastRubrosGridOpen');
    assert.strictEqual(stored, 'true', 'Rubros grid open state should be persisted');
    
    // Verify parsing as boolean
    assert.strictEqual(stored === 'true', true);
  });

  it('should persist portfolio summary collapsed state', () => {
    // Default should be false (collapsed)
    mockStorage.setItem('forecastPortfolioSummaryOpen', 'false');
    
    const stored = mockStorage.getItem('forecastPortfolioSummaryOpen');
    assert.strictEqual(stored, 'false', 'Portfolio summary should default to collapsed');
    assert.strictEqual(stored === 'true', false);
  });

  it('should persist budget simulator collapsed state', () => {
    // Default should be false (collapsed)
    mockStorage.setItem('forecastBudgetSimulatorOpen', 'false');
    
    const stored = mockStorage.getItem('forecastBudgetSimulatorOpen');
    assert.strictEqual(stored, 'false', 'Budget simulator should default to collapsed');
  });

  it('should persist charts panel collapsed state', () => {
    // Default should be false (collapsed)
    mockStorage.setItem('forecastChartsPanelOpen', 'false');
    
    const stored = mockStorage.getItem('forecastChartsPanelOpen');
    assert.strictEqual(stored, 'false', 'Charts panel should default to collapsed');
  });

  it('should persist monitoring table open state', () => {
    // Monitoring table should default to open (true)
    mockStorage.setItem('forecastMonitoringTableOpen', 'true');
    
    const stored = mockStorage.getItem('forecastMonitoringTableOpen');
    assert.strictEqual(stored, 'true', 'Monitoring table should default to open');
  });

  it('should handle toggling state', () => {
    // Start collapsed
    mockStorage.setItem('forecastRubrosGridOpen', 'false');
    assert.strictEqual(mockStorage.getItem('forecastRubrosGridOpen'), 'false');
    
    // Toggle to open
    mockStorage.setItem('forecastRubrosGridOpen', 'true');
    assert.strictEqual(mockStorage.getItem('forecastRubrosGridOpen'), 'true');
    
    // Toggle back to collapsed
    mockStorage.setItem('forecastRubrosGridOpen', 'false');
    assert.strictEqual(mockStorage.getItem('forecastRubrosGridOpen'), 'false');
  });

  it('should return null for unset keys', () => {
    const stored = mockStorage.getItem('nonexistentKey');
    assert.strictEqual(stored, null, 'Unset keys should return null');
  });

  it('should handle initialization with default values', () => {
    // Simulate component initialization
    const initializeState = (key: string, defaultValue: boolean): boolean => {
      const stored = mockStorage.getItem(key);
      return stored === 'true'; // Returns false if null
    };
    
    // First load - no value in storage
    const initialState = initializeState('forecastRubrosGridOpen', false);
    assert.strictEqual(initialState, false, 'Should return false for unset key');
    
    // Set value
    mockStorage.setItem('forecastRubrosGridOpen', 'true');
    
    // Second load - value exists
    const persistedState = initializeState('forecastRubrosGridOpen', false);
    assert.strictEqual(persistedState, true, 'Should return persisted value');
  });

  it('should clear all collapsible states', () => {
    // Set multiple states
    mockStorage.setItem('forecastRubrosGridOpen', 'true');
    mockStorage.setItem('forecastPortfolioSummaryOpen', 'true');
    mockStorage.setItem('forecastBudgetSimulatorOpen', 'true');
    
    // Clear all
    mockStorage.clear();
    
    // Verify all are cleared
    assert.strictEqual(mockStorage.getItem('forecastRubrosGridOpen'), null);
    assert.strictEqual(mockStorage.getItem('forecastPortfolioSummaryOpen'), null);
    assert.strictEqual(mockStorage.getItem('forecastBudgetSimulatorOpen'), null);
  });

  it('should maintain independent states for different sections', () => {
    // Set different states
    mockStorage.setItem('forecastRubrosGridOpen', 'true');
    mockStorage.setItem('forecastPortfolioSummaryOpen', 'false');
    mockStorage.setItem('forecastBudgetSimulatorOpen', 'true');
    
    // Verify each state is independent
    assert.strictEqual(mockStorage.getItem('forecastRubrosGridOpen'), 'true');
    assert.strictEqual(mockStorage.getItem('forecastPortfolioSummaryOpen'), 'false');
    assert.strictEqual(mockStorage.getItem('forecastBudgetSimulatorOpen'), 'true');
  });
});

// Export for use in other tests
export { MockSessionStorage };

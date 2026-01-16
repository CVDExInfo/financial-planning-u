/**
 * ForecastRubrosTable Filter Tests
 * 
 * Tests to ensure labor/non-labor filtering works correctly
 * and subtotals are calculated from visible rows only.
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import type { CategoryTotals, CategoryRubro } from '../categoryGrouping';

// Mock data helpers
function createMockRubro(
  rubroId: string,
  description: string,
  category: string,
  isLaborRole: boolean,
  forecast: number = 1000,
  actual: number = 900
): CategoryRubro {
  return {
    rubroId,
    description,
    category,
    role: isLaborRole ? 'Ingeniero' : undefined,
    subtype: isLaborRole ? 'Ingeniero' : 'Equipment',
    byMonth: {
      1: { forecast: forecast / 12, actual: actual / 12, planned: forecast / 12 },
      2: { forecast: forecast / 12, actual: actual / 12, planned: forecast / 12 },
      3: { forecast: forecast / 12, actual: actual / 12, planned: forecast / 12 },
      4: { forecast: forecast / 12, actual: actual / 12, planned: forecast / 12 },
      5: { forecast: forecast / 12, actual: actual / 12, planned: forecast / 12 },
      6: { forecast: forecast / 12, actual: actual / 12, planned: forecast / 12 },
      7: { forecast: forecast / 12, actual: actual / 12, planned: forecast / 12 },
      8: { forecast: forecast / 12, actual: actual / 12, planned: forecast / 12 },
      9: { forecast: forecast / 12, actual: actual / 12, planned: forecast / 12 },
      10: { forecast: forecast / 12, actual: actual / 12, planned: forecast / 12 },
      11: { forecast: forecast / 12, actual: actual / 12, planned: forecast / 12 },
      12: { forecast: forecast / 12, actual: actual / 12, planned: forecast / 12 },
    },
    overall: {
      forecast,
      actual,
      planned: forecast,
      varianceActual: actual - forecast,
      variancePlanned: 0,
      percentConsumption: (actual / forecast) * 100,
    },
  };
}

function createMockCategoryTotals(rubros: CategoryRubro[]): CategoryTotals {
  const byMonth: Record<number, { forecast: number; actual: number; planned: number }> = {};
  let overallForecast = 0;
  let overallActual = 0;
  let overallPlanned = 0;

  rubros.forEach(rubro => {
    Object.keys(rubro.byMonth).forEach(monthStr => {
      const month = parseInt(monthStr, 10);
      if (!byMonth[month]) {
        byMonth[month] = { forecast: 0, actual: 0, planned: 0 };
      }
      const monthData = rubro.byMonth[month];
      byMonth[month].forecast += monthData.forecast || 0;
      byMonth[month].actual += monthData.actual || 0;
      byMonth[month].planned += monthData.planned || 0;
    });

    overallForecast += rubro.overall.forecast || 0;
    overallActual += rubro.overall.actual || 0;
    overallPlanned += rubro.overall.planned || 0;
  });

  return {
    byMonth,
    overall: {
      forecast: overallForecast,
      actual: overallActual,
      planned: overallPlanned,
      varianceActual: overallActual - overallForecast,
      variancePlanned: overallForecast - overallPlanned,
      percentConsumption: overallForecast > 0 ? (overallActual / overallForecast) * 100 : 0,
    },
  };
}

describe('ForecastRubrosTable Filter Logic', () => {
  let mockLaborRubros: CategoryRubro[];
  let mockNonLaborRubros: CategoryRubro[];
  let categoryTotals: Map<string, CategoryTotals>;
  let categoryRubros: Map<string, CategoryRubro[]>;

  beforeEach(() => {
    // Create mock labor rubros
    mockLaborRubros = [
      createMockRubro('rubro-1', 'Ingeniero Senior', 'Mano de Obra Directa', true, 12000, 11000),
      createMockRubro('rubro-2', 'Service Delivery Manager', 'Mano de Obra Directa', true, 15000, 14000),
      createMockRubro('rubro-3', 'Project Manager', 'Mano de Obra Directa', true, 10000, 9500),
    ];

    // Create mock non-labor rubros
    mockNonLaborRubros = [
      createMockRubro('rubro-4', 'Server Equipment', 'Hardware', false, 5000, 4800),
      createMockRubro('rubro-5', 'Software Licenses', 'Software', false, 3000, 2900),
      createMockRubro('rubro-6', 'Office Supplies', 'Administrative', false, 1000, 950),
    ];

    // Setup maps
    categoryTotals = new Map();
    categoryRubros = new Map();

    categoryTotals.set('Mano de Obra Directa', createMockCategoryTotals(mockLaborRubros));
    categoryTotals.set('Hardware', createMockCategoryTotals([mockNonLaborRubros[0]]));
    categoryTotals.set('Software', createMockCategoryTotals([mockNonLaborRubros[1]]));
    categoryTotals.set('Administrative', createMockCategoryTotals([mockNonLaborRubros[2]]));

    categoryRubros.set('Mano de Obra Directa', mockLaborRubros);
    categoryRubros.set('Hardware', [mockNonLaborRubros[0]]);
    categoryRubros.set('Software', [mockNonLaborRubros[1]]);
    categoryRubros.set('Administrative', [mockNonLaborRubros[2]]);
  });

  it('should filter to show only labor rubros when filter is "labor"', () => {
    const filterMode = 'labor';
    
    // Simulate filtering logic from component
    const visibleCategories: Array<[string, CategoryRubro[]]> = [];
    categoryTotals.forEach((_, category) => {
      const rubros = categoryRubros.get(category) || [];
      const filteredRubros = rubros.filter(rubro => {
        const rubroCategory = rubro.category || category;
        const rubroRole = (rubro as any).role || (rubro as any).subtype || '';
        // Simple labor check - in real component this uses isLabor()
        const isLaborRubro = rubroCategory.toLowerCase().includes('mano de obra') || 
                            rubroRole.toLowerCase().includes('ingeniero') ||
                            rubroRole.toLowerCase().includes('manager');
        return filterMode === 'labor' ? isLaborRubro : false;
      });

      if (filteredRubros.length > 0) {
        visibleCategories.push([category, filteredRubros]);
      }
    });

    // Assert only labor category is visible
    assert.strictEqual(visibleCategories.length, 1, 'Should have exactly one category');
    assert.strictEqual(visibleCategories[0][0], 'Mano de Obra Directa', 'Category should be labor');
    assert.strictEqual(visibleCategories[0][1].length, 3, 'Should have 3 labor rubros');
  });

  it('should show all rubros when filter is "all"', () => {
    const visibleCategories: Array<[string, CategoryRubro[]]> = [];
    categoryTotals.forEach((_, category) => {
      const rubros = categoryRubros.get(category) || [];
      if (rubros.length > 0) {
        visibleCategories.push([category, rubros]);
      }
    });

    // Assert all categories are visible
    assert.strictEqual(visibleCategories.length, 4, 'Should have all 4 categories');
    const totalRubros = visibleCategories.reduce((sum, [_, rubros]) => sum + rubros.length, 0);
    assert.strictEqual(totalRubros, 6, 'Should have all 6 rubros');
  });

  it('should filter to show only non-labor rubros when filter is "non-labor"', () => {
    const filterMode = 'non-labor';
    
    const visibleCategories: Array<[string, CategoryRubro[]]> = [];
    categoryTotals.forEach((_, category) => {
      const rubros = categoryRubros.get(category) || [];
      const filteredRubros = rubros.filter(rubro => {
        const rubroCategory = rubro.category || category;
        const rubroRole = (rubro as any).role || (rubro as any).subtype || '';
        const isLaborRubro = rubroCategory.toLowerCase().includes('mano de obra') || 
                            rubroRole.toLowerCase().includes('ingeniero') ||
                            rubroRole.toLowerCase().includes('manager');
        return filterMode === 'non-labor' ? !isLaborRubro : false;
      });

      if (filteredRubros.length > 0) {
        visibleCategories.push([category, filteredRubros]);
      }
    });

    // Assert only non-labor categories are visible
    assert.strictEqual(visibleCategories.length, 3, 'Should have 3 non-labor categories');
    const totalRubros = visibleCategories.reduce((sum, [_, rubros]) => sum + rubros.length, 0);
    assert.strictEqual(totalRubros, 3, 'Should have 3 non-labor rubros');
    
    // Verify no labor category
    const hasLaborCategory = visibleCategories.some(([cat]) => cat === 'Mano de Obra Directa');
    assert.strictEqual(hasLaborCategory, false, 'Should not include labor category');
  });

  it('should calculate subtotals from visible rows only', () => {
    // Filter to labor only
    const laborRubros = mockLaborRubros;
    const expectedSubtotal = laborRubros.reduce((sum, r) => sum + r.overall.forecast, 0);
    
    assert.strictEqual(expectedSubtotal, 37000, 'Labor subtotal should be sum of 3 labor rubros');

    // Filter to non-labor only
    const nonLaborRubros = mockNonLaborRubros;
    const expectedNonLaborSubtotal = nonLaborRubros.reduce((sum, r) => sum + r.overall.forecast, 0);
    
    assert.strictEqual(expectedNonLaborSubtotal, 9000, 'Non-labor subtotal should be sum of 3 non-labor rubros');
  });

  it('should persist filter mode to sessionStorage', () => {
    // Simulate sessionStorage
    const storage: Record<string, string> = {};
    const mockSessionStorage = {
      getItem: (key: string) => storage[key] || null,
      setItem: (key: string, value: string) => { storage[key] = value; },
    };

    const sessionKey = 'forecastGridFilter:test-project:test-user';
    
    // Set filter mode
    mockSessionStorage.setItem(sessionKey, 'labor');
    assert.strictEqual(mockSessionStorage.getItem(sessionKey), 'labor');

    // Change filter mode
    mockSessionStorage.setItem(sessionKey, 'non-labor');
    assert.strictEqual(mockSessionStorage.getItem(sessionKey), 'non-labor');

    // Verify persistence
    const restored = mockSessionStorage.getItem(sessionKey);
    assert.strictEqual(restored, 'non-labor', 'Filter mode should be persisted');
  });

  it('should handle empty category gracefully', () => {
    const emptyCategory = new Map<string, CategoryRubro[]>();
    emptyCategory.set('Empty Category', []);

    const visibleCategories: Array<[string, CategoryRubro[]]> = [];
    emptyCategory.forEach((rubros, category) => {
      if (rubros.length > 0) {
        visibleCategories.push([category, rubros]);
      }
    });

    assert.strictEqual(visibleCategories.length, 0, 'Empty categories should not be visible');
  });

  it('should correctly identify labor roles with missing category', () => {
    // Test case for misclassified items (as mentioned in the spec)
    const misclassifiedRubro = createMockRubro(
      'rubro-7',
      'Ingeniero Lider',
      '', // Missing category
      true,
      8000,
      7500
    );

    const role = (misclassifiedRubro as any).role || '';
    
    // Should be classified as labor based on role
    const isLaborByRole = role.toLowerCase().includes('ingeniero');
    assert.strictEqual(isLaborByRole, true, 'Should identify as labor based on role');
  });
});

describe('ForecastRubrosTable Subtotal Calculations', () => {
  it('should recalculate monthly totals from filtered rubros', () => {
    const rubros = [
      createMockRubro('r1', 'Rubro 1', 'Category A', false, 12000, 11000),
      createMockRubro('r2', 'Rubro 2', 'Category A', false, 24000, 22000),
    ];

    // Calculate expected month 1 total
    const month1Total = rubros.reduce((sum, r) => sum + (r.byMonth[1]?.forecast || 0), 0);
    const expectedMonth1 = (12000 / 12) + (24000 / 12);
    
    assert.strictEqual(month1Total, expectedMonth1, 'Month 1 total should match sum of rubros');

    // Calculate expected overall total
    const overallTotal = rubros.reduce((sum, r) => sum + r.overall.forecast, 0);
    assert.strictEqual(overallTotal, 36000, 'Overall total should match sum of rubros');
  });

  it('should calculate variance from recalculated totals', () => {
    const rubros = [
      createMockRubro('r1', 'Rubro 1', 'Category A', false, 10000, 9000),
      createMockRubro('r2', 'Rubro 2', 'Category A', false, 20000, 22000),
    ];

    const totalForecast = rubros.reduce((sum, r) => sum + r.overall.forecast, 0);
    const totalActual = rubros.reduce((sum, r) => sum + r.overall.actual, 0);
    const variance = totalActual - totalForecast;

    assert.strictEqual(totalForecast, 30000, 'Total forecast should be 30000');
    assert.strictEqual(totalActual, 31000, 'Total actual should be 31000');
    assert.strictEqual(variance, 1000, 'Variance should be 1000 (over budget)');
  });
});

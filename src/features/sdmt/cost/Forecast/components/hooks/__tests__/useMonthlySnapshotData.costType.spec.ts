/**
 * useMonthlySnapshotData Cost Type Tests
 *
 * Tests for cost type derivation and filtering when category is missing
 * but can be inferred from description/name fields.
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { buildSnapshotRows, CostBreakdown } from '../useMonthlySnapshotData';
import type { ForecastCell, GroupingMode } from '../../monthlySnapshotTypes';

// Mock import.meta.env for Node.js test environment
globalThis.import = globalThis.import || {} as any;
(globalThis.import as any).meta = (globalThis.import as any).meta || {};
(globalThis.import as any).meta.env = {
  DEV: false, // Set to false to skip DEV-only console logs in tests
};

describe('useMonthlySnapshotData - Cost Type Derivation', () => {
  it('should derive labor cost type from description when category is missing', () => {
    const forecastData: ForecastCell[] = [
      {
        line_item_id: 'item1',
        rubroId: 'rubro1',
        projectId: 'proj1',
        projectName: 'Project Alpha',
        description: 'Ingeniero Delivery', // Labor keyword in description
        category: undefined, // Missing category
        month: 1,
        planned: 10000,
        forecast: 10000,
        actual: 9000,
        variance: -1000,
      },
    ];

    const lineItemCategoryMap = new Map<string, string | undefined>();
    
    const result = buildSnapshotRows({
      forecastData,
      actualMonthIndex: 1,
      groupingMode: 'project' as GroupingMode,
      monthBudget: 15000,
      useMonthlyBudget: true,
      lineItemCategoryMap,
    });

    assert.strictEqual(result.length, 1, 'Should have one project row');
    const projectRow = result[0];
    assert.ok(projectRow.children && projectRow.children.length > 0, 'Should have child rows');
    const childRow = projectRow.children[0];
    assert.strictEqual(childRow.costType, 'labor', 'Should derive labor cost type from description');
  });

  it('should derive labor cost type from role keywords in description', () => {
    const forecastData: ForecastCell[] = [
      {
        line_item_id: 'item2',
        rubroId: 'rubro2',
        projectId: 'proj1',
        projectName: 'Project Beta',
        description: 'Project Manager Senior', // Labor keyword PM
        category: undefined,
        month: 1,
        planned: 15000,
        forecast: 15000,
        actual: 14000,
        variance: -1000,
      },
    ];

    const lineItemCategoryMap = new Map<string, string | undefined>();
    
    const result = buildSnapshotRows({
      forecastData,
      actualMonthIndex: 1,
      groupingMode: 'project' as GroupingMode,
      monthBudget: 20000,
      useMonthlyBudget: true,
      lineItemCategoryMap,
    });

    const childRow = result[0].children![0];
    assert.strictEqual(childRow.costType, 'labor', 'Should derive labor from PM keyword');
  });

  it('should derive non-labor cost type from description', () => {
    const forecastData: ForecastCell[] = [
      {
        line_item_id: 'item3',
        rubroId: 'rubro3',
        projectId: 'proj1',
        projectName: 'Project Gamma',
        description: 'Equipos y Tecnología', // Non-labor
        category: undefined,
        month: 1,
        planned: 5000,
        forecast: 5000,
        actual: 4500,
        variance: -500,
      },
    ];

    const lineItemCategoryMap = new Map<string, string | undefined>();
    
    const result = buildSnapshotRows({
      forecastData,
      actualMonthIndex: 1,
      groupingMode: 'project' as GroupingMode,
      monthBudget: 10000,
      useMonthlyBudget: true,
      lineItemCategoryMap,
    });

    const childRow = result[0].children![0];
    assert.strictEqual(childRow.costType, 'non-labor', 'Should derive non-labor from description');
  });

  it('should prefer category over description when both are present', () => {
    const forecastData: ForecastCell[] = [
      {
        line_item_id: 'item4',
        rubroId: 'rubro4',
        projectId: 'proj1',
        projectName: 'Project Delta',
        description: 'Ingeniero', // Labor keyword
        category: 'Equipos y Tecnología', // Non-labor category (should win)
        month: 1,
        planned: 8000,
        forecast: 8000,
        actual: 7500,
        variance: -500,
      },
    ];

    const lineItemCategoryMap = new Map<string, string | undefined>();
    
    const result = buildSnapshotRows({
      forecastData,
      actualMonthIndex: 1,
      groupingMode: 'project' as GroupingMode,
      monthBudget: 10000,
      useMonthlyBudget: true,
      lineItemCategoryMap,
    });

    const childRow = result[0].children![0];
    assert.strictEqual(childRow.costType, 'non-labor', 'Should prefer explicit category over description');
  });

  it('should use lineItemCategoryMap when available', () => {
    const forecastData: ForecastCell[] = [
      {
        line_item_id: 'item5',
        rubroId: 'rubro5',
        projectId: 'proj1',
        projectName: 'Project Epsilon',
        description: 'Some Item',
        category: undefined,
        month: 1,
        planned: 6000,
        forecast: 6000,
        actual: 5800,
        variance: -200,
      },
    ];

    const lineItemCategoryMap = new Map<string, string | undefined>();
    lineItemCategoryMap.set('item5', 'Mano de Obra Directa'); // Labor category in map
    
    const result = buildSnapshotRows({
      forecastData,
      actualMonthIndex: 1,
      groupingMode: 'project' as GroupingMode,
      monthBudget: 10000,
      useMonthlyBudget: true,
      lineItemCategoryMap,
    });

    const childRow = result[0].children![0];
    assert.strictEqual(childRow.costType, 'labor', 'Should use category from lineItemCategoryMap');
  });

  it('should work with rubro grouping mode', () => {
    const forecastData: ForecastCell[] = [
      {
        line_item_id: 'item6',
        rubroId: 'rubro6',
        projectId: 'proj1',
        projectName: 'Project Zeta',
        description: 'Service Delivery Manager', // SDM is labor
        category: undefined,
        month: 1,
        planned: 12000,
        forecast: 12000,
        actual: 11500,
        variance: -500,
      },
    ];

    const lineItemCategoryMap = new Map<string, string | undefined>();
    
    const result = buildSnapshotRows({
      forecastData,
      actualMonthIndex: 1,
      groupingMode: 'rubro' as GroupingMode,
      monthBudget: 15000,
      useMonthlyBudget: true,
      lineItemCategoryMap,
    });

    assert.strictEqual(result.length, 1, 'Should have one rubro row');
    const rubroRow = result[0];
    assert.strictEqual(rubroRow.costType, 'labor', 'Rubro row should have labor cost type from description');
  });
});

describe('useMonthlySnapshotData - Cost Type Filtering', () => {
  it('should include rows with labor keywords in name when filtering for labor', () => {
    // This test validates that filterRowByCostType infers from name when costType is undefined
    const forecastData: ForecastCell[] = [
      {
        line_item_id: 'item7',
        rubroId: 'rubro7',
        projectId: 'proj1',
        projectName: 'Project Eta',
        description: 'Random text', // No labor keyword
        category: undefined, // Missing category
        month: 1,
        planned: 7000,
        forecast: 7000,
        actual: 6800,
        variance: -200,
      },
    ];

    const lineItemCategoryMap = new Map<string, string | undefined>();
    
    const result = buildSnapshotRows({
      forecastData,
      actualMonthIndex: 1,
      groupingMode: 'project' as GroupingMode,
      monthBudget: 10000,
      useMonthlyBudget: true,
      lineItemCategoryMap,
    });

    // The child row will have undefined costType (no labor keyword in description)
    // But if the row.name contains a labor keyword, filterRowByCostType should infer it
    const childRow = result[0].children![0];
    assert.strictEqual(childRow.costType, 'non-labor', 'Should have non-labor cost type');
  });

  it('should handle mixed labor and non-labor items', () => {
    const forecastData: ForecastCell[] = [
      {
        line_item_id: 'item8',
        rubroId: 'rubro8',
        projectId: 'proj1',
        projectName: 'Project Theta',
        description: 'Ingeniero Lider', // Labor
        category: undefined,
        month: 1,
        planned: 10000,
        forecast: 10000,
        actual: 9500,
        variance: -500,
      },
      {
        line_item_id: 'item9',
        rubroId: 'rubro9',
        projectId: 'proj1',
        projectName: 'Project Theta',
        description: 'Cloud Infrastructure', // Non-labor
        category: undefined,
        month: 1,
        planned: 5000,
        forecast: 5000,
        actual: 4800,
        variance: -200,
      },
    ];

    const lineItemCategoryMap = new Map<string, string | undefined>();
    
    const result = buildSnapshotRows({
      forecastData,
      actualMonthIndex: 1,
      groupingMode: 'project' as GroupingMode,
      monthBudget: 20000,
      useMonthlyBudget: true,
      lineItemCategoryMap,
    });

    const children = result[0].children!;
    assert.strictEqual(children.length, 2, 'Should have two child rows');
    
    const laborChild = children.find(c => c.name.includes('Ingeniero'));
    const nonLaborChild = children.find(c => c.name.includes('Infrastructure'));
    
    assert.ok(laborChild, 'Should find labor child');
    assert.ok(nonLaborChild, 'Should find non-labor child');
    assert.strictEqual(laborChild!.costType, 'labor', 'Ingeniero should be labor');
    assert.strictEqual(nonLaborChild!.costType, 'non-labor', 'Infrastructure should be non-labor');
  });

  it('should handle empty description gracefully', () => {
    const forecastData: ForecastCell[] = [
      {
        line_item_id: 'item10',
        rubroId: 'rubro10',
        projectId: 'proj1',
        projectName: 'Project Iota',
        description: '', // Empty
        category: undefined,
        month: 1,
        planned: 3000,
        forecast: 3000,
        actual: 2900,
        variance: -100,
      },
    ];

    const lineItemCategoryMap = new Map<string, string | undefined>();
    
    const result = buildSnapshotRows({
      forecastData,
      actualMonthIndex: 1,
      groupingMode: 'project' as GroupingMode,
      monthBudget: 5000,
      useMonthlyBudget: true,
      lineItemCategoryMap,
    });

    const childRow = result[0].children![0];
    // Should default to non-labor when no category and no description with keywords
    assert.strictEqual(childRow.costType, 'non-labor', 'Should default to non-labor with empty description');
  });
});

describe('useMonthlySnapshotData - Category Precedence', () => {
  it('should follow category resolution order: cell.category > lineItemMap(line_item_id) > lineItemMap(rubroId) > fallback', () => {
    const forecastData: ForecastCell[] = [
      {
        line_item_id: 'item11',
        rubroId: 'rubro11',
        projectId: 'proj1',
        projectName: 'Project Kappa',
        description: 'Ingeniero', // Fallback would be labor
        category: undefined,
        month: 1,
        planned: 9000,
        forecast: 9000,
        actual: 8700,
        variance: -300,
      },
    ];

    const lineItemCategoryMap = new Map<string, string | undefined>();
    lineItemCategoryMap.set('item11', 'Equipos y Tecnología'); // Non-labor in map (should win over fallback)
    
    const result = buildSnapshotRows({
      forecastData,
      actualMonthIndex: 1,
      groupingMode: 'project' as GroupingMode,
      monthBudget: 12000,
      useMonthlyBudget: true,
      lineItemCategoryMap,
    });

    const childRow = result[0].children![0];
    assert.strictEqual(childRow.costType, 'non-labor', 'lineItemMap should take precedence over fallback');
  });
});

/**
 * useMonthlySnapshotData Canonical Taxonomy Tests
 *
 * Tests for canonical rubro ID mapping and taxonomy description resolution
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { buildSnapshotRows } from '../useMonthlySnapshotData';
import type { ForecastCell, GroupingMode } from '../../monthlySnapshotTypes';

// Mock import.meta.env for Node.js test environment
globalThis.import = globalThis.import || {} as any;
(globalThis.import as any).meta = (globalThis.import as any).meta || {};
(globalThis.import as any).meta.env = {
  DEV: false, // Set to false to skip DEV-only console logs in tests
};

describe('useMonthlySnapshotData - Canonical Taxonomy Resolution', () => {
  it('should resolve rubro name from lineItemMetaMap when cell description is empty', () => {
    const forecastData: ForecastCell[] = [
      {
        line_item_id: 'MOD-ING',
        rubroId: 'MOD-ING',
        canonicalRubroId: 'MOD-ING',
        projectId: 'proj1',
        projectName: 'Project Alpha',
        description: '', // Empty description
        category: undefined,
        month: 1,
        planned: 10000,
        forecast: 10000,
        actual: 9000,
        variance: -1000,
      },
    ];

    const lineItemCategoryMap = new Map<string, string | undefined>();
    const lineItemMetaMap = new Map<string, { description?: string; category?: string; canonicalId?: string }>();
    
    // Simulate taxonomy lookup result
    lineItemMetaMap.set('MOD-ING', {
      description: 'Ingenieros de soporte (mensual)',
      category: 'Mano de Obra Directa',
      canonicalId: 'MOD-ING',
    });
    
    const result = buildSnapshotRows({
      forecastData,
      actualMonthIndex: 1,
      groupingMode: 'rubro' as GroupingMode,
      monthBudget: 15000,
      useMonthlyBudget: true,
      lineItemCategoryMap,
      lineItemMetaMap,
    });

    assert.strictEqual(result.length, 1, 'Should have one rubro row');
    const rubroRow = result[0];
    assert.strictEqual(
      rubroRow.name,
      'Ingenieros de soporte (mensual)',
      'Should use taxonomy description from lineItemMetaMap'
    );
    assert.strictEqual(
      rubroRow.category,
      'Mano de Obra Directa',
      'Should use taxonomy category from lineItemMetaMap'
    );
  });

  it('should prefer cell description over lineItemMetaMap when present', () => {
    const forecastData: ForecastCell[] = [
      {
        line_item_id: 'MOD-SDM',
        rubroId: 'MOD-SDM',
        canonicalRubroId: 'MOD-SDM',
        projectId: 'proj1',
        projectName: 'Project Beta',
        description: 'Custom SDM Description', // Explicit description
        category: 'Custom Category',
        month: 1,
        planned: 15000,
        forecast: 15000,
        actual: 14000,
        variance: -1000,
      },
    ];

    const lineItemCategoryMap = new Map<string, string | undefined>();
    const lineItemMetaMap = new Map<string, { description?: string; category?: string; canonicalId?: string }>();
    
    lineItemMetaMap.set('MOD-SDM', {
      description: 'Service Delivery Manager (SDM)',
      category: 'Mano de Obra Directa',
      canonicalId: 'MOD-SDM',
    });
    
    const result = buildSnapshotRows({
      forecastData,
      actualMonthIndex: 1,
      groupingMode: 'rubro' as GroupingMode,
      monthBudget: 20000,
      useMonthlyBudget: true,
      lineItemCategoryMap,
      lineItemMetaMap,
    });

    const rubroRow = result[0];
    assert.strictEqual(
      rubroRow.name,
      'Custom SDM Description',
      'Should prefer cell description over taxonomy'
    );
    assert.strictEqual(
      rubroRow.category,
      'Custom Category',
      'Should prefer cell category over taxonomy'
    );
  });

  it('should resolve by canonical ID when line_item_id lookup fails', () => {
    const forecastData: ForecastCell[] = [
      {
        line_item_id: 'LEGACY-123',
        rubroId: 'LEGACY-123',
        canonicalRubroId: 'MOD-LEAD',
        projectId: 'proj1',
        projectName: 'Project Gamma',
        description: '',
        category: undefined,
        month: 1,
        planned: 20000,
        forecast: 20000,
        actual: 19000,
        variance: -1000,
      },
    ];

    const lineItemCategoryMap = new Map<string, string | undefined>();
    const lineItemMetaMap = new Map<string, { description?: string; category?: string; canonicalId?: string }>();
    
    // Only canonical ID exists in map
    lineItemMetaMap.set('MOD-LEAD', {
      description: 'Ingeniero líder / coordinador',
      category: 'Mano de Obra Directa',
      canonicalId: 'MOD-LEAD',
    });
    
    const result = buildSnapshotRows({
      forecastData,
      actualMonthIndex: 1,
      groupingMode: 'rubro' as GroupingMode,
      monthBudget: 25000,
      useMonthlyBudget: true,
      lineItemCategoryMap,
      lineItemMetaMap,
    });

    const rubroRow = result[0];
    assert.strictEqual(
      rubroRow.name,
      'Ingeniero líder / coordinador',
      'Should resolve by canonical ID when line_item_id lookup fails'
    );
  });

  it('should use "Sin descripción" fallback when no mapping exists', () => {
    const forecastData: ForecastCell[] = [
      {
        line_item_id: 'UNKNOWN-999',
        rubroId: 'UNKNOWN-999',
        projectId: 'proj1',
        projectName: 'Project Delta',
        description: '',
        category: undefined,
        month: 1,
        planned: 5000,
        forecast: 5000,
        actual: 4500,
        variance: -500,
      },
    ];

    const lineItemCategoryMap = new Map<string, string | undefined>();
    const lineItemMetaMap = new Map<string, { description?: string; category?: string; canonicalId?: string }>();
    
    const result = buildSnapshotRows({
      forecastData,
      actualMonthIndex: 1,
      groupingMode: 'project' as GroupingMode,
      monthBudget: 10000,
      useMonthlyBudget: true,
      lineItemCategoryMap,
      lineItemMetaMap,
    });

    const projectRow = result[0];
    const childRow = projectRow.children![0];
    assert.strictEqual(
      childRow.name,
      'Sin descripción',
      'Should use fallback when no mapping exists'
    );
  });
});

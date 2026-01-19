/**
 * End-to-End Test for SDMT Forecast Data Flow
 * 
 * Validates that rubros/allocations flow through correctly to forecast grids.
 * Tests the complete pipeline: allocations → computeForecastFromAllocations → forecast cells
 */

import { test } from 'node:test';
import assert from 'node:assert';
import { computeForecastFromAllocations, type Allocation } from '../computeForecastFromAllocations';
import { buildTaxonomyMap } from '../lib/taxonomyLookup';
import type { LineItem } from '@/types/domain';

test('E2E: Allocations flow through to forecast cells with canonical taxonomy', async (t) => {
  
  await t.test('MOD allocations from DynamoDB SKs produce forecast cells with Labor classification', () => {
    // Simulate allocations from DynamoDB with allocation SKs
    const mockAllocations: Allocation[] = [
      {
        // MOD-LEAD allocation for June 2025
        month: 6,
        amount: 5000,
        rubroId: 'MOD-LEAD',
        rubro_id: 'MOD-LEAD',
        line_item_id: 'ALLOCATION#base_bbf111163bb7#2025-06#MOD-LEAD',
        projectId: 'project-123',
      },
      {
        // MOD-SDM allocation for June 2025
        month: 6,
        amount: 6000,
        rubroId: 'MOD-SDM',
        rubro_id: 'MOD-SDM',
        line_item_id: 'ALLOCATION#base_bbf111163bb7#2025-06#MOD-SDM',
        projectId: 'project-123',
      },
      {
        // TEC-ITSM allocation for June 2025 (non-labor)
        month: 6,
        amount: 1000,
        rubroId: 'TEC-ITSM',
        rubro_id: 'TEC-ITSM',
        line_item_id: 'ALLOCATION#base_bbf111163bb7#2025-06#TEC-ITSM',
        projectId: 'project-123',
      },
    ];

    const mockRubros: LineItem[] = [
      {
        id: 'MOD-LEAD',
        description: 'Ingeniero Líder',
        category: 'Mano de Obra Directa',
        unit_cost: 5000,
        qty: 1,
        currency: 'USD',
        start_month: 1,
        end_month: 12,
      },
      {
        id: 'MOD-SDM',
        description: 'Service Delivery Manager',
        category: 'Mano de Obra Directa',
        unit_cost: 6000,
        qty: 1,
        currency: 'USD',
        start_month: 1,
        end_month: 12,
      },
      {
        id: 'TEC-ITSM',
        description: 'ITSM Tool',
        category: 'Equipos y Tecnología',
        unit_cost: 1000,
        qty: 1,
        currency: 'USD',
        start_month: 1,
        end_month: 12,
      },
    ];

    // Build taxonomy map
    const taxonomyByRubroId = {
      'MOD-LEAD': { description: 'Ingeniero Líder', category: 'Mano de Obra Directa', isLabor: true },
      'MOD-SDM': { description: 'Service Delivery Manager', category: 'Mano de Obra Directa', isLabor: true },
      'TEC-ITSM': { description: 'ITSM Tool', category: 'Equipos y Tecnología', isLabor: false },
    };

    const taxonomyMap = buildTaxonomyMap(taxonomyByRubroId);
    const taxonomyCache = new Map();

    // Compute forecast from allocations
    const forecastCells = computeForecastFromAllocations(
      mockAllocations,
      mockRubros,
      12, // months
      'project-123',
      taxonomyByRubroId,
      taxonomyMap,
      taxonomyCache
    );

    // Validate forecast cells were generated
    assert.ok(forecastCells.length > 0, 'Forecast cells should be generated');
    
    // Should have 3 cells (one per rubro for month 6)
    assert.strictEqual(forecastCells.length, 3, 'Should have 3 forecast cells');

    // Find MOD-LEAD cell
    const modLeadCell = forecastCells.find(cell => cell.rubroId === 'MOD-LEAD');
    assert.ok(modLeadCell, 'MOD-LEAD forecast cell should exist');
    assert.strictEqual(modLeadCell.month, 6, 'MOD-LEAD cell should be for month 6');
    assert.strictEqual(modLeadCell.forecast, 5000, 'MOD-LEAD cell should have $5000 forecast');
    assert.strictEqual(modLeadCell.planned, 5000, 'MOD-LEAD cell should have $5000 planned');
    assert.strictEqual(modLeadCell.isLabor, true, 'MOD-LEAD should be classified as Labor');
    // Category can be either the taxonomy's category or the canonical override
    assert.ok(
      modLeadCell.category === 'Mano de Obra Directa' || modLeadCell.category === 'Mano de Obra (MOD)',
      `MOD-LEAD should have Labor category, got: ${modLeadCell.category}`
    );

    // Find MOD-SDM cell
    const modSdmCell = forecastCells.find(cell => cell.rubroId === 'MOD-SDM');
    assert.ok(modSdmCell, 'MOD-SDM forecast cell should exist');
    assert.strictEqual(modSdmCell.month, 6, 'MOD-SDM cell should be for month 6');
    assert.strictEqual(modSdmCell.forecast, 6000, 'MOD-SDM cell should have $6000 forecast');
    assert.strictEqual(modSdmCell.isLabor, true, 'MOD-SDM should be classified as Labor');

    // Find TEC-ITSM cell
    const tecItsmCell = forecastCells.find(cell => cell.rubroId === 'TEC-ITSM');
    assert.ok(tecItsmCell, 'TEC-ITSM forecast cell should exist');
    assert.strictEqual(tecItsmCell.month, 6, 'TEC-ITSM cell should be for month 6');
    assert.strictEqual(tecItsmCell.forecast, 1000, 'TEC-ITSM cell should have $1000 forecast');
    assert.strictEqual(tecItsmCell.isLabor, false, 'TEC-ITSM should NOT be classified as Labor');

    console.log('[E2E Test] ✅ All allocations successfully converted to forecast cells with correct Labor classification');
  });

  await t.test('Allocations with month_index field work correctly', () => {
    // Test allocations with month_index field (newer format)
    const mockAllocations: Allocation[] = [
      {
        month: '2025-06', // String format
        amount: 5000,
        rubroId: 'MOD-LEAD',
        projectId: 'project-123',
        // @ts-ignore - testing runtime behavior
        month_index: 6, // Explicit month index
      },
      {
        month: '2025-07',
        amount: 5500,
        rubroId: 'MOD-LEAD',
        projectId: 'project-123',
        // @ts-ignore
        month_index: 7,
      },
    ];

    const mockRubros: LineItem[] = [
      {
        id: 'MOD-LEAD',
        description: 'Ingeniero Líder',
        category: 'Mano de Obra Directa',
        unit_cost: 5000,
        qty: 1,
        currency: 'USD',
        start_month: 1,
        end_month: 12,
      },
    ];

    const taxonomyByRubroId = {
      'MOD-LEAD': { description: 'Ingeniero Líder', category: 'Mano de Obra Directa', isLabor: true },
    };

    const taxonomyMap = buildTaxonomyMap(taxonomyByRubroId);
    const taxonomyCache = new Map();

    const forecastCells = computeForecastFromAllocations(
      mockAllocations,
      mockRubros,
      12,
      'project-123',
      taxonomyByRubroId,
      taxonomyMap,
      taxonomyCache
    );

    // Should have 2 cells (one per month)
    assert.strictEqual(forecastCells.length, 2, 'Should have 2 forecast cells');

    const june = forecastCells.find(cell => cell.month === 6);
    const july = forecastCells.find(cell => cell.month === 7);

    assert.ok(june, 'June cell should exist');
    assert.ok(july, 'July cell should exist');
    assert.strictEqual(june.forecast, 5000, 'June should have $5000');
    assert.strictEqual(july.forecast, 5500, 'July should have $5500');

    console.log('[E2E Test] ✅ Allocations with month_index correctly parsed');
  });

  await t.test('Multiple allocations for same rubro/month aggregate correctly', () => {
    // Test that multiple allocations for the same rubro and month are summed
    const mockAllocations: Allocation[] = [
      {
        month: 6,
        amount: 2000,
        rubroId: 'MOD-LEAD',
        projectId: 'project-123',
      },
      {
        month: 6,
        amount: 3000,
        rubroId: 'MOD-LEAD',
        projectId: 'project-123',
      },
    ];

    const mockRubros: LineItem[] = [
      {
        id: 'MOD-LEAD',
        description: 'Ingeniero Líder',
        category: 'Mano de Obra Directa',
        unit_cost: 5000,
        qty: 1,
        currency: 'USD',
        start_month: 1,
        end_month: 12,
      },
    ];

    const taxonomyByRubroId = {
      'MOD-LEAD': { description: 'Ingeniero Líder', category: 'Mano de Obra Directa', isLabor: true },
    };

    const taxonomyMap = buildTaxonomyMap(taxonomyByRubroId);
    const taxonomyCache = new Map();

    const forecastCells = computeForecastFromAllocations(
      mockAllocations,
      mockRubros,
      12,
      'project-123',
      taxonomyByRubroId,
      taxonomyMap,
      taxonomyCache
    );

    // Should have 1 cell (aggregated)
    assert.strictEqual(forecastCells.length, 1, 'Should have 1 aggregated forecast cell');

    const cell = forecastCells[0];
    assert.strictEqual(cell.forecast, 5000, 'Should sum to $5000');
    assert.strictEqual(cell.planned, 5000, 'Planned should also be $5000');

    console.log('[E2E Test] ✅ Multiple allocations for same rubro/month correctly aggregated');
  });

  await t.test('Empty allocations return empty forecast', () => {
    const forecastCells = computeForecastFromAllocations(
      [],
      [],
      12,
      'project-123',
      {},
      new Map(),
      new Map()
    );

    assert.strictEqual(forecastCells.length, 0, 'Empty allocations should return empty forecast');

    console.log('[E2E Test] ✅ Empty allocations correctly handled');
  });

  await t.test('Allocations without projectId fail gracefully', () => {
    const mockAllocations: Allocation[] = [
      {
        month: 6,
        amount: 5000,
        rubroId: 'MOD-LEAD',
        // No projectId
      },
    ];

    const mockRubros: LineItem[] = [];

    const forecastCells = computeForecastFromAllocations(
      mockAllocations,
      mockRubros,
      12,
      undefined, // No projectId
      {},
      new Map(),
      new Map()
    );

    // Should return empty forecast when projectId is missing
    assert.strictEqual(forecastCells.length, 0, 'Should return empty forecast without projectId');

    console.log('[E2E Test] ✅ Missing projectId handled gracefully');
  });
});

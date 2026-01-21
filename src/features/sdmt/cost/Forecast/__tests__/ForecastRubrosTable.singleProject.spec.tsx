/**
 * ForecastRubrosTable Single-Project Integration Test
 * 
 * Validates that the table component works correctly in single-project mode
 * with forecast data from materialized allocations
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { buildCategoryTotals, buildCategoryRubros } from '../categoryGrouping';
import type { ForecastCell, LineItem } from '@/types/domain';

describe('ForecastRubrosTable - Single Project Mode', () => {
  it('should build category grouping for single project with MOD and equipment rubros', () => {
    const projectId = 'proj-test-123';
    
    // Mock forecast data with both labor (MOD) and equipment rubros
    const forecastData: ForecastCell[] = [
      // MOD-LEAD allocation for months 1-12 (unit_cost: 1000)
      ...Array.from({ length: 12 }, (_, i) => ({
        line_item_id: 'MOD-LEAD',
        month: i + 1,
        planned: 1000,
        forecast: 1000,
        actual: 0,
        variance: 0,
        last_updated: '2025-01-01T00:00:00Z',
        updated_by: 'materializer',
        category: 'Mano de Obra Directa',
        description: 'Tech Lead',
        project_id: projectId,
      } as any)),
      
      // Equipment allocation for month 1 (unit_cost: 1145.83)
      {
        line_item_id: 'EQUIPMENT-001',
        month: 1,
        planned: 1145.83,
        forecast: 1145.83,
        actual: 0,
        variance: 0,
        last_updated: '2025-01-01T00:00:00Z',
        updated_by: 'materializer',
        category: 'Equipment',
        description: 'Laptop',
        project_id: projectId,
      } as any,
    ];

    // Mock line items matching the rubros
    const lineItems: LineItem[] = [
      {
        id: 'MOD-LEAD',
        description: 'Tech Lead',
        category: 'Mano de Obra Directa',
        unit_cost: 1000,
        qty: 1,
        currency: 'USD',
        start_month: 1,
        end_month: 12,
        one_time: false,
        recurring: true,
        amortization: 'none',
        capex_flag: false,
        indexation_policy: 'none',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        created_by: 'test-user',
      },
      {
        id: 'EQUIPMENT-001',
        description: 'Laptop',
        category: 'Equipment',
        unit_cost: 1145.83,
        qty: 1,
        currency: 'USD',
        start_month: 1,
        end_month: 1,
        one_time: true,
        recurring: false,
        amortization: 'none',
        capex_flag: false,
        indexation_policy: 'none',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        created_by: 'test-user',
      },
    ];

    // Build category totals (same as what SDMTForecast does)
    const categoryTotals = buildCategoryTotals(forecastData);
    
    // Build category rubros (same as what SDMTForecast does)
    const categoryRubros = buildCategoryRubros(forecastData, lineItems);

    // Verify category totals
    assert.strictEqual(categoryTotals.size, 2, 'Should have 2 categories (MOD + Equipment)');
    
    const modTotals = categoryTotals.get('Mano de Obra Directa');
    assert.ok(modTotals, 'Should have MOD category totals');
    assert.strictEqual(modTotals.overall.planned, 12000, 'MOD planned should be 12 * 1000 = 12000');
    assert.strictEqual(modTotals.overall.forecast, 12000, 'MOD forecast should be 12000');
    
    const equipmentTotals = categoryTotals.get('Equipment');
    assert.ok(equipmentTotals, 'Should have Equipment category totals');
    assert.strictEqual(equipmentTotals.overall.planned, 1145.83, 'Equipment planned should be 1145.83');

    // Verify category rubros
    assert.strictEqual(categoryRubros.size, 2, 'Should have 2 category groups');
    
    const modRubros = categoryRubros.get('Mano de Obra Directa');
    assert.ok(modRubros, 'Should have MOD rubros');
    assert.strictEqual(modRubros.length, 1, 'Should have 1 MOD rubro');
    assert.strictEqual(modRubros[0].rubroId, 'MOD-LEAD', 'Should be MOD-LEAD rubro');
    assert.strictEqual(modRubros[0].description, 'Tech Lead', 'Should have correct description');
    
    const equipmentRubros = categoryRubros.get('Equipment');
    assert.ok(equipmentRubros, 'Should have Equipment rubros');
    assert.strictEqual(equipmentRubros.length, 1, 'Should have 1 Equipment rubro');
    assert.strictEqual(equipmentRubros[0].rubroId, 'EQUIPMENT-001', 'Should be EQUIPMENT-001 rubro');

    // Verify that table would render with non-empty data
    // (The actual table render is done by ForecastRubrosTable component,
    // but we can verify the data structures are correct)
    assert.ok(categoryTotals.size > 0, 'Table should have category totals to display');
    assert.ok(categoryRubros.size > 0, 'Table should have category rubros to display');
  });

  it('should filter forecast data to single project when multiple projects present', () => {
    const targetProjectId = 'proj-123';
    const otherProjectId = 'proj-456';
    
    const allForecastData: ForecastCell[] = [
      // Target project data
      {
        line_item_id: 'MOD-LEAD',
        month: 1,
        planned: 1000,
        forecast: 1000,
        actual: 0,
        variance: 0,
        last_updated: '2025-01-01T00:00:00Z',
        updated_by: 'system',
        category: 'Mano de Obra Directa',
        description: 'Tech Lead',
        project_id: targetProjectId,
      } as any,
      // Other project data (should be filtered out)
      {
        line_item_id: 'MOD-LEAD',
        month: 1,
        planned: 1500,
        forecast: 1500,
        actual: 0,
        variance: 0,
        last_updated: '2025-01-01T00:00:00Z',
        updated_by: 'system',
        category: 'Mano de Obra Directa',
        description: 'Tech Lead',
        project_id: otherProjectId,
      } as any,
    ];

    // Filter to single project (as SDMTForecast does in single-project mode)
    const filteredData = allForecastData.filter(
      cell => (cell as any).project_id === targetProjectId
    );

    const categoryTotals = buildCategoryTotals(filteredData);
    const modTotals = categoryTotals.get('Mano de Obra Directa')!;
    
    // Should only include target project
    assert.strictEqual(
      modTotals.overall.planned,
      1000,
      'Should only include target project data, not other project'
    );
  });
});

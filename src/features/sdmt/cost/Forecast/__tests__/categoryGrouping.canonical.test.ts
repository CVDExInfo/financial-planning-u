/**
 * Test: buildCategoryRubros with Canonical Taxonomy Integration
 * 
 * Validates that buildCategoryRubros correctly resolves category and description
 * from canonical taxonomy when not present on forecast cells.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { buildCategoryRubros, buildCategoryTotals } from '../categoryGrouping';
import type { ForecastCell, LineItem } from '@/types/domain';

describe('buildCategoryRubros with Canonical Taxonomy', () => {
  it('should resolve category from canonical taxonomy when not on cell', () => {
    const forecastData: ForecastCell[] = [
      {
        line_item_id: 'MOD-SDM',
        month: 1,
        planned: 1000,
        forecast: 1000,
        actual: 0,
        variance: 0,
        last_updated: '2025-01-01T00:00:00Z',
        updated_by: 'system',
        // No category field - should be resolved from canonical taxonomy
      },
      {
        line_item_id: 'MOD-LEAD',
        month: 1,
        planned: 1200,
        forecast: 1200,
        actual: 0,
        variance: 0,
        last_updated: '2025-01-01T00:00:00Z',
        updated_by: 'system',
        // No category field - should be resolved from canonical taxonomy
      },
      {
        line_item_id: 'TEC-ITSM',
        month: 1,
        planned: 500,
        forecast: 500,
        actual: 0,
        variance: 0,
        last_updated: '2025-01-01T00:00:00Z',
        updated_by: 'system',
        // No category field - should be resolved from canonical taxonomy
      },
    ];

    const lineItems: LineItem[] = [];

    const result = buildCategoryRubros(forecastData, lineItems);

    // Should have 2 categories: "Mano de Obra Directa" and "Equipos y Tecnología"
    assert.ok(result.has('Mano de Obra Directa'), 'Should have Mano de Obra Directa category from taxonomy');
    assert.ok(result.has('Equipos y Tecnología'), 'Should have Equipos y Tecnología category from taxonomy');

    // Verify MOD category has 2 rubros
    const modRubros = result.get('Mano de Obra Directa')!;
    assert.strictEqual(modRubros.length, 2, 'Should have 2 MOD rubros');

    // Verify rubros have correct descriptions from taxonomy
    const sdmRubro = modRubros.find(r => r.rubroId === 'MOD-SDM');
    const leadRubro = modRubros.find(r => r.rubroId === 'MOD-LEAD');

    assert.ok(sdmRubro, 'Should find MOD-SDM rubro');
    assert.ok(leadRubro, 'Should find MOD-LEAD rubro');

    // Descriptions should come from canonical taxonomy, not be "Unknown"
    assert.notStrictEqual(sdmRubro!.description, 'Unknown', 'MOD-SDM should have proper description');
    assert.notStrictEqual(leadRubro!.description, 'Unknown', 'MOD-LEAD should have proper description');

    // Should have proper isLabor flag for MOD items
    assert.strictEqual(sdmRubro!.isLabor, true, 'MOD-SDM should be labor');
    assert.strictEqual(leadRubro!.isLabor, true, 'MOD-LEAD should be labor');

    // Verify TEC category
    const tecRubros = result.get('Equipos y Tecnología')!;
    assert.strictEqual(tecRubros.length, 1, 'Should have 1 TEC rubro');
    assert.strictEqual(tecRubros[0].rubroId, 'TEC-ITSM', 'Should be TEC-ITSM rubro');
    assert.notStrictEqual(tecRubros[0].description, 'Unknown', 'TEC-ITSM should have proper description');
    assert.strictEqual(tecRubros[0].isLabor, false, 'TEC-ITSM should not be labor');
  });

  it('should prioritize cell category over taxonomy', () => {
    const forecastData: ForecastCell[] = [
      {
        line_item_id: 'MOD-SDM',
        month: 1,
        planned: 1000,
        forecast: 1000,
        actual: 0,
        variance: 0,
        last_updated: '2025-01-01T00:00:00Z',
        updated_by: 'system',
        category: 'Custom Category', // Explicitly set category
      } as any,
    ];

    const lineItems: LineItem[] = [];

    const result = buildCategoryRubros(forecastData, lineItems);

    // Should use the cell's category, not taxonomy
    assert.ok(result.has('Custom Category'), 'Should use cell category when present');
    assert.strictEqual(result.get('Custom Category')!.length, 1, 'Should have 1 rubro in custom category');
  });

  it('should handle unknown rubros gracefully', () => {
    const forecastData: ForecastCell[] = [
      {
        line_item_id: 'UNKNOWN-RUBRO-123',
        month: 1,
        planned: 1000,
        forecast: 1000,
        actual: 0,
        variance: 0,
        last_updated: '2025-01-01T00:00:00Z',
        updated_by: 'system',
        // No category - should fall back to "Sin categoría"
      },
    ];

    const lineItems: LineItem[] = [];

    const result = buildCategoryRubros(forecastData, lineItems);

    // Should fall back to "Sin categoría"
    assert.ok(result.has('Sin categoría'), 'Should have Sin categoría for unknown rubros');
    
    const unknownRubros = result.get('Sin categoría')!;
    assert.strictEqual(unknownRubros.length, 1, 'Should have 1 unknown rubro');
    assert.strictEqual(unknownRubros[0].description, 'Unknown', 'Should use Unknown description for unmapped rubros');
  });
});

describe('buildCategoryTotals with Canonical Taxonomy', () => {
  it('should resolve category from canonical taxonomy when not on cell', () => {
    const forecastData: ForecastCell[] = [
      {
        line_item_id: 'MOD-SDM',
        month: 1,
        planned: 1000,
        forecast: 1000,
        actual: 0,
        variance: 0,
        last_updated: '2025-01-01T00:00:00Z',
        updated_by: 'system',
      },
      {
        line_item_id: 'MOD-LEAD',
        month: 1,
        planned: 1200,
        forecast: 1200,
        actual: 0,
        variance: 0,
        last_updated: '2025-01-01T00:00:00Z',
        updated_by: 'system',
      },
      {
        line_item_id: 'TEC-ITSM',
        month: 1,
        planned: 500,
        forecast: 500,
        actual: 0,
        variance: 0,
        last_updated: '2025-01-01T00:00:00Z',
        updated_by: 'system',
      },
    ];

    const result = buildCategoryTotals(forecastData);

    // Should have 2 categories from taxonomy
    assert.ok(result.has('Mano de Obra Directa'), 'Should have Mano de Obra Directa category');
    assert.ok(result.has('Equipos y Tecnología'), 'Should have Equipos y Tecnología category');

    // Verify MOD totals (1000 + 1200 = 2200)
    const modTotals = result.get('Mano de Obra Directa')!;
    assert.strictEqual(modTotals.overall.planned, 2200, 'MOD planned should be 2200');
    assert.strictEqual(modTotals.overall.forecast, 2200, 'MOD forecast should be 2200');

    // Verify TEC totals
    const tecTotals = result.get('Equipos y Tecnología')!;
    assert.strictEqual(tecTotals.overall.planned, 500, 'TEC planned should be 500');
    assert.strictEqual(tecTotals.overall.forecast, 500, 'TEC forecast should be 500');
  });
});

/**
 * Unit tests for buildGroupingMaps helper
 * 
 * Validates that grouping works correctly for both portfolio and single-project views
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { buildGroupingMaps, type RubroTaxonomy } from '../buildGroupingMaps';
import type { ForecastCell } from '@/types/domain';

describe('buildGroupingMaps', () => {
  it('should group forecast rows by category for single project', () => {
    const taxonomy: RubroTaxonomy = {
      'MOD-LEAD': {
        category: 'Mano de Obra Directa',
        description: 'Tech Lead',
        order: 1,
      },
      'EQUIPMENT-001': {
        category: 'Equipment',
        description: 'Laptop',
        order: 2,
      },
    };

    const forecastRows: ForecastCell[] = [
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
        project_id: 'proj-123',
      } as any,
      {
        line_item_id: 'MOD-LEAD',
        month: 2,
        planned: 1000,
        forecast: 1000,
        actual: 0,
        variance: 0,
        last_updated: '2025-01-01T00:00:00Z',
        updated_by: 'system',
        category: 'Mano de Obra Directa',
        description: 'Tech Lead',
        project_id: 'proj-123',
      } as any,
      {
        line_item_id: 'EQUIPMENT-001',
        month: 1,
        planned: 1145.83,
        forecast: 1145.83,
        actual: 0,
        variance: 0,
        last_updated: '2025-01-01T00:00:00Z',
        updated_by: 'system',
        category: 'Equipment',
        description: 'Laptop',
        project_id: 'proj-123',
      } as any,
    ];

    const result = buildGroupingMaps({
      forecastRows,
      taxonomy,
      viewMode: 'project',
      projectId: 'proj-123',
    });

    // Verify categoryMap contains both categories
    assert.strictEqual(result.categoryMap.size, 2, 'Should have 2 categories');
    assert.ok(result.categoryMap.has('Mano de Obra Directa'), 'Should have MOD category');
    assert.ok(result.categoryMap.has('Equipment'), 'Should have Equipment category');

    // Verify MOD category has 1 rubro
    const modRubros = result.categoryMap.get('Mano de Obra Directa')!;
    assert.strictEqual(modRubros.length, 1, 'MOD category should have 1 rubro');
    assert.strictEqual(modRubros[0].rubroId, 'MOD-LEAD', 'Should be MOD-LEAD rubro');

    // Verify MOD-LEAD totals (2 months * 1000 = 2000)
    const modLead = result.rubroMap.get('MOD-LEAD')!;
    assert.strictEqual(modLead.overall.planned, 2000, 'MOD-LEAD planned should be 2000');
    assert.strictEqual(modLead.overall.forecast, 2000, 'MOD-LEAD forecast should be 2000');

    // Verify Equipment category totals
    const equipmentTotals = result.totalsMap.get('Equipment')!;
    assert.strictEqual(equipmentTotals.overall.planned, 1145.83, 'Equipment planned should be 1145.83');
  });

  it('should handle portfolio mode with multiple projects', () => {
    const taxonomy: RubroTaxonomy = {
      'MOD-LEAD': {
        category: 'Mano de Obra Directa',
        description: 'Tech Lead',
        order: 1,
      },
    };

    const forecastRows: ForecastCell[] = [
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
        project_id: 'proj-123',
      } as any,
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
        project_id: 'proj-456',
      } as any,
    ];

    const result = buildGroupingMaps({
      forecastRows,
      taxonomy,
      viewMode: 'portfolio',
    });

    // Verify aggregation across projects
    const modLead = result.rubroMap.get('MOD-LEAD')!;
    assert.strictEqual(modLead.overall.planned, 2500, 'Should aggregate across projects');
  });

  it('should normalize rubro keys for matching', () => {
    const taxonomy: RubroTaxonomy = {
      'modlead': {
        category: 'Mano de Obra Directa',
        description: 'Tech Lead',
      },
    };

    const forecastRows: ForecastCell[] = [
      {
        line_item_id: 'MOD-LEAD#base123#1',
        month: 1,
        planned: 1000,
        forecast: 1000,
        actual: 0,
        variance: 0,
        last_updated: '2025-01-01T00:00:00Z',
        updated_by: 'system',
        project_id: 'proj-123',
      } as any,
    ];

    const result = buildGroupingMaps({
      forecastRows,
      taxonomy,
      viewMode: 'project',
      projectId: 'proj-123',
    });

    // Should find taxonomy entry despite key differences (hash suffix, case, hyphens)
    const rubro = result.rubroMap.get('MOD-LEAD#base123#1')!;
    assert.strictEqual(rubro.category, 'Mano de Obra Directa', 'Should match normalized taxonomy');
  });

  it('should handle UNMAPPED category for missing taxonomy entries', () => {
    const taxonomy: RubroTaxonomy = {};

    const forecastRows: ForecastCell[] = [
      {
        line_item_id: 'UNKNOWN-RUBRO',
        month: 1,
        planned: 1000,
        forecast: 1000,
        actual: 0,
        variance: 0,
        last_updated: '2025-01-01T00:00:00Z',
        updated_by: 'system',
        project_id: 'proj-123',
      } as any,
    ];

    const result = buildGroupingMaps({
      forecastRows,
      taxonomy,
      viewMode: 'project',
      projectId: 'proj-123',
    });

    // Should create UNMAPPED category
    assert.ok(result.categoryMap.has('UNMAPPED'), 'Should have UNMAPPED category');
    const unmappedRubros = result.categoryMap.get('UNMAPPED')!;
    assert.strictEqual(unmappedRubros.length, 1, 'Should have 1 unmapped rubro');
    assert.strictEqual(
      unmappedRubros[0].description,
      'Allocation UNKNOWN-RUBRO',
      'Should have fallback description'
    );
  });
});

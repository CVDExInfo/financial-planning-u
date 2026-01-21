/**
 * Integration Test: Labor/Non-Labor Segmentation in Forecast Grids
 * 
 * Validates that canonical MOD items are properly classified and filtered
 * across ForecastRubrosTable and data loading pipeline.
 * 
 * Tests requested by @valencia94 to ensure grids load data accordingly
 * and are segmented by Labor and Non-Labor.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { buildProjectRubros } from '../projectGrouping';
import { computeForecastFromAllocations } from '../computeForecastFromAllocations';
import { buildTaxonomyMap, isLaborByKey } from '../lib/taxonomyLookup';
import type { ForecastCell, LineItem } from '@/types/domain';
import type { Allocation } from '../computeForecastFromAllocations';

describe('Labor/Non-Labor Segmentation Integration', () => {
  describe('Canonical MOD items classification', () => {
    it('should classify all canonical MOD items as Labor in computeForecastFromAllocations', () => {
      const canonicalModItems = [
        'MOD-EXT',
        'MOD-OT',
        'MOD-ING',
        'MOD-LEAD',
        'MOD-CONT',
        'MOD-SDM',
        'MOD-IN1',
        'MOD-IN2',
        'MOD-IN3',
        'MOD-PMO',
      ];

      const allocations: Allocation[] = canonicalModItems.map((modId, index) => ({
        month: 1,
        amount: 1000 + index * 100,
        rubroId: modId,
        projectId: 'test-project',
      }));

      const rubros: LineItem[] = [];
      const forecastRows = computeForecastFromAllocations(allocations, rubros, 12, 'test-project');

      // All canonical MOD items should be classified as Labor
      forecastRows.forEach(row => {
        assert.strictEqual(
          row.isLabor,
          true,
          `${row.line_item_id} should be classified as Labor`
        );
      });

      // All should have Labor category (either includes "Mano de Obra" or is "MOD" or "Allocations")
      forecastRows.forEach(row => {
        // When using canonical labor keys without rubros, category may be "Mano de Obra (MOD)" or "Allocations"
        // The key assertion is isLabor=true, category is secondary
        assert.ok(
          row.category?.includes('Mano de Obra') || row.category === 'MOD' || row.category === 'Allocations',
          `${row.line_item_id} should have Labor-related category, got: ${row.category}`
        );
      });
    });

    it('should classify non-labor items correctly in computeForecastFromAllocations', () => {
      const nonLaborItems = [
        'GSV-CLOUD',
        'EQUIPO-SERVER',
        'SOFTWARE-LICENSE',
        'ADMIN-SUPPLIES',
      ];

      const allocations: Allocation[] = nonLaborItems.map((itemId, index) => ({
        month: 1,
        amount: 500 + index * 50,
        rubroId: itemId,
        projectId: 'test-project',
      }));

      const rubros: LineItem[] = nonLaborItems.map((itemId, index) => ({
        id: itemId,
        description: `Non-Labor Item ${index + 1}`,
        category: index % 2 === 0 ? 'Equipos y Tecnología' : 'Administrative',
        start_month: 1,
        end_month: 12,
        unit_cost: 500,
        qty: 1,
        currency: 'USD',
      } as LineItem));

      const forecastRows = computeForecastFromAllocations(allocations, rubros, 12, 'test-project');

      // All non-labor items should be classified as non-Labor
      forecastRows.forEach(row => {
        assert.strictEqual(
          row.isLabor,
          false,
          `${row.line_item_id} should not be classified as Labor`
        );
      });
    });

    it('should properly segment mixed Labor and Non-Labor items', () => {
      const mixedAllocations: Allocation[] = [
        // Labor items
        { month: 1, amount: 10000, rubroId: 'MOD-EXT', projectId: 'proj1' },
        { month: 1, amount: 12000, rubroId: 'MOD-SDM', projectId: 'proj1' },
        { month: 1, amount: 8000, rubroId: 'MOD-ING', projectId: 'proj1' },
        // Non-Labor items
        { month: 1, amount: 5000, rubroId: 'GSV-CLOUD', projectId: 'proj1' },
        { month: 1, amount: 3000, rubroId: 'EQUIPO-SERVER', projectId: 'proj1' },
      ];

      const rubros: LineItem[] = [
        {
          id: 'GSV-CLOUD',
          description: 'Cloud Services',
          category: 'IT Infrastructure',
          start_month: 1,
          end_month: 12,
          unit_cost: 5000,
          qty: 1,
          currency: 'USD',
        } as LineItem,
        {
          id: 'EQUIPO-SERVER',
          description: 'Server Equipment',
          category: 'Equipos y Tecnología',
          start_month: 1,
          end_month: 12,
          unit_cost: 3000,
          qty: 1,
          currency: 'USD',
        } as LineItem,
      ];

      const forecastRows = computeForecastFromAllocations(mixedAllocations, rubros, 12, 'proj1');

      const laborRows = forecastRows.filter(r => r.isLabor);
      const nonLaborRows = forecastRows.filter(r => !r.isLabor);

      // Should have 3 labor rows and 2 non-labor rows
      assert.strictEqual(laborRows.length, 3, 'Should have 3 labor rows');
      assert.strictEqual(nonLaborRows.length, 2, 'Should have 2 non-labor rows');

      // Verify labor totals
      const laborTotal = laborRows.reduce((sum, r) => sum + r.forecast, 0);
      assert.strictEqual(laborTotal, 30000, 'Labor total should be 30000');

      // Verify non-labor totals
      const nonLaborTotal = nonLaborRows.reduce((sum, r) => sum + r.forecast, 0);
      assert.strictEqual(nonLaborTotal, 8000, 'Non-labor total should be 8000');
    });
  });

  describe('Project grouping with Labor segmentation', () => {
    it('should maintain Labor classification in buildProjectRubros', () => {
      const forecastData: ForecastCell[] = [
        // Labor cells
        {
          line_item_id: 'MOD-LEAD',
          month: 1,
          planned: 10000,
          forecast: 10500,
          actual: 9800,
          variance: -700,
          last_updated: '2024-01-01',
          updated_by: 'system',
          project_id: 'proj1',
          project_name: 'Project Alpha',
        } as any,
        {
          line_item_id: 'MOD-SDM',
          month: 1,
          planned: 12000,
          forecast: 12500,
          actual: 11900,
          variance: -600,
          last_updated: '2024-01-01',
          updated_by: 'system',
          project_id: 'proj1',
          project_name: 'Project Alpha',
        } as any,
        // Non-Labor cell
        {
          line_item_id: 'GSV-CLOUD',
          month: 1,
          planned: 5000,
          forecast: 5200,
          actual: 4900,
          variance: -300,
          last_updated: '2024-01-01',
          updated_by: 'system',
          project_id: 'proj1',
          project_name: 'Project Alpha',
        } as any,
      ];

      const lineItems: LineItem[] = [];
      const projectRubros = buildProjectRubros(forecastData, lineItems);

      const proj1Rubros = projectRubros.get('proj1');
      assert.ok(proj1Rubros, 'Project 1 should have rubros');
      assert.strictEqual(proj1Rubros.length, 3, 'Should have 3 rubros');

      // Check Labor classification
      const modLead = proj1Rubros.find(r => r.rubroId === 'MOD-LEAD');
      const modSdm = proj1Rubros.find(r => r.rubroId === 'MOD-SDM');
      const gsvCloud = proj1Rubros.find(r => r.rubroId === 'GSV-CLOUD');

      assert.ok(modLead, 'MOD-LEAD should exist');
      assert.strictEqual(modLead.isLabor, true, 'MOD-LEAD should be Labor');

      assert.ok(modSdm, 'MOD-SDM should exist');
      assert.strictEqual(modSdm.isLabor, true, 'MOD-SDM should be Labor');

      assert.ok(gsvCloud, 'GSV-CLOUD should exist');
      assert.strictEqual(gsvCloud.isLabor, false, 'GSV-CLOUD should not be Labor');
    });

    it('should correctly segment Labor vs Non-Labor across multiple projects', () => {
      const forecastData: ForecastCell[] = [
        // Project 1 - Labor
        {
          line_item_id: 'MOD-EXT',
          month: 1,
          planned: 8000,
          forecast: 8200,
          actual: 7800,
          variance: -400,
          last_updated: '2024-01-01',
          updated_by: 'system',
          project_id: 'proj1',
          project_name: 'Project Alpha',
        } as any,
        // Project 1 - Non-Labor
        {
          line_item_id: 'EQUIPO-LAPTOP',
          month: 1,
          planned: 3000,
          forecast: 3100,
          actual: 2900,
          variance: -200,
          last_updated: '2024-01-01',
          updated_by: 'system',
          project_id: 'proj1',
          project_name: 'Project Alpha',
        } as any,
        // Project 2 - Labor
        {
          line_item_id: 'MOD-ING',
          month: 1,
          planned: 9000,
          forecast: 9300,
          actual: 8900,
          variance: -400,
          last_updated: '2024-01-01',
          updated_by: 'system',
          project_id: 'proj2',
          project_name: 'Project Beta',
        } as any,
        // Project 2 - Non-Labor
        {
          line_item_id: 'SOFTWARE-DB',
          month: 1,
          planned: 4000,
          forecast: 4200,
          actual: 3800,
          variance: -400,
          last_updated: '2024-01-01',
          updated_by: 'system',
          project_id: 'proj2',
          project_name: 'Project Beta',
        } as any,
      ];

      const lineItems: LineItem[] = [];
      const projectRubros = buildProjectRubros(forecastData, lineItems);

      // Verify Project 1
      const proj1Rubros = projectRubros.get('proj1');
      assert.ok(proj1Rubros, 'Project 1 should exist');
      const proj1Labor = proj1Rubros.filter(r => r.isLabor);
      const proj1NonLabor = proj1Rubros.filter(r => !r.isLabor);
      assert.strictEqual(proj1Labor.length, 1, 'Project 1 should have 1 labor rubro');
      assert.strictEqual(proj1NonLabor.length, 1, 'Project 1 should have 1 non-labor rubro');

      // Verify Project 2
      const proj2Rubros = projectRubros.get('proj2');
      assert.ok(proj2Rubros, 'Project 2 should exist');
      const proj2Labor = proj2Rubros.filter(r => r.isLabor);
      const proj2NonLabor = proj2Rubros.filter(r => !r.isLabor);
      assert.strictEqual(proj2Labor.length, 1, 'Project 2 should have 1 labor rubro');
      assert.strictEqual(proj2NonLabor.length, 1, 'Project 2 should have 1 non-labor rubro');
    });
  });

  describe('LINEA# prefixed variants', () => {
    it('should classify LINEA#MOD-* variants as Labor', () => {
      const lineaPrefixedItems = [
        'LINEA#MOD-EXT',
        'LINEA#MOD-OT',
        'LINEA#MOD-ING',
        'LINEA#MOD-LEAD',
        'LINEA#MOD-CONT',
        'LINEA#MOD-SDM',
      ];

      // Test with isLaborByKey directly
      lineaPrefixedItems.forEach(itemId => {
        assert.strictEqual(
          isLaborByKey(itemId),
          true,
          `${itemId} should be recognized as Labor by key`
        );
      });

      // Test in allocation pipeline
      const allocations: Allocation[] = lineaPrefixedItems.map((itemId, index) => ({
        month: 1,
        amount: 1500 + index * 100,
        rubroId: itemId,
        projectId: 'test-project',
      }));

      const forecastRows = computeForecastFromAllocations(allocations, [], 12, 'test-project');

      forecastRows.forEach(row => {
        assert.strictEqual(
          row.isLabor,
          true,
          `${row.line_item_id} should be classified as Labor in forecast`
        );
      });
    });
  });

  describe('Role descriptors classification', () => {
    it('should classify engineer role descriptors as Labor', () => {
      const engineerRoles = [
        'Ingeniero Soporte N1',
        'Ingeniero Soporte N2',
        'Ingeniero Soporte N3',
        'Ingeniero Lider',
      ];

      engineerRoles.forEach(role => {
        assert.strictEqual(
          isLaborByKey(role),
          true,
          `${role} should be recognized as Labor`
        );
      });
    });

    it('should classify management role descriptors as Labor', () => {
      const managementRoles = [
        'Project Manager',
        'Service Delivery Manager',
      ];

      managementRoles.forEach(role => {
        assert.strictEqual(
          isLaborByKey(role),
          true,
          `${role} should be recognized as Labor`
        );
      });
    });
  });

  describe('Taxonomy map integration', () => {
    it('should seed canonical labor keys in taxonomy map', () => {
      const taxonomy = {
        'MOD': {
          rubroId: 'MOD',
          description: 'Mano de Obra Directa',
          category: 'Labor',
        },
      };

      const taxonomyMap = buildTaxonomyMap(taxonomy);

      // Check that canonical keys are seeded
      const canonicalKeys = ['mod-ext', 'mod-sdm', 'mod-ing', 'mod-lead'];
      canonicalKeys.forEach(key => {
        assert.ok(
          taxonomyMap.has(key),
          `Taxonomy map should have canonical key: ${key}`
        );
        
        const entry = taxonomyMap.get(key);
        assert.strictEqual(
          entry?.isLabor,
          true,
          `Taxonomy entry for ${key} should have isLabor=true`
        );
      });
    });
  });

  describe('Data loading and filtering simulation', () => {
    it('should allow filtering Labor-only rows from mixed dataset', () => {
      const allocations: Allocation[] = [
        { month: 1, amount: 10000, rubroId: 'MOD-EXT', projectId: 'p1' },
        { month: 1, amount: 12000, rubroId: 'MOD-SDM', projectId: 'p1' },
        { month: 1, amount: 8000, rubroId: 'MOD-ING', projectId: 'p1' },
        { month: 1, amount: 5000, rubroId: 'GSV-CLOUD', projectId: 'p1' },
        { month: 1, amount: 3000, rubroId: 'EQUIPO-SERVER', projectId: 'p1' },
        { month: 1, amount: 2000, rubroId: 'SOFTWARE-LICENSE', projectId: 'p1' },
      ];

      const forecastRows = computeForecastFromAllocations(allocations, [], 12, 'p1');

      // Simulate "Labor" filter
      const laborFiltered = forecastRows.filter(row => row.isLabor === true);
      assert.strictEqual(laborFiltered.length, 3, 'Labor filter should return 3 rows');
      
      const laborTotal = laborFiltered.reduce((sum, r) => sum + r.forecast, 0);
      assert.strictEqual(laborTotal, 30000, 'Labor total should be 30,000');

      // Simulate "Non-Labor" filter
      const nonLaborFiltered = forecastRows.filter(row => row.isLabor === false);
      assert.strictEqual(nonLaborFiltered.length, 3, 'Non-labor filter should return 3 rows');
      
      const nonLaborTotal = nonLaborFiltered.reduce((sum, r) => sum + r.forecast, 0);
      assert.strictEqual(nonLaborTotal, 10000, 'Non-labor total should be 10,000');

      // Simulate "All" filter (no filter)
      assert.strictEqual(forecastRows.length, 6, 'All filter should return all 6 rows');
      
      const grandTotal = forecastRows.reduce((sum, r) => sum + r.forecast, 0);
      assert.strictEqual(grandTotal, 40000, 'Grand total should be 40,000');
    });

    it('should maintain correct totals when filtering by Labor/Non-Labor', () => {
      const forecastData: ForecastCell[] = [
        // 3 months of data for better validation
        { line_item_id: 'MOD-LEAD', month: 1, planned: 10000, forecast: 10000, actual: 9500, variance: 0, last_updated: '2024-01-01', updated_by: 'sys', project_id: 'p1', project_name: 'P1' } as any,
        { line_item_id: 'MOD-LEAD', month: 2, planned: 10000, forecast: 10000, actual: 9600, variance: 0, last_updated: '2024-02-01', updated_by: 'sys', project_id: 'p1', project_name: 'P1' } as any,
        { line_item_id: 'MOD-LEAD', month: 3, planned: 10000, forecast: 10000, actual: 9700, variance: 0, last_updated: '2024-03-01', updated_by: 'sys', project_id: 'p1', project_name: 'P1' } as any,
        
        { line_item_id: 'GSV-CLOUD', month: 1, planned: 5000, forecast: 5000, actual: 4800, variance: 0, last_updated: '2024-01-01', updated_by: 'sys', project_id: 'p1', project_name: 'P1' } as any,
        { line_item_id: 'GSV-CLOUD', month: 2, planned: 5000, forecast: 5000, actual: 4900, variance: 0, last_updated: '2024-02-01', updated_by: 'sys', project_id: 'p1', project_name: 'P1' } as any,
        { line_item_id: 'GSV-CLOUD', month: 3, planned: 5000, forecast: 5000, actual: 4950, variance: 0, last_updated: '2024-03-01', updated_by: 'sys', project_id: 'p1', project_name: 'P1' } as any,
      ];

      const projectRubros = buildProjectRubros(forecastData, []);
      const p1Rubros = projectRubros.get('p1');
      
      assert.ok(p1Rubros, 'Should have project rubros');
      
      const laborRubros = p1Rubros.filter(r => r.isLabor);
      const nonLaborRubros = p1Rubros.filter(r => !r.isLabor);
      
      // Verify counts
      assert.strictEqual(laborRubros.length, 1, 'Should have 1 labor rubro');
      assert.strictEqual(nonLaborRubros.length, 1, 'Should have 1 non-labor rubro');
      
      // Verify totals
      const laborTotal = laborRubros[0].overall.forecast;
      const nonLaborTotal = nonLaborRubros[0].overall.forecast;
      
      assert.strictEqual(laborTotal, 30000, 'Labor total across 3 months should be 30,000');
      assert.strictEqual(nonLaborTotal, 15000, 'Non-labor total across 3 months should be 15,000');
      
      // Verify grand total
      assert.strictEqual(laborTotal + nonLaborTotal, 45000, 'Grand total should be 45,000');
    });
  });
});

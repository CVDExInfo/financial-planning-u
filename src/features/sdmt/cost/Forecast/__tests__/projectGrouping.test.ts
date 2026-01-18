/**
 * Project Grouping Tests
 * Validates pure functions for grouping forecast data by project
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  buildProjectTotals,
  buildProjectRubros,
  type ProjectTotals,
  type ProjectRubro,
} from '../projectGrouping';
import type { ForecastCell, LineItem } from '@/types/domain';

describe('Project Grouping Utils', () => {
  describe('buildProjectTotals', () => {
    it('should group forecast data by project and compute totals', () => {
      const forecastData: ForecastCell[] = [
        {
          line_item_id: 'rubro1',
          month: 1,
          planned: 1000,
          forecast: 1100,
          actual: 900,
          variance: -200,
          last_updated: '2024-01-01',
          updated_by: 'user1',
          project_id: 'proj1',
          project_name: 'Project Alpha',
        } as any,
        {
          line_item_id: 'rubro2',
          month: 1,
          planned: 2000,
          forecast: 2200,
          actual: 1800,
          variance: -400,
          last_updated: '2024-01-01',
          updated_by: 'user1',
          project_id: 'proj1',
          project_name: 'Project Alpha',
        } as any,
        {
          line_item_id: 'rubro3',
          month: 2,
          planned: 1500,
          forecast: 1650,
          actual: 1400,
          variance: -250,
          last_updated: '2024-02-01',
          updated_by: 'user1',
          project_id: 'proj2',
          project_name: 'Project Beta',
        } as any,
      ];

      const result = buildProjectTotals(forecastData);

      // Should have 2 projects
      assert.strictEqual(result.size, 2);

      // Project 1 totals
      const proj1 = result.get('proj1');
      assert.ok(proj1);
      assert.strictEqual(proj1.projectId, 'proj1');
      assert.strictEqual(proj1.projectName, 'Project Alpha');
      assert.strictEqual(proj1.byMonth[1].forecast, 3300); // 1100 + 2200
      assert.strictEqual(proj1.byMonth[1].actual, 2700); // 900 + 1800
      assert.strictEqual(proj1.byMonth[1].planned, 3000); // 1000 + 2000
      assert.strictEqual(proj1.overall.forecast, 3300);
      assert.strictEqual(proj1.overall.actual, 2700);
      assert.strictEqual(proj1.overall.planned, 3000);
      assert.strictEqual(proj1.overall.varianceForecast, 300); // 3300 - 3000
      assert.strictEqual(proj1.overall.varianceActual, -300); // 2700 - 3000
      
      // percentConsumption = (actual / forecast) * 100 = (2700 / 3300) * 100
      const expectedPercent = (2700 / 3300) * 100;
      assert.ok(Math.abs(proj1.overall.percentConsumption - expectedPercent) < 0.01);

      // Project 2 totals
      const proj2 = result.get('proj2');
      assert.ok(proj2);
      assert.strictEqual(proj2.projectId, 'proj2');
      assert.strictEqual(proj2.projectName, 'Project Beta');
      assert.strictEqual(proj2.byMonth[2].forecast, 1650);
      assert.strictEqual(proj2.byMonth[2].actual, 1400);
      assert.strictEqual(proj2.overall.forecast, 1650);
      assert.strictEqual(proj2.overall.actual, 1400);
    });

    it('should handle empty forecast data', () => {
      const result = buildProjectTotals([]);
      assert.strictEqual(result.size, 0);
    });

    it('should handle cells without project_id (fallback to unknown-project)', () => {
      const forecastData: ForecastCell[] = [
        {
          line_item_id: 'rubro1',
          month: 1,
          planned: 1000,
          forecast: 1100,
          actual: 900,
          variance: -200,
          last_updated: '2024-01-01',
          updated_by: 'user1',
        } as any,
      ];

      const result = buildProjectTotals(forecastData);
      assert.strictEqual(result.size, 1);
      
      const unknownProj = result.get('unknown-project');
      assert.ok(unknownProj);
      assert.strictEqual(unknownProj.projectName, 'Unknown Project');
      assert.strictEqual(unknownProj.overall.forecast, 1100);
    });
  });

  describe('buildProjectRubros', () => {
    it('should group rubros by project and compute totals', () => {
      const forecastData: ForecastCell[] = [
        {
          line_item_id: 'rubro1',
          month: 1,
          planned: 1000,
          forecast: 1100,
          actual: 900,
          variance: -200,
          last_updated: '2024-01-01',
          updated_by: 'user1',
          project_id: 'proj1',
          project_name: 'Project Alpha',
        } as any,
        {
          line_item_id: 'rubro1',
          month: 2,
          planned: 1000,
          forecast: 1100,
          actual: 950,
          variance: -150,
          last_updated: '2024-02-01',
          updated_by: 'user1',
          project_id: 'proj1',
          project_name: 'Project Alpha',
        } as any,
        {
          line_item_id: 'rubro2',
          month: 1,
          planned: 2000,
          forecast: 2200,
          actual: 1800,
          variance: -400,
          last_updated: '2024-01-01',
          updated_by: 'user1',
          project_id: 'proj1',
          project_name: 'Project Alpha',
        } as any,
        {
          line_item_id: 'rubro3',
          month: 1,
          planned: 1500,
          forecast: 1650,
          actual: 1400,
          variance: -250,
          last_updated: '2024-01-01',
          updated_by: 'user1',
          project_id: 'proj2',
          project_name: 'Project Beta',
        } as any,
      ];

      const lineItems: LineItem[] = [
        {
          id: 'rubro1',
          description: 'Software License',
          category: 'IT Infrastructure',
        } as any,
        {
          id: 'rubro2',
          description: 'Cloud Services',
          category: 'IT Infrastructure',
        } as any,
        {
          id: 'rubro3',
          description: 'Consulting',
          category: 'Professional Services',
        } as any,
      ];

      const result = buildProjectRubros(forecastData, lineItems);

      // Should have 2 projects
      assert.strictEqual(result.size, 2);

      // Project 1 rubros
      const proj1Rubros = result.get('proj1');
      assert.ok(proj1Rubros);
      assert.strictEqual(proj1Rubros.length, 2); // rubro1 and rubro2

      // Find rubro1 in proj1
      const rubro1 = proj1Rubros.find(r => r.rubroId === 'rubro1');
      assert.ok(rubro1);
      assert.strictEqual(rubro1.description, 'Software License');
      assert.strictEqual(rubro1.projectId, 'proj1');
      assert.strictEqual(rubro1.projectName, 'Project Alpha');
      assert.strictEqual(rubro1.category, 'IT Infrastructure');
      assert.strictEqual(rubro1.byMonth[1].forecast, 1100);
      assert.strictEqual(rubro1.byMonth[2].forecast, 1100);
      assert.strictEqual(rubro1.overall.forecast, 2200); // 1100 + 1100
      assert.strictEqual(rubro1.overall.actual, 1850); // 900 + 950
      assert.strictEqual(rubro1.overall.planned, 2000); // 1000 + 1000
      assert.strictEqual(rubro1.overall.varianceForecast, 200); // 2200 - 2000
      assert.strictEqual(rubro1.overall.varianceActual, -150); // 1850 - 2000

      // Find rubro2 in proj1
      const rubro2 = proj1Rubros.find(r => r.rubroId === 'rubro2');
      assert.ok(rubro2);
      assert.strictEqual(rubro2.description, 'Cloud Services');
      assert.strictEqual(rubro2.overall.forecast, 2200);

      // Project 2 rubros
      const proj2Rubros = result.get('proj2');
      assert.ok(proj2Rubros);
      assert.strictEqual(proj2Rubros.length, 1); // only rubro3

      const rubro3 = proj2Rubros[0];
      assert.strictEqual(rubro3.rubroId, 'rubro3');
      assert.strictEqual(rubro3.description, 'Consulting');
      assert.strictEqual(rubro3.projectName, 'Project Beta');
      assert.strictEqual(rubro3.category, 'Professional Services');
    });

    it('should handle empty forecast data', () => {
      const result = buildProjectRubros([], []);
      assert.strictEqual(result.size, 0);
    });

    it('should use description from cell if line item not found', () => {
      const forecastData: ForecastCell[] = [
        {
          line_item_id: 'unknown-rubro',
          month: 1,
          planned: 1000,
          forecast: 1100,
          actual: 900,
          variance: -200,
          last_updated: '2024-01-01',
          updated_by: 'user1',
          project_id: 'proj1',
          project_name: 'Project Alpha',
          description: 'Cell Description',
        } as any,
      ];

      const result = buildProjectRubros(forecastData, []);
      
      const proj1Rubros = result.get('proj1');
      assert.ok(proj1Rubros);
      assert.strictEqual(proj1Rubros.length, 1);
      assert.strictEqual(proj1Rubros[0].description, 'Cell Description');
    });

    it('should use taxonomy fallback when line item and cell lack description', () => {
      const forecastData: ForecastCell[] = [
        {
          line_item_id: 'MOD-SDM',
          month: 1,
          planned: 1000,
          forecast: 1100,
          actual: 900,
          variance: -200,
          last_updated: '2024-01-01',
          updated_by: 'user1',
          project_id: 'proj1',
          project_name: 'Project Alpha',
        } as any,
      ];

      const taxonomyByRubroId = {
        'MOD-SDM': {
          description: 'Service Delivery Manager (SDM)',
          category: 'Mano de Obra Directa',
        },
      };

      const result = buildProjectRubros(forecastData, [], taxonomyByRubroId);
      
      const proj1Rubros = result.get('proj1');
      assert.ok(proj1Rubros);
      assert.strictEqual(proj1Rubros.length, 1);
      assert.strictEqual(proj1Rubros[0].description, 'Service Delivery Manager (SDM)');
      assert.strictEqual(proj1Rubros[0].category, 'Mano de Obra Directa');
    });

    it('should match line items by id, line_item_id, or rubroId', () => {
      const forecastData: ForecastCell[] = [
        {
          line_item_id: 'rubro-alt-id',
          month: 1,
          planned: 1000,
          forecast: 1100,
          actual: 900,
          variance: -200,
          last_updated: '2024-01-01',
          updated_by: 'user1',
          project_id: 'proj1',
          project_name: 'Project Alpha',
        } as any,
      ];

      // Line item has a different id but matches via rubroId field
      const lineItems: LineItem[] = [
        {
          id: 'different-id',
          rubroId: 'rubro-alt-id',
          description: 'Matched by rubroId',
          category: 'Test Category',
        } as any,
      ];

      const result = buildProjectRubros(forecastData, lineItems);
      
      const proj1Rubros = result.get('proj1');
      assert.ok(proj1Rubros);
      assert.strictEqual(proj1Rubros.length, 1);
      assert.strictEqual(proj1Rubros[0].description, 'Matched by rubroId');
    });

    it('should default to "Allocation {rubroId}" description if not found anywhere', () => {
      const forecastData: ForecastCell[] = [
        {
          line_item_id: 'unknown-rubro',
          month: 1,
          planned: 1000,
          forecast: 1100,
          actual: 900,
          variance: -200,
          last_updated: '2024-01-01',
          updated_by: 'user1',
          project_id: 'proj1',
          project_name: 'Project Alpha',
        } as any,
      ];

      const result = buildProjectRubros(forecastData, []);
      
      const proj1Rubros = result.get('proj1');
      assert.ok(proj1Rubros);
      assert.strictEqual(proj1Rubros.length, 1);
      assert.strictEqual(proj1Rubros[0].description, 'Allocation unknown-rubro');
    });

    it('should classify canonical labor keys as labor with isLabor flag', () => {
      const forecastData: ForecastCell[] = [
        {
          line_item_id: 'MOD-EXT',
          month: 1,
          planned: 1000,
          forecast: 1100,
          actual: 900,
          variance: -200,
          last_updated: '2024-01-01',
          updated_by: 'user1',
          project_id: 'proj1',
          project_name: 'Project Alpha',
        } as any,
        {
          line_item_id: 'MOD-SDM',
          month: 1,
          planned: 2000,
          forecast: 2200,
          actual: 1800,
          variance: -400,
          last_updated: '2024-01-01',
          updated_by: 'user1',
          project_id: 'proj1',
          project_name: 'Project Alpha',
        } as any,
        {
          line_item_id: 'GSV-CLOUD',
          month: 1,
          planned: 500,
          forecast: 550,
          actual: 450,
          variance: -100,
          last_updated: '2024-01-01',
          updated_by: 'user1',
          project_id: 'proj1',
          project_name: 'Project Alpha',
        } as any,
      ];

      const result = buildProjectRubros(forecastData, []);
      
      const proj1Rubros = result.get('proj1');
      assert.ok(proj1Rubros);
      assert.strictEqual(proj1Rubros.length, 3);

      // MOD-EXT should be labor
      const modExt = proj1Rubros.find(r => r.rubroId === 'MOD-EXT');
      assert.ok(modExt);
      assert.strictEqual(modExt.isLabor, true);

      // MOD-SDM should be labor
      const modSdm = proj1Rubros.find(r => r.rubroId === 'MOD-SDM');
      assert.ok(modSdm);
      assert.strictEqual(modSdm.isLabor, true);

      // GSV-CLOUD should not be labor
      const gsvCloud = proj1Rubros.find(r => r.rubroId === 'GSV-CLOUD');
      assert.ok(gsvCloud);
      assert.strictEqual(gsvCloud.isLabor, false);
    });

    it('should use isLabor flag from taxonomy when provided', () => {
      const forecastData: ForecastCell[] = [
        {
          line_item_id: 'CUSTOM-LABOR',
          month: 1,
          planned: 1000,
          forecast: 1100,
          actual: 900,
          variance: -200,
          last_updated: '2024-01-01',
          updated_by: 'user1',
          project_id: 'proj1',
          project_name: 'Project Alpha',
        } as any,
      ];

      const taxonomyByRubroId = {
        'CUSTOM-LABOR': {
          description: 'Custom Labor Role',
          category: 'Custom Category',
          isLabor: true,
        },
      };

      const result = buildProjectRubros(forecastData, [], taxonomyByRubroId);
      
      const proj1Rubros = result.get('proj1');
      assert.ok(proj1Rubros);
      assert.strictEqual(proj1Rubros.length, 1);
      assert.strictEqual(proj1Rubros[0].isLabor, true);
      assert.strictEqual(proj1Rubros[0].description, 'Custom Labor Role');
    });

    it('should classify by category when isLabor not explicitly set', () => {
      const forecastData: ForecastCell[] = [
        {
          line_item_id: 'SOME-ROLE',
          month: 1,
          planned: 1000,
          forecast: 1100,
          actual: 900,
          variance: -200,
          last_updated: '2024-01-01',
          updated_by: 'user1',
          project_id: 'proj1',
          project_name: 'Project Alpha',
        } as any,
      ];

      const taxonomyByRubroId = {
        'SOME-ROLE': {
          description: 'Some Role',
          category: 'Mano de Obra Directa',
        },
      };

      const result = buildProjectRubros(forecastData, [], taxonomyByRubroId);
      
      const proj1Rubros = result.get('proj1');
      assert.ok(proj1Rubros);
      assert.strictEqual(proj1Rubros.length, 1);
      // Should detect labor from category
      assert.strictEqual(proj1Rubros[0].isLabor, true);
      assert.strictEqual(proj1Rubros[0].category, 'Mano de Obra Directa');
    });
  });
});

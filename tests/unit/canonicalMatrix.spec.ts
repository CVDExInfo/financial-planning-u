/**
 * canonicalMatrix.spec.ts
 * 
 * Unit tests for canonical matrix module
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  buildCanonicalMatrix,
  deriveKpisFromMatrix,
  type CanonicalMatrixRow,
} from '../../src/features/sdmt/cost/utils/canonicalMatrix';
import type { ForecastCell, InvoiceDoc, LineItem } from '../../src/types/domain.d';

describe('canonicalMatrix', () => {
  describe('buildCanonicalMatrix', () => {
    it('should build matrix from forecast payloads', () => {
      const forecastPayloads = [
        {
          projectId: 'proj1',
          data: [
            {
              line_item_id: 'labor_001',
              month: 1,
              planned: 1000,
              forecast: 1100,
              actual: 900,
              variance: 100,
              last_updated: '2024-01-15',
              updated_by: 'user1',
            },
            {
              line_item_id: 'labor_001',
              month: 2,
              planned: 1000,
              forecast: 1050,
              actual: 950,
              variance: 50,
              last_updated: '2024-02-15',
              updated_by: 'user1',
            },
          ] as ForecastCell[],
        },
      ];
      
      const result = buildCanonicalMatrix({
        projects: [{ id: 'proj1', name: 'Project 1' }],
        forecastPayloads,
        monthsToShow: 12,
      });
      
      assert.strictEqual(result.matrixRows.length, 1);
      assert.strictEqual(result.matrixRows[0].projectId, 'proj1');
      assert.strictEqual(result.matrixRows[0].lineItemId, 'labor_001');
      assert.strictEqual((result.matrixRows[0] as any).month_1_planned, 1000);
      assert.strictEqual((result.matrixRows[0] as any).month_1_forecast, 1100);
      assert.strictEqual((result.matrixRows[0] as any).month_2_planned, 1000);
      assert.strictEqual((result.matrixRows[0] as any).month_2_forecast, 1050);
    });
    
    it('should reconcile invoices into actual values', () => {
      const forecastPayloads = [
        {
          projectId: 'proj1',
          data: [
            {
              line_item_id: 'labor_001',
              month: 1,
              planned: 1000,
              forecast: 1100,
              actual: 0,
              variance: 100,
              last_updated: '2024-01-15',
              updated_by: 'user1',
            },
          ] as ForecastCell[],
        },
      ];
      
      const invoices = [
        {
          id: 'inv1',
          line_item_id: 'labor_001',
          month: 1,
          amount: 950,
          currency: 'USD' as const,
          status: 'Matched' as const,
          uploaded_by: 'user1',
          uploaded_at: '2024-01-20',
          matched_at: '2024-01-21',
          matched_by: 'user2',
        },
      ] as InvoiceDoc[];
      
      const result = buildCanonicalMatrix({
        projects: [{ id: 'proj1', name: 'Project 1' }],
        forecastPayloads,
        invoices,
        monthsToShow: 12,
      });
      
      assert.strictEqual(result.matrixRows.length, 1);
      assert.strictEqual((result.matrixRows[0] as any).month_1_actual, 950);
    });
    
    it('should combine allocations for fallback data', () => {
      const forecastPayloads = [
        {
          projectId: 'proj1',
          data: [] as ForecastCell[],
        },
      ];
      
      const allocations = [
        {
          month: '2024-01',
          amount: 5000,
          rubroId: 'labor_002',
          projectId: 'proj1',
          rubro_type: 'Labor',
        },
        {
          month: '2024-02',
          amount: 5500,
          rubroId: 'labor_002',
          projectId: 'proj1',
          rubro_type: 'Labor',
        },
      ];
      
      const result = buildCanonicalMatrix({
        projects: [{ id: 'proj1', name: 'Project 1' }],
        forecastPayloads,
        allocations,
        monthsToShow: 12,
      });
      
      assert.strictEqual(result.matrixRows.length, 1);
      assert.strictEqual(result.matrixRows[0].rubroId, 'labor_002');
      assert.strictEqual((result.matrixRows[0] as any).month_1_planned, 5000);
      assert.strictEqual((result.matrixRows[0] as any).month_2_planned, 5500);
    });
    
    it('should deduplicate rows by canonical keys', () => {
      const forecastPayloads = [
        {
          projectId: 'proj1',
          data: [
            {
              line_item_id: 'labor_001',
              month: 1,
              planned: 1000,
              forecast: 1100,
              actual: 900,
              variance: 100,
              last_updated: '2024-01-15',
              updated_by: 'user1',
            },
            {
              line_item_id: 'LABOR_001', // Different case, should deduplicate
              month: 2,
              planned: 1000,
              forecast: 1050,
              actual: 950,
              variance: 50,
              last_updated: '2024-02-15',
              updated_by: 'user1',
            },
          ] as ForecastCell[],
        },
      ];
      
      const result = buildCanonicalMatrix({
        projects: [{ id: 'proj1', name: 'Project 1' }],
        forecastPayloads,
        monthsToShow: 12,
      });
      
      // Should have only one row (deduplicated)
      assert.strictEqual(result.matrixRows.length, 1);
      assert.strictEqual((result.matrixRows[0] as any).month_1_planned, 1000);
      assert.strictEqual((result.matrixRows[0] as any).month_2_planned, 1000);
    });
    
    it('should compute totals correctly', () => {
      const forecastPayloads = [
        {
          projectId: 'proj1',
          data: [
            {
              line_item_id: 'labor_001',
              month: 1,
              planned: 1000,
              forecast: 1100,
              actual: 900,
              variance: 100,
              last_updated: '2024-01-15',
              updated_by: 'user1',
            },
            {
              line_item_id: 'labor_002',
              month: 1,
              planned: 2000,
              forecast: 2200,
              actual: 1900,
              variance: 200,
              last_updated: '2024-01-15',
              updated_by: 'user1',
            },
          ] as ForecastCell[],
        },
      ];
      
      const result = buildCanonicalMatrix({
        projects: [{ id: 'proj1', name: 'Project 1' }],
        forecastPayloads,
        monthsToShow: 12,
      });
      
      assert.strictEqual(result.totals.byMonth[0].planned, 3000);
      assert.strictEqual(result.totals.byMonth[0].forecast, 3300);
      assert.strictEqual(result.totals.byMonth[0].actual, 2800);
      assert.strictEqual(result.totals.overall.planned, 3000);
      assert.strictEqual(result.totals.overall.forecast, 3300);
      assert.strictEqual(result.totals.overall.actual, 2800);
    });
  });
  
  describe('Portfolio fixtures', () => {
    it('should handle multiple projects with allocations', () => {
      // Portfolio fixture with multiple projects and allocations
      const forecastPayloads = [
        {
          projectId: 'proj1',
          data: [
            {
              line_item_id: 'labor_001',
              month: 1,
              planned: 5000,
              forecast: 5500,
              actual: 5200,
              variance: 500,
              last_updated: '2024-01-15',
              updated_by: 'user1',
            },
            {
              line_item_id: 'labor_001',
              month: 2,
              planned: 5000,
              forecast: 5300,
              actual: 5100,
              variance: 300,
              last_updated: '2024-02-15',
              updated_by: 'user1',
            },
          ] as ForecastCell[],
        },
        {
          projectId: 'proj2',
          data: [
            {
              line_item_id: 'labor_002',
              month: 1,
              planned: 3000,
              forecast: 3200,
              actual: 2900,
              variance: 200,
              last_updated: '2024-01-15',
              updated_by: 'user2',
            },
            {
              line_item_id: 'labor_002',
              month: 2,
              planned: 3000,
              forecast: 3100,
              actual: 2950,
              variance: 100,
              last_updated: '2024-02-15',
              updated_by: 'user2',
            },
          ] as ForecastCell[],
        },
      ];
      
      const allocations = [
        {
          month: '2024-03',
          amount: 4500,
          rubroId: 'labor_003',
          projectId: 'proj1',
          rubro_type: 'Labor',
        },
        {
          month: '2024-03',
          amount: 2500,
          rubroId: 'labor_004',
          projectId: 'proj2',
          rubro_type: 'Labor',
        },
      ];
      
      const result = buildCanonicalMatrix({
        projects: [
          { id: 'proj1', name: 'Project 1' },
          { id: 'proj2', name: 'Project 2' },
        ],
        forecastPayloads,
        allocations,
        monthsToShow: 12,
      });
      
      // Should have 4 rows (2 from proj1, 2 from proj2)
      assert.strictEqual(result.matrixRows.length, 4);
      
      // Verify month_ fields are present
      const proj1Labor001 = result.matrixRows.find(r => r.projectId === 'proj1' && r.lineItemId === 'labor_001');
      assert.ok(proj1Labor001, 'Should have labor_001 from proj1');
      assert.strictEqual((proj1Labor001 as any).month_1_planned, 5000, 'month_1_planned should match');
      assert.strictEqual((proj1Labor001 as any).month_1_forecast, 5500, 'month_1_forecast should match');
      assert.strictEqual((proj1Labor001 as any).month_1_actual, 5200, 'month_1_actual should match');
      assert.strictEqual((proj1Labor001 as any).month_2_planned, 5000, 'month_2_planned should match');
      assert.strictEqual((proj1Labor001 as any).month_2_forecast, 5300, 'month_2_forecast should match');
      
      const proj2Labor002 = result.matrixRows.find(r => r.projectId === 'proj2' && r.lineItemId === 'labor_002');
      assert.ok(proj2Labor002, 'Should have labor_002 from proj2');
      assert.strictEqual((proj2Labor002 as any).month_1_planned, 3000, 'month_1_planned should match');
      assert.strictEqual((proj2Labor002 as any).month_1_forecast, 3200, 'month_1_forecast should match');
      
      // Verify allocation-based rows
      const proj1Labor003 = result.matrixRows.find(r => r.projectId === 'proj1' && r.rubroId === 'labor_003');
      assert.ok(proj1Labor003, 'Should have labor_003 from proj1 allocation');
      assert.strictEqual((proj1Labor003 as any).month_3_planned, 4500, 'month_3_planned from allocation should match');
      
      const proj2Labor004 = result.matrixRows.find(r => r.projectId === 'proj2' && r.rubroId === 'labor_004');
      assert.ok(proj2Labor004, 'Should have labor_004 from proj2 allocation');
      assert.strictEqual((proj2Labor004 as any).month_3_planned, 2500, 'month_3_planned from allocation should match');
      
      // Verify project index
      assert.ok(result.projectIndex['proj1'], 'Project index should have proj1');
      assert.ok(result.projectIndex['proj2'], 'Project index should have proj2');
      assert.strictEqual(result.projectIndex['proj1'].name, 'Project 1', 'Project name should match');
      assert.strictEqual(result.projectIndex['proj2'].name, 'Project 2', 'Project name should match');
    });
    
    it('should aggregate totals across multiple projects', () => {
      const forecastPayloads = [
        {
          projectId: 'proj1',
          data: [
            {
              line_item_id: 'labor_001',
              month: 1,
              planned: 1000,
              forecast: 1100,
              actual: 1050,
              variance: 100,
              last_updated: '2024-01-15',
              updated_by: 'user1',
            },
          ] as ForecastCell[],
        },
        {
          projectId: 'proj2',
          data: [
            {
              line_item_id: 'labor_002',
              month: 1,
              planned: 2000,
              forecast: 2200,
              actual: 2100,
              variance: 200,
              last_updated: '2024-01-15',
              updated_by: 'user2',
            },
          ] as ForecastCell[],
        },
        {
          projectId: 'proj3',
          data: [
            {
              line_item_id: 'labor_003',
              month: 1,
              planned: 3000,
              forecast: 3300,
              actual: 3200,
              variance: 300,
              last_updated: '2024-01-15',
              updated_by: 'user3',
            },
          ] as ForecastCell[],
        },
      ];
      
      const result = buildCanonicalMatrix({
        projects: [
          { id: 'proj1', name: 'Project 1' },
          { id: 'proj2', name: 'Project 2' },
          { id: 'proj3', name: 'Project 3' },
        ],
        forecastPayloads,
        monthsToShow: 12,
      });
      
      // Verify aggregated totals across all projects
      assert.strictEqual(result.totals.byMonth[0].planned, 6000, 'Total month 1 planned should be sum of all projects');
      assert.strictEqual(result.totals.byMonth[0].forecast, 6600, 'Total month 1 forecast should be sum of all projects');
      assert.strictEqual(result.totals.byMonth[0].actual, 6350, 'Total month 1 actual should be sum of all projects');
      assert.strictEqual(result.totals.overall.planned, 6000, 'Total overall planned should match');
      assert.strictEqual(result.totals.overall.forecast, 6600, 'Total overall forecast should match');
      assert.strictEqual(result.totals.overall.actual, 6350, 'Total overall actual should match');
    });
  });
  
  describe('deriveKpisFromMatrix', () => {
    it('should derive KPIs from matrix rows', () => {
      const matrixRows = [
        {
          projectId: 'proj1',
          rubroId: 'labor_001',
          lineItemId: 'labor_001',
          costType: 'labor',
          month_1_planned: 1000,
          month_1_forecast: 1100,
          month_1_actual: 900,
          month_2_planned: 1000,
          month_2_forecast: 1050,
          month_2_actual: 950,
        },
        {
          projectId: 'proj1',
          rubroId: 'labor_002',
          lineItemId: 'labor_002',
          costType: 'labor',
          month_1_planned: 2000,
          month_1_forecast: 2200,
          month_1_actual: 1900,
          month_2_planned: 2000,
          month_2_forecast: 2100,
          month_2_actual: 1950,
        },
      ] as CanonicalMatrixRow[];
      
      const kpis = deriveKpisFromMatrix(matrixRows, 2);
      
      assert.strictEqual(kpis.presupuesto, 6000); // 1000 + 1000 + 2000 + 2000
      assert.strictEqual(kpis.pronostico, 6450); // 1100 + 1050 + 2200 + 2100
      assert.strictEqual(kpis.real, 5700); // 900 + 950 + 1900 + 1950
      assert.strictEqual(kpis.varianza, 450); // 6450 - 6000
      assert.ok(Math.abs(kpis.consumo - 95) < 0.1); // 5700/6000 * 100 = 95
    });
    
    it('should handle zero presupuesto', () => {
      const matrixRows = [
        {
          projectId: 'proj1',
          rubroId: 'labor_001',
          lineItemId: 'labor_001',
          costType: 'labor',
          month_1_planned: 0,
          month_1_forecast: 1100,
          month_1_actual: 900,
        },
      ] as CanonicalMatrixRow[];
      
      const kpis = deriveKpisFromMatrix(matrixRows, 1);
      
      assert.strictEqual(kpis.presupuesto, 0);
      assert.strictEqual(kpis.pronostico, 1100);
      assert.strictEqual(kpis.real, 900);
      assert.strictEqual(kpis.consumo, 0); // Should not divide by zero
    });
    
    it('should handle empty matrix', () => {
      const kpis = deriveKpisFromMatrix([], 12);
      
      assert.strictEqual(kpis.presupuesto, 0);
      assert.strictEqual(kpis.pronostico, 0);
      assert.strictEqual(kpis.real, 0);
      assert.strictEqual(kpis.consumo, 0);
      assert.strictEqual(kpis.varianza, 0);
    });
  });
});

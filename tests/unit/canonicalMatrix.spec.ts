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

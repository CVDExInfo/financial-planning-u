/**
 * Unit tests for forecast fallback path
 * 
 * Validates that when forecast is empty but allocations exist,
 * the grid still shows month totals computed from allocations.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import type { AmortizationType, Currency, IndexationPolicy } from '@/types/domain';
import { computeForecastFromAllocations, type Allocation } from '../computeForecastFromAllocations';
import type { LineItem } from '@/types/domain';

describe('Forecast Fallback Logic', () => {
  describe('computeForecastFromAllocations', () => {
    it('should create forecast cells from allocation data', () => {
      // Mock allocation data from /allocations endpoint
      const allocations: Allocation[] = [
        {
          month: '2025-01',
          amount: 50000,
          rubroId: 'MOD-001',
          rubro_type: 'MOD',
          projectId: 'proj-123',
        },
        {
          month: '2025-02',
          amount: 52000,
          rubroId: 'MOD-001',
          rubro_type: 'MOD',
          projectId: 'proj-123',
        },
        {
          month: '2025-01',
          amount: 10000,
          rubroId: 'INFRA-001',
          rubro_type: 'Infrastructure',
          projectId: 'proj-123',
        },
      ];

      // Mock rubros data for enrichment
      const rubros = [
        {
          id: 'MOD-001',
          description: 'Software Engineers',
          category: 'Mano de Obra Directa',
          unit_cost: 5000,
          qty: 10,
          currency: 'USD' as Currency,
          one_time: false,
          recurring: true,
          start_month: 1,
          end_month: 12,
          amortization: 'none' as AmortizationType,
          capex_flag: false,
          indexation_policy: 'none' as IndexationPolicy,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
          created_by: 'test-user',
        },
        {
          id: 'INFRA-001',
          description: 'Cloud Infrastructure',
          category: 'Infrastructure',
          unit_cost: 10000,
          qty: 1,
          currency: 'USD' as Currency,
          one_time: false,
          recurring: true,
          start_month: 1,
          end_month: 12,
          amortization: 'none' as AmortizationType,
          capex_flag: false,
          indexation_policy: 'none' as IndexationPolicy,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
          created_by: 'test-user',
        },
      ] as LineItem[];

      // Import the actual function to test
      // Note: This function is currently private in useSDMTForecastData
      // For testing, we'll create a standalone version
      
      // Test implementation (simplified for unit test)
      const cells = computeForecastFromAllocations(allocations, rubros, 12, 'proj-123');
      
      // Should create 3 forecast cells (2 for MOD-001, 1 for INFRA-001)
      assert.strictEqual(cells.length, 3);
      
      // Check MOD-001 January cell
      const mod001Jan = cells.find(c => c.rubroId === 'MOD-001' && c.month === 1);
      assert.ok(mod001Jan, 'Should have MOD-001 January cell');
      assert.strictEqual(mod001Jan.planned, 50000);
      assert.strictEqual(mod001Jan.forecast, 50000);
      assert.strictEqual(mod001Jan.description, 'Software Engineers');
      assert.strictEqual(mod001Jan.category, 'Mano de Obra Directa');
      
      // Check MOD-001 February cell
      const mod001Feb = cells.find(c => c.rubroId === 'MOD-001' && c.month === 2);
      assert.ok(mod001Feb, 'Should have MOD-001 February cell');
      assert.strictEqual(mod001Feb.planned, 52000);
      assert.strictEqual(mod001Feb.forecast, 52000);
      
      // Check INFRA-001 January cell
      const infraJan = cells.find(c => c.rubroId === 'INFRA-001' && c.month === 1);
      assert.ok(infraJan, 'Should have INFRA-001 January cell');
      assert.strictEqual(infraJan.planned, 10000);
      assert.strictEqual(infraJan.forecast, 10000);
      assert.strictEqual(infraJan.description, 'Cloud Infrastructure');
    });

    it('should resolve projectId from allocations when not provided', () => {
      const allocations: Allocation[] = [
        { month: '2025-01', amount: 100000, rubroId: 'MOD-001', projectId: 'proj-123' },
      ];
      const rubros: any[] = [];
      const cells = computeForecastFromAllocations(allocations, rubros, 12);
      assert.strictEqual(cells[0].projectId, 'proj-123');
    });

    it('should handle numeric month format', () => {
      const allocations = [
        {
          month: 3, // Numeric month
          amount: 25000,
          rubroId: 'TEST-001',
          projectId: 'proj-123',
        },
      ];

      const rubros: any[] = [];
      const cells = computeForecastFromAllocations(allocations, rubros, 12, 'proj-123');
      
      assert.strictEqual(cells.length, 1);
      assert.strictEqual(cells[0].month, 3);
      assert.strictEqual(cells[0].planned, 25000);
    });

    it('should aggregate multiple allocations for same rubro/month', () => {
      const allocations = [
        {
          month: '2025-01',
          amount: 30000,
          rubroId: 'MOD-001',
          projectId: 'proj-123',
        },
        {
          month: '2025-01',
          amount: 20000,
          rubroId: 'MOD-001',
          projectId: 'proj-123',
        },
      ];

      const rubros: any[] = [];
      const cells = computeForecastFromAllocations(allocations, rubros, 12, 'proj-123');
      
      // Should aggregate into single cell with combined amount
      assert.strictEqual(cells.length, 1);
      assert.strictEqual(cells[0].planned, 50000);
      assert.strictEqual(cells[0].forecast, 50000);
    });

    it('should handle allocations without matching rubros', () => {
      const allocations = [
        {
          month: '2025-01',
          amount: 15000,
          rubroId: 'UNKNOWN-001',
          projectId: 'proj-123',
        },
      ];

      const rubros: any[] = []; // No matching rubro
      const cells = computeForecastFromAllocations(allocations, rubros, 12, 'proj-123');
      
      assert.strictEqual(cells.length, 1);
      assert.strictEqual(cells[0].rubroId, 'UNKNOWN-001');
      assert.ok(cells[0].description.includes('Allocation'));
      assert.strictEqual(cells[0].category, 'Allocations');
    });

    it('should return empty array when allocations are empty', () => {
      const cells = computeForecastFromAllocations([], [], 12, 'proj-123');
      assert.strictEqual(cells.length, 0);
    });

    it('should filter out invalid months', () => {
      const allocations = [
        {
          month: '2025-00', // Invalid (month 0)
          amount: 10000,
          rubroId: 'TEST-001',
          projectId: 'proj-123',
        },
        {
          month: '2025-13', // Invalid (month 13)
          amount: 10000,
          rubroId: 'TEST-002',
          projectId: 'proj-123',
        },
        {
          month: '2025-06', // Valid
          amount: 10000,
          rubroId: 'TEST-003',
          projectId: 'proj-123',
        },
      ];

      const rubros: any[] = [];
      const cells = computeForecastFromAllocations(allocations, rubros, 12, 'proj-123');
      
      // Only the valid month should be included
      assert.strictEqual(cells.length, 1);
      assert.strictEqual(cells[0].month, 6);
    });
  });

  describe('Grid display with allocations fallback', () => {
    it('should display month totals when forecast is empty but allocations exist', () => {
      // This is an integration test scenario:
      // 1. GET /forecast returns empty array or null
      // 2. GET /rubros returns line items
      // 3. GET /allocations returns allocation data
      // 4. Forecast grid should show month totals from allocations
      
      const emptyForecast: any[] = [];
      const allocations = [
        { month: '2025-01', amount: 100000, rubroId: 'MOD-001', projectId: 'proj-123' },
        { month: '2025-01', amount: 20000, rubroId: 'INFRA-001', projectId: 'proj-123' },
        { month: '2025-02', amount: 105000, rubroId: 'MOD-001', projectId: 'proj-123' },
      ];
      
      const cells = computeForecastFromAllocations(allocations, [], 12, 'proj-123');
      
      // Verify we can compute totals by month
      const monthTotals = new Map<number, number>();
      cells.forEach(cell => {
        const currentTotal = monthTotals.get(cell.month) || 0;
        monthTotals.set(cell.month, currentTotal + cell.planned);
      });
      
      // January total should be 120000 (100000 + 20000)
      assert.strictEqual(monthTotals.get(1), 120000);
      
      // February total should be 105000
      assert.strictEqual(monthTotals.get(2), 105000);
      
      // Grid can display these totals
      assert.ok(cells.length > 0, 'Cells should be generated for grid display');
    });
  });
});

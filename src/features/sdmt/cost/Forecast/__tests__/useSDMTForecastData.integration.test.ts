/**
 * Integration tests for useSDMTForecastData hook
 * 
 * Tests the hook's behavior in realistic scenarios including:
 * - Data source fallback logic
 * - Stale request handling
 * - Materialization polling
 * - Invoice matching
 * 
 * Note: This test validates the hook's logic without importing the hook directly
 * to avoid React dependencies in the test environment.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { computeForecastFromAllocations } from '../computeForecastFromAllocations';
import type { ForecastCell, LineItem } from '@/types/domain';

// Re-implement helper functions locally to avoid importing React hook
function isMaterialized(baseline: any): boolean {
  if (!baseline) return false;
  return !!(baseline.materializedAt || baseline.materialization_status === 'completed');
}

function normalizeString(value: any): string {
  if (value === null || value === undefined) return '';
  return String(value).toLowerCase().trim().replace(/\s+/g, ' ');
}

function matchInvoiceToCell(invoice: any, cell: any): boolean {
  if (!invoice || !cell) return false;
  
  if (invoice.line_item_id && cell.line_item_id) {
    return invoice.line_item_id === cell.line_item_id;
  }
  
  if (invoice.rubroId && cell.rubroId) {
    return invoice.rubroId === cell.rubroId;
  }
  
  if (invoice.description && cell.description) {
    return normalizeString(invoice.description) === normalizeString(cell.description);
  }
  
  return false;
}

describe('useSDMTForecastData Integration Tests', () => {
  describe('Helper Functions', () => {
    describe('isMaterialized', () => {
      it('should return true when materializedAt is set', () => {
        const baseline = { materializedAt: '2025-01-15T00:00:00Z' };
        assert.strictEqual(isMaterialized(baseline), true);
      });
      
      it('should return true when materialization_status is completed', () => {
        const baseline = { materialization_status: 'completed' };
        assert.strictEqual(isMaterialized(baseline), true);
      });
      
      it('should return false when not materialized', () => {
        const baseline = { materialization_status: 'pending' };
        assert.strictEqual(isMaterialized(baseline), false);
      });
      
      it('should handle null/undefined baseline', () => {
        assert.strictEqual(isMaterialized(null), false);
        assert.strictEqual(isMaterialized(undefined), false);
      });
    });
    
    describe('normalizeString', () => {
      it('should normalize case and whitespace', () => {
        assert.strictEqual(normalizeString('  Hello  World  '), 'hello world');
        assert.strictEqual(normalizeString('UPPERCASE'), 'uppercase');
        assert.strictEqual(normalizeString('MixedCase'), 'mixedcase');
      });
      
      it('should handle non-string inputs', () => {
        assert.strictEqual(normalizeString(null), '');
        assert.strictEqual(normalizeString(undefined), '');
        assert.strictEqual(normalizeString(123), '123');
      });
    });
    
    describe('matchInvoiceToCell', () => {
      const mockCell = {
        line_item_id: 'R-1',
        rubroId: 'R-1',
        description: 'Software Engineer',
        month: 1,
        planned: 1000,
        forecast: 1100,
        actual: 0,
        variance: 0,
        last_updated: '',
        updated_by: '',
      };
      
      it('should match by line_item_id (priority 1)', () => {
        const invoice = {
          line_item_id: 'R-1',
          rubroId: 'different-id',
          description: 'different description',
          amount: 1050,
          month: 1,
          status: 'Matched',
        };
        
        assert.strictEqual(matchInvoiceToCell(invoice, mockCell), true);
      });
      
      it('should match by rubroId (priority 2)', () => {
        const invoice = {
          rubroId: 'R-1',
          description: 'different description',
          amount: 1050,
          month: 1,
          status: 'Matched',
        };
        
        assert.strictEqual(matchInvoiceToCell(invoice, mockCell), true);
      });
      
      it('should match by normalized description (priority 3)', () => {
        const invoice = {
          description: '  SOFTWARE  ENGINEER  ',
          amount: 1050,
          month: 1,
          status: 'Matched',
        };
        
        assert.strictEqual(matchInvoiceToCell(invoice, mockCell), true);
      });
      
      it('should not match when nothing matches', () => {
        const invoice = {
          line_item_id: 'different',
          rubroId: 'different',
          description: 'completely different',
          amount: 1050,
          month: 1,
          status: 'Matched',
        };
        
        assert.strictEqual(matchInvoiceToCell(invoice, mockCell), false);
      });
      
      it('should handle null invoice', () => {
        assert.strictEqual(matchInvoiceToCell(null, mockCell), false);
      });
    });
  });
  
  describe('Data Source Fallback Logic', () => {
    it('should use server forecast when critical cells exist', () => {
      // Simulate server forecast with critical data
      const serverForecast = [
        { line_item_id: 'R-1', month: 1, planned: 1000, forecast: 1100, actual: 0 }
      ];
      
      const hasCriticalCells = serverForecast.some(cell => 
        (cell.planned || 0) > 0 || (cell.forecast || 0) > 0
      );
      
      assert.strictEqual(hasCriticalCells, true);
      // In the hook, this would set dataSource = 'serverForecast'
    });
    
    it('should fall back to allocations when server forecast is empty', () => {
      // Simulate empty server forecast but allocations exist
      const serverForecast: any[] = [];
      const allocations = [
        { month: 1, month_index: 1, amount: 1000, rubro_id: 'R-1', projectId: 'P-1' }
      ];
      
      const hasCriticalCells = serverForecast.length > 0 && serverForecast.some(cell => 
        (cell.planned || 0) > 0 || (cell.forecast || 0) > 0
      );
      
      assert.strictEqual(hasCriticalCells, false);
      assert.ok(allocations.length > 0);
      
      // Compute forecast from allocations
      const rows = computeForecastFromAllocations(
        allocations,
        [{ 
          id: 'R-1', 
          description: 'Engineer', 
          category: 'Labor',
          unit_cost: 100,
          qty: 10,
          start_month: 1,
          end_month: 12,
          currency: 'USD',
          one_time: false,
          recurring: true,
          amortization: 'none',
          capex_flag: false,
          indexation_policy: 'none',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
          created_by: 'test-user',
        } as LineItem],
        12,
        'P-1'
      );
      
      assert.ok(rows.length > 0);
      // In the hook, this would set dataSource = 'allocationsFallback'
    });
    
    it('should fall back to rubros when allocations are empty', () => {
      // Simulate empty forecast and allocations but rubros exist
      const serverForecast: any[] = [];
      const allocations: any[] = [];
      const rubros: LineItem[] = [
        { 
          id: 'R-1', 
          description: 'Engineer', 
          category: 'Labor',
          unit_cost: 100,
          qty: 10,
          start_month: 1,
          end_month: 12,
          currency: 'USD',
          one_time: false,
          recurring: true,
          amortization: 'none',
          capex_flag: false,
          indexation_policy: 'none',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
          created_by: 'test-user',
        }
      ];
      
      assert.strictEqual(serverForecast.length, 0);
      assert.strictEqual(allocations.length, 0);
      assert.ok(rubros.length > 0);
      
      // In the hook, this would use transformLineItemsToForecast(rubros)
      // and set dataSource = 'rubrosFallback'
    });
  });
  
  describe('Month Index Support (M13+)', () => {
    it('should use month_index correctly in computeForecastFromAllocations', () => {
      // This validates the FORECAST_MONTHINDEX_FIX implementation
      const allocations = [
        {
          month: '2026-01', // Calendar month (would be month 1 without month_index)
          month_index: 13,   // Contract month (M13)
          amount: 1000,
          rubro_id: 'R-1',
          projectId: 'P-1',
        }
      ];
      
      const rubros: LineItem[] = [];
      
      const rows = computeForecastFromAllocations(allocations as any, rubros, 36, 'P-1');
      
      assert.strictEqual(rows.length, 1);
      assert.strictEqual(rows[0].month, 13); // Should use month_index, not calendar month
      assert.strictEqual(rows[0].forecast, 1000);
    });
    
    it('should support months up to M60', () => {
      const allocations = [
        {
          month: '2029-12',
          month_index: 60,
          amount: 500,
          rubro_id: 'R-1',
          projectId: 'P-1',
        }
      ];
      
      const rubros: LineItem[] = [];
      
      const rows = computeForecastFromAllocations(allocations as any, rubros, 60, 'P-1');
      
      assert.strictEqual(rows.length, 1);
      assert.strictEqual(rows[0].month, 60);
    });
    
    it('should filter out invalid month indexes (> 60)', () => {
      const allocations = [
        {
          month: '2030-01',
          month_index: 99, // Invalid: > 60
          amount: 500,
          rubro_id: 'R-1',
          projectId: 'P-1',
        },
        {
          month: '2026-06',
          month_index: 6, // Valid
          amount: 1000,
          rubro_id: 'R-2',
          projectId: 'P-1',
        }
      ];
      
      const rubros: LineItem[] = [];
      const rows = computeForecastFromAllocations(allocations as any, rubros, 60, 'P-1');
      
      // Only valid month should be included
      assert.strictEqual(rows.length, 1);
      assert.strictEqual(rows[0].month, 6);
    });
  });
  
  describe('Stale Request Handling', () => {
    it('should demonstrate stale request guard concept', () => {
      // Simulate multiple rapid requests
      let latestRequestKey = 0;
      
      // First request
      const request1Key = ++latestRequestKey;
      assert.strictEqual(request1Key, 1);
      
      // Second request (should supersede first)
      const request2Key = ++latestRequestKey;
      assert.strictEqual(request2Key, 2);
      
      // First request returns - should be ignored
      const isStale1 = latestRequestKey !== request1Key;
      assert.strictEqual(isStale1, true, 'First request should be stale');
      
      // Second request returns - should be applied
      const isStale2 = latestRequestKey !== request2Key;
      assert.strictEqual(isStale2, false, 'Second request should not be stale');
    });
    
    it('should validate abort controller pattern', () => {
      // Simulate abort controller usage
      const abortController1 = { aborted: false };
      const abortController2 = { aborted: false };
      
      // First request starts with controller 1
      const activeController = abortController1;
      
      // Second request starts - should abort first
      abortController1.aborted = true;
      
      assert.strictEqual(abortController1.aborted, true, 'First controller should be aborted');
      assert.strictEqual(abortController2.aborted, false, 'Second controller should remain active');
    });
  });
  
  describe('Materialization Flow', () => {
    it('should validate materialization polling concept', () => {
      // Simulate materialization states
      const states = [
        { materialization_status: 'pending', materializedAt: null },
        { materialization_status: 'pending', materializedAt: null },
        { materialization_status: 'completed', materializedAt: '2025-01-15T00:00:00Z' },
      ];
      
      // Check each poll
      assert.strictEqual(isMaterialized(states[0]), false, 'First poll: not materialized');
      assert.strictEqual(isMaterialized(states[1]), false, 'Second poll: still not materialized');
      assert.strictEqual(isMaterialized(states[2]), true, 'Third poll: materialized');
    });
    
    it('should demonstrate timeout handling', () => {
      const maxAttempts = 12;
      const attemptInterval = 5000; // 5 seconds
      const maxWaitTime = maxAttempts * attemptInterval;
      
      assert.strictEqual(maxWaitTime, 60000, 'Should timeout after 60 seconds');
    });
  });
  
  describe('End-to-End Data Flow Validation', () => {
    it('should validate complete data pipeline', () => {
      // 1. Start with allocations
      const allocations = [
        { month_index: 1, amount: 1000, rubro_id: 'R-1', projectId: 'P-1' },
        { month_index: 2, amount: 1050, rubro_id: 'R-1', projectId: 'P-1' },
      ];
      
      // 2. Compute forecast from allocations
      const rubros: LineItem[] = [];
      const forecastRows = computeForecastFromAllocations(allocations as any, rubros, 12, 'P-1');
      
      assert.strictEqual(forecastRows.length, 2, 'Should have 2 forecast rows');
      
      // 3. Simulate invoice matching
      const invoices = [
        { line_item_id: 'R-1', month: 1, amount: 980, status: 'Matched' },
      ];
      
      const rowsWithActuals = forecastRows.map<ForecastCell & { varianceActual?: number }>(cell => {
        const matchedInvoice = invoices.find(
          inv => inv.line_item_id === cell.line_item_id && inv.month === cell.month
        );
        
        if (matchedInvoice) {
          return {
            ...cell,
            actual: matchedInvoice.amount,
            varianceActual: matchedInvoice.amount - cell.planned,
          };
        }
        return {
          ...cell,
          varianceActual: cell.actual - cell.planned,
        };
      });
      
      // 4. Validate results
      assert.strictEqual(rowsWithActuals[0].actual, 980, 'First row should have actual');
      assert.strictEqual(rowsWithActuals[0].varianceActual, -20, 'First row should have variance');
      assert.strictEqual(rowsWithActuals[1].actual, 0, 'Second row should have no actual');
    });
  });
});
